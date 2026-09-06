/**
 * [INPUT]: 依赖 Motion for React 的 transition/variant 对象约定与设计系统的 reduced-motion 全局策略
 * [OUTPUT]: 对外提供全站共用的 Spring、Apple easing、入场、交互、模态与路由动画语义
 * [POS]: app/src/lib 的动效语言边界；共享组件、路由与页面只消费这里的语义，不重复声明物理参数
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export const snappy = { type: "spring", stiffness: 400, damping: 30 };
export const gentle = { type: "spring", stiffness: 300, damping: 35 };
export const bouncy = { type: "spring", stiffness: 500, damping: 25, mass: 0.8 };
export const smooth = { type: "spring", stiffness: 200, damping: 40, mass: 1.2 };
export const inertia = { type: "spring", stiffness: 150, damping: 20, mass: 0.5 };

export const appleEase = [0.25, 0.1, 0.25, 1];
export const appleEaseOut = [0.22, 1, 0.36, 1];
export const appleDecelerate = [0, 0, 0.2, 1];

export const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: gentle },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: snappy },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.04, staggerChildren: 0.06 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: gentle },
};

// 阴影由 CSS :hover 过渡负责。CSS 自定义属性阴影交给 Motion 插值会在中间帧退化成无阴影。
export const hoverLift = {
  rest: {
    scale: 1,
    y: 0,
    transition: snappy,
  },
  hover: {
    scale: 1.012,
    y: -4,
    transition: snappy,
  },
  pressed: { scale: 1.004, y: -2, transition: bouncy },
};

export const tapScale = {
  rest: { scale: 1 },
  pressed: { scale: 0.98, transition: bouncy },
};

export const modalOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: appleEaseOut } },
  exit: { opacity: 0, transition: { duration: 0.14, ease: appleEase } },
};

export const modalContent = {
  hidden: { opacity: 0, scale: 0.985, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 40, mass: 1.05 },
  },
  exit: { opacity: 0, scale: 0.99, y: 4, transition: { duration: 0.14, ease: appleEase } },
};

export const pageTransition = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: smooth },
  exit: { opacity: 0, x: -18, transition: { duration: 0.18, ease: appleEase } },
};

export const pageInitial = { opacity: 0, x: 18 };
export const pageAnimate = { opacity: 1, x: 0, transition: smooth };
export const pageExit = { opacity: 0, x: -18, transition: { duration: 0.18, ease: appleEase } };

export const iconWiggle = {
  rest: { rotate: 0, scale: 1 },
  hover: { rotate: -4, scale: 1.06, transition: snappy },
};

export const successPulse = {
  initial: { opacity: 0, scale: 0.86 },
  animate: { opacity: 1, scale: 1, transition: bouncy },
};

export const errorShake = {
  initial: { opacity: 0, x: 0 },
  animate: {
    opacity: 1,
    x: [0, -4, 4, -2, 2, 0],
    transition: { ...gentle, x: { type: "spring", stiffness: 500, damping: 28 } },
  },
};

export const loadingTransition = {
  opacity: { duration: 0.18, ease: appleEaseOut },
  scale: gentle,
};

export const contentSwitch = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: gentle },
  exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease: appleEase } },
};
