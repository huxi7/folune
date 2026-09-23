/**
 * [INPUT]: 依赖 motion/react 的面板 Tween、Dashboard 传入的左右工具内容、共享工作区尺寸变量、归档线运动租约
 * [OUTPUT]: 对外提供跨 Paper/Canvas 路由持续挂载的左右工具浮层宿主与裁切内容之外的 resizeHandle 插槽；关闭时只隐藏并冻结交互，不卸载 AppSidebar/AgentPanel，并在 Tween 期间交出一段归档几何租约
 * [POS]: widgets 的跨空间 Workspace Chrome 边界；把文件树与 AI 实例从互斥的 Paper/Canvas 内容壳中提出，消除路由切换时的重挂载闪烁。它是唯一知道这段 Tween 何时结束的人，因此必须由它显式通知归档线，而不是让归档线去猜 transform 动画的结尾
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
import { motionDistance } from "../shared/design-system/motion";
import {
  beginArchiveMotion,
  endArchiveMotion,
} from "./archiveCordMotion";

const ARCHIVE_MOTION_SOURCE = "library-panel";

type WorkspacePanelLayerProps = {
  children: ReactNode;
  open: boolean;
  resizeHandle?: ReactNode;
  side?: "library" | "assistant";
  style: CSSProperties;
};

export function WorkspacePanelLayer({
  children,
  open,
  resizeHandle,
  side = "library",
  style,
}: WorkspacePanelLayerProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(open);
  /*
   * 租约必须成对。Motion 在一次 Tween 被新状态打断时会再发一次 start 而不补 complete,
   * 用一个布尔守住配对, 否则计数永不归零, 归档线就会永远逐帧空转。
   */
  const motionLeaseRef = useRef(false);
  const releaseArchiveMotion = () => {
    if (!motionLeaseRef.current) return;
    motionLeaseRef.current = false;
    endArchiveMotion(ARCHIVE_MOTION_SOURCE);
  };

  useEffect(() => releaseArchiveMotion, []);

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
        x: open || reduceMotion ? 0 : (side === "library" ? -1 : 1) * motionDistance.panel,
      }}
      aria-hidden={!open}
      className={`app-${side === "library" ? "sidebar" : "agent"}-shell workspace-floating-panel workspace-persistent-panel`}
      data-open={open}
      inert={!open}
      initial={false}
      onAnimationComplete={releaseArchiveMotion}
      onAnimationStart={() => {
        if (side !== "library" || motionLeaseRef.current) return;
        motionLeaseRef.current = true;
        beginArchiveMotion(ARCHIVE_MOTION_SOURCE);
      }}
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
      <div className={`workspace-panel-content workspace-panel-content-${side}`}>
        {children}
      </div>
      {resizeHandle}
    </motion.div>
  );
}
