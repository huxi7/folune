/**
 * [INPUT]: 依赖 React useId、Blueprint 外轨坐标和 pricing.css 的 Folune 色彩映射
 * [OUTPUT]: 提供价格正文两侧的 72px Truchet 曲线平铺，几何来自 Laper 公开价格页
 * [POS]: 价格页专用侧纹；保留参考页三个路径和横向渐隐，不改博客编织纹或引入外部运行依赖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useId } from "react";

export function PricingRailPattern() {
  const id = useId();
  return <div className="pricing-rail-pattern" aria-hidden="true">
    {(["start", "end"] as const).map(side => <svg key={side} data-side={side} preserveAspectRatio="none">
      <defs><pattern id={`${id}-${side}`} width="72" height="72" patternUnits="userSpaceOnUse">
        <path d="M0 36 C18 36 18 0 36 0 M36 0 C54 0 54 36 72 36 M72 36 C54 36 54 72 36 72 M36 72 C18 72 18 36 0 36" fill="none" stroke="var(--pricing-pattern-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d="M0 0 C24 24 48 24 72 0 M0 72 C24 48 48 48 72 72 M0 36 C18 18 54 18 72 36 M0 36 C18 54 54 54 72 36" fill="none" stroke="var(--pricing-pattern-accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d="M18 18 C28 28 44 28 54 18 M18 54 C28 44 44 44 54 54 M18 18 C8 28 8 44 18 54 M54 18 C64 28 64 44 54 54" fill="none" stroke="var(--pricing-pattern-line)" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id}-${side})`} />
    </svg>)}
  </div>;
}
