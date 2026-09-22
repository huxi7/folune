/**
 * [INPUT]: 依赖 landing.css 的 Blueprint 坐标、固定七线、大小横纹交替与回环编织、格点纹样、墨蓝层级与两端渐隐
 * [OUTPUT]: 对外提供 paper / weave / index 三种静态 LandingRailTexture
 * [POS]: widgets 的首页侧轨纹理；仅评价、指南和精选博客装配，不持有骨架、布局或交互状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
type RailVariant = "paper" | "weave" | "index";

export function LandingRailTexture({ variant }: { variant: RailVariant }) {
  return <div className="landing-rail-texture" data-variant={variant} aria-hidden="true">
    {(["start", "end"] as const).map(side => <div className="landing-rail-texture-side" data-side={side} key={side}>
      <div className="landing-rail-texture-pattern">
        <span className="landing-rail-detail" />
        <span className="landing-rail-main" />
      </div>
    </div>)}
  </div>;
}
