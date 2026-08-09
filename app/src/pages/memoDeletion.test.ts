/**
 * [INPUT]: 依赖 Bun test、MemoTreeNode fixtures 与 memoDeletion 纯编排函数
 * [OUTPUT]: 验证删除当前 Memo/祖先 Folder 的影响集合、下一 Memo 路由与无剩余 Memo 空态
 * [POS]: app/src/pages 的删除路由与 last-memo 清理决策回归测试，不执行网络或浏览器导航
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoTreeNode } from "../shared/api/memo";
import {
  getMemoDeletionImpact,
  getPostDeletionDestination,
} from "./memoDeletion";

const TIME = "2026-08-09T08:00:00.000Z";
const node = (
  id: string,
  type: "folder" | "memo",
  children: MemoTreeNode[] = [],
): MemoTreeNode => ({
  children,
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: type === "memo" ? {
    content_mdx: "尚未自动保存的正文",
    created_at: TIME,
    excerpt: "正文",
    metadata: {},
    node_id: id,
    updated_at: TIME,
    user_id: "user-1",
    word_count: 1,
  } : null,
  metadata: {},
  node_type: type,
  parent_id: null,
  sort_order: "1000",
  title: id,
  updated_at: TIME,
  user_id: "user-1",
});

describe("memo deletion orchestration", () => {
  test("marks the current memo affected when deleting its ancestor folder", () => {
    const tree = [node("folder", "folder", [node("current", "memo")])];
    const impact = getMemoDeletionImpact(tree, "folder", "current");

    expect(impact?.affectsCurrentMemo).toBe(true);
    expect([...impact!.affectedMemoIds]).toEqual(["current"]);
  });

  test("selects the next active memo or returns the /app empty state", () => {
    expect(getPostDeletionDestination([node("next", "memo")])).toEqual({
      memoId: "next",
      path: "/app/notes/next",
    });
    expect(getPostDeletionDestination([])).toEqual({
      memoId: null,
      path: "/app",
    });
  });
});
