/**
 * [INPUT]: 依赖 Bun test、snake_case MemoTreeNode 与 archiveCordPolicy 的无副作用 canonical/代表/可见性决策
 * [OUTPUT]: 覆盖 canonical memo 恒定、候选链、逐层折叠与逐层展开的代表迁移、memo 缺失与树未就绪的区分、文件库与窄屏门禁
 * [POS]: widgets 层 Archive Cord 语义回归测试；不启动 DOM、Overlay 或几何
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoContentSummary, MemoTreeNode } from "../shared/api/memo";
import {
  archiveCanonicalMemoId,
  archiveRepresentativeCandidates,
  resolveArchiveRepresentative,
  shouldShowArchiveCord,
  type WorkspaceOrganizePresentation,
} from "./archiveCordPolicy";

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

/*
 * outer / inner / leaf-memo  三层嵌套 + 一个根级 memo。
 * 多层是必须的: 只有两层分不出「最内层收起」与「外层收起」两种代表。
 */
const tree: MemoTreeNode[] = [
  node("outer", "folder", null, [
    node("inner", "folder", "outer", [
      node("leaf-memo", "memo", "inner"),
    ]),
  ]),
  node("root-memo", "memo", null),
];

const presentation: WorkspaceOrganizePresentation = {
  memoId: "leaf-memo",
  origin: "fresh",
  path: "outer / inner",
  runId: "run-1",
  status: "succeeded",
};

const representativeOf = (
  memoId: string,
  expanded: readonly string[],
  treeReady = true,
) => resolveArchiveRepresentative({
  expandedFolders: new Set(expanded),
  memoId,
  tree,
  treeReady,
});

describe("Archive Cord canonical target", () => {
  test("成功与撤销的 canonical 目标都是 memo，目录永不替代它", () => {
    expect(archiveCanonicalMemoId(presentation)).toBe("leaf-memo");
    expect(archiveCanonicalMemoId({
      ...presentation,
      origin: "restored",
      runId: "run-2",
      status: "undone",
    })).toBe("leaf-memo");
    expect(archiveCanonicalMemoId(null)).toBeNull();
  });

  test("候选链由具体到抽象，memo 不在树里则为空链", () => {
    expect(archiveRepresentativeCandidates(tree, "leaf-memo"))
      .toEqual(["leaf-memo", "inner", "outer"]);
    expect(archiveRepresentativeCandidates(tree, "root-memo"))
      .toEqual(["root-memo"]);
    expect(archiveRepresentativeCandidates(tree, "ghost-memo")).toEqual([]);
  });
});

describe("Archive Cord visible representative", () => {
  test("祖先全展开时代表就是 memo 本身", () => {
    expect(representativeOf("leaf-memo", ["outer", "inner"])).toEqual({
      kind: "memo",
      nodeId: "leaf-memo",
      reason: "expanded",
    });
  });

  test("根级 memo 没有祖先，代表恒为自己", () => {
    expect(representativeOf("root-memo", [])).toEqual({
      kind: "memo",
      nodeId: "root-memo",
      reason: "root",
    });
  });

  test("最内层收起命中父目录，外层收起命中外层目录", () => {
    expect(representativeOf("leaf-memo", ["outer"])).toEqual({
      kind: "folder",
      nodeId: "inner",
      reason: "collapsed-ancestor",
    });
    // outer 收起时 inner 自身也不再挂载，代表必须退到仍结构可见的最外层
    expect(representativeOf("leaf-memo", ["inner"])).toEqual({
      kind: "folder",
      nodeId: "outer",
      reason: "collapsed-ancestor",
    });
    expect(representativeOf("leaf-memo", [])).toEqual({
      kind: "folder",
      nodeId: "outer",
      reason: "collapsed-ancestor",
    });
  });

  test("逐级展开使代表连续回到更具体的对象，最终回到 memo", () => {
    expect(representativeOf("leaf-memo", []).nodeId).toBe("outer");
    expect(representativeOf("leaf-memo", ["outer"]).nodeId).toBe("inner");
    expect(representativeOf("leaf-memo", ["outer", "inner"]).nodeId)
      .toBe("leaf-memo");
  });

  test("memo 已不在 active tree 与树尚未 ready 是两种不同结论", () => {
    expect(representativeOf("ghost-memo", ["outer", "inner"])).toEqual({
      kind: "missing",
      nodeId: null,
      reason: "memo-absent",
    });
    // 未 ready 时连 missing 都不能断言: 树还没来，缺席不是事实
    expect(representativeOf("ghost-memo", [], false)).toEqual({
      kind: "pending",
      nodeId: null,
      reason: "tree-loading",
    });
    expect(representativeOf("leaf-memo", ["outer", "inner"], false).kind)
      .toBe("pending");
  });
});

describe("Archive Cord 渲染门禁", () => {
  test("仅宽屏文件库打开且存在 canonical memo 时画线", () => {
    expect(shouldShowArchiveCord({
      libraryOpen: true,
      overlayPanels: false,
      presentation,
    })).toBe(true);
    expect(shouldShowArchiveCord({
      libraryOpen: false,
      overlayPanels: false,
      presentation,
    })).toBe(false);
    expect(shouldShowArchiveCord({
      libraryOpen: true,
      overlayPanels: true,
      presentation,
    })).toBe(false);
    expect(shouldShowArchiveCord({
      libraryOpen: true,
      overlayPanels: false,
      presentation: null,
    })).toBe(false);
  });
});
