/**
 * [INPUT]: 依赖 React useId 和博客封面主题，不使用图片请求或运行时动画
 * [OUTPUT]: 对外提供散页、枝条、关系三种原创 SVG 蓝图封面
 * [POS]: widgets 的博客插画；共享细网格、标尺与墨蓝轴，每篇以不同几何构图表达内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useId } from "react";
import type { BlogCoverKind } from "./landingBlogData";

function Branch({ x, y, length, angle, depth }: { x: number; y: number; length: number; angle: number; depth: number }) {
  const endX = x + Math.cos(angle) * length;
  const endY = y + Math.sin(angle) * length;
  return <>
    <path d={`M${x} ${y}L${endX} ${endY}`} opacity={0.3 + depth * 0.12} />
    {depth > 0 ? [-0.5, 0.5].map(turn => <Branch key={turn} x={endX} y={endY} length={length * 0.69} angle={angle + turn} depth={depth - 1} />) : <circle cx={endX} cy={endY} r="2" fill="currentColor" stroke="none" opacity=".4" />}
  </>;
}
export function BlogCover({ kind }: { kind: BlogCoverKind }) {
  const id = useId();
  return <svg className={`blog-cover blog-cover-${kind}`} viewBox="0 0 640 360" fill="none" aria-hidden="true">
    <defs>
      <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="currentColor" strokeOpacity=".09" /><circle cx="12" cy="12" r=".8" fill="currentColor" fillOpacity=".17" /></pattern>
      <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 1L1-1M0 6L6 0M5 7L7 5" stroke="currentColor" strokeOpacity=".13" /></pattern>
      <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#e5ecef" /></linearGradient>
    </defs>
    <path fill={`url(#${id}-wash)`} d="M0 0H640V360H0z" />
    <path fill={`url(#${id}-grid)`} d="M0 0H640V360H0z" />
    <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {kind === "paper" ? <>
        <circle cx="324" cy="172" r="124" strokeDasharray="2 7" opacity=".22" />
        <path d="M90 232C150 232 156 140 239 140M424 212C493 212 494 134 551 134" opacity=".4" />
        <g transform="translate(227 75) rotate(-15 88 102)"><rect width="176" height="204" fill="#eef2f3" strokeOpacity=".35" /><path d="M24 32H112M24 46H146" opacity=".3" /></g>
        <g transform="translate(246 74) rotate(8 88 102)"><rect width="176" height="204" fill="#f5f7f7" strokeOpacity=".5" /></g>
        <g transform="translate(249 74)"><rect width="164" height="206" fill="#fafbf9" /><path d="M23 40H88" strokeWidth="2" /><path d="M23 64H141M23 80H141M23 96H117M23 130H141M23 146H128M23 162H141" opacity=".3" /><path d="M23 184H61" opacity=".6" /></g>
        <path d="M88 219V244M76 232H101M540 122L552 134L540 146" opacity=".65" />
        <circle cx="177" cy="113" r="4" fill="currentColor" stroke="none" opacity=".4" />
      </> : kind === "branches" ? <>
        <circle cx="320" cy="166" r="125" strokeDasharray="2 7" opacity=".2" />
        <Branch x={320} y={299} length={79} angle={-Math.PI / 2} depth={5} />
        <path d="M257 299H383M280 310H360" opacity=".3" />
      </> : <>
        <ellipse cx="320" cy="178" rx="216" ry="114" strokeDasharray="2 7" opacity=".25" />
        <path d="M159 210C195 210 224 127 305 127S390 225 475 225M159 210C253 297 386 300 475 225M305 127C363 84 423 96 491 121" opacity=".7" />
        {([[127,166,64,82],[268,81,76,96],[439,184,72,88],[469,91,46,58]] as const).map(([x,y,w,h],i) => <g key={x}>
          <rect x={x+5} y={y+5} width={w} height={h} fill="#e7edef" strokeOpacity=".2" />
          <rect x={x} y={y} width={w} height={h} fill="#fafbf9" strokeOpacity={i === 1 ? 1 : 0.6} />
          <path d={`M${x+12} ${y+20}h${w-26}m${26-w} 12h${w-26}m${26-w} 12h${w-34}`} opacity=".3" />
          <circle cx={x+w/2} cy={y+h-12} r="2.5" fill="currentColor" stroke="none" />
        </g>)}
        <path d="M301 252H366M319 261H352" opacity=".35" />
      </>}
      <path d="M24 24H616V336H24z" opacity=".2" />
      {[24,616].flatMap(x=>[24,336].map(y=><path key={`${x}-${y}`} d={`M${x-4} ${y}h8M${x} ${y-4}v8`} opacity=".65" />))}
      <path d="M24 320H616" opacity=".25" />
      {Array.from({length:25},(_,i)=><path key={i} d={`M${32+i*24} 320v${i%4===0 ? 8 : 4}`} opacity=".35" />)}
    </g>
    <path fill={`url(#${id}-hatch)`} d="M24 321H616V336H24z" />
    <g fill="currentColor" opacity=".5" fontFamily="monospace" fontSize="9" letterSpacing="2"><text x="40" y="49">FOLUNE / {kind === "paper" ? "01" : kind === "branches" ? "02" : "03"}</text><text x="600" y="306" textAnchor="end">{kind === "paper" ? "A THOUGHT, KEPT" : kind === "branches" ? "ROOM TO GROW" : "BETWEEN IDEAS"}</text></g>
  </svg>;
}
