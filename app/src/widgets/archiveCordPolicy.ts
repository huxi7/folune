/**
 * [INPUT]: 依赖 shared/api/memo 的树类型与 memoLibrary 的唯一祖先遍历（findMemoNode/getAncestorFolderIds）
 * [OUTPUT]: 对外提供 WorkspaceOrganizePresentation、canonical memo 目标、候选链、可见代表解析与 Archive Cord 可见性纯决策
 * [POS]: widgets 的归档语义边界；真相层（memo 永远是目标）与表现层（当前展开状态下谁代表它）在此分离，Overlay 只消费 DOM 上唯一的代表标记，几何钳制归 archiveCordGeometry
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "../shared/api/memo";
import { findMemoNode, getAncestorFolderIds } from "./memoLibrary";

/**
 * 归档展示事实。它只描述「哪一篇 memo 归档在哪条路径下、由哪次 run 证明」，
 * 不描述当前谁在屏幕上代表它 —— 后者是 representative，随展开状态与滚动变化。
 *
 * origin 区分「刚刚发生」与「本来就为真」: 只有 fresh 允许播放一次自绘，
 * 刷新恢复、重开文件库都以 restored 进来并直接落在 settled。
 */
export type WorkspaceOrganizePresentation = {
  memoId: string;
  origin: "fresh" | "restored";
  path: string;
  runId: string;
  status: "succeeded" | "undone";
};

/**
 * 当前展开状态下、屏幕上真正代表 canonical memo 的那个对象。
 *
 * - memo: 祖先全展开，代表就是被整理的那篇笔记本身
 * - folder: 某层祖先收起，后代 DOM 不存在，由最外层那个收起的祖先代表
 * - missing: memo 已不在 active tree，presentation 该被清除
 * - pending: 树尚未 ready，保留 presentation 但先不画线，绝不假连其他行
 */
export type ArchiveRepresentative =
  | { kind: "folder"; nodeId: string; reason: "collapsed-ancestor" }
  | { kind: "memo"; nodeId: string; reason: "expanded" | "root" }
  | { kind: "missing"; nodeId: null; reason: "memo-absent" }
  | { kind: "pending"; nodeId: null; reason: "tree-loading" };

/** canonical 目标永远是 memo；目录、路径文字与展开状态都不得替代它 */
export const archiveCanonicalMemoId = (
  presentation: WorkspaceOrganizePresentation | null,
): string | null => presentation?.memoId ?? null;

/**
 * 候选链由具体到抽象: [memo, parentFolder, ..., rootFolder]。
 * memo 不在树里就是空链 —— 空链与「根级 memo 没有祖先」是两件事，
 * 因此这里不能只看 getAncestorFolderIds 的长度。
 */
export const archiveRepresentativeCandidates = (
  tree: readonly MemoTreeNode[],
  memoId: string,
): string[] => findMemoNode(tree, memoId) === null
  ? []
  : [memoId, ...getAncestorFolderIds(tree, memoId).toReversed()];

/**
 * 先解结构（祖先收起），再由几何解视口（滚出 clip）。顺序倒过来就会把
 * 「文件夹收起」误判成「目标丢失」。
 *
 * 祖先按根 → 父顺序检查: 第一个收起的祖先，其自身祖先必然都还展开，
 * 所以它是那条链上仍然结构可见、且距离目标最近的对象。
 */
export const resolveArchiveRepresentative = ({
  expandedFolders,
  memoId,
  tree,
  treeReady,
}: {
  expandedFolders: ReadonlySet<string>;
  memoId: string;
  tree: readonly MemoTreeNode[];
  treeReady: boolean;
}): ArchiveRepresentative => {
  if (!treeReady) {
    return { kind: "pending", nodeId: null, reason: "tree-loading" };
  }

  if (findMemoNode(tree, memoId) === null) {
    return { kind: "missing", nodeId: null, reason: "memo-absent" };
  }

  const ancestorIds = getAncestorFolderIds(tree, memoId);
  const collapsed = ancestorIds.find((folderId) => !expandedFolders.has(folderId));

  if (collapsed !== undefined) {
    return { kind: "folder", nodeId: collapsed, reason: "collapsed-ancestor" };
  }

  return {
    kind: "memo",
    nodeId: memoId,
    reason: ancestorIds.length === 0 ? "root" : "expanded",
  };
};

/**
 * 窄屏 overlay 布局没有并列空间，跨层线只会变成穿过内容的一道划痕；
 * 那里只保留 representative 行本身的安静反馈。文件库关闭同理: 只隐藏渲染，
 * presentation 不因视图开关而销毁。
 */
export const shouldShowArchiveCord = ({
  libraryOpen,
  overlayPanels,
  presentation,
}: {
  libraryOpen: boolean;
  overlayPanels: boolean;
  presentation: WorkspaceOrganizePresentation | null;
}): boolean => libraryOpen
  && !overlayPanels
  && archiveCanonicalMemoId(presentation) !== null;
