/**
 * [INPUT]: 依赖 AI SDK DefaultChatTransport、SuperNoteUIMessage、shared/supabase/auth token 与 chatFetch
 * [OUTPUT]: 对外提供 createMemoChatTransport，以及 organize/canvas-expand 的统一鉴权 URL/Fetch 边界
 * [POS]: AgentPanel 的 AI SDK 会话传输工厂；稳定绑定一个 thread，当前页面 memo 不再作为动态请求状态进入工具续写
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { DefaultChatTransport, type UIMessage } from "ai";

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

export const createMemoChatTransport = (
  threadId: string,
) => new DefaultChatTransport<SuperNoteUIMessage>({
  api: chatApiUrl("/v1/chat"),
  fetch: authenticatedChatFetch,
  prepareSendMessagesRequest: ({ messages, trigger, messageId, body }) => ({
    body: {
      ...body,
      thread_id: threadId,
      messages,
      trigger,
      ...(messageId === undefined ? {} : { messageId }),
    },
  }),
});

export const getOrganizeApiUrl = (): string => chatApiUrl("/v1/organize");
export const getCanvasExpandApiUrl = (): string => chatApiUrl("/v1/canvas-expand");
export const authenticatedAgentFetch = authenticatedChatFetch;
