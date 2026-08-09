/**
 * [INPUT]: 依赖 Bun test、snake_case MemoTreeNode 与 memoLibrary 路径/搜索/四类拖拽计划
 * [OUTPUT]: 验证无限嵌套检索、folder 首位放入、根级末尾移动、混合排序及自己/后代防环
 * [POS]: app/src/widgets 的拖拽视图模型回归测试，不访问浏览器、Supabase、Store 或远端 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type {
  MemoContent,
  MemoNode,
  MemoTreeNode,
} from "../shared/api/memo";
import {
  createMemoMovePlan,
  findFirstMemoId,
  findMemoNode,
  getAncestorFolderIds,
  getMemoFolderPath,
  replaceNodeInMemoTree,
  searchMemoTree,
  updateNodeInMemoTree,
} from "./memoLibrary";

const TIMESTAMP = "2026-08-05T00:00:00.000Z";

function content(nodeId: string, contentMdx: string): MemoContent {
  return {
    content_mdx: contentMdx,
    created_at: TIMESTAMP,
    excerpt: contentMdx,
    metadata: {},
    node_id: nodeId,
    updated_at: TIMESTAMP,
    user_id: "user-1",
    word_count: contentMdx.length,
  };
}

function node(
  id: string,
  title: string,
  nodeType: "folder" | "memo",
  parentId: string | null,
  sortOrder: number,
  children: MemoTreeNode[] = [],
  contentMdx = "",
): MemoTreeNode {
  return {
    children,
    color: null,
    created_at: TIMESTAMP,
    deleted_at: null,
    deleted_root_id: null,
    icon: null,
    id,
    memo: nodeType === "memo" ? content(id, contentMdx) : null,
    metadata: {},
    node_type: nodeType,
    parent_id: parentId,
    sort_order: String(sortOrder),
    title,
    updated_at: TIMESTAMP,
    user_id: "user-1",
  };
}

const nestedMemo = node(
  "memo-nested",
  "会议记录",
  "memo",
  "folder-child",
  1000,
  [],
  "后端树正文",
);
const tree: MemoTreeNode[] = [
  node(
    "folder-root",
    "工作",
    "folder",
    null,
    1000,
    [
      node(
        "folder-child",
        "项目 A",
        "folder",
        "folder-root",
        1000,
        [nestedMemo],
      ),
    ],
  ),
  node("memo-root", "根目录笔记", "memo", null, 2000, [], "根内容"),
];

describe("memo tree view model", () => {
  test("finds nested nodes and the first memo deterministically", () => {
    expect(findMemoNode(tree, "memo-nested")?.title).toBe("会议记录");
    expect(findFirstMemoId(tree)).toBe("memo-nested");
  });

  test("derives ancestors, paths, and full-text search", () => {
    expect(getAncestorFolderIds(tree, "memo-nested")).toEqual([
      "folder-root",
      "folder-child",
    ]);
    expect(getMemoFolderPath(tree, "memo-nested")).toBe("工作 / 项目 A");
    expect(searchMemoTree(tree, "后端树")).toEqual([
      { id: "memo-nested", path: "工作 / 项目 A", title: "会议记录" },
    ]);
  });

  test("updates metadata and full content without mutating the source", () => {
    const { children: _children, memo: _memo, ...baseNode } = nestedMemo;
    const renamed: MemoNode = { ...baseNode, title: "新标题" };
    const renamedTree = updateNodeInMemoTree(tree, renamed);
    const replacedTree = replaceNodeInMemoTree(renamedTree, {
      ...nestedMemo,
      memo: content("memo-nested", "新正文"),
      title: "新标题",
    });

    expect(findMemoNode(tree, "memo-nested")?.title).toBe("会议记录");
    expect(findMemoNode(renamedTree, "memo-nested")?.title).toBe("新标题");
    expect(findMemoNode(replacedTree, "memo-nested")?.memo?.content_mdx).toBe("新正文");
  });

  test("places a node inside a folder as its first child", () => {
    expect(
      createMemoMovePlan(tree, "memo-root", {
        nodeId: "folder-child",
        parentId: "folder-root",
        placement: "inside",
      }),
    ).toEqual({ parent_id: "folder-child", sort_order: "500" });
  });

  test("plans before, after, and root-end with sparse string orders", () => {
    expect(
      createMemoMovePlan(tree, "memo-root", {
        nodeId: "folder-root",
        parentId: null,
        placement: "before",
      }),
    ).toEqual({ parent_id: null, sort_order: "500" });
    expect(
      createMemoMovePlan(tree, "folder-root", {
        nodeId: "memo-root",
        parentId: null,
        placement: "after",
      }),
    ).toEqual({ parent_id: null, sort_order: "3000" });
    expect(
      createMemoMovePlan(tree, "memo-nested", {
        nodeId: null,
        parentId: null,
        placement: "root-end",
      }),
    ).toEqual({ parent_id: null, sort_order: "3000" });
  });

  test("uses first minus 1000 when halving cannot move before zero", () => {
    const zeroBasedTree = [
      node("memo-zero", "零位", "memo", null, 0),
      node("memo-next", "下一条", "memo", null, 1000),
    ];

    expect(
      createMemoMovePlan(zeroBasedTree, "memo-next", {
        nodeId: "memo-zero",
        parentId: null,
        placement: "before",
      }),
    ).toEqual({ parent_id: null, sort_order: "-1000" });
  });

  test("rejects self, memo-inside, and descendant-cycle targets", () => {
    expect(
      createMemoMovePlan(tree, "memo-root", {
        nodeId: "memo-root",
        parentId: null,
        placement: "before",
      }),
    ).toBeNull();
    expect(
      createMemoMovePlan(tree, "folder-root", {
        nodeId: "memo-root",
        parentId: null,
        placement: "inside",
      }),
    ).toBeNull();
    expect(
      createMemoMovePlan(tree, "folder-root", {
        nodeId: "folder-child",
        parentId: "folder-root",
        placement: "inside",
      }),
    ).toBeNull();
    expect(
      createMemoMovePlan(tree, "folder-root", {
        nodeId: null,
        parentId: "folder-child",
        placement: "after",
      }),
    ).toBeNull();
  });
});
