/**
 * [INPUT]: 优先加载 index.css 建立全局 CSS 层序，再依赖设计系统 motionTokenStyles、React、app/router、ThemeProvider、ToastProvider 与跨路由 WorkspaceEntryTransition
 * [OUTPUT]: 对外提供尊重系统 reduced-motion 的浏览器端 React 挂载入口
 * [POS]: app/src 的运行时入口，负责把全局 Motion/主题/Toast 上下文和 React Router 渲染到 index.html 的 root 节点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { RouterProvider } from "react-router-dom";

import { WorkspaceEntryTransition } from "./app/router/WorkspaceEntryTransition";
import { router } from "./app/router";
import { ToastProvider } from "./shared/design-system/components";
import { ThemeProvider } from "./shared/theme/ThemeProvider";
import { motionTokenStyles } from "./shared/design-system/motion";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <style>{motionTokenStyles}</style>
      <ThemeProvider>
        <ToastProvider>
          <WorkspaceEntryTransition>
            <RouterProvider router={router} />
          </WorkspaceEntryTransition>
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
