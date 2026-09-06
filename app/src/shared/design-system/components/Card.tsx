/**
 * [INPUT]: 依赖 React 的 HTMLAttributes、Motion for React 与 index.css 暴露的 ds-card 微拟物表面类
 * [OUTPUT]: 对外提供仅保留实际使用的 default、accent 表面与轻量 Spring hover/tap 提升的 Card 组件与 CardTone 类型；阴影由 CSS hover 过渡拥有，避免 CSS 变量阴影在 Motion 插值中消失
 * [POS]: app/src/shared/design-system/components 的表面基础件，被 Landing、NotebookPreview、NotesWorkspace 与 TrashWorkspace 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ComponentType, HTMLAttributes } from "react";
import { motion } from "motion/react";

import { hoverLift } from "../../../lib/motion.js";

const MotionCard = motion.div as unknown as ComponentType<
  HTMLAttributes<HTMLDivElement> & {
    initial?: string | boolean;
    variants?: unknown;
    whileHover?: string;
    whileTap?: string;
  }
>;

export type CardTone = "default" | "accent";
export type CardMotion = "lift" | "none";

type CardProps = Omit<HTMLAttributes<HTMLDivElement>, "onDrag" | "onDragStart" | "onDragEnd"> & {
  motion?: CardMotion;
  tone?: CardTone;
};

const toneClassName: Record<CardTone, string> = {
  default: "ds-card-default",
  accent: "ds-card-accent",
};

export function Card({ children, className = "", motion: motionMode = "lift", tone = "default", ...props }: CardProps) {
  const shouldLift = motionMode === "lift";

  return (
    <MotionCard
      className={[
        "ds-card",
        toneClassName[tone],
        className,
      ].join(" ")}
      initial={shouldLift ? "rest" : false}
      whileHover={shouldLift ? "hover" : undefined}
      whileTap={shouldLift ? "pressed" : undefined}
      variants={shouldLift ? hoverLift : undefined}
      {...props}
    >
      {children}
    </MotionCard>
  );
}
