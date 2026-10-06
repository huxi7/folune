/**
 * [INPUT]: 依赖调用方提供的唯一 SVG 图案 ID、描边颜色与可选路径动效类
 * [OUTPUT]: 对外提供 72px TruchetPattern 三层曲线平铺，几何取自 Laper 公开页面
 * [POS]: widgets 的纯 SVG 纹样定义；首页波浪、价格与公开目录共用路径，宿主各自持有定位、色彩和显现生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function TruchetPattern({ id, line, accent, pathClassName }: {
  id: string;
  line: string;
  accent: string;
  pathClassName?: string;
}) {
  return <pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
    <path className={pathClassName} pathLength="1" d="M0 36 C18 36 18 0 36 0 M36 0 C54 0 54 36 72 36 M72 36 C54 36 54 72 36 72 M36 72 C18 72 18 36 0 36" fill="none" stroke={line} strokeWidth="1" vectorEffect="non-scaling-stroke" />
    <path className={pathClassName} pathLength="1" d="M0 0 C24 24 48 24 72 0 M0 72 C24 48 48 48 72 72 M0 36 C18 18 54 18 72 36 M0 36 C18 54 54 54 72 36" fill="none" stroke={accent} strokeWidth="1" vectorEffect="non-scaling-stroke" />
    <path className={pathClassName} pathLength="1" d="M18 18 C28 28 44 28 54 18 M18 54 C28 44 44 44 54 54 M18 18 C8 28 8 44 18 54 M54 18 C64 28 64 44 54 54" fill="none" stroke={line} strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
  </pattern>;
}
