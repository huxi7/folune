/**
 * [INPUT]: 依赖 Bun test、MemoTreeNode fixtures 与 memoDeletion 纯编排函数
 * [OUTPUT]: 验证删除当前 Memo/祖先 Folder 的影响集合、删除正在打开的 Canvas 只需导航不需 flush、就近落点（同级后一篇 → 前一篇 → 上一层 → 才钻旁边文件夹，画布不作落点）与无剩余 Memo 空态
 * [POS]: app/src/pages 的删除路由与 last-memo 清理决策回归测试，不执行网络或浏览器导航
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoTreeNode } from "../shared/api/memo";
import { removeNode } from "../shared/store/memoTree";
import {
  getMemoDeletionImpact,
  getMemoTreeSlot,
  getPostDeletionDestination,
} from "./memoDeletion";

const TIME = "2026-08-09T08:00:00.000Z";
const node = (
  id: string,
  type: "canvas" | "folder" | "memo",
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
  revision: 1,
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
    expect(impact?.affectsCurrentRoute).toBe(true);
    expect([...impact!.affectedMemoIds]).toEqual(["current"]);
  });

  // 画布没有 autosave 会话可等: 若把它算作"当前 memo", 删除会卡在一个永远
  // 拿不到的编辑器引用上并静默失败, 但导航离开仍然必须发生。
  test("deleting the open canvas needs navigation but no autosave flush", () => {
    const tree = [node("canvas-1", "canvas"), node("memo-1", "memo")];
    const impact = getMemoDeletionImpact(tree, "canvas-1", "canvas-1");

    expect(impact?.affectsCurrentRoute).toBe(true);
    expect(impact?.affectsCurrentMemo).toBe(false);
    expect([...impact!.affectedMemoIds]).toEqual([]);
  });

  test("deleting a folder that holds the open canvas behaves the same", () => {
    const tree = [node("folder", "folder", [node("canvas-1", "canvas")])];
    const impact = getMemoDeletionImpact(tree, "folder", "canvas-1");

    expect(impact?.affectsCurrentRoute).toBe(true);
    expect(impact?.affectsCurrentMemo).toBe(false);
  });

  test("deleting an unrelated node touches neither route nor autosave", () => {
    const tree = [node("other", "memo"), node("current", "memo")];
    const impact = getMemoDeletionImpact(tree, "other", "current");

    expect(impact?.affectsCurrentRoute).toBe(false);
    expect(impact?.affectsCurrentMemo).toBe(false);
  });

  test("returns the /app empty state when no memo remains", () => {
    expect(getPostDeletionDestination([], null)).toEqual({
      memoId: null,
      path: "/app",
    });
    expect(getPostDeletionDestination([node("next", "memo")], null)).toEqual({
      memoId: "next",
      path: "/app/notes/next",
    });
  });
});

/* ========================================================================== */
/* 就近落点: 删完留在原地，而不是被甩回树顶                                    */
/* ========================================================================== */

// 按真实形状装配：子节点带 parent_id，同级 sort_order 递增
const tree = (spec: MemoTreeNode[], parentId: string | null = null): MemoTreeNode[] =>
  spec.map((item, index) => ({
    ...item,
    children: tree(item.children, item.id),
    parent_id: parentId,
    sort_order: String((index + 1) * 1000),
  }));

const destinationAfterRemoving = (nodes: MemoTreeNode[], nodeId: string) => {
  const slot = getMemoTreeSlot(nodes, nodeId);
  return getPostDeletionDestination(removeNode(nodes, nodeId), slot).memoId;
};

describe("post-deletion destination stays near the removed slot", () => {
  const library = tree([
    node("top", "memo"),
    node("folder-a", "folder", [
      node("a1", "memo"),
      node("a2", "memo"),
      node("a3", "memo"),
    ]),
    node("folder-b", "folder", [node("b1", "memo")]),
    node("bottom", "memo"),
  ]);

  test("prefers the next sibling inside the same folder, never the tree top", () => {
    expect(destinationAfterRemoving(library, "a2")).toBe("a3");
  });

  test("falls back to the previous sibling when the removed memo was last", () => {
    expect(destinationAfterRemoving(library, "a3")).toBe("a2");
  });

  test("climbs to the parent level before opening an unrelated folder", () => {
    // folder-b 可能是收起的：钻进去会撑开它，所以先落到上一层的同级笔记
    expect(destinationAfterRemoving(library, "b1")).toBe("bottom");
  });

  test("deleting a folder lands on the memo beside that folder", () => {
    expect(destinationAfterRemoving(library, "folder-a")).toBe("bottom");
  });

  test("only descends into sibling folders when the ancestor chain has no memo", () => {
    const nested = tree([
      node("folder-x", "folder", [node("x1", "memo"), node("x2", "memo")]),
      node("folder-y", "folder", [node("y1", "memo")]),
      node("folder-z", "folder", [node("z1", "memo")]),
    ]);

    expect(destinationAfterRemoving(nested, "y1")).toBe("z1");
    expect(destinationAfterRemoving(nested, "folder-z")).toBe("y1");
  });

  test("a canvas is never a destination", () => {
    const withCanvas = tree([
      node("folder", "folder", [
        node("current", "memo"),
        node("canvas-1", "canvas"),
        node("after", "memo"),
      ]),
    ]);

    expect(destinationAfterRemoving(withCanvas, "current")).toBe("after");
  });
});
