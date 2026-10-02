/**
 * [INPUT]: 依赖 Motion AnimatePresence/useIsPresent、设计系统 surfaceVariants 与受控 open
 * [OUTPUT]: 对外提供无需额外定位包装的 PresenceSurface，以及外部 presence 边界可组合的 MotionSurface
 * [POS]: 菜单/子菜单/浮动面板的视觉生命周期基础件；中心缩放与固定方向完全由DS配方决定，placement只保留定位API，关闭立即inert且退场后卸载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { surfaceVariants, surfaceTransformOrigin, type SurfaceMotion, type SurfacePlacement } from "../motion";

type MotionSurfaceProps = HTMLMotionProps<"div"> & {
  kind?: SurfaceMotion;
  placement?: SurfacePlacement;
};
export function MotionSurface({ kind = "popover", placement = "bottom", style, ...props }: MotionSurfaceProps) {
  const present = useIsPresent();
  const reduced = Boolean(useReducedMotion());
  return <motion.div
    {...props}
    aria-hidden={!present || props["aria-hidden"]}
    inert={!present || props.inert}
    data-motion-surface={kind}
    data-state={present ? "open" : "closing"}
    initial="hidden" animate="visible" exit="exit"
    variants={surfaceVariants(kind, reduced, placement)}
    style={{ ...style, transformOrigin: surfaceTransformOrigin, pointerEvents: present ? style?.pointerEvents : "none" }}
  />;
}
export function PresenceSurface({ open, ...props }: MotionSurfaceProps & { open: boolean }) {
  return <AnimatePresence>{open ? <MotionSurface key="surface" {...props} /> : null}</AnimatePresence>;
}
