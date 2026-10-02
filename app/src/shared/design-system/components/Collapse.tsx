/**
 * [INPUT]: 依赖 Motion height/opacity 与 Design System 的层级时间轴
 * [OUTPUT]: 对外提供 Collapse，tree/micro 两档同源高度切换与即时退出交互
 * [POS]: Tree/披露控件的尺寸生命周期原语；独立 presence 隔离父面板退出，高度与透明度同步使用进/退场节奏，避免高度已收完仍等待淡出
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { fadeTransition, microExitTransition, reducedFadeTransition, treeTransition } from "../motion";

type CollapseProps = {
  children: ReactNode;
  className?: string;
  open: boolean;
  keepMounted?: boolean;
  motion?: "tree" | "micro";
  onMotionStart?: () => void;
  onMotionEnd?: () => void;
  onMotionProgress?: () => void;
};
function CollapseBody({ children, className, onMotionStart, onMotionEnd, onMotionProgress, keptOpen, motion: motionKind = "tree" }: Omit<CollapseProps, "open"> & { keptOpen?: boolean }) {
  const parentPresent = useIsPresent();
  const present = parentPresent && keptOpen !== false;
  const reduced = useReducedMotion();
  const heightTransition = motionKind === "micro" ? (present ? fadeTransition : microExitTransition) : treeTransition;
  useEffect(() => () => onMotionEnd?.(), [onMotionEnd]);
  return <motion.div
    className={className}
    data-collapse
    aria-hidden={!present}
    inert={!present}
    style={{ overflow: "clip", minHeight: 0, pointerEvents: present ? undefined : "none" }}
    initial={keptOpen !== undefined || reduced ? false : { height: 0, opacity: 0 }}
    animate={present ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
    exit={{ height: 0, opacity: 0 }}
    transition={reduced ? { height: { duration: 0 }, opacity: reducedFadeTransition } : { height: heightTransition, opacity: present ? fadeTransition : microExitTransition }}
    onAnimationStart={onMotionStart}
    onAnimationComplete={onMotionEnd}
    onUpdate={onMotionProgress}
  >{children}</motion.div>;
}
export function Collapse({ open, keepMounted = false, ...props }: CollapseProps) {
  // 常驻内容也必须拥有自己的 presence 边界，否则父 Panel 退出会使详情高度归零。
  return <AnimatePresence initial={false} propagate={false}>
    {keepMounted || open ? <CollapseBody key="content" keptOpen={keepMounted ? open : undefined} {...props} /> : null}
  </AnimatePresence>;
}
