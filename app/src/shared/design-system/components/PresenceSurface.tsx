/**
 * [INPUT]: 依赖 Motion AnimatePresence/useIsPresent、设计系统 surfaceVariants 与受控 open
 * [OUTPUT]: 对外提供无需额外定位包装的 PresenceSurface，以及外部 presence 边界可组合的 MotionSurface
 * [POS]: 菜单/Popover/Panel 的视觉生命周期基础件；关闭立即 inert，退出后卸载，定位与焦点策略仍由语义组件拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { surfaceVariants, type SurfaceMotion, type SurfacePlacement } from "../motion";

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
    style={{ transformOrigin: placement === "top" ? "bottom center" : "top center", ...style, pointerEvents: present ? style?.pointerEvents : "none" }}
  />;
}
export function PresenceSurface({ open, ...props }: MotionSurfaceProps & { open: boolean }) {
  return <AnimatePresence>{open ? <MotionSurface key="surface" {...props} /> : null}</AnimatePresence>;
}
