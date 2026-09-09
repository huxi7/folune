/**
 * [INPUT]: 依赖 Bun test、createAuthenticatedChatFetch 与标准 Request/Response
 * [OUTPUT]: 验证增量消息/稳定 assistant 请求裁剪、每请求 Bearer 注入、缺失会话拒绝及扁平/嵌套错误信封 code 保留
 * [POS]: AgentPanel transport 回归边界，防止鉴权头或后端错误语义在 SDK 升级时静默丢失
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  ChatRequestError,
  createAuthenticatedChatFetch,
} from "./chatFetch";
import { prepareMemoChatRequest } from "./chatTransport";

describe("AgentPanel authenticated transport", () => {
  test("普通发送只携带最后一条消息，工具续写仍携带稳定 assistant", async () => {
    const first = prepareMemoChatRequest({
      threadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "旧" }] },
        { id: "u2", role: "user", parts: [{ type: "text", text: "新" }] },
      ],
      trigger: "submit-message",
    });
    expect(first.body.message).toMatchObject({ id: "u2" });
    expect(first.body.messages).toBeUndefined();

    const continued = prepareMemoChatRequest({
      threadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "旧" }] },
        { id: "assistant-1", role: "assistant", parts: [] },
      ],
      trigger: "submit-message",
      messageId: "assistant-1",
    });
    expect(continued.body.message).toMatchObject({ id: "assistant-1" });
    expect(continued.body.response_message_id).toBe("assistant-1");

    const regenerated = prepareMemoChatRequest({
      threadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      messages: [{
        id: "user-old",
        role: "user",
        parts: [{ type: "text", text: "旧问题" }],
        metadata: {
          context_snapshot: {
            primary: {
              memo_id: "11111111-1111-4111-8111-111111111111",
              revision: 7,
              title: "旧笔记",
            },
            references: [],
          },
        },
      }],
      trigger: "regenerate-message",
    });
    expect(regenerated.body.active_memo_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(regenerated.body.expected_revisions).toEqual({
      "11111111-1111-4111-8111-111111111111": 7,
    });
  });

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
