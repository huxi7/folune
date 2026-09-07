/**
 * [INPUT]: 依赖 Motion 的 Transition/Variants 类型与 CSS 自定义属性协议
 * [OUTPUT]: 对外提供语义时长、曲线、有限 spring、surface 变体与同源 CSS token 声明
 * [POS]: Design System 的唯一通用动效语言；组件不复制数字，纸面/绳线的领域几何仍归 pages/widgets
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Transition, Variants } from "motion/react";

export const motionDuration = {
  press: 0.09,
  microEnter: 0.16,
  microExit: 0.13,
  panelEnter: 0.22,
  panelExit: 0.17,
  modalEnter: 0.28,
  modalExit: 0.16,
  tree: 0.21,
  spatial: 0.36,
  reveal: 0.42,
  quiet: 0.6,
} as const;
export const motionEase = {
  enter: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1],
  standard: [0.2, 0, 0, 1],
  tree: [0.2, 0.8, 0.2, 1],
} as const;
export const motionSpring = {
  // 回弹只服务短距离的直接操控，文本/大面板不用物理长尾。
  response: { type: "spring", visualDuration: 0.18, bounce: 0 },
  surface: { type: "spring", visualDuration: motionDuration.modalEnter, bounce: 0 },
  spatial: { type: "spring", visualDuration: motionDuration.spatial, bounce: 0.04 },
} as const;
export const motionDistance = { panel: 8, modal: 10, popover: 4, reveal: 16 } as const;
export const staggerStepMs = 32;
export const staggerMaxMs = 128;

export const fadeTransition: Transition = { duration: motionDuration.microEnter, ease: motionEase.enter };
export const microExitTransition: Transition = { duration: motionDuration.microExit, ease: motionEase.exit };
export const reducedFadeTransition: Transition = { duration: motionDuration.press, ease: motionEase.standard };
export const panelEnterTransition: Transition = { duration: motionDuration.panelEnter, ease: motionEase.enter };
export const panelExitTransition: Transition = { duration: motionDuration.panelExit, ease: motionEase.exit };
export const workspaceLayoutTransition: Transition = panelEnterTransition;
export const spatialSpring: Transition = motionSpring.spatial;
export const treeTransition: Transition = { duration: motionDuration.tree, ease: motionEase.tree };

export type SurfaceMotion = "popover" | "modal" | "fade" | "panel-left" | "panel-right";
export type SurfacePlacement = "top" | "bottom";
export function surfaceVariants(kind: SurfaceMotion, reduced: boolean, placement: SurfacePlacement = "bottom"): Variants {
  if (reduced || kind === "fade") return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: reduced ? reducedFadeTransition : fadeTransition },
    exit: { opacity: 0, transition: reduced ? reducedFadeTransition : microExitTransition },
  };
  if (kind === "panel-left" || kind === "panel-right") {
    const x = kind === "panel-left" ? -motionDistance.panel : motionDistance.panel;
    return {
      hidden: { opacity: 0, x },
      visible: { opacity: 1, x: 0, transition: panelEnterTransition },
      exit: { opacity: 0, x, transition: panelExitTransition },
    };
  }
  const modal = kind === "modal";
  const y = modal ? motionDistance.modal : motionDistance.popover * (placement === "top" ? 1 : -1);
  return {
    hidden: { opacity: 0, scale: modal ? 0.985 : 0.98, y },
    visible: {
      opacity: 1, scale: 1, y: 0,
      transition: modal ? { ...motionSpring.surface, opacity: fadeTransition } : fadeTransition,
    },
    exit: {
      opacity: 0, scale: 0.99, y: y * 0.4,
      transition: { duration: modal ? motionDuration.modalExit : motionDuration.microExit, ease: motionEase.exit },
    },
  };
}

// React 与 CSS 由同一份数值生成；无需在构建前同步另一张参数表。
const cssName = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
export const motionTokenStyles = `:root{${Object.entries(motionDuration)
  .map(([name, seconds]) => `--motion-${cssName(name)}:${seconds * 1000}ms;`).join("")}${Object.entries(motionEase)
  .map(([name, points]) => `--ease-${name}:cubic-bezier(${points.join(",")});`).join("")}}
@media(prefers-reduced-motion:reduce){:root{--motion-press:90ms;--motion-micro-enter:90ms;--motion-micro-exit:90ms;--motion-panel-enter:90ms;--motion-panel-exit:90ms;--motion-modal-enter:90ms;--motion-modal-exit:90ms;--motion-tree:0ms;--motion-reveal:90ms;}}`;

export function revealVariants(reduced: boolean, scale = false): Variants {
  return {
    hidden: { opacity: 0, y: reduced || scale ? 0 : motionDistance.reveal, scale: reduced || !scale ? 1 : 0.985 },
    visible: { opacity: 1, y: 0, scale: 1, transition: reduced ? reducedFadeTransition : { duration: motionDuration.reveal, ease: motionEase.enter } },
  };
}
export function staggerVariants(reduced: boolean): Variants {
  return { hidden: {}, visible: { transition: { staggerChildren: reduced ? 0 : staggerStepMs / 1000 } } };
}
