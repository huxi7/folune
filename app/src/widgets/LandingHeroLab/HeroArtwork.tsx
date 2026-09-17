/**
 * [INPUT]: 依赖 React useId 与本模块 CSS 动画、Folune 的纸张/细线视觉语言
 * [OUTPUT]: 对外提供 PaperArtwork、ContourArtwork、DaylightArtwork 与 MarginNotes
 * [POS]: 首屏研究的纯装饰层；借鉴 React Bits Waves、Aceternity 路径与 Magic UI 图案的组合思路，几何原创且不承载产品状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useId } from "react";

export function MarginNotes({ kind }: { kind: "paper" | "contour" | "daylight" }) {
  return <div className={`hero-lab-margins hero-lab-margins-${kind}`} aria-hidden="true">
    <div className="hero-lab-margin hero-lab-margin-left"><span className="hero-lab-margin-number">01 — 03</span><div className="hero-lab-ruler" /><span className="hero-lab-margin-caption">留一点空白</span><i /></div>
    <div className="hero-lab-margin hero-lab-margin-right"><span className="hero-lab-margin-number">FOLUNE / NOTES</span><div className="hero-lab-ruler" /><span className="hero-lab-margin-caption">让想法慢慢生长</span><i /></div>
  </div>;
}

export function PaperArtwork() {
  const id = useId();
  return <div className="hero-lab-art hero-lab-paper-art" aria-hidden="true">
    <div className="hero-lab-paper-outline hero-lab-paper-back" />
    <div className="hero-lab-paper-outline hero-lab-paper-front" />
    <div className="hero-lab-fragment hero-lab-fragment-left">
      <span>随手记 · 01</span><p>散步的时候，<br />想法也慢了下来。</p><i /><i /><i />
    </div>
    <div className="hero-lab-fragment hero-lab-fragment-right">
      <span>日常 / 观察</span><p>把注意力，<br />还给眼前的事。</p><i /><i /><i />
    </div>
    <svg className="hero-lab-cords" viewBox="0 0 1120 540" fill="none" preserveAspectRatio="none">
      <defs><linearGradient id={id}><stop stopColor="#395875" stopOpacity="0" /><stop offset=".5" stopColor="#395875" stopOpacity=".55" /><stop offset="1" stopColor="#395875" stopOpacity="0" /></linearGradient></defs>
      <g className="hero-lab-cord-base"><path d="M 80,374 C 265,520 335,435 444,441" /><path d="M 1012,156 C 935,65 779,70 711,107" /><path d="M 995,311 C 963,463 825,476 692,449" /></g>
      <g stroke={`url(#${id})`} className="hero-lab-cord-travel"><path pathLength="100" d="M 80,374 C 265,520 335,435 444,441" /><path pathLength="100" d="M 995,311 C 963,463 825,476 692,449" /></g>
      <g className="hero-lab-cord-dots"><circle cx="444" cy="441" r="2" /><circle cx="711" cy="107" r="2" /><circle cx="692" cy="449" r="2" /></g>
    </svg>
    <span className="hero-lab-paper-footer">每一个想法，都有它的位置。</span>
  </div>;
}

export function ContourArtwork() {
  return <div className="hero-lab-art hero-lab-contour-art" aria-hidden="true">
    <div className="hero-lab-contour-dots" />
    <svg viewBox="0 0 1120 540" fill="none" preserveAspectRatio="xMidYMid slice">
      <g className="hero-lab-contour-bank hero-lab-contour-bank-one">
        {Array.from({ length: 19 }, (_, i) => <path key={i} d={`M ${-260 + i * 18},-90 C ${150 + i * 12},-35 ${-180 + i * 20},350 ${80 + i * 19},432 S ${820 + i * 24},${470 + i * 18} ${1130 + i * 14},650`} />)}
      </g>
      <g className="hero-lab-contour-bank hero-lab-contour-bank-two">
        {Array.from({ length: 17 }, (_, i) => <path key={i} d={`M ${580 + i * 24},-120 C ${510 + i * 22},100 ${1120 - i * 8},${80 + i * 9} ${1140 - i * 10},${265 + i * 9} S ${660 + i * 10},${340 + i * 16} ${1040 + i * 22},630`} />)}
      </g>
      <g className="hero-lab-contour-guides"><path d="M 0,452 H 1120" /><path d="M 0,88 H 1120" /></g>
    </svg>
    <div className="hero-lab-contour-coordinate"><span>一点一滴</span><span>渐成脉络</span></div>
  </div>;
}

export function DaylightArtwork() {
  return <div className="hero-lab-art hero-lab-daylight-art" aria-hidden="true">
    <div className="hero-lab-daylight-wash" />
    <div className="hero-lab-daylight-rule" />
    <div className="hero-lab-folio">
      <div className="hero-lab-folio-back" />
      <div className="hero-lab-folio-page">
        <span className="hero-lab-folio-index">一页日常 <span>017</span></span>
        <h3>留一点时间，<br />给没有目的的散步。</h3>
        <p>不必急着得出结论。<br />沿途记下的几句话，<br />也许会在另一天，连成新的想法。</p>
        <div className="hero-lab-folio-lines"><i /><i /><i /></div>
        <span className="hero-lab-folio-bottom">日常与灵感 <span>↗</span></span>
      </div>
      <div className="hero-lab-folio-note"><span>相关的一页</span><p>散步时，注意力回来了。</p><div /></div>
      <svg className="hero-lab-folio-cord" viewBox="0 0 440 460" fill="none"><path d="M 80,337 C -35,428 276,505 301,382" /><path className="hero-lab-folio-cord-ink" pathLength="100" d="M 80,337 C -35,428 276,505 301,382" /></svg>
    </div>
  </div>;
}
