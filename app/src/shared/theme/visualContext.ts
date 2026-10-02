/**
 * [INPUT]: 依赖 Router 已提交的 pathname、HTML 文档根与 locale 的纯文档语言策略，读取 ThemeProvider 保存于根节点的已解析主题，不读取存储或业务状态
 * [OUTPUT]: 对外提供 applyVisualContext/applyThemeAppearance；营销固定浅色，工作区恢复已解析偏好
 * [POS]: theme 的场景边界；路由装配负责同步，根级标记让 body Portal 与拖拽预览继承 APP 主题
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { applyDocumentLocale } from "../locale/documentLocale";

export function applyVisualContext(pathname: string, root: HTMLElement = document.documentElement) {
  root.dataset.visualContext = pathname === "/app" || pathname.startsWith("/app/")
    ? "app"
    : "marketing";
  applyThemeAppearance(root);
  applyDocumentLocale(root);
}

// ---- 场景只约束展示，不覆盖用户的 system/light/dark 持久化偏好 ----
export function applyThemeAppearance(root: HTMLElement = document.documentElement) {
  root.classList.toggle("dark", root.dataset.visualContext !== "marketing" && root.dataset.resolvedTheme === "dark");
}
