/**
 * [INPUT]: 依赖 Bun test、shared/api/ai 消息同步 client 与可替换 global fetch
 * [OUTPUT]: 覆盖审批状态通过认证 PUT 原样同步到 thread messages 资源
 * [POS]: shared/api 的审批持久化 HTTP 契约回归测试，不访问真实 Supabase 或浏览器会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import type { AiMessage, SuperNoteUIMessage } from "./ai";

let syncAiMessages: (
  accessToken: string,
  threadId: string,
  messages: readonly SuperNoteUIMessage[],
) => Promise<AiMessage[]>;

const originalFetch = globalThis.fetch;

beforeAll(async () => {
  process.env.VITE_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";
  ({ syncAiMessages } = await import("./ai"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AI messages API", () => {
  test("PUT 持久化 approval-responded，刷新不会重新得到待确认状态", async () => {
    const messages: SuperNoteUIMessage[] = [{
      id: "assistant-1",
      parts: [{
        approval: { approved: true, id: "approval-1" },
        input: { op: "delete" },
        state: "approval-responded",
        toolCallId: "tool-1",
        toolName: "edit_node",
        type: "dynamic-tool",
      }],
      role: "assistant",
    }];
    let request: Request | undefined;
    globalThis.fetch = (async (input, init) => {
      request = new Request(input, init);
      return Response.json({ code: "ok", data: [], message: "OK" });
    }) as typeof fetch;

    await syncAiMessages("token", "thread/1", messages);

    expect(request?.method).toBe("PUT");
    expect(new URL(request?.url ?? "http://invalid").pathname).toBe("/ai-threads/thread%2F1/messages");
    expect(request?.headers.get("Authorization")).toBe("Bearer token");
    expect(await request?.json()).toEqual(messages);
  });
});
