/**
 * [INPUT]: 依赖 AppSidebar 的 SidebarView 与 TrashWorkspace
 * [OUTPUT]: 对外提供 WorkspaceAuxViews，按 activeView 挂载 Paper 内的回收站
 * [POS]: widgets 的纸内辅助视图挂载点；订阅、画布与 DEV Design System 各自由独立页面或 Workspace 承载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { SidebarView } from "./AppSidebar";
import { TrashWorkspace } from "./TrashWorkspace";

type WorkspaceAuxViewsProps = {
  accessToken: string;
  activeView: WorkspaceAuxView;
  onRestoreTrashNode: (nodeId: string) => Promise<void>;
  trashRevision: number;
};

export type WorkspaceAuxView = SidebarView;

export function WorkspaceAuxViews({
  accessToken,
  activeView,
  onRestoreTrashNode,
  trashRevision,
}: WorkspaceAuxViewsProps) {
  if (activeView === "trash") {
    return (
      <TrashWorkspace
        accessToken={accessToken}
        onRestore={onRestoreTrashNode}
        refreshKey={trashRevision}
      />
    );
  }

  return null;
}
