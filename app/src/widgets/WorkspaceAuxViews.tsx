/**
 * [INPUT]: 依赖 react 的 lazy/Suspense、Motion for React 内容切换、AppSidebar 的 SidebarView、TrashWorkspace/SubscriptionWorkspace 与仅 DEV 懒加载的 DesignSystemWorkspace
 * [OUTPUT]: 对外提供 WorkspaceAuxViews，按 activeView 以克制 Spring 过渡挂载住在 Paper 内部的订阅/回收站/Design System 辅助工作区
 * [POS]: app/src/widgets 的纸内非笔记视图挂载点；已保存画布属于独立空间语境并由 CanvasWorkspace 承载，不再混进这条 Paper 内容分支
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "motion/react";

import { contentSwitch } from "../lib/motion.js";

import type { SidebarView } from "./AppSidebar";
import { SubscriptionWorkspace } from "./SubscriptionWorkspace";
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
  return (
    <AnimatePresence initial={false} mode="wait">
      {activeView === "trash" ? (
        <motion.div animate="visible" className="workspace-aux-view" exit="exit" initial="hidden" key="trash" variants={contentSwitch}>
          <TrashWorkspace accessToken={accessToken} onRestore={onRestoreTrashNode} refreshKey={trashRevision} />
        </motion.div>
      ) : activeView === "subscription" ? (
        <motion.div animate="visible" className="workspace-aux-view" exit="exit" initial="hidden" key="subscription" variants={contentSwitch}>
          <SubscriptionWorkspace />
        </motion.div>
      ) : activeView === "design-system" && DesignSystemWorkspace !== null ? (
        <motion.div animate="visible" className="workspace-aux-view" exit="exit" initial="hidden" key="design-system" variants={contentSwitch}>
          <Suspense fallback={<div className="h-full bg-background" />}>
            <DesignSystemWorkspace />
          </Suspense>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
