/**
 * [INPUT]: 依赖 React 的 ButtonHTMLAttributes、Motion for React 与 ../icons 的 Icon 类型，以及 index.css 暴露的柔和墨蓝、36px 标准高度、14px/18px 控件文字、垂直面光、均匀内外环影、Processing 状态及唯一那份 press 收紧比例 token
 * [OUTPUT]: 对外提供支持图标、spinner、低频窄光带、disabled、aria-busy 联动与 Spring 按压回弹的 Button 组件，以及 ButtonVariant、ButtonSize 类型
 * [POS]: app/src/shared/design-system/components 的核心命令基础件，以统一 12px 平滑圆角、硅谷包豪斯式轻薄实体层级和「原地收紧」的按压反馈统一全站操作质感
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Icon } from "../icons";
import { motion } from "motion/react";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";

import { tapScale } from "../../../lib/motion.js";

const MotionButton = motion.button as unknown as ComponentType<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    initial?: string;
    variants?: unknown;
    whileTap?: string;
  }
>;

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "square";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd"> & {
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
    <MotionButton
      aria-busy={loading ? true : ariaBusy}
      className={[
        "ds-button",
        variantClassName[variant],
        sizeClassName[size],
        loading ? "ds-button-loading" : "",
        className,
      ].join(" ")}
      disabled={disabled || loading}
      initial="rest"
      whileTap="pressed"
      variants={tapScale}
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
    </MotionButton>
  );
}
