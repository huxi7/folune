/**
 * [INPUT]: 依赖 landing.css 的 Blueprint 坐标、固定七线、大小横纹交替与回环编织、格点纹样、墨蓝层级与两端渐隐
 * [OUTPUT]: 对外提供 paper / weave / index 三种静态 LandingRailTexture 及 RailVariant 类型
 * [POS]: widgets 的首页侧轨纹理；由 LandingSections 的章节外框为评价、指南和精选博客各装配一次，连续覆盖上下空轨与正文，不持有骨架、布局或交互状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type RailVariant = "paper" | "weave" | "index";

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
