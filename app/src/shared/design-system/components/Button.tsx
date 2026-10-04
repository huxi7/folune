/**
 * [INPUT]: 依赖 React 原生 button/ref、WarmTooltip、../icons 与共享控件材质/press token
 * [OUTPUT]: 对外提供 Button 与变体/尺寸类型；图标按钮从 aria-label 生成提示，tooltip/title 显式说明共用 WarmTooltip，外层已接入时去重
 * [POS]: app/src/shared/design-system/components 的核心命令基础件，以统一 16px 平滑圆角、克制实体层级和「原地收紧」的按压反馈统一全站操作质感
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Icon } from "../icons";
import type { ComponentPropsWithRef, ReactNode } from "react";
import WarmTooltip, { type WarmTooltipSide } from "./WarmTooltip";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "square";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  "data-warm-tooltip-trigger"?: boolean;
  tooltip?: ReactNode | false;
  tooltipSide?: WarmTooltipSide;
  children?: ReactNode;
  icon?: Icon;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary: "ds-button-primary",
  secondary: "ds-button-secondary",
  ghost: "ds-button-ghost",
  danger: "ds-button-danger",
};

const sizeClassName: Record<ButtonSize, string> = {
  default: "ds-button-size-default",
  square: "ds-button-size-square",
};

export function Button({
  "aria-busy": ariaBusy,
  children,
  className = "",
  disabled = false,
  icon: IconComponent,
  loading = false,
  size = "default",
  type = "button",
  variant = "secondary",
  title,
  tooltip,
  tooltipSide = "top",
  ...props
}: ButtonProps) {
  const button = (
    <button
      aria-busy={loading ? true : ariaBusy}
      className={[
        "ds-button",
        variantClassName[variant],
        sizeClassName[size],
        loading ? "ds-button-loading" : "",
        className,
      ].join(" ")}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      <span className="ds-button-content">
        {loading ? (
          <span aria-hidden="true" className="ds-button-spinner" />
        ) : IconComponent ? (
          <IconComponent aria-hidden="true" size={16} />
        ) : null}
        {children}
      </span>
    </button>
  );
  const hint = tooltip ?? title ?? (size === "square" ? props["aria-label"] : undefined);
  return hint && !props["data-warm-tooltip-trigger"]
    ? <WarmTooltip asChild content={hint} side={tooltipSide} disabled={disabled || loading || Boolean(props["aria-haspopup"] && props["aria-expanded"] === true)}>{button}</WarmTooltip>
    : button;
}
