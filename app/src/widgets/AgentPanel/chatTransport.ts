/**
 * [INPUT]: 依赖 AI SDK DefaultChatTransport、shared/supabase/auth 的请求期 token 读取、chatFetch 鉴权策略与 VITE_CHAT_BASE_URL
 * [OUTPUT]: 对外提供指向 /v1/chat 且逐请求读取最新 Supabase token 的 memoChatTransport
 * [POS]: AgentPanel 的 AI SDK 装配边界；绑定具体会话来源与端点，不承载错误解析或消息状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { DefaultChatTransport } from "ai";

import { getAuthenticatedAccessToken } from "../../shared/supabase/auth";
import { createAuthenticatedChatFetch } from "./chatFetch";

const DEFAULT_CHAT_BASE_URL = "http://localhost:10002";

function getChatApiUrl() {
  const configuredBaseUrl = import.meta.env.VITE_CHAT_BASE_URL?.trim();
  const baseUrl = configuredBaseUrl || DEFAULT_CHAT_BASE_URL;

  try {
    return new URL("/v1/chat", `${baseUrl.replace(/\/$/u, "")}/`).toString();
  } catch {
    throw new Error("VITE_CHAT_BASE_URL 必须是合法的绝对 URL。");
  }
}

const authenticatedChatFetch = Object.assign(
  createAuthenticatedChatFetch(getAuthenticatedAccessToken, globalThis.fetch),
  { preconnect: globalThis.fetch.preconnect },
);

export const memoChatTransport = new DefaultChatTransport({
  api: getChatApiUrl(),
  fetch: authenticatedChatFetch,
});
