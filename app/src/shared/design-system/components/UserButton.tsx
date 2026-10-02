/**
 * [INPUT]: 账户名消费 navigation 字重角色； 依赖 React 原生 button 属性、共享 Lucide CaretDownIcon 与 index.css 的 ds-user-button/avatar 类
 * [OUTPUT]: 对外提供真实头像/双字符回退的 UserAvatar 与姓名/方案/单向展开箭头的 UserButton；方案名只从上层真实快照传入
 * [POS]: app/src/shared/design-system/components 的用户身份原子层，被 UserMenu 与 LandingDemo 复用，不承载业务跳转
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CaretDownIcon } from "../icons";
import type { ComponentPropsWithRef } from "react";

type UserButtonProps = ComponentPropsWithRef<"button"> & {
  avatarUrl?: string;
  email: string;
  name: string;
  open?: boolean;
  planName?: string;
};

type UserAvatarProps = {
  avatarUrl?: string;
  className?: string;
  name: string;
};

export function UserAvatar({
  avatarUrl,
  className = "",
  name,
}: UserAvatarProps) {
  const initial = Array.from(name.trim()).slice(0, 2).join("").toUpperCase() || "U";

  return avatarUrl ? (
    <img alt="" className={["ds-user-avatar", className].join(" ")} src={avatarUrl} />
  ) : (
    <span
      aria-hidden="true"
      className={["ds-user-avatar", className].join(" ")}
    >
      {initial}
    </span>
  );
}

export function UserButton({
  avatarUrl,
  className = "",
  email,
  name,
  open = false,
  planName,
  type = "button",
  ...props
}: UserButtonProps) {
  return (
    <button
      className={["ds-user-button", className].join(" ")}
      data-open={open}
      type={type}
      {...props}
    >
      <UserAvatar avatarUrl={avatarUrl} name={name} />
      <span className="ds-user-button-copy">
        <span className="ds-user-button-name">{name}</span>
        <span className="ds-user-button-detail">{planName ?? email}</span>
      </span>
      <CaretDownIcon aria-hidden="true" className="ds-user-button-caret" size={14} />
    </button>
  );
}
