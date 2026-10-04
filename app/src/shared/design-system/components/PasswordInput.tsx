/**
 * [INPUT]: 依赖 React 原生 input 属性/ref、../icons 的显隐图标与同目录 Input 原语
 * [OUTPUT]: 密码显隐保留无障碍名称与状态，不重复提示；对外提供受控可见性、原生密码属性与无障碍显隐按钮的 PasswordInput 组件和 PasswordInputProps 类型
 * [POS]: app/src/shared/design-system/components 的 Input 家族组合件，被 AuthForm 与 DesignSystemWorkspace 复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { EyeIcon, EyeSlashIcon } from "../icons";
import type { ComponentPropsWithRef } from "react";

import { Input } from "./Input";

export type PasswordInputProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  onVisibilityChange: (visible: boolean) => void;
  visibilityLabel?: string;
  visible: boolean;
};

export function PasswordInput({
  "aria-label": ariaLabel,
  className = "",
  disabled = false,
  onVisibilityChange,
  visibilityLabel = "密码",
  visible,
  ...props
}: PasswordInputProps) {
  const VisibilityIcon = visible ? EyeSlashIcon : EyeIcon;

  return (
    <div className="ds-password-input">
      <Input
        aria-label={ariaLabel}
        className={["ds-password-input-control", className].join(" ")}
        disabled={disabled}
        type={visible ? "text" : "password"}
        {...props}
      />
      <button
        aria-label={visible ? `隐藏${visibilityLabel}` : `显示${visibilityLabel}`}
        aria-pressed={visible}
        className="ds-password-toggle"
        disabled={disabled}
        onClick={() => onVisibilityChange(!visible)}
        type="button"
      >
        <VisibilityIcon aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
