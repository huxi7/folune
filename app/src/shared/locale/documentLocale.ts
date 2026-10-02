/**
 * [INPUT]: 依赖正式入口 Provider 写入的 data-locale 与已提交路由的 data-visual-context
 * [OUTPUT]: 对外提供 applyDocumentLocale，同步当前页面的真实文档语言；未翻译的公开页面保持中文
 * [POS]: locale 的纯文档根策略，由 Provider 与 visualContext 共用，不读写存储、不加载 React 或改写用户语言偏好
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function applyDocumentLocale(root: HTMLElement = document.documentElement) {
  root.lang = root.dataset.visualContext !== "marketing" && root.dataset.locale === "en" ? "en" : "zh-CN";
}
