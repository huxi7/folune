/**
 * [INPUT]: 依赖 Bun test、MemoTreeNode 与 memoTree 的不可变树算法
 * [OUTPUT]: 验证无限嵌套查找、同级排序、插入/移除/替换/更新、根与文件夹移动和后代防环
 * [POS]: app/src/shared/store 的领域算法回归测试，为 Zustand 乐观事务提供无浏览器的确定性底座
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoTreeNode } from "../api/memo";
import {
  findNode,
  findSiblings,
  insertNode,
  isDescendant,
  moveNodeInTree,
  removeNode,
  replaceNode,
  sortNodes,
  updateNode,
} from "./memoTree";

const TIME = "2026-08-08T00:00:00.000Z";

const makeNode = (
  id: string,
  type: "folder" | "memo",
  parentId: string | null,
  sortOrder: string,
  children: MemoTreeNode[] = [],
): MemoTreeNode => ({
  children,
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: type === "memo"
    ? {
        created_at: TIME,
        excerpt: id,
        metadata: {},
        node_id: id,
        updated_at: TIME,
        user_id: "user-1",
        word_count: 1,
      }
    : null,
  metadata: {},
  node_type: type,
  parent_id: parentId,
  revision: 1,
  sort_order: sortOrder,
  title: id,
  updated_at: TIME,
  user_id: "user-1",
});

const nestedTree = [
  makeNode("root-memo", "memo", null, "2000"),
  makeNode("root-folder", "folder", null, "1000", [
    makeNode("child-folder", "folder", "root-folder", "1000", [
      makeNode("deep-memo", "memo", "child-folder", "1000"),
    ]),
  ]),
];

describe("memoTree", () => {
  test("updateNode 只克隆祖先路径，未命中的兄弟子树保持原引用", () => {
    const untouchedSibling = nestedTree[0];
    const updated = updateNode(nestedTree, "deep-memo", (node) => ({
      ...node,
      title: "renamed",
    }));

    // 兄弟节点必须是同一个引用 —— 否则每次正文按键都会重建全树，
    // 树越大打字越卡（根因 5）
    expect(updated[0]).toBe(untouchedSibling);

    // 祖先路径必须是新对象，变更才能被 Zustand 订阅者看到
    const nextFolder = updated[1];
    const previousFolder = nestedTree[1];
    expect(nextFolder).not.toBe(previousFolder);
    expect(nextFolder?.children[0]).not.toBe(previousFolder?.children[0]);
    expect(nextFolder?.children[0]?.children[0]?.title).toBe("renamed");
  });

  test("updateNode 目标不存在时返回原数组引用", () => {
    expect(updateNode(nestedTree, "missing-id", (node) => node)).toBe(nestedTree);
  });

  test("finds nodes and siblings at arbitrary depth", () => {
    expect(findNode(nestedTree, "deep-memo")?.parent_id).toBe("child-folder");
    expect(findSiblings(nestedTree, "child-folder")?.map((node) => node.id)).toEqual([
      "deep-memo",
    ]);
  });

  test("sorts numeric string order and breaks ties by id", () => {
    const sorted = sortNodes([
      makeNode("b", "memo", null, "1000"),
      makeNode("c", "memo", null, "500"),
      makeNode("a", "memo", null, "1000"),
    ]);
    expect(sorted.map((node) => node.id)).toEqual(["c", "a", "b"]);
  });

  test("inserts, updates, replaces, and removes immutably", () => {
    const inserted = insertNode(
      nestedTree,
      makeNode("new-memo", "memo", null, "0"),
      "root-folder",
      "500",
    );
    const updated = updateNode(inserted, "new-memo", (node) => ({
      ...node,
      title: "renamed",
    }));
    const replacement = makeNode(
      "root-folder",
      "folder",
      null,
      "3000",
    );
    const replaced = replaceNode(updated, "root-folder", replacement, true);
    const removed = removeNode(replaced, "new-memo");

    expect(findNode(nestedTree, "new-memo")).toBeNull();
    expect(findNode(updated, "new-memo")?.title).toBe("renamed");
    expect(findNode(replaced, "root-folder")?.children.length).toBe(2);
    expect(findNode(removed, "new-memo")).toBeNull();
  });

  test("moves between nested folder and root while preserving subtree", () => {
    const inside = moveNodeInTree(
      nestedTree,
      "root-memo",
      "child-folder",
      "500",
    );
    const backToRoot = moveNodeInTree(
      inside,
      "root-memo",
      null,
      "3000",
    );

    expect(findNode(inside, "root-memo")?.parent_id).toBe("child-folder");
    expect(findSiblings(backToRoot, null)?.at(-1)?.id).toBe("root-memo");
    expect(findNode(backToRoot, "deep-memo")).not.toBeNull();
  });

  test("detects descendants and rejects cycles", () => {
    expect(isDescendant(nestedTree, "root-folder", "deep-memo")).toBe(true);
    const invalid = moveNodeInTree(
      nestedTree,
      "root-folder",
      "child-folder",
      "1000",
    );
    expect(findNode(invalid, "root-folder")?.parent_id).toBeNull();
  });
});
