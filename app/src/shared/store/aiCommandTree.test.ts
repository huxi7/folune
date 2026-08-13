/**
 * [INPUT]: 依赖 Bun test、AiCommand/MemoTreeNode fixtures 与 reconcileAiCommandTree
 * [OUTPUT]: 覆盖命令创建、改名、软删除、stale 不变和撤销恢复的 active tree 幂等归并语义
 * [POS]: shared/store 的 AI Native V2 命令对账回归测试，保护服务端写入后局部刷新而非整树 refetch
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { AiCommand } from "../api/ai";
import type { MemoTreeNode } from "../api/memo";
import { reconcileAiCommandTree } from "./aiCommandTree";

const NOW = "2026-08-13T08:00:00.000Z";
const node = (id: string, title = "旧标题"): MemoTreeNode => ({
  id,
  user_id: "11111111-1111-4111-8111-111111111111",
  parent_id: null,
  node_type: "memo",
  title,
  sort_order: "1000",
  icon: null,
  color: null,
  metadata: {},
  revision: 1,
  deleted_at: null,
  deleted_root_id: null,
  created_at: NOW,
  updated_at: NOW,
  children: [],
  memo: {
    node_id: id,
    user_id: "11111111-1111-4111-8111-111111111111",
    content_mdx: "正文",
    excerpt: "正文",
    word_count: 2,
    metadata: {},
    created_at: NOW,
    updated_at: NOW,
  },
});

const command = (overrides: Partial<AiCommand>): AiCommand => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  thread_id: null,
  tool_call_id: "tool-1",
  operation: "rename_node",
  target_node_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expected_revision: 1,
  idempotency_key: "once",
  input: {},
  before_state: null,
  after_state: null,
  undo_result: null,
  status: "succeeded",
  approval_source: "approval_agent",
  risk: "low",
  approval_reason: "明确",
  error_code: null,
  updated_at: NOW,
  applied_at: NOW,
  undone_at: null,
  ...overrides,
});

describe("AI command tree reconciliation", () => {
  test("merges server node facts and removes trashed subtrees", () => {
    const original = node("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    const renamed = { ...original, title: "新标题", revision: 2 };
    const updated = reconcileAiCommandTree([original], command({
      after_state: { node: renamed },
    }));
    expect(updated[0]?.title).toBe("新标题");
    expect(updated[0]?.revision).toBe(2);
    expect(reconcileAiCommandTree(updated, command({
      operation: "trash_node",
      after_state: { node: renamed },
    }))).toEqual([]);
  });

  test("does not change tree for stale commands", () => {
    const original = node("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(reconcileAiCommandTree([original], command({ status: "stale" }))).toEqual([original]);
  });

  test("undo can remove a created node or restore a server node", () => {
    const created = node("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "新笔记");
    expect(reconcileAiCommandTree([created], command({
      operation: "create_node",
      status: "undone",
      target_node_id: created.id,
      undo_result: { removed_node_id: created.id },
    }))).toEqual([]);
    const restored = { ...created, title: "恢复标题", revision: 3 };
    expect(reconcileAiCommandTree([], command({
      status: "undone",
      target_node_id: restored.id,
      undo_result: { node: restored },
    }))[0]?.title).toBe("恢复标题");
  });
});
