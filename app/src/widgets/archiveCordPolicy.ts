/**
 * [INPUT]: 依赖整理成功/撤销后的最小展示快照与 Workspace 当前面板形态
 * [OUTPUT]: 对外提供 WorkspaceOrganizePresentation、归档目标解析与 Archive Cord 可见性纯决策
 * [POS]: widgets 的归档展示策略边界；让 Cord 几何层只接收已验证目标，让 pages 生命周期与 Shell 布局可独立测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type WorkspaceOrganizePresentation = {
  memoId: string;
  path: string;
  runId: string;
  status: "succeeded" | "undone";
  targetFolderId: string | null;
};

export const resolveArchiveTargetNodeId = (
  presentation: WorkspaceOrganizePresentation | null,
): string | null => presentation?.targetFolderId
  ?? presentation?.memoId
  ?? null;

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
  && resolveArchiveTargetNodeId(presentation) !== null;
