/**
 * [INPUT]: 依赖 Bun test、createAuthenticatedChatFetch 与标准 Request/Response
 * [OUTPUT]: 验证每请求 Bearer 注入、缺失会话拒绝及扁平/嵌套错误信封 code 保留
 * [POS]: AgentPanel transport 回归边界，防止鉴权头或后端错误语义在 SDK 升级时静默丢失
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  ChatRequestError,
  createAuthenticatedChatFetch,
} from "./chatFetch";

describe("AgentPanel authenticated transport", () => {
  test("injects the latest bearer token while preserving request headers", async () => {
    let capturedHeaders = new Headers();
    const chatFetch = createAuthenticatedChatFetch(
      async () => "fresh-access-token",
      async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response("ok");
      },
    );

    await chatFetch("http://localhost:10002/v1/chat", {
      headers: { "X-Request-Id": "request-1" },
    });

    expect(capturedHeaders.get("Authorization")).toBe(
      "Bearer fresh-access-token",
    );
    expect(capturedHeaders.get("X-Request-Id")).toBe("request-1");
  });

  test("rejects before sending when no authenticated session exists", async () => {
    let requestCount = 0;
    const chatFetch = createAuthenticatedChatFetch(
      async () => null,
      async () => {
        requestCount += 1;
        return new Response("unexpected");
      },
    );

    const error = await chatFetch("http://localhost:10002/v1/chat").catch(
      (caughtError: unknown) => caughtError,
    );

    expect(error).toBeInstanceOf(ChatRequestError);
    expect((error as ChatRequestError).code).toBe("UNAUTHORIZED");
    expect(requestCount).toBe(0);
  });

  test.each([
    [{ code: "UNAUTHORIZED", message: "expired" }, "UNAUTHORIZED"],
    [
      { error: { code: "INVALID_CHAT_REQUEST", message: "invalid" } },
      "INVALID_CHAT_REQUEST",
    ],
  ])("preserves backend error code from supported envelopes", async (body, code) => {
    const chatFetch = createAuthenticatedChatFetch(
      async () => "access-token",
      async () =>
        Response.json(body, {
          status: 401,
        }),
    );

    const error = await chatFetch("http://localhost:10002/v1/chat").catch(
      (caughtError: unknown) => caughtError,
    );

    expect(error).toBeInstanceOf(ChatRequestError);
    expect((error as ChatRequestError).code).toBe(code);
  });
});
