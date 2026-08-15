/**
 * [INPUT]: 依赖 motion/react 的 Transition 类型
 * [OUTPUT]: 对外提供 Panel 进入/退出、工作台布局与淡入淡出四类克制 Tween 配置
 * [POS]: app/src/pages 的工作台空间关系配置；Panel 与 Paper 使用同轴无弹跳时间线，颜色与压感仍由 CSS 负责
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Transition } from "motion/react";

export const panelEnterTransition: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};

export const panelExitTransition: Transition = {
  duration: 0.17,
  ease: [0.4, 0, 1, 1],
};

export const workspaceLayoutTransition: Transition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
};

export const fadeTransition: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};
