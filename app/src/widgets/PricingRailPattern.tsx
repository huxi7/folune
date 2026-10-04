/**
 * [INPUT]: 依赖 React useId、共享 TruchetPattern、Blueprint 外轨坐标和 pricing.css 的 Folune 色彩映射
 * [OUTPUT]: 提供价格正文两侧的 72px Truchet 曲线平铺，几何来自 Laper 公开价格页
 * [POS]: 价格页侧纹宿主；与目录共用曲线路径，定位、颜色与静态显示仍由价格样式独立持有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useId } from "react";
import { TruchetPattern } from "./TruchetPattern";

export function PricingRailPattern() {
  const id = useId();
  return <div className="pricing-rail-pattern" aria-hidden="true">
    {(["start", "end"] as const).map(side => <svg key={side} data-side={side} preserveAspectRatio="none">
      <defs><TruchetPattern id={`${id}-${side}`} line="var(--pricing-pattern-line)" accent="var(--pricing-pattern-accent)" /></defs>
      <rect width="100%" height="100%" fill={`url(#${id}-${side})`} />
    </svg>)}
  </div>;
}
