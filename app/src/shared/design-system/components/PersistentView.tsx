/**
 * [INPUT]: 依赖 Motion 的 opacity 动画、React 本地可见状态与设计系统淡换时长
 * [OUTPUT]: 对外提供保留编辑器/表单实例的 PersistentView，关闭即退出交互、完成淡出才 hidden
 * [POS]: 阅读/编辑与设置栏目共用的视图切换基础件；父容器 position:relative，旧视图脱离流，避免双份内容撑高
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useState } from "react";
import { fadeTransition, reducedFadeTransition } from "../motion";

export function PersistentView({ active, style, ...props }: HTMLMotionProps<"div"> & { active: boolean }) {
  const [visible, setVisible] = useState(active);
  const reduced = useReducedMotion();
  if (active && !visible) setVisible(true);
  return <motion.div
    {...props}
    data-persistent-view
    data-active={active}
    hidden={!visible}
    aria-hidden={!active}
    inert={!active}
    initial={false}
    animate={{ opacity: active ? 1 : 0 }}
    onAnimationComplete={() => { if (!active) setVisible(false); }}
    style={{ ...style, position: active ? "relative" : "absolute", inset: active ? undefined : "0 0 auto", pointerEvents: active ? "auto" : "none" }}
    transition={reduced ? reducedFadeTransition : fadeTransition}
  />;
}
