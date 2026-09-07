/**
 * [INPUT]: 依赖 Motion 的手势/减少动态效果与 Design System 的 response spring
 * [OUTPUT]: 对外提供 Card、CardTone、显式 opt-in 的 CardMotion；阴影由 CSS 独占
 * [POS]: Design System 表面基础件；默认信息容器静止，Landing 等需层级反馈的表面可选择 lift
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { motion as m, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { motionSpring } from "../motion";
export type CardTone = "default" | "accent";
export type CardMotion = "lift" | "none";
type CardProps = HTMLMotionProps<"div"> & { tone?: CardTone; motion?: CardMotion };
export function Card({ className = "", tone = "default", motion = "none", ...props }: CardProps) {
  const reduced = useReducedMotion();
  const lift = motion === "lift" && !reduced;
  return <m.div
    {...props}
    className={`ds-card ds-card-${tone} ${className}`}
    data-card-motion={motion}
    initial={false}
    whileHover={lift ? { y: -4, scale: 1.012 } : undefined}
    transition={motionSpring.response}
  />;
}
