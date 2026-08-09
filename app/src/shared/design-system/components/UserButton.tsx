/**
 * [INPUT]: 依赖 React 原生 button 属性、Phosphor CaretUpDownIcon 与 index.css 的 ds-user-button/avatar 类
 * [OUTPUT]: 对外提供可复用 UserAvatar 与打开账户菜单的 UserButton 触发器
 * [POS]: app/src/shared/design-system/components 的用户身份原子层，被 UserMenu 与收起态 AppSidebar 复用，不承载业务跳转
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CaretUpDownIcon } from "@phosphor-icons/react";
import type { ComponentPropsWithRef } from "react";

type UserButtonProps = ComponentPropsWithRef<"button"> & {
  avatarUrl?: string;
  email: string;
  name: string;
  open?: boolean;
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
  const initial = name.trim().charAt(0).toUpperCase() || "U";

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
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{email}</span>
      </span>
      <CaretUpDownIcon aria-hidden="true" className="shrink-0 text-muted-foreground" size={16} weight="bold" />
    </button>
  );
}
