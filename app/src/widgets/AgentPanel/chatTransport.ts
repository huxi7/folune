/**
 * [INPUT]: 依赖 AI SDK DefaultChatTransport、SuperNoteUIMessage、shared/supabase/auth token 与 chatFetch
 * [OUTPUT]: 对外提供 createMemoChatTransport，以及 organize/canvas-expand 的统一鉴权 URL/Fetch 边界；普通发送只传增量消息
 * [POS]: AgentPanel 的 AI SDK 会话传输工厂；稳定绑定一个 thread，当前页面 memo 不再作为动态请求状态进入工具续写
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { DefaultChatTransport } from "ai";

import type { SuperNoteUIMessage } from "../../shared/api/ai";
import { getAuthenticatedAccessToken } from "../../shared/supabase/auth";
import { createAuthenticatedChatFetch } from "./chatFetch";

const DEFAULT_CHAT_BASE_URL = "http://localhost:10002";

const chatApiUrl = (path: string): string => {
  const configuredBaseUrl = import.meta.env.VITE_CHAT_BASE_URL?.trim();
  const baseUrl = configuredBaseUrl || DEFAULT_CHAT_BASE_URL;

  try {
    return new URL(path, `${baseUrl.replace(/\/$/u, "")}/`).toString();
  } catch {
    throw new Error("VITE_CHAT_BASE_URL 必须是合法的绝对 URL。");
  }
};

const authenticatedChatFetch = Object.assign(
  createAuthenticatedChatFetch(getAuthenticatedAccessToken, globalThis.fetch),
  { preconnect: globalThis.fetch.preconnect },
);

type MemoChatRequestInput = {
  body?: Record<string, unknown>;
  messageId?: string;
  messages: SuperNoteUIMessage[];
  trigger: "submit-message" | "regenerate-message";
};

/**
 * 把 AI SDK 的本地消息状态转换成 Chat wire body；普通发送只取增量，
 * 重新生成保留完整列表以维护截断语义。
 */
export const prepareMemoChatRequest = ({
  body,
  messageId,
  messages,
  threadId,
  trigger,
}: MemoChatRequestInput & { threadId: string }): { body: Record<string, unknown> } => {
  const lastMessage = messages.at(-1);
  if (lastMessage === undefined) {
    throw new Error("Chat message list must not be empty.");
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const persistedSnapshot = lastUserMessage?.metadata?.context_snapshot;
  const frozen = lastUserMessage?.metadata?.context
    ?? (persistedSnapshot === undefined || persistedSnapshot === null
      ? undefined
      : {
          active_memo_id: persistedSnapshot.primary?.memo_id ?? null,
          reference_memo_ids: persistedSnapshot.references.map(
            (reference) => reference.memo_id,
          ),
          revisions: Object.fromEntries([
            ...(persistedSnapshot.primary === null
              ? []
              : [[
                  persistedSnapshot.primary.memo_id,
                  persistedSnapshot.primary.revision,
                ]]),
            ...persistedSnapshot.references.map((reference) => [
              reference.memo_id,
              reference.revision,
            ]),
          ]),
        });
  const responseMessageId = lastMessage.role === "assistant"
    ? lastMessage.id
    : `msg_${lastMessage.id}`;
  const contextBody = frozen === undefined
    ? {}
    : {
        active_memo_id: frozen.active_memo_id,
        expected_revisions: frozen.revisions,
        reference_memo_ids: frozen.reference_memo_ids,
      };

  return {
    body: {
      ...body,
      ...contextBody,
      response_message_id: responseMessageId,
      thread_id: threadId,
      trigger,
      ...(messageId === undefined ? {} : { messageId }),
      ...(trigger === "regenerate-message"
        ? { messages }
        : { message: lastMessage }),
    },
  };
};

export const createMemoChatTransport = (
  threadId: string,
) => new DefaultChatTransport<SuperNoteUIMessage>({
  api: chatApiUrl("/v1/chat"),
  fetch: authenticatedChatFetch,
  prepareSendMessagesRequest: (input) => prepareMemoChatRequest({ ...input, threadId }),
});

export const getOrganizeApiUrl = (): string => chatApiUrl("/v1/organize");
export const getCanvasExpandApiUrl = (): string => chatApiUrl("/v1/canvas-expand");
export const authenticatedAgentFetch = authenticatedChatFetch;
