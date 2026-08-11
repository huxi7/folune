/**
 * [INPUT]: 依赖 React 的 ButtonHTMLAttributes、@phosphor-icons/react 的 Icon 类型与 index.css 暴露的纯色色彩、实体边缘、零偏移环绕阴影及 1px press 触感 token
 * [OUTPUT]: 对外提供支持图标、spinner、低频窄光带、disabled 与 aria-busy 联动的 Button 组件，以及 ButtonVariant、ButtonSize 类型
 * [POS]: app/src/shared/design-system/components 的核心命令基础件，以统一平滑圆角、克制平面层级和真实按压反馈统一全站操作质感
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Icon } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "square";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
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
  ...props
}: ButtonProps) {
  return (
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
          <IconComponent aria-hidden="true" size={16} weight="bold" />
        ) : null}
        {children}
      </span>
    </button>
  );
}
