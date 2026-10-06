/**
 * [INPUT]: 依赖 Motion 的 Transition/Variants 类型与 CSS 自定义属性协议
 * [OUTPUT]: 对外提供借鉴Laper的菜单/模态与紧凑菜单档、保持原侧向淡入的工作区侧栏、Laper确认按钮400/40 tap spring、150ms/200ms中性悬停及同源CSS token和DS目录；营销提供Laper首屏/区块/标题/文章行配方；品牌入口/纸面独立
 * [POS]: Design System 的唯一通用动效语言；组件不复制数字，纸面/绳线的领域几何仍归 pages/widgets
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Transition, Variants } from "motion/react";

export const motionDuration = {
  press: 0.09,
  hover: 0.15,
  buttonHover: 0.2,
  microEnter: 0.16,
  microExit: 0.13,
  menuEnter: 0.15,
  menuExit: 0.15,
  compactMenuEnter: 0.12,
  compactMenuExit: 0.1,
  panelEnter: 0.22,
  panelExit: 0.17,
  modalEnter: 0.15,
  modalExit: 0.15,
  viewEnter: 0.28,
  viewExit: 0.18,
  tree: 0.21,
  spatial: 0.36,
  reveal: 0.42,
  quiet: 0.6,
  progressRotate: 1.8,
  progressArc: 1.4,
} as const;
export const motionEase = {
  enter: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1],
  standard: [0.2, 0, 0, 1],
  tree: [0.2, 0.8, 0.2, 1],
  // Laper 菜单是 ease-out，弹窗是缓起步 standard；不能拿 settle 代替所有表面的淡入。
  menu: [0, 0, 0.58, 1],
  surface: [0.4, 0, 0.2, 1],
} as const;
export const motionSpring = {
  tap: { type: "spring", stiffness: 400, damping: 40 },
  // 回弹只服务短距离的直接操控，文本/大面板不用物理长尾。
  response: { type: "spring", visualDuration: 0.18, bounce: 0 },
  spatial: { type: "spring", visualDuration: motionDuration.spatial, bounce: 0.04 },
} as const;
export const motionDistance = { panel: 8, modal: 0, popover: 8, submenu: 10, reveal: 16, view: 24, content: 12 } as const;
export const motionScale = { menu: 0.95, panel: 1, modal: 0.9 } as const;
export const surfaceTransformOrigin = "50% 50%";
export const staggerStepMs = 32;
export const staggerMaxMs = 128;

// ---- Laper 公开前端包实测；营销节奏独立于 APP 的短反馈 ----
export const marketingMotion = {
  ease: [0.2, 0.7, 0.2, 1],
  hero: { distance: 18, duration: 550 },
  section: { distance: 24, duration: 550 },
  heading: { distance: 16, duration: 480 },
  row: { distance: 24, duration: 420 },
  rowStagger: 50,
  rowStaggerMax: 250,
  viewportMargin: "-80px",
} as const;

export const fadeTransition: Transition = { type: "tween", duration: motionDuration.microEnter, ease: motionEase.enter };
export const microExitTransition: Transition = { type: "tween", duration: motionDuration.microExit, ease: motionEase.exit };
export const reducedFadeTransition: Transition = { type: "tween", duration: motionDuration.press, ease: motionEase.standard };
export const panelEnterTransition: Transition = {
  type: "tween", duration: motionDuration.panelEnter, ease: motionEase.enter,
};
export const panelExitTransition: Transition = {
  type: "tween", duration: motionDuration.panelExit, ease: motionEase.exit,
};
function modalTransition(open: boolean, reduced: boolean): Transition {
  return reduced ? reducedFadeTransition : {
    type: "tween", duration: open ? motionDuration.modalEnter : motionDuration.modalExit, ease: motionEase.surface,
  };
}
/** Laper设置模态的父层/遮罩/面板同拍进入；父层只参与进入，关闭由内部两层完成。 */
export function modalBackdropVariants(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: modalTransition(true, reduced) },
    exit: { opacity: 0, transition: modalTransition(false, reduced) },
  };
}
export const workspaceLayoutTransition: Transition = panelEnterTransition;
export const spatialSpring: Transition = motionSpring.spatial;
export const treeTransition: Transition = { type: "tween", duration: motionDuration.tree, ease: motionEase.tree };

/** 目录视图从左侧进入、原路返回；短距离承接不推动底层内容。 */
export function persistentViewTransition(active: boolean, reduced: boolean, directional: boolean): Transition {
  if (reduced) return reducedFadeTransition;
  if (!directional) return active ? fadeTransition : microExitTransition;
  return { type: "tween", duration: active ? motionDuration.viewEnter : motionDuration.viewExit, ease: active ? motionEase.enter : motionEase.exit };
}

/** 新上下文的输入表面轻轻浮现；只在会话身份建立时播放，不跟随每次输入重播。 */
export function contentEntranceVariants(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : motionDistance.content },
    visible: {
      opacity: 1, y: 0,
      transition: reduced ? reducedFadeTransition : {
        type: "tween",
        duration: motionDuration.viewEnter,
        ease: motionEase.enter,
      },
    },
  };
}

