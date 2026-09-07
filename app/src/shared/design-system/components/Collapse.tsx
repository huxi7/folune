/**
 * [INPUT]: 依赖 Motion height/opacity 与 Design System 的层级时间轴
 * [OUTPUT]: 对外提供 Collapse，可中断的高度展开/收起与即时退出交互
 * [POS]: Tree/披露控件的尺寸生命周期原语；独立 presence 边界隔离父面板退出，只在自身 open 改变时收放高度
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
  // 常驻内容也必须拥有自己的 presence 边界，否则父 Panel 退出会使详情高度归零。
  return <AnimatePresence initial={false} propagate={false}>
    {keepMounted || open ? <CollapseBody key="content" keptOpen={keepMounted ? open : undefined} {...props} /> : null}
  </AnimatePresence>;
}
