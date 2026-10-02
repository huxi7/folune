/**
 * [INPUT]: 依赖 react 的 lazy/Suspense、AppSidebar 的 SidebarView、TrashWorkspace 与仅 DEV 懒加载的 DesignSystemWorkspace
 * [OUTPUT]: 对外提供 WorkspaceAuxViews，按 activeView 挂载 Paper 内的回收站或 Design System
 * [POS]: app/src/widgets 的纸内非笔记视图挂载点；独立订阅页归 SubscriptionPage、画布归 CanvasWorkspace，均不进入这条 Paper 内容分支
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { lazy, Suspense } from "react";

import type { SidebarView } from "./AppSidebar";
import { TrashWorkspace } from "./TrashWorkspace";

/** Design System 是开发态陈列，不进生产包 */
const DesignSystemWorkspace = import.meta.env.DEV
  ? lazy(() =>
      import("./DesignSystemWorkspace").then((module) => ({
        default: module.DesignSystemWorkspace,
      })),
    )
  : null;

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

  if (activeView === "design-system" && DesignSystemWorkspace !== null) {
    return (
      <Suspense fallback={<div className="h-full bg-background" />}>
        <DesignSystemWorkspace />
      </Suspense>
    );
  }

  return null;
}
