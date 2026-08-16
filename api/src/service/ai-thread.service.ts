/**
 * [INPUT]: 依赖可信 AuthUser、请求期 JWT、AI thread/message/reference DTO、AI repository 与 HttpError
 * [OUTPUT]: 对外提供无归档分支的会话 CRUD、完整消息幂等同步/自动标题和会话级引用原子替换用例
 * [POS]: service 层 AI 会话业务边界，保证 owner、默认标题一次性生成、parts 保真与最多五篇去重引用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type {
  CreateAiThreadInput,
  PatchAiThreadInput,
  SyncAiMessageInput,
} from "../dto/ai.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  AiMessage,
  AiThread,
  AiThreadReference,
} from "../model/ai.model.ts";
import { aiRepository } from "../repository/ai.repository.ts";

const DEFAULT_THREAD_TITLE = "新会话";
const AUTO_TITLE_MAX_CHARACTERS = 30;

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
): Promise<AiMessage[]> => {
  const thread = await requireThread(authUser, accessToken, threadId);
  const existingMessages = await aiRepository.listMessages(
    authUser.id,
    threadId,
    accessToken,
  );
  const existingById = new Map(
    existingMessages.map((message) => [message.id, message]),
  );
  const messagesWithStableSnapshots = messages.map((message) => ({
    ...message,
    context_snapshot:
      message.context_snapshot ??
      existingById.get(message.id)?.context_snapshot ??
      null,
  }));
  const synced = await aiRepository.upsertMessages(
    authUser.id,
    threadId,
    messagesWithStableSnapshots,
    accessToken,
  );
  const autoTitle =
    thread.title === DEFAULT_THREAD_TITLE ? firstUserTitle(messages) : null;

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

  return aiRepository.listMessages(authUser.id, threadId, accessToken);
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

export const aiThreadService = {
  createThread,

  listThreads(
    authUser: AuthUser,
    accessToken: string,
  ): Promise<AiThread[]> {
    return aiRepository.listThreads(authUser.id, accessToken);
  },

  async getThread(authUser: AuthUser, accessToken: string, threadId: string) {
    const thread = await requireThread(authUser, accessToken, threadId);
    const references = await aiRepository.listReferences(
      authUser.id,
      threadId,
      accessToken,
    );
    return { ...thread, references };
  },

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
  replaceReferences,
};
