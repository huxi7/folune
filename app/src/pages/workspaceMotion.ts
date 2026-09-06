/**
 * [INPUT]: 依赖 motion/react 的 Transition 类型
 * [OUTPUT]: 对外提供 interactive/snappy/gentle/smooth/expressive 五档 spring、easeOut/standardEase、press/micro/panel/spatial/stagger 语义 Motion Token、tree FLIP 的 CSS 与 JS 同源时间轴，以及工作台兼容过渡配置；纸张在两处之间的放大缩小归浏览器视图过渡，这里不再持有任何飞行规格
 * [POS]: app/src/pages 的唯一动效语言；空间/尺寸/位置变化消费五档物理 preset，opacity/color/shadow/blur 继续消费短时 easing；文件树行位移与归档线端点迁移共用同一条 FLIP 曲线，因此它必须同时以 CSS 字符串和可求值函数出现在这里，而不是各自复制一份数字
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Transition } from "motion/react";

/**
 * 全局物理基线。空间/尺寸/位置使用 spring，视觉属性仍在消费点用短时 easing。
 * 这些对象是只读语义 token，组件不得自行复制一套 stiffness/damping/mass。
 */
export const interactive = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 1,
} as const;

export const snappy = {
  type: "spring",
  stiffness: 350,
  damping: 32,
  mass: 1,
} as const;

export const gentle = {
  type: "spring",
  stiffness: 300,
  damping: 35,
  mass: 1,
} as const;

export const smooth = {
  type: "spring",
  stiffness: 200,
  damping: 40,
  mass: 1.2,
} as const;

export const expressive = {
  type: "spring",
  stiffness: 500,
  damping: 28,
  mass: 0.8,
} as const;

export const easeOut = [0.22, 1, 0.36, 1] as const;
export const standardEase = [0.25, 0.1, 0.25, 1] as const;

export const motionDuration = {
  microEnter: 0.16,
  microExit: 0.13,
  panelEnter: 0.22,
  panelExit: 0.17,
  press: 0.09,
} as const;

export const staggerStepMs = 32;
export const staggerMaxMs = 128;

/*
 * 文件树行位置变化用 Web Animations FLIP 表达, 归档线的端点必须跟着同一条时间轴
 * 迁移 —— 线的生命感来自「与树同时到位」, 给它另配一条相似但不同的曲线, 就会
 * 在每次展开/收起时看见端点比行早到或晚到。因此这里同时给出 CSS 字符串与可求值
 * 函数, 两者由同一组控制点导出, 谁也不能单独改。
 */
export const treeFlipDurationMs = 210;
export const treeFlipEasingPoints = [0.2, 0.8, 0.2, 1] as const;
export const treeFlipEasing =
  `cubic-bezier(${treeFlipEasingPoints.join(", ")})`;

/**
 * 三次贝塞尔缓动求值: 先按 x 反解参数 t, 再取同一条曲线的 y。
 * Newton 迭代对这组控制点单调可解, 少数近端点的病态输入夹一次二分兜底。
 */
export const treeFlipEase = (progress: number): number => {
  const x = Math.min(1, Math.max(0, progress));
  if (x === 0 || x === 1) return x;
  const [x1, y1, x2, y2] = treeFlipEasingPoints;
  const curve = (a: number, b: number, t: number): number => {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t;
  };
  const slope = (a: number, b: number, t: number): number => {
    const inverse = 1 - t;
    return 3 * inverse * inverse * a
      + 6 * inverse * t * (b - a)
      + 3 * t * t * (1 - b);
  };

  let t = x;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const error = curve(x1, x2, t) - x;
    if (Math.abs(error) < 1e-5) return curve(y1, y2, t);
    const derivative = slope(x1, x2, t);
    if (Math.abs(derivative) < 1e-6) break;
    t -= error / derivative;
  }

  let low = 0;
  let high = 1;
  t = x;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const error = curve(x1, x2, t) - x;
    if (Math.abs(error) < 1e-5) break;
    if (error > 0) high = t;
    else low = t;
    t = (low + high) / 2;
  }
  return curve(y1, y2, t);
};

export const spatialSpring: Transition = {
  bounce: 0.04,
  type: "spring",
  visualDuration: 0.36,
};

export const panelEnterTransition: Transition = {
  ...gentle,
  opacity: { duration: motionDuration.panelEnter, ease: easeOut },
};

export const panelExitTransition: Transition = {
  ...snappy,
  opacity: { duration: motionDuration.panelExit, ease: [0.4, 0, 1, 1] },
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
