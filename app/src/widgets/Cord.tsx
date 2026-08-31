/**
 * [INPUT]: 依赖 React useId、widgets/cordGeometry 的 CordBox/cordCurveBetween 与 styles/cord.css 的语义类
 * [OUTPUT]: 对外提供 CordLayer、Cord 单条连线与可延后启动的 draw 语义
 * [POS]: app/src/widgets 的 Cord Signature 渲染层；只把 cordGeometry 算好的 path 交给 SVG，粗细恒定而观感上的两头收细由沿线透明度渐变承担，动效与配色全部下沉到 CSS 以避免每帧 React 更新
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useId, type ReactNode } from "react";

import { cordCurveBetween, type CordBox } from "./cordGeometry";

/** 语境色板；实际色值由 styles/cord.css 映射到 index.css 的语义 token */
export type CordTone = "archive" | "explore" | "relation";

/**
 * 观感上的粗细变化只能靠透明度——SVG 的 stroke 宽度沿路径恒定，
 * 变宽描边至今没有任何浏览器实现（W3C ISSUE-2271 自 2009 年悬置）。
 */
export type CordTaper = "both" | "none" | "toTarget";

export type CordProps = {
  /** 出场时自绘；reducedMotion 下自动降级为静态终态 */
  draw?: boolean;
  /** 本地因果编排的启动延迟；只写 CSS animation-delay，不逐帧更新 React */
  drawDelayMs?: number;
  /** 白光自中点淌向两端，表示「此刻正在发生」；建立完成后应关闭 */
  flow?: boolean;
  from: CordBox;
  mode?: "horizontal" | "radial";
  reducedMotion?: boolean;
  taper?: CordTaper;
  to: CordBox;
  tone?: CordTone;
  /** AI 临时推荐用 dashed，用户确认后的关联用 solid */
  variant?: "dashed" | "solid";
  width?: number;
};

const TAPER_STOPS: Record<CordTaper, readonly [number, number, number]> = {
  both: [0.1, 0.85, 0.1],
  none: [0.85, 0.85, 0.85],
  toTarget: [0.85, 0.5, 0.08],
};

export function CordLayer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className === undefined ? "cord-layer" : `cord-layer ${className}`}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function Cord({
  draw = false,
  drawDelayMs = 0,
  flow = false,
  from,
  mode = "horizontal",
  reducedMotion = false,
  taper = "both",
  to,
  tone = "archive",
  variant = "solid",
  width = 1.6,
}: CordProps) {
  // useId 的结果含 CSS/URL 不安全字符，沿用 ArchiveCord 的净化约定
  const gradientId = `cord-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const curve = cordCurveBetween(from, to, { mode });
  const [head, middle, tail] = TAPER_STOPS[taper];
  const animate = !reducedMotion;

  return (
    <g className="cord" data-tone={tone} data-variant={variant}>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1={curve.from.x}
          x2={curve.to.x}
          y1={curve.from.y}
          y2={curve.to.y}
        >
          <stop className="cord-stop" offset="0" stopOpacity={head} />
          <stop className="cord-stop" offset="0.5" stopOpacity={middle} />
          <stop className="cord-stop" offset="1" stopOpacity={tail} />
        </linearGradient>
      </defs>

      <path
        className={draw && animate ? "cord-line cord-line-draw" : "cord-line"}
        d={curve.d}
        pathLength="1"
        style={drawDelayMs === 0 ? undefined : { animationDelay: `${drawDelayMs}ms` }}
        stroke={`url(#${gradientId})`}
        strokeWidth={width}
      />

      {flow && animate
        ? curve.halves.map((half, index) => (
          // 两段均以中点为起点，同一个向外的 dash 动画即得到「光从中间淌向两端」。
          // 外发光刻意用更宽更淡的第二条描边，而非 feGaussianBlur——滤镜动画每帧重算且落主线程。
          <g className="cord-flow" key={index === 0 ? "toSource" : "toTarget"}>
            <path
              className="cord-flow-halo"
              d={half}
              pathLength="1"
              strokeWidth={width * 3.5}
            />
            <path
              className="cord-flow-core"
              d={half}
              pathLength="1"
              strokeWidth={width}
            />
          </g>
        ))
        : null}
    </g>
  );
}
