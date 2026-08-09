/**
 * [INPUT]: 依赖 React SVGProps/forwardRef/useId 与 design-system.css 的固定尺寸、分组变换原点约束
 * [OUTPUT]: 对外提供默认 Formation 造型、可选 active Motion、三种归档候选与可访问 SVG 属性
 * [POS]: design-system 的 AI 品牌符号原子件，静态即成立并以稳定 core/connector/node 节点承载正式聚合 Motion
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { forwardRef, useId, type ReactNode, type SVGProps } from "react";

export type ThinkingMarkVariant = "radiation" | "formation" | "fold";

export interface ThinkingMarkProps
  extends Omit<SVGProps<SVGSVGElement>, "children" | "height" | "width"> {
  active?: boolean;
  size?: number;
  title?: string;
  variant?: ThinkingMarkVariant;
}

function RadiationGeometry() {
  return (
    <>
      <g data-part="arms">
        <path data-part="arm-a" d="m10.15 6.45-.65-2.8" />
        <path data-part="arm-b" d="m15.45 8.35 2.8-1.9" />
        <path data-part="arm-c" d="M16.4 12.1h3.45" />
        <path data-part="arm-d" d="m15.05 15.5 2.35 2.75" />
        <path data-part="arm-e" d="m8.55 15.85-1.9 2.55" />
      </g>
      <rect
        data-part="core"
        fill="currentColor"
        height="5.2"
        rx="1.5"
        stroke="none"
        transform="rotate(8 12 12)"
        width="5.2"
        x="9.4"
        y="9.4"
      />
    </>
  );
}

function FormationGeometry() {
  return (
    <>
      <g data-part="connectors">
        <path data-part="connector-a" d="M9.3 10.4H8V5.9H6.5" pathLength="1" />
        <path data-part="connector-b" d="M9.3 13.4H7.8v3.7H6.55" pathLength="1" />
        <path data-part="connector-c" d="M14.7 10.25h1.55V5.9h1.15" pathLength="1" />
        <path data-part="connector-d" d="M14.7 12.15h3.05" pathLength="1" />
        <path data-part="connector-e" d="M13.25 14.7v1.8h2.55v1.35" pathLength="1" />
      </g>
      <rect
        data-part="core"
        fill="currentColor"
        height="5.5"
        rx="1.65"
        stroke="none"
        width="5.4"
        x="9.3"
        y="9.25"
      />
      <g data-part="nodes" fill="currentColor" stroke="none">
        <circle data-part="node-a" cx="5.15" cy="5.9" r="1.25" />
        <circle data-part="node-b" cx="5.15" cy="17.1" r="1.4" />
        <circle data-part="node-c" cx="18.55" cy="5.9" r="1.05" />
        <circle data-part="node-d" cx="19.1" cy="12.15" r="1.35" />
        <circle data-part="node-e" cx="15.8" cy="19" r="1.15" />
      </g>
    </>
  );
}

function FoldGeometry() {
  return (
    <>
      <path data-part="fold-a" d="M8.5 4.5h-3a1 1 0 0 0-1 1v3.2" />
      <path data-part="fold-b" d="M15.5 4.5h3a1 1 0 0 1 1 1v3.2" />
      <path data-part="fold-c" d="M19.5 15.3v3.2a1 1 0 0 1-1 1h-3" />
      <rect
        data-part="core"
        fill="currentColor"
        height="4.2"
        rx="1.05"
        stroke="none"
        transform="rotate(45 12 12)"
        width="4.2"
        x="9.9"
        y="9.9"
      />
    </>
  );
}

const geometryByVariant = {
  fold: <FoldGeometry />,
  formation: <FormationGeometry />,
  radiation: <RadiationGeometry />,
} satisfies Record<ThinkingMarkVariant, ReactNode>;

export const ThinkingMark = forwardRef<SVGSVGElement, ThinkingMarkProps>(
  function ThinkingMark(
    {
      active = false,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      className = "",
      size = 16,
      title,
      variant = "formation",
      ...svgProps
    },
    ref,
  ) {
    const generatedTitleId = useId();
    const titleId = title ? generatedTitleId : undefined;
    const hasAccessibleName = Boolean(title || ariaLabel || ariaLabelledBy);

    return (
      <svg
        {...svgProps}
        aria-hidden={hasAccessibleName ? undefined : true}
        aria-label={ariaLabel}
        aria-labelledby={titleId ?? ariaLabelledBy}
        className={["ds-thinking-mark", className].filter(Boolean).join(" ")}
        data-active={active || undefined}
        data-variant={variant}
        fill="none"
        focusable="false"
        height={size}
        ref={ref}
        role={hasAccessibleName ? "img" : undefined}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {title ? <title id={titleId}>{title}</title> : null}
        {geometryByVariant[variant]}
      </svg>
    );
  },
);
