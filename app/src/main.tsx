/**
 * [INPUT]: 优先加载 index.css 建立全局 CSS 层序，再依赖设计系统 motionTokenStyles、React、app/router、ThemeProvider、ToastProvider 与跨路由 WorkspaceEntryTransition
 * [OUTPUT]: 对外提供本地存储品牌命名空间迁移与尊重系统 reduced-motion 的浏览器端 React 挂载入口
 * [POS]: app/src 的运行时入口，先把旧 SuperNote 偏好迁移到 Folune，再挂载全局 Motion/主题/Toast 上下文和 React Router
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

function migrateLegacyStorageNamespace() {
  try {
    const storage = window.localStorage;
    const legacyKeys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index))
      .filter((key): key is string => key !== null && /^supernote(?=[:_-])/.test(key));

    for (const legacyKey of legacyKeys) {
      const foluneKey = legacyKey.replace(/^supernote(?=[:_-])/, "folune");
      const legacyValue = storage.getItem(legacyKey);
      if (legacyValue === null) continue;

      try {
        if (storage.getItem(foluneKey) === null) {
          storage.setItem(foluneKey, legacyValue);
        }
        storage.removeItem(legacyKey);
      } catch {
        // 新键写入失败时保留旧键，避免丢失本机偏好。
      }
    }
  } catch {
    // 浏览器禁用本地存储时，产品继续以默认偏好启动。
  }
}

migrateLegacyStorageNamespace();

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
