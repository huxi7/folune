/**
 * [INPUT]: 依赖 Bun test 与 frozen-turn-context 纯解析策略
 * [OUTPUT]: 验证发送后页面切换不改变本轮 active/@refs，并锁定 V1 消息回退行为
 * [POS]: routes 消息级上下文回归测试，不启动 API、Mastra 或模型即可验证“不随页面漂移”的核心不变量
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { readFrozenTurnContext } from "./frozen-turn-context";

const SENT_MEMO = "11111111-1111-4111-8111-111111111111";
const SENT_REFERENCE = "22222222-2222-4222-8222-222222222222";
const CURRENT_PAGE_MEMO = "33333333-3333-4333-8333-333333333333";

describe("readFrozenTurnContext", () => {
  test("合法消息 metadata 优先于已经切换后的页面 memo", () => {
    expect(readFrozenTurnContext([
      {
        role: "user",
        metadata: {
          context: {
            active_memo_id: SENT_MEMO,
            reference_memo_ids: [SENT_REFERENCE],
            revisions: { [SENT_MEMO]: 7, [SENT_REFERENCE]: 3 },
          },
        },
      },
    ], CURRENT_PAGE_MEMO)).toEqual({
      active_memo_id: SENT_MEMO,
      reference_memo_ids: [SENT_REFERENCE],
      revisions: { [SENT_MEMO]: 7, [SENT_REFERENCE]: 3 },
    });
  });

  test("V1 消息没有 metadata 时才使用请求级 active memo", () => {
    expect(readFrozenTurnContext([
      { role: "user" },
    ], CURRENT_PAGE_MEMO)).toEqual({
      active_memo_id: CURRENT_PAGE_MEMO,
      reference_memo_ids: [],
      revisions: {},
    });
  });

  test("不借用更早轮次的 context", () => {
    expect(readFrozenTurnContext([
      {
        role: "user",
        metadata: {
          context: {
            active_memo_id: SENT_MEMO,
            reference_memo_ids: [SENT_REFERENCE],
          },
        },
      },
      { role: "assistant" },
      { role: "user", metadata: {} },
    ], CURRENT_PAGE_MEMO)).toEqual({
      active_memo_id: CURRENT_PAGE_MEMO,
      reference_memo_ids: [],
      revisions: {},
    });
  });
});
