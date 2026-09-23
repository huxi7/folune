/**
 * [INPUT]: 依赖 Router 已提交的 pathname 与 HTML 文档根，不读取主题偏好或业务状态
 * [OUTPUT]: 对外提供 applyVisualContext，将工作区与营销页面映射为独立的视觉作用域
 * [POS]: theme 的场景边界；路由装配负责同步，根级标记让 body Portal 与拖拽预览继承 APP 主题
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export function applyVisualContext(pathname: string, root: HTMLElement = document.documentElement) {
  root.dataset.visualContext = pathname === "/app" || pathname.startsWith("/app/")
    ? "app"
    : "marketing";
}
