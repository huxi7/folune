/**
 * [INPUT]: 依赖 DS 实时动态偏好、 Motion、React 可见状态与 DS 视图承接/淡换语义
 * [OUTPUT]: 对外提供保留实例的 PersistentView；motion=from-left 从左侧进入，fill 保持面板退出时的完整高度
 * [POS]: 视图切换基础件；普通文档按自然高度淡换，固定 Panel 以四边定位防止退出层按长消息重新撑高
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useMotionPreference } from "../useMotionPreference";
import { motion, type HTMLMotionProps } from "motion/react";
import { useState } from "react";
import { motionDistance, persistentViewTransition } from "../motion";

type PersistentViewProps = HTMLMotionProps<"div"> & {
  active: boolean;
  motion?: "fade" | "from-left";
  fill?: boolean;
};

export function PersistentView({ active, motion: motionMode = "fade", fill = false, style, ...props }: PersistentViewProps) {
  const [visible, setVisible] = useState(active);
  const reduced = useMotionPreference();
  if (active && !visible) setVisible(true);
  return <motion.div
    {...props}
    data-persistent-view
    data-active={active}
    hidden={!visible}
    aria-hidden={!active}
    inert={!active}
    initial={false}
    animate={{
      opacity: active ? 1 : 0,
      x: active || reduced || motionMode !== "from-left" ? 0 : -motionDistance.view,
      y: 0,
    }}
    onAnimationComplete={() => { if (!active) setVisible(false); }}
    style={{ ...style, position: active ? "relative" : "absolute", inset: active ? undefined : fill ? 0 : "0 0 auto", pointerEvents: active ? "auto" : "none" }}
    transition={persistentViewTransition(active, Boolean(reduced), motionMode === "from-left")}
  />;
}
