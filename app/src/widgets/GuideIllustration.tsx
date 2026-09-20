/**
 * [INPUT]: 依赖 React useId 隔离渐隐定义，消费指南的六种语义主题
 * [OUTPUT]: 对外提供 GuideIllustration 与 GuideCoverKind；网格与博客目录共用线稿
 * [POS]: 营销阅读指南的静态 SVG；通过纸页、段落与路径表达方法，不复刻交互界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useId } from "react";

export type GuideCoverKind = "guide-capture" | "guide-reading" | "guide-naming" | "guide-relations" | "guide-outline" | "guide-portability";

function Page({ x, y, width = 48, height = 62 }: { x: number; y: number; width?: number; height?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d={`M0 0H${width - 10}L${width} 10V${height}H0ZM${width - 10} 0V10H${width}`} />
    <path d={`M9 22H${width - 10}M9 30H${width - 10}M9 38H${width - 19}`} opacity=".55" />
  </g>;
}

export function GuideIllustration({ kind }: { kind: GuideCoverKind }) {
  const id = useId();
  return <svg className={`guide-illustration ${kind}`} viewBox="0 0 240 160" fill="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="160"><stop stopColor="currentColor" stopOpacity=".65" /><stop offset="1" stopColor="currentColor" stopOpacity=".16" /></linearGradient></defs>
    <g stroke={`url(#${id}-fade)`} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      {kind === "guide-capture" && <>
        <Page x={18} y={16} width={35} height={48} /><Page x={25} y={95} width={35} height={48} />
        <path d="M53 42H75Q94 42 94 80M60 119H75Q94 119 94 80M94 80H132" />
        <Page x={140} y={38} width={65} height={88} /><path d="M148 133H213V46M156 140H221V54" opacity=".4" />
        <circle cx="94" cy="80" r="3" /><path d="M125 75L132 80L125 85" />
      </>}
      {kind === "guide-reading" && <>
        <Page x={27} y={25} width={80} height={110} /><path d="M40 73H93M40 81H85M40 106H77" />
        <path d="M102 76C122 76 116 48 140 48M102 109C125 109 120 110 140 110" />
        <path d="M143 32H214V68H143ZM153 43H201M153 54H185M143 92H214V127H143ZM153 103H203M153 114H189" />
        <path d="M41 49H77" strokeWidth="2" />
      </>}
      {kind === "guide-naming" && <>
        <path d="M32 20V137M32 36H79M32 81H79M32 126H79M120 36H145V19H192M145 36V58H192M120 81H161M120 126H145V114H193M145 126V142H193" />
        <path d="M79 24H120V48H79ZM79 69H120V93H79ZM79 114H120V138H79Z" />
        <path d="M32 81H79M120 81H161" strokeWidth="2" /><path d="M161 69H222V93H161ZM170 81H210" />
        <path d="M192 19H218M192 58H217M193 114H218M193 142H218" opacity=".5" />
      </>}
      {kind === "guide-relations" && <>
        <Page x={20} y={53} /><Page x={165} y={15} /><Page x={165} y={96} height={53} />
        <path d="M68 78C114 78 112 45 165 45" /><path d="M68 94C109 94 122 122 165 122" strokeDasharray="3 5" opacity=".6" />
        <circle cx="118" cy="60" r="10" /><path d="M113 60L117 64L123 56M113 112L122 121M122 112L113 121" />
      </>}
      {kind === "guide-outline" && <>
        <path d="M15 20H73V51H15ZM24 30H58M24 39H48M29 64H87V95H29ZM38 74H75M38 83H62M15 109H73V140H15ZM24 119H58M24 128H48" />
        <path d="M73 35H105V80H144M87 80H144M73 125H105V80" />
        <path d="M144 20H221V142H144ZM156 39H204M156 63H161M170 63H208M170 74H200M156 92H161M170 92H208M170 103H201M156 123H190" />
      </>}
      {kind === "guide-portability" && <>
        <Page x={14} y={48} width={55} height={73} /><path d="M69 83H99M99 83C124 83 108 43 137 43M99 83C124 83 108 122 137 122" />
        <path d="M143 14H219V70H143ZM143 26H219M155 39L149 45L155 51M176 39L182 45L176 51M167 37L162 54M143 96H219V149H143ZM151 105H178M151 116H210M151 126H210M151 136H194" />
        <path d="M131 38L137 43L131 48M131 117L137 122L131 127" />
      </>}
    </g>
  </svg>;
}
