/**
 * [INPUT]: 依赖 motion/react 的 Transition 类型
 * [OUTPUT]: 对外提供 press/micro/panel/spatial/stagger 语义 Motion Token 与工作台兼容过渡配置；纸张在两处之间的放大缩小归浏览器视图过渡，这里不再持有任何飞行规格
 * [POS]: app/src/pages 的唯一动效语言；只有 Canvas 新节点入场配 spring，Panel 保持克制 Tween，高频状态只消费 micro/press；没有消费者的 token 不留在这里
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Transition } from "motion/react";

export const motionDuration = {
  microEnter: 0.16,
  microExit: 0.13,
  panelEnter: 0.22,
  panelExit: 0.17,
  press: 0.09,
} as const;

export const staggerStepMs = 32;
export const staggerMaxMs = 128;

export const spatialSpring: Transition = {
  bounce: 0.04,
  type: "spring",
  visualDuration: 0.36,
};

export const panelEnterTransition: Transition = {
  duration: motionDuration.panelEnter,
  ease: [0.22, 1, 0.36, 1],
};

export const panelExitTransition: Transition = {
  duration: motionDuration.panelExit,
  ease: [0.4, 0, 1, 1],
};

export const workspaceLayoutTransition: Transition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
};

export const fadeTransition: Transition = {
  duration: motionDuration.microEnter,
  ease: [0.22, 1, 0.36, 1],
};

export const microExitTransition: Transition = {
  duration: motionDuration.microExit,
  ease: [0.4, 0, 1, 1],
};

export const reducedFadeTransition: Transition = {
  duration: motionDuration.press,
  ease: [0.4, 0, 1, 1],
};
