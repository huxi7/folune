/**
 * [INPUT]: 依赖可信 AuthUser、请求期 JWT、AI thread/message/reference DTO、AI repository 与 HttpError
 * [OUTPUT]: 对外提供并发读取详情的无归档会话 CRUD、聊天 turn 准备、增量消息同步/自动标题和会话级引用原子替换用例
 * [POS]: service 层 AI 会话业务边界；详情与引用都按 owner 过滤并并发读取，保证默认标题一次性生成、parts 保真与最多五篇去重引用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type {
  CreateAiThreadInput,
  PatchAiThreadInput,
  PrepareAiChatInput,
  SyncAiMessageInput,
} from "../dto/ai.dto.ts";
import { aiMessageContextSnapshotSchema } from "../dto/ai.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  AiMessage,
  AiThread,
  AiThreadReference,
  ResolvedAiContext,
} from "../model/ai.model.ts";
import { aiSettingsService } from "./ai-command.service.ts";
import { aiContextService } from "./ai-context.service.ts";
import { aiRepository } from "../repository/ai.repository.ts";

const DEFAULT_THREAD_TITLE = "新会话";
const AUTO_TITLE_MAX_CHARACTERS = 30;

type SyncMessagesOptions = {
  knownThread?: AiThread;
  returnAll?: boolean;
  awaitMetadata?: boolean;
  skipSnapshotLookup?: boolean;
  returnRepresentation?: boolean;
};

type MessageContextSnapshot = SyncAiMessageInput["context_snapshot"];

const readMessageSnapshot = (
  message: SyncAiMessageInput,
): { present: boolean; value: MessageContextSnapshot } => {
  if (message.context_snapshot !== undefined && message.context_snapshot !== null) {
    return { present: true, value: message.context_snapshot };
  }

  const metadata = (message as { metadata?: unknown }).metadata;
  if (metadata === null || typeof metadata !== "object") {
    return { present: false, value: undefined };
  }

  const parsed = aiMessageContextSnapshotSchema.safeParse(
    (metadata as Record<string, unknown>)["context_snapshot"],
  );
  return parsed.success
    ? { present: true, value: parsed.data }
    : { present: false, value: undefined };
};

const contextSnapshot = (
  context: ResolvedAiContext,
): NonNullable<MessageContextSnapshot> => ({
  primary: context.primary === null
    ? null
    : {
        memo_id: context.primary.memo_id,
        title: context.primary.title,
        revision: context.primary.revision,
      },
  references: context.references.map((reference) => ({
    memo_id: reference.memo_id,
    title: reference.title,
    revision: reference.revision,
  })),
});

const lastUserIndex = (messages: readonly SyncAiMessageInput[]): number => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return index;
  }
  return -1;
};

const mergeDeltaMessage = (
  messages: readonly AiMessage[],
  message: SyncAiMessageInput,
): SyncAiMessageInput[] => {
  const next: SyncAiMessageInput[] = messages.map(({ id, role, parts, status, context_snapshot }) => ({
    context_snapshot: context_snapshot ?? null,
    id,
    parts,
    role,
    status: status ?? "complete",
  }));
  const existingIndex = next.findIndex((candidate) => candidate.id === message.id);
  if (existingIndex >= 0) {
    next[existingIndex] = message;
    return next;
  }
  return [...next, message];
};

const prepareResponseMessages = (
  messages: readonly SyncAiMessageInput[],
  responseMessageId: string,
): SyncAiMessageInput[] => {
  const last = messages.at(-1);
  if (last?.role === "assistant" && last.id === responseMessageId) {
    return messages.map((message, index) => index === messages.length - 1
      ? { ...message, status: "in_progress" as const }
      : { ...message, status: message.status ?? "complete" as const });
  }

  return [
    ...messages.map((message) => ({
      ...message,
      status: message.status ?? "complete" as const,
    })),
    {
      id: responseMessageId,
      role: "assistant" as const,
      parts: [],
      status: "in_progress" as const,
      context_snapshot: null,
    },
  ];
};

const expectedResponseId = (input: PrepareAiChatInput): string => {
  const last = input.messages?.at(-1) ?? input.message;
  if (last === undefined) {
    throw new HttpError(400, "AI_RESPONSE_ID_INVALID", "Chat response message is missing");
  }
  const expected = last.role === "assistant" ? last.id : `msg_${last.id}`;
  if (input.response_message_id !== expected) {
    throw new HttpError(
      400,
      "AI_RESPONSE_ID_INVALID",
      "Chat response message id does not match the current turn",
    );
  }
  return expected;
};

const requireThread = async (
  authUser: AuthUser,
  accessToken: string,
  threadId: string,
): Promise<AiThread> => {
  const thread = await aiRepository.findThread(
    authUser.id,
    threadId,
    accessToken,
  );

  if (thread === null) {
    throw new HttpError(404, "AI_THREAD_NOT_FOUND", "AI thread was not found");
  }

  return thread;
};

const textFromPart = (part: unknown): string => {
  if (typeof part !== "object" || part === null) return "";
  const record = part as Record<string, unknown>;
  return record["type"] === "text" && typeof record["text"] === "string"
    ? record["text"]
    : "";
};

const firstUserTitle = (
  messages: readonly SyncAiMessageInput[],
): string | null => {
  const firstUser = messages.find((message) => message.role === "user");
  if (firstUser === undefined) return null;
  const normalized = firstUser.parts
    .map(textFromPart)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  if (normalized.length === 0) return null;
  return Array.from(normalized).slice(0, AUTO_TITLE_MAX_CHARACTERS).join("");
};

const createThread = async (
  authUser: AuthUser,
  accessToken: string,
  input: CreateAiThreadInput,
): Promise<AiThread> => {
  const created = await aiRepository.createThread(
    authUser.id,
    input.title ?? DEFAULT_THREAD_TITLE,
    accessToken,
  );
  if (created === null) {
    throw new HttpError(
      502,
      "AI_THREAD_CREATE_FAILED",
      "AI thread was not available after creation",
    );
  }
  return created;
};

const syncMessages = async (
  authUser: AuthUser,
  accessToken: string,
  threadId: string,
  messages: readonly SyncAiMessageInput[],
  options: SyncMessagesOptions = {},
): Promise<AiMessage[]> => {
  const thread = options.knownThread
    ?? await requireThread(authUser, accessToken, threadId);
  // Chat 请求通常已经带着 snapshot；只有旧/不完整调用缺少用户 snapshot 时，
  // 才回读已有消息做兼容合并。
  const needsSnapshotLookup = !options.skipSnapshotLookup && messages.some(
    (message) => message.role === "user" && !readMessageSnapshot(message).present,
  );
  const existingMessages = needsSnapshotLookup
    ? await aiRepository.listMessages(authUser.id, threadId, accessToken)
    : [];
  const existingById = new Map(
    existingMessages.map((message) => [message.id, message]),
  );
  const messagesWithStableSnapshots = messages.map((message) => {
    const supplied = readMessageSnapshot(message);
    return {
      ...message,
      context_snapshot: supplied.present
        ? supplied.value
        : existingById.get(message.id)?.context_snapshot ?? null,
    };
  });
  const synced = await aiRepository.upsertMessages(
    authUser.id,
    threadId,
    messagesWithStableSnapshots,
    accessToken,
    { returnRepresentation: options.returnRepresentation },
  );
  const autoTitle =
    thread.title === DEFAULT_THREAD_TITLE ? firstUserTitle(messages) : null;

  const metadata = (async () => {
    if (autoTitle !== null) {
      await aiRepository.updateDefaultTitle(
        authUser.id,
        threadId,
        autoTitle,
        accessToken,
      );
    }
    if (messages.length > 0) {
      const newest = synced.reduce<string | null>(
        (latest, message) =>
          latest === null || message.updated_at > latest
            ? message.updated_at
            : latest,
        null,
      );
      await aiRepository.updateThread(
        authUser.id,
        threadId,
        { last_message_at: newest ?? new Date().toISOString() },
        accessToken,
      );
    }
  })();
  if (options.awaitMetadata !== false) await metadata;
  else void metadata.catch(() => undefined);

  return options.returnAll === false
    ? synced
    : aiRepository.listMessages(authUser.id, threadId, accessToken);
};

const syncMessage = async (
  authUser: AuthUser,
  accessToken: string,
  threadId: string,
  messageId: string,
  message: SyncAiMessageInput,
): Promise<{ id: string; updated_at: string }> => {
  const updated = await aiRepository.updateMessage(
    authUser.id,
    threadId,
    messageId,
    {
      context_snapshot: message.context_snapshot,
      parts: message.parts,
      status: message.status ?? "complete",
    },
    accessToken,
  );
  if (updated === null) {
    throw new HttpError(404, "AI_MESSAGE_NOT_FOUND", "AI message was not found");
  }
  // 活跃时间只服务历史排序；消息行落稳后不再让它阻塞流的最后一帧。
  void aiRepository.updateThread(
    authUser.id,
    threadId,
    { last_message_at: updated.updated_at },
    accessToken,
  ).catch(() => undefined);
  return updated;
};

const persistPreparedDelta = async (
  authUser: AuthUser,
  accessToken: string,
  thread: AiThread,
  existingMessages: readonly AiMessage[],
  incoming: SyncAiMessageInput,
  preparedMessages: readonly SyncAiMessageInput[],
): Promise<void> => {
  const existingIndex = existingMessages.findIndex((message) => message.id === incoming.id);
  const incomingWithSnapshot = preparedMessages.find((message) => message.id === incoming.id)
    ?? incoming;
  const assistant = preparedMessages.at(-1);
  const assistantExists = assistant !== undefined
    && existingMessages.some((message) => message.id === assistant.id);

  if (existingIndex >= 0) {
    await aiRepository.updateMessage(
      authUser.id,
      thread.id,
      incoming.id,
      {
        context_snapshot: incomingWithSnapshot.context_snapshot ?? null,
        parts: incomingWithSnapshot.parts,
        status: incomingWithSnapshot.status ?? "complete",
      },
      accessToken,
    );
    if (assistant?.role === "assistant" && assistant.id !== incoming.id) {
      if (assistantExists) {
        await aiRepository.updateMessage(
          authUser.id,
          thread.id,
          assistant.id,
          {
            context_snapshot: assistant.context_snapshot ?? null,
            parts: assistant.parts,
            status: assistant.status ?? "in_progress",
          },
          accessToken,
        );
      } else {
        await aiRepository.upsertMessagesAt(
          authUser.id,
          thread.id,
          [{ message: assistant, position: existingMessages.length }],
          accessToken,
          { returnRepresentation: false },
        );
      }
    }
  } else {
    const delta = [
      { message: incomingWithSnapshot, position: existingMessages.length },
      ...(assistant?.role === "assistant" && assistant.id !== incoming.id
        ? [{ message: assistant, position: existingMessages.length + 1 }]
        : []),
    ];
    await aiRepository.upsertMessagesAt(
      authUser.id,
      thread.id,
      delta,
      accessToken,
      { returnRepresentation: false },
    );
  }

  const autoTitle = thread.title === DEFAULT_THREAD_TITLE
    ? firstUserTitle(preparedMessages)
    : null;
  void (async () => {
    if (autoTitle !== null) {
      await aiRepository.updateDefaultTitle(
        authUser.id,
        thread.id,
        autoTitle,
        accessToken,
      );
    }
    await aiRepository.updateThread(
      authUser.id,
      thread.id,
      { last_message_at: new Date().toISOString() },
      accessToken,
    );
  })().catch(() => undefined);
};

const prepareChatTurn = async (
  authUser: AuthUser,
  accessToken: string,
  input: PrepareAiChatInput,
) => {
  expectedResponseId(input);
  const threadPromise = aiRepository.findThread(
    authUser.id,
    input.thread_id,
    accessToken,
  );
  const historyPromise = input.messages === undefined
    ? aiRepository.listMessages(authUser.id, input.thread_id, accessToken)
    : Promise.resolve<AiMessage[]>([]);
  // 权限与 thread 校验彼此独立；先与 context/history 一起启动，关键路径只汇合一次。
  const settingsPromise = aiSettingsService.get(authUser, accessToken);
  const contextPromise = aiContextService.resolveForThread(
    authUser,
    accessToken,
    {
      thread_id: input.thread_id,
      active_memo_id: input.active_memo_id,
      reference_memo_ids: input.reference_memo_ids,
      expected_revisions: input.expected_revisions,
      include_thread_references: input.include_thread_references,
    },
  );

  const [thread, settings, resolvedContext] = await Promise.all([
    threadPromise,
    settingsPromise,
    contextPromise,
  ]);
  if (thread === null) {
    throw new HttpError(404, "AI_THREAD_NOT_FOUND", "AI thread was not found");
  }

  const existingHistory = await historyPromise;
  const sourceMessages = input.messages !== undefined
    ? input.messages
    : mergeDeltaMessage(existingHistory, input.message!);
  const snapshot = contextSnapshot(resolvedContext);
  const userIndex = lastUserIndex(sourceMessages);
  const withSnapshot = sourceMessages.map((message, index) =>
    index === userIndex
      ? { ...message, context_snapshot: snapshot }
      : message,
  );
  const preparedMessages = prepareResponseMessages(
    withSnapshot,
    input.response_message_id,
  );

  if (input.message !== undefined) {
    await persistPreparedDelta(
      authUser,
      accessToken,
      thread,
      existingHistory,
      input.message,
      preparedMessages,
    );
  } else {
    await syncMessages(
      authUser,
      accessToken,
      input.thread_id,
      preparedMessages,
      {
        awaitMetadata: false,
        knownThread: thread,
        returnAll: false,
        returnRepresentation: false,
        skipSnapshotLookup: true,
      },
    );
  }

  return {
    context: resolvedContext,
    messages: preparedMessages,
    permission_mode: settings.permission_mode,
    response_message_id: input.response_message_id,
  };
};

const replaceReferences = async (
  authUser: AuthUser,
  accessToken: string,
  threadId: string,
  memoIds: readonly string[],
): Promise<AiThreadReference[]> => {
  await requireThread(authUser, accessToken, threadId);
  const uniqueIds = [...new Set(memoIds)];
  if (uniqueIds.length > 5) {
    throw new HttpError(
      400,
      "AI_REFERENCE_LIMIT_EXCEEDED",
      "An AI thread can reference at most five memos",
    );
  }
  return aiRepository.replaceReferences(
    authUser.id,
    threadId,
    uniqueIds,
    accessToken,
  );
};

const getThread = async (
  authUser: AuthUser,
  accessToken: string,
  threadId: string,
) => {
  const [thread, references] = await Promise.all([
    requireThread(authUser, accessToken, threadId),
    aiRepository.listReferences(authUser.id, threadId, accessToken),
  ]);
  return { ...thread, references };
};

const bootstrap = async (
  authUser: AuthUser,
  accessToken: string,
  preferredThreadId: string | null,
) => {
  const threads = await aiRepository.listThreads(authUser.id, accessToken);
  if (threads.length === 0) {
    return { messages: [], selectedThread: null, threads };
  }

  const selectedThreadId = preferredThreadId !== null
    && threads.some((thread) => thread.id === preferredThreadId)
    ? preferredThreadId
    : threads[0]!.id;
  const [selectedThread, messages] = await Promise.all([
    getThread(authUser, accessToken, selectedThreadId),
    aiRepository.listMessages(authUser.id, selectedThreadId, accessToken),
  ]);
  return { messages, selectedThread, threads };
};

export const aiThreadService = {
  createThread,

  listThreads(
    authUser: AuthUser,
    accessToken: string,
  ): Promise<AiThread[]> {
    return aiRepository.listThreads(authUser.id, accessToken);
  },

  bootstrap,

  getThread,

  async updateThread(
    authUser: AuthUser,
    accessToken: string,
    threadId: string,
    input: PatchAiThreadInput,
  ): Promise<AiThread> {
    await requireThread(authUser, accessToken, threadId);
    const updated = await aiRepository.updateThread(
      authUser.id,
      threadId,
      input,
      accessToken,
    );
    if (updated === null) {
      throw new HttpError(404, "AI_THREAD_NOT_FOUND", "AI thread was not found");
    }
    return updated;
  },

  async deleteThread(
    authUser: AuthUser,
    accessToken: string,
    threadId: string,
  ): Promise<{ id: string; deleted: true }> {
    await requireThread(authUser, accessToken, threadId);
    const deleted = await aiRepository.deleteThread(
      authUser.id,
      threadId,
      accessToken,
    );
    if (deleted === null) {
      throw new HttpError(404, "AI_THREAD_NOT_FOUND", "AI thread was not found");
    }
    return { id: deleted.id, deleted: true };
  },

  async listMessages(
    authUser: AuthUser,
    accessToken: string,
    threadId: string,
  ): Promise<AiMessage[]> {
    await requireThread(authUser, accessToken, threadId);
    return aiRepository.listMessages(authUser.id, threadId, accessToken);
  },

  syncMessages,
  syncMessage,
  prepareChatTurn,
  replaceReferences,
};
