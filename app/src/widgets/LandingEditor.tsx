/**
 * [INPUT]: 依赖独立 demo.html 入口和原 Landing 展示框样式
 * [OUTPUT]: 对外提供受限 iframe 中的真实 UI 互动体验
 * [POS]: Landing 主展示插槽；iframe 隔离视口/浮层/Transition，不向正式 APP 传递状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function LandingEditor() {
  return <iframe className="landing-product-demo" title="Folune 互动体验：笔记、AI 整理与 Canvas"
    src="/demo.html" loading="lazy" sandbox="allow-scripts allow-same-origin" />;
}
