/**
 * [INPUT]: 依赖 Motion height/opacity 与 Design System 的层级时间轴
 * [OUTPUT]: 对外提供 Collapse，可中断的高度展开/收起与即时退出交互
 * [POS]: Tree/披露控件的尺寸生命周期原语；只动画一层高度，不缩放文字、不逐项错峰
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { fadeTransition, reducedFadeTransition, treeTransition } from "../motion";

type CollapseProps = {
  children: ReactNode;
  className?: string;
  open: boolean;
  keepMounted?: boolean;
  onMotionStart?: () => void;
  onMotionEnd?: () => void;
};
function CollapseBody({ children, className, onMotionStart, onMotionEnd, keptOpen }: Omit<CollapseProps, "open"> & { keptOpen?: boolean }) {
  const parentPresent = useIsPresent();
  const present = parentPresent && keptOpen !== false;
  const reduced = useReducedMotion();
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
    transition={reduced ? { height: { duration: 0 }, opacity: reducedFadeTransition } : { height: treeTransition, opacity: fadeTransition }}
    onAnimationStart={onMotionStart}
    onAnimationComplete={onMotionEnd}
  >{children}</motion.div>;
}
export function Collapse({ open, keepMounted = false, ...props }: CollapseProps) {
  if (keepMounted) return <CollapseBody keptOpen={open} {...props} />;
  return <AnimatePresence initial={false}>{open ? <CollapseBody key="content" {...props} /> : null}</AnimatePresence>;
}
