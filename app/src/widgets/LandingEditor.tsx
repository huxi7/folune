/**
 * [INPUT]: 依赖独立 demo.html、ShowcaseBackdrop 背景与 DS 平滑圆角展示框
 * [OUTPUT]: 对外提供点阵流动背景之上的受限 iframe 互动体验，外壳统一裁剪界面边缘
 * [POS]: Landing 主展示插槽；iframe 隔离视口/浮层/Transition，不向正式 APP 传递状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { ShowcaseBackdrop } from "./LandingMotion/ShowcaseBackdrop";

export function LandingEditor() {
  return <>
    <ShowcaseBackdrop />
    <div className="landing-product-shell">
      <iframe className="landing-product-demo" title="Folune 互动体验：笔记、AI 整理与 Canvas"
        src="/demo.html" loading="lazy" sandbox="allow-scripts allow-same-origin" />
    </div>
  </>;
}
