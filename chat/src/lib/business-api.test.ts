/**
 * [INPUT]: 依赖 Bun test 与 business-api 暴露的轻量树资源 schema
 * [OUTPUT]: 覆盖 canvas 节点可穿过 Chat 业务 API 资源校验的回归测试
 * [POS]: lib 测试边界，锁定 Memo Tree 新节点类型不会在进入 Planner 投影前误触发 502
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { expect, test } from "bun:test";

import { memoTreeSchema } from "./business-api";

test("轻量树资源接受 canvas 节点", () => {
  const parsed = memoTreeSchema.parse([{
    id: "33333333-3333-4333-8333-333333333333",
    parent_id: null,
    node_type: "canvas",
    title: "研究画布",
    sort_order: 0,
    revision: 1,
    deleted_at: null,
    updated_at: "2026-08-24T00:00:00.000Z",
    children: [],
    memo: null,
  }]);

  expect(parsed[0]?.node_type).toBe("canvas");
});
