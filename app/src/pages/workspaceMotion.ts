/**
 * [INPUT]: 依赖 motion/react 的 Transition 类型
 * [OUTPUT]: 对外提供 Paper First 工作台唯一 panelSpring、paperSpring 与 fadeTransition 动效配置
 * [POS]: app/src/pages 的工作台空间关系配置；Panel、纸张、连线和回执共享参数，颜色与压感仍由 CSS 负责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Transition } from "motion/react";

export const panelSpring: Transition = {
  damping: 38,
  mass: 0.9,
  stiffness: 420,
  type: "spring",
};

export const paperSpring: Transition = {
  damping: 34,
  mass: 0.95,
  stiffness: 360,
  type: "spring",
};

export const fadeTransition: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};
