/**
 * [INPUT]: 依赖 motion/react 的面板 Tween、Dashboard 传入的文件库内容、共享工作区尺寸变量
 * [OUTPUT]: 对外提供跨 Paper/Canvas 路由持续挂载的文件库浮层宿主；关闭时只隐藏并冻结交互，不卸载 AppSidebar
 * [POS]: widgets 的跨空间 Workspace Chrome 边界；把文件树实例从互斥的 Paper/Canvas 内容壳中提出，消除路由切换时的重挂载闪烁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  panelEnterTransition,
  panelExitTransition,
  reducedFadeTransition,
} from "../pages/workspaceMotion";

type WorkspaceLibraryLayerProps = {
  children: ReactNode;
  open: boolean;
  style: CSSProperties;
};

export function WorkspaceLibraryLayer({
  children,
  open,
  style,
}: WorkspaceLibraryLayerProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (
      wasOpenRef.current
      && !open
      && panelRef.current?.contains(document.activeElement)
      && document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }
    wasOpenRef.current = open;
  }, [open]);

  return (
    <motion.div
      animate={{
        opacity: open ? 1 : 0,
        x: open || reduceMotion ? 0 : -12,
      }}
      aria-hidden={!open}
      className="app-sidebar-shell workspace-floating-panel workspace-persistent-panel"
      data-open={open}
      inert={!open}
      initial={false}
      ref={panelRef}
      style={{
        ...style,
        pointerEvents: open ? "auto" : "none",
      }}
      transition={reduceMotion
        ? reducedFadeTransition
        : open
          ? panelEnterTransition
          : panelExitTransition}
    >
      <div className="workspace-panel-content workspace-panel-content-library">
        {children}
      </div>
    </motion.div>
  );
}
