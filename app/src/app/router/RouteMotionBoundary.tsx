/**
 * [INPUT]: 依赖 React Router 的 useLocation/Outlet、Motion for React 的 AnimatePresence/motion 与 lib/motion 的路由变体
 * [OUTPUT]: 对外提供所有 URL 页面共用的 AnimatePresence 路由过渡边界
 * [POS]: app/src/app/router 的根布局；只负责页面视觉生命周期，不触碰 loader、鉴权、Paper/Canvas 数据交接
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { AnimatePresence, motion } from "motion/react";
import { Outlet, useLocation } from "react-router-dom";
import type { TargetAndTransition } from "motion/react";

import { pageAnimate, pageExit, pageInitial } from "../../lib/motion.js";

export function RouteMotionBoundary() {
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith("/app");
  const transition: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition } = isWorkspace
    ? {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { type: "spring" as const, stiffness: 200, damping: 40 } },
      exit: { opacity: 0, transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const } },
    }
    : { initial: pageInitial, animate: pageAnimate, exit: pageExit };
  // 查询参数通常是页面内状态（例如 Landing 的登录 Dialog），不能触发整页退场/入场。
  const routeKey = isWorkspace ? "workspace" : location.pathname;

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        className="route-motion-boundary"
        key={routeKey}
        initial={transition.initial}
        animate={transition.animate}
        exit={transition.exit}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