export type SurfaceMotion = "popover" | "compact-menu" | "submenu" | "modal" | "fade" | "panel-left" | "panel-right";
export type SurfacePlacement = "top" | "bottom";
export function surfaceVariants(kind: SurfaceMotion, reduced: boolean, _placement: SurfacePlacement = "bottom"): Variants {
  if (reduced || kind === "fade") return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: reduced ? reducedFadeTransition : fadeTransition },
    exit: { opacity: 0, transition: reduced ? reducedFadeTransition : microExitTransition },
  };
  if (kind === "panel-left" || kind === "panel-right") {
    // 侧栏保持固定尺寸，只从各自外侧浮现；不是从中心缩放的Popover。
    const x = kind === "panel-left" ? -motionDistance.panel : motionDistance.panel;
    return {
      hidden: { opacity: 0, x, scale: motionScale.panel },
      visible: { opacity: 1, x: 0, scale: 1, transition: panelEnterTransition },
      exit: { opacity: 0, x, scale: motionScale.panel, transition: panelExitTransition },
    };
  }
  if (kind === "submenu") return {
    hidden: { opacity: 0, x: -motionDistance.submenu },
    visible: { opacity: 1, x: 0, transition: { type: "tween", duration: motionDuration.menuEnter, ease: motionEase.menu } },
    exit: { opacity: 0, x: -motionDistance.submenu, transition: { type: "tween", duration: motionDuration.menuExit, ease: motionEase.menu } },
  };
  const modal = kind === "modal";
  const compact = kind === "compact-menu";
  // Laper菜单不因上下定位反转动画方向：所有菜单均从下方8px回到原位。
  const y = modal ? motionDistance.modal : motionDistance.popover;
  const scale = modal ? motionScale.modal : motionScale.menu;
  return {
    hidden: { opacity: 0, scale, y },
    visible: {
      opacity: 1, scale: 1, y: 0,
      transition: modal ? modalTransition(true, false) : { type: "tween", duration: compact ? motionDuration.compactMenuEnter : motionDuration.menuEnter, ease: motionEase.menu },
    },
    exit: {
      opacity: 0, scale, y,
      transition: modal ? modalTransition(false, false) : { type: "tween", duration: compact ? motionDuration.compactMenuExit : motionDuration.menuExit, ease: motionEase.menu },
    },
  };
}

/** 设计系统直接陈列生产参数，不维护另一份展示专用时长/曲线。 */
export const surfaceMotionCatalog = [
  { kind: "compact-menu", label: "紧凑菜单", use: "新建下拉、笔记区更多", enter: motionDuration.compactMenuEnter, exit: motionDuration.compactMenuExit, ease: motionEase.menu, scale: motionScale.menu, offset: `Y +${motionDistance.popover}px`, source: "用户确认的小菜单调速；沿用Laper菜单几何与曲线" },
  { kind: "popover", label: "菜单", use: "右键、Select、账户及其他菜单", enter: motionDuration.menuEnter, exit: motionDuration.menuExit, ease: motionEase.menu, scale: motionScale.menu, offset: `Y +${motionDistance.popover}px`, source: "Laper menuPop / menu" },
  { kind: "submenu", label: "子菜单", use: "账户语言、主题二级菜单", enter: motionDuration.menuEnter, exit: motionDuration.menuExit, ease: motionEase.menu, scale: 1, offset: `X −${motionDistance.submenu}px`, source: "Laper submenuSlide / menu" },
  { kind: "panel-right", label: "工作区侧栏", use: "文件库、助手面板", enter: motionDuration.panelEnter, exit: motionDuration.panelExit, ease: motionEase.enter, exitEase: motionEase.exit, scale: motionScale.panel, offset: `左 −${motionDistance.panel}px / 右 +${motionDistance.panel}px；不缩放`, source: "Folune原侧栏：外侧平移与透明度，不套用Popover" },
  { kind: "modal", label: "模态弹窗", use: "设置、命令面板、确认、积分弹窗", enter: motionDuration.modalEnter, exit: motionDuration.modalExit, ease: motionEase.surface, scale: motionScale.modal, offset: "0px；父层与本体同拍渐入", source: "Laper dialogPop / dialog / modal-wrapper" },
] as const;

// React 与 CSS 由同一份数值生成；无需在构建前同步另一张参数表。
const cssName = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
export const motionTokenStyles = `:root{${Object.entries(motionDuration)
  .map(([name, seconds]) => `--motion-${cssName(name)}:${seconds * 1000}ms;`).join("")}${Object.entries(motionEase)
  .map(([name, points]) => `--ease-${name}:cubic-bezier(${points.join(",")});`).join("")}--motion-stagger-step:${staggerStepMs}ms;--motion-stagger-max:${staggerMaxMs}ms;}
.landing-blueprint{--marketing-ease:cubic-bezier(${marketingMotion.ease.join(",")});${(["hero", "section", "heading", "row"] as const).map(kind => `--marketing-${kind}-distance:${marketingMotion[kind].distance}px;--marketing-${kind}-duration:${marketingMotion[kind].duration}ms;`).join("")}}
@media(prefers-reduced-motion:reduce){:root{--motion-press:90ms;--motion-hover:0ms;--motion-button-hover:0ms;--motion-micro-enter:90ms;--motion-micro-exit:90ms;--motion-menu-enter:90ms;--motion-menu-exit:90ms;--motion-compact-menu-enter:90ms;--motion-compact-menu-exit:90ms;--motion-panel-enter:90ms;--motion-panel-exit:90ms;--motion-modal-enter:90ms;--motion-modal-exit:90ms;--motion-view-enter:90ms;--motion-view-exit:90ms;--motion-tree:0ms;--motion-reveal:90ms;}}`;

export function revealVariants(reduced: boolean, scale = false): Variants {
  return {
    hidden: { opacity: 0, y: reduced || scale ? 0 : motionDistance.reveal, scale: reduced || !scale ? 1 : 0.985 },
    visible: { opacity: 1, y: 0, scale: 1, transition: reduced ? reducedFadeTransition : { duration: motionDuration.reveal, ease: motionEase.enter } },
  };
}
export function staggerVariants(reduced: boolean): Variants {
  return { hidden: {}, visible: { transition: { staggerChildren: reduced ? 0 : staggerStepMs / 1000 } } };
}
