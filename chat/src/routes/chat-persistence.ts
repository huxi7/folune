/**
 * [INPUT]: 依赖 AI SDK UIMessage、Business API ResolvedContext 与可注入消息同步函数
 * [OUTPUT]: 对外提供当前用户消息 snapshot 合并、同轮 assistant ID/parts 续写、完成/中止状态标记及一次安全重试的持久化 helper
 * [POS]: routes 层聊天持久化纯策略，将初次生成与工具/审批续写收敛到同一 assistant 记录，不接触 JWT 获取、日志或模型
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { UIMessage } from "ai";

import type { ResolvedContext } from "@/lib/business-api";

type PersistableMessage = UIMessage & {
  status?: "in_progress" | "complete" | "aborted" | "error";
  context_snapshot?: {
    primary: { memo_id: string; title: string; revision: number } | null;
    references: Array<{ memo_id: string; title: string; revision: number }>;
  } | null;
};

const persistedStatus = (
  message: UIMessage,
): PersistableMessage["status"] => {
  const status = (message as { status?: unknown }).status;
  return status === "in_progress" ||
      status === "complete" ||
      status === "aborted" ||
      status === "error"
    ? status
    : "complete";
};

const snapshotFromContext = (context: ResolvedContext) => ({
  primary:
    context.primary === null
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

export const attachCurrentContextSnapshot = (
  messages: readonly UIMessage[],
  context: ResolvedContext,
): PersistableMessage[] => {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      lastUserIndex = index;
      break;
    }
  }

  return messages.map((message, index) => ({
    ...message,
    status: "complete",
    ...(index === lastUserIndex
      ? { context_snapshot: snapshotFromContext(context) }
      : {}),
  }));
};

export const responseStartChunk = (messageId: string) => ({
  type: "start" as const,
  messageId,
});

export const responseMessageId = (
  messages: readonly UIMessage[],
  generateId: () => string,
): string => {
  const lastMessage = messages.at(-1);
  return lastMessage?.role === "assistant" ? lastMessage.id : generateId();
};

export const prepareResponseMessages = (
  messages: readonly PersistableMessage[],
  messageId: string,
): PersistableMessage[] => {
  const lastMessage = messages.at(-1);
  if (lastMessage?.role === "assistant" && lastMessage.id === messageId) {
    return messages.map((message, index) => index === messages.length - 1
      ? { ...message, status: "in_progress" }
      : message);
  }
  return [
    ...messages,
    {
      id: messageId,
      role: "assistant",
      parts: [],
      status: "in_progress",
    },
  ];
};

export const markResponseStatus = (
  messages: readonly UIMessage[],
  responseMessageId: string,
  isAborted: boolean,
): PersistableMessage[] =>
  messages.map((message) => ({
    ...message,
    status:
      message.id === responseMessageId && isAborted
        ? "aborted"
        : message.id === responseMessageId
          ? "complete"
          : persistedStatus(message),
  }));

export const markResponseError = (
  messages: readonly UIMessage[],
  responseMessageId: string,
): PersistableMessage[] => messages.map((message) => ({
  ...message,
  status: message.id === responseMessageId ? "error" : persistedStatus(message),
}));

export const persistWithOneRetry = async (
  persist: () => Promise<unknown>,
): Promise<boolean> => {
  try {
    await persist();
    return true;
  } catch {
    try {
      await persist();
      return true;
    } catch {
      return false;
    }
  }
};
