/**
 * [INPUT]: 依赖 Bun test、chat-persistence 纯策略与最小 UIMessage/context fixtures
 * [OUTPUT]: 覆盖仅最后用户消息快照、assistant abort 状态及持久化最多重试一次
 * [POS]: routes 测试边界，锁定聊天落库生命周期而不启动 Mastra、模型或真实 Business API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import {
  attachCurrentContextSnapshot,
  markResponseStatus,
  persistWithOneRetry,
  responseStartChunk,
} from "./chat-persistence";

const messages: UIMessage[] = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "first" }] },
  { id: "a1", role: "assistant", parts: [{ type: "text", text: "answer" }] },
  { id: "u2", role: "user", parts: [{ type: "text", text: "second" }] },
];

const context = {
  primary: {
    memo_id: "11111111-1111-4111-8111-111111111111",
    title: "当前笔记",
    content_mdx: "正文不应进入 snapshot",
    path: "/当前笔记",
    revision: 7,
    updated_at: "2026-08-13T00:00:00Z",
    truncated: false,
  },
  references: [
    {
      memo_id: "22222222-2222-4222-8222-222222222222",
      title: "参考笔记",
      content_mdx: "参考正文",
      path: "/参考笔记",
      revision: 3,
      updated_at: "2026-08-13T00:00:00Z",
      truncated: false,
    },
  ],
  missing_reference_ids: [],
};

describe("chat persistence", () => {
  test("只给当前轮最后一条 user message 加不含正文的 snapshot", () => {
    const result = attachCurrentContextSnapshot(messages, context);
    expect(result[0]?.context_snapshot).toBeUndefined();
    expect(result[2]?.context_snapshot).toEqual({
      primary: {
        memo_id: context.primary.memo_id,
        title: "当前笔记",
        revision: 7,
      },
      references: [
        {
          memo_id: context.references[0]!.memo_id,
          title: "参考笔记",
          revision: 3,
        },
      ],
    });
    expect(JSON.stringify(result[2]?.context_snapshot)).not.toContain("正文");
  });

  test("中止只把当前 assistant 标记为 aborted", () => {
    const result = markResponseStatus([
      { ...messages[0]!, status: "error" } as UIMessage,
      ...messages.slice(1),
    ], "a1", true);
    expect(result.map((message) => message.status)).toEqual([
      "error",
      "aborted",
      "complete",
    ]);
  });

  test("向浏览器显式发送服务端稳定 assistant ID", () => {
    expect(responseStartChunk("msg_stable")).toEqual({
      type: "start",
      messageId: "msg_stable",
    });
  });

  test("失败时只安全重试一次", async () => {
    let attempts = 0;
    expect(
      await persistWithOneRetry(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("transient");
      }),
    ).toBe(true);
    expect(attempts).toBe(2);

    attempts = 0;
    expect(
      await persistWithOneRetry(async () => {
        attempts += 1;
        throw new Error("persistent");
      }),
    ).toBe(false);
    expect(attempts).toBe(2);
  });
});
