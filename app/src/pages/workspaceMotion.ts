/**
 * [INPUT]: 依赖 Design System 的唯一 motion token
 * [OUTPUT]: 对外提供 press/micro/panel/spatial/stagger 语义 Motion Token、tree FLIP 的 CSS 与 JS 同源时间轴，以及工作台兼容过渡配置；纸张在两处之间的放大缩小归浏览器视图过渡，这里不再持有任何飞行规格
 * [POS]: app/src/pages 的领域动效适配器；只有 Canvas 新节点入场配 spring，Panel 保持克制 Tween，高频状态只消费 micro/press；文件树行位移与归档线端点迁移共用同一条 FLIP 曲线，因此它必须同时以 CSS 字符串和可求值函数出现在这里，而不是各自复制一份数字
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motionDuration, motionEase } from "../shared/design-system/motion";
export {
  motionDuration, staggerStepMs, staggerMaxMs, spatialSpring,
  panelEnterTransition, panelExitTransition, workspaceLayoutTransition,
  fadeTransition, microExitTransition, reducedFadeTransition,
} from "../shared/design-system/motion";

/*
 * 文件树行位置变化用 Web Animations FLIP 表达, 归档线的端点必须跟着同一条时间轴
 * 迁移 —— 线的生命感来自「与树同时到位」, 给它另配一条相似但不同的曲线, 就会
 * 在每次展开/收起时看见端点比行早到或晚到。因此这里同时给出 CSS 字符串与可求值
 * 函数, 两者由同一组控制点导出, 谁也不能单独改。
 */
export const treeFlipDurationMs = motionDuration.tree * 1000;
export const treeFlipEasingPoints = motionEase.tree;
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
