/**
 * [INPUT]: 依赖 React 服务端渲染、真实 MemoTreeBranch 与 archiveCordPolicy 的代表解析
 * [OUTPUT]: 锁定树上至多存在一个 data-archive-representative、折叠前后标记落在哪一行、多层折叠只标最接近目标的可见祖先，以及旧的 folder/memo 双高亮与零尺寸 marker 已消失
 * [POS]: 文件树归档代表集成门禁；解析规则本身归 archiveCordPolicy.test，端点几何归 archiveCordGeometry.test
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { MemoContentSummary, MemoTreeNode } from "../shared/api/memo";
import { resolveArchiveRepresentative } from "./archiveCordPolicy";
import { MemoTreeBranch } from "./MemoTreeBranch";

const TIMESTAMP = "2026-09-03T00:00:00.000Z";

const content = (nodeId: string): MemoContentSummary => ({
  created_at: TIMESTAMP,
  excerpt: null,
  metadata: {},
  node_id: nodeId,
  updated_at: TIMESTAMP,
  user_id: "user-1",
  word_count: 0,
});

const node = (
  id: string,
  nodeType: "folder" | "memo",
  parentId: string | null,
  children: MemoTreeNode[] = [],
): MemoTreeNode => ({
  children,
  color: null,
  created_at: TIMESTAMP,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: nodeType === "memo" ? content(id) : null,
  metadata: {},
  node_type: nodeType,
  parent_id: parentId,
  revision: 1,
  sort_order: "a0",
  title: id,
  updated_at: TIMESTAMP,
  user_id: "user-1",
});

const tree: MemoTreeNode[] = [
  node("outer", "folder", null, [
    node("inner", "folder", "outer", [node("leaf-memo", "memo", "inner")]),
  ]),
  node("sibling-memo", "memo", null),
];

const noop = () => undefined;

const renderTree = (expanded: readonly string[], memoId = "leaf-memo") =>
  renderToStaticMarkup(createElement(MemoTreeBranch, {
    archiveRepresentative: resolveArchiveRepresentative({
      expandedFolders: new Set(expanded),
      memoId,
      tree,
      treeReady: true,
    }),
    depth: 0,
    draggedNodeId: null,
    dropTarget: null,
    expandedFolders: new Set(expanded),
    mutating: false,
    nodes: tree,
    notesActive: true,
    onBeginRename: noop,
    onCancelRename: noop,
    onCommitRename: noop,
    onContextMenu: noop,
    onDragEnd: noop,
    onDragOverTarget: noop,
    onDragStart: noop,
    onDropTarget: noop,
    onPrefetchMemo: noop,
    onRenameValueChange: noop,
    onSelectMemo: noop,
    onToggleFolder: noop,
    parentId: null,
    renameConflict: false,
    renameValue: "",
    renamingNodeId: null,
    selectedMemoId: null,
  }));

/** 抓出真的落在 DOM 上的那些标记，连同它们所在的行 id */
const markers = (html: string): { kind: string; row: string }[] => {
  const rows = html.split("data-memo-tree-row-id=").slice(1);
  return rows.flatMap((chunk) => {
    const row = chunk.slice(1, chunk.indexOf('"', 1));
    const marker = /^[^>]*data-archive-representative="([a-z]+)"/.exec(chunk);
    return marker === null ? [] : [{ kind: marker[1] ?? "", row }];
  });
};

describe("MemoTreeBranch 归档代表标记", () => {
  test("全展开时标记恰好一个，且落在 memo 行上", () => {
    expect(markers(renderTree(["outer", "inner"])))
      .toEqual([{ kind: "memo", row: "leaf-memo" }]);
  });

  test("折叠内层后标记转到父目录行，memo 与 folder 绝不同时点亮", () => {
    const found = markers(renderTree(["outer"]));
    expect(found).toEqual([{ kind: "folder", row: "inner" }]);
    // leaf-memo 此刻根本不在 DOM 里，所以「两处都亮」在结构上就不可能
    expect(renderTree(["outer"])).not.toContain('data-memo-tree-row-id="leaf-memo"');
  });

  test("多层折叠只标最接近目标且仍结构可见的那个祖先", () => {
    expect(markers(renderTree([]))).toEqual([{ kind: "folder", row: "outer" }]);
    expect(markers(renderTree(["inner"]))).toEqual([{ kind: "folder", row: "outer" }]);
  });

  test("逐级展开时标记连续回到更具体的对象，且始终只有一个", () => {
    [[], ["outer"], ["outer", "inner"]].forEach((expanded) => {
      expect(markers(renderTree(expanded))).toHaveLength(1);
    });
    expect(markers(renderTree(["outer", "inner"]))[0]?.row).toBe("leaf-memo");
  });

  test("目标 memo 不在树中或树未 ready 时，一个标记都不落", () => {
    expect(markers(renderTree(["outer", "inner"], "ghost-memo"))).toHaveLength(0);
    expect(renderToStaticMarkup(createElement(MemoTreeBranch, {
      archiveRepresentative: resolveArchiveRepresentative({
        expandedFolders: new Set(["outer", "inner"]),
        memoId: "leaf-memo",
        tree,
        treeReady: false,
      }),
      depth: 0,
      draggedNodeId: null,
      dropTarget: null,
      expandedFolders: new Set(["outer", "inner"]),
      mutating: false,
      nodes: tree,
      notesActive: true,
      onBeginRename: noop,
      onCancelRename: noop,
      onCommitRename: noop,
      onContextMenu: noop,
      onDragEnd: noop,
      onDragOverTarget: noop,
      onDragStart: noop,
      onDropTarget: noop,
      onPrefetchMemo: noop,
      onRenameValueChange: noop,
      onSelectMemo: noop,
      onToggleFolder: noop,
      parentId: null,
      renameConflict: false,
      renameValue: "",
      renamingNodeId: null,
      selectedMemoId: null,
    }))).not.toContain("data-archive-representative");
  });

  test("旧的 folder/memo 双高亮与零尺寸中转 marker 已彻底消失", () => {
    const html = renderTree(["outer", "inner"]);
    expect(html).not.toContain("data-organize-target");
    expect(html).not.toContain("archive-target-marker");
  });
});
