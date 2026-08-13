/**
 * [INPUT]: 依赖 Bun test、AI Run fixtures 与 aiRunTree 纯归并函数
 * [OUTPUT]: 覆盖整理新建目录/移动/改名与撤销移回/删除空目录，验证正文和 children 不丢失
 * [POS]: shared/store 的 AI 整理局部合并回归测试，不发网络请求且禁止整树刷新
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { AiRun } from "../api/ai";
import type { MemoNode, MemoTreeNode } from "../api/memo";
import { findNode } from "./memoTree";
import { reconcileAiRunTree } from "./aiRunTree";

const TIME = "2026-08-13T00:00:00Z";
const baseNode = (id: string, type: "folder" | "memo"): MemoTreeNode => ({
  id,
  user_id: "11111111-1111-4111-8111-111111111111",
  parent_id: null,
  node_type: type,
  title: id,
  sort_order: "1000",
  icon: null,
  color: null,
  metadata: {},
  revision: 1,
  deleted_at: null,
  deleted_root_id: null,
  created_at: TIME,
  updated_at: TIME,
  children: [],
  memo: type === "memo" ? {
    node_id: id,
    user_id: "11111111-1111-4111-8111-111111111111",
    content_mdx: "正文保留",
    excerpt: "正文保留",
    word_count: 4,
    metadata: {},
    created_at: TIME,
    updated_at: TIME,
  } : null,
});

const asNode = (node: MemoTreeNode): MemoNode => {
  const { children: _children, memo: _memo, ...plain } = node;
  return plain;
};

const runFixture = (status: AiRun["status"]): AiRun => ({
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "11111111-1111-4111-8111-111111111111",
  thread_id: null,
  memo_id: "memo",
  source_revision: 1,
  status,
  idempotency_key: "key",
  plan: null,
  result: null,
  error_code: null,
  created_at: TIME,
  updated_at: TIME,
  applied_at: TIME,
  undone_at: status === "undone" ? TIME : null,
});

describe("AI Run tree reconciliation", () => {
  test("局部插入新目录并移动改名，保留正文", () => {
    const memo = baseNode("memo", "memo");
    const folder = baseNode("folder", "folder");
    const run = runFixture("succeeded");
    run.result = {
      result_revision: 3,
      memo: { ...asNode(memo), parent_id: folder.id, title: "整理后", revision: 3 },
      created_folder: asNode(folder),
      target_path: "/folder/整理后",
    };
    const next = reconcileAiRunTree([memo], run);
    expect(findNode(next, "memo")?.title).toBe("整理后");
    expect(findNode(next, "memo")?.memo?.content_mdx).toBe("正文保留");
    expect(findNode(next, "folder")?.children[0]?.id).toBe("memo");
  });

  test("撤销移回原位并删除工作流创建的空目录", () => {
    const memo = baseNode("memo", "memo");
    const folder = { ...baseNode("folder", "folder"), children: [memo] };
    memo.parent_id = folder.id;
    const run = runFixture("undone");
    run.result = {
      result_revision: 3,
      memo: asNode(memo),
      created_folder: asNode(folder),
      target_path: "/folder/memo",
      undo: {
        memo: { ...asNode(memo), parent_id: null, revision: 4 },
        removed_folder_id: folder.id,
        folder_retained: false,
      },
    };
    const next = reconcileAiRunTree([folder], run);
    expect(findNode(next, "folder")).toBeNull();
    expect(next[0]?.id).toBe("memo");
    expect(next[0]?.memo?.content_mdx).toBe("正文保留");
  });
});
