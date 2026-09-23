/**
 * [INPUT]: 依赖 Bun test、src/testEnv 的公开占位配置、shared/api/ai 消息同步 client 与可替换 global fetch
 * [OUTPUT]: 覆盖首开 bootstrap、单会话 content 聚合读取与审批状态通过认证 PUT 原样同步到 thread messages 资源
 * [POS]: shared/api 的审批持久化 HTTP 契约回归测试，不访问真实 Supabase 或浏览器会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import "../../testEnv";

import type { AiMessage, FoluneUIMessage } from "./ai";

let syncAiMessages: (
  accessToken: string,
  threadId: string,
  messages: readonly FoluneUIMessage[],
) => Promise<AiMessage[]>;
let getAiThreadBootstrap: typeof import("./ai").getAiThreadBootstrap;
let getAiThreadContent: typeof import("./ai").getAiThreadContent;

const originalFetch = globalThis.fetch;

beforeAll(async () => {
  ({ getAiThreadBootstrap, getAiThreadContent, syncAiMessages } = await import("./ai"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AI messages API", () => {
  test("bootstrap 请求一次返回选中会话所需的恢复数据", async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        code: "ok",
        data: {
          messages: [{
            context_snapshot: {
              primary: {
                memo_id: "11111111-1111-4111-8111-111111111111",
                revision: 3,
                title: "当前",
              },
              references: [],
            },
            created_at: "2026-09-08T00:00:00Z",
            id: "assistant-1",
            parts: [],
            position: 0,
            role: "assistant",
            status: "complete",
            thread_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            updated_at: "2026-09-08T00:00:00Z",
            user_id: "11111111-1111-4111-8111-111111111111",
          }],
          selectedThread: null,
          threads: [],
        },
        message: "OK",
      });
    }) as typeof fetch;

    const bootstrap = await getAiThreadBootstrap("token", "thread/1");

    expect(request?.method).toBe("GET");
    expect(new URL(request?.url ?? "http://invalid").pathname).toBe("/ai-threads/bootstrap");
    expect(new URL(request?.url ?? "http://invalid").searchParams.get("selected_id")).toBe("thread/1");
    expect(request?.headers.get("Authorization")).toBe("Bearer token");
    expect(bootstrap.messages[0]?.metadata?.context_snapshot?.primary?.memo_id)
      .toBe("11111111-1111-4111-8111-111111111111");
  });

  test("PUT 持久化 approval-responded，刷新不会重新得到待确认状态", async () => {
    const messages: FoluneUIMessage[] = [{
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

  test("content 通过一条认证请求读取目标会话并恢复冻结上下文", async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        code: "ok",
        data: {
          messages: [{
            context_snapshot: {
              primary: {
                memo_id: "11111111-1111-4111-8111-111111111111",
                revision: 3,
                title: "当前",
              },
              references: [],
            },
            created_at: "2026-09-08T00:00:00Z",
            id: "assistant-1",
            parts: [],
            position: 0,
            role: "assistant",
            status: "complete",
            thread_id: "thread/1",
            updated_at: "2026-09-08T00:00:00Z",
            user_id: "11111111-1111-4111-8111-111111111111",
          }],
          selectedThread: { id: "thread/1", references: [], title: "目标会话" },
        },
        message: "OK",
      });
    }) as typeof fetch;

    const content = await getAiThreadContent("token", "thread/1");

    expect(request?.method).toBe("GET");
    expect(new URL(request?.url ?? "http://invalid").pathname)
      .toBe("/ai-threads/thread%2F1/content");
    expect(request?.headers.get("Authorization")).toBe("Bearer token");
    expect(content.messages[0]?.metadata?.context_snapshot?.primary?.title).toBe("当前");
  });
});
