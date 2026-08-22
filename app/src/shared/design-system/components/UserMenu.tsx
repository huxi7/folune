/**
 * [INPUT]: 依赖 React 弹出层状态/焦点管理、共享 Lucide 设置/订阅/退出图标、UserAvatar/UserButton 与上层账户命令
 * [OUTPUT]: 对外提供顶部身份卡片直达个人资料、下方仅列设置等动作且退出失败走全局 Toast 的 UserMenu 组合组件
 * [POS]: app/src/shared/design-system/components 的账户菜单；身份卡片与设置命令进入同一个 AccountDialog，不把个人资料重复成普通菜单项
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  CaretRightIcon,
  CreditCardIcon,
  GearSixIcon,
  SignOutIcon,
} from "../icons";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useDismissable } from "../useDismissable";

import { UserAvatar, UserButton } from "./UserButton";
import { useToast } from "./Toast";

type UserMenuProps = {
  avatarUrl?: string;
  email: string;
  name: string;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenSubscription: () => void;
  onSignOut: () => Promise<void>;
};

export function UserMenu({
  avatarUrl,
  email,
  name,
  onOpenProfile,
  onOpenSettings,
  onOpenSubscription,
  onSignOut,
}: UserMenuProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const closeMenu = useCallback(() => setOpen(false), []);

  useDismissable({
    focusRef: triggerRef,
    onDismiss: closeMenu,
    open,
    shellRef,
  });

  function closeAndRun(action: () => void) {
    // 焦点先离开即将被卸载的 menuitem, 否则 activeElement 退回 body,
    // 下游 Dialog 会把 body 记成 previousActiveElement, 关闭时无处归还。
    triggerRef.current?.focus();
    setOpen(false);
    action();
  }

  function focusMenuItem(position: "first" | "last") {
    requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      );
      const target = position === "first" ? items?.[0] : items?.[items.length - 1];
      target?.focus();
    });
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      focusMenuItem(event.key === "ArrowDown" ? "first" : "last");
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1 + items.length) % items.length
            : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  return (
    <div className="ds-user-menu-shell" ref={shellRef}>
      <UserButton
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="打开用户菜单"
        avatarUrl={avatarUrl}
        email={email}
        name={name}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        open={open}
        ref={triggerRef}
      />

      {open ? (
        <div
          aria-label="用户菜单"
          className="ds-user-menu-popover"
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          <button
            aria-label={`打开 ${name} 的个人资料`}
            className="ds-user-menu-identity"
            onClick={() => closeAndRun(onOpenProfile)}
            role="menuitem"
            type="button"
          >
            <UserAvatar
              avatarUrl={avatarUrl}
              className="ds-user-menu-identity-avatar"
              name={name}
            />
            <span className="ds-user-menu-identity-copy">
              <strong>{name}</strong>
              <small>{email}</small>
            </span>
            <CaretRightIcon aria-hidden="true" size={16} />
          </button>

          <div className="ds-user-menu-divider" />

          <button
            className="ds-user-menu-item"
            onClick={() => closeAndRun(onOpenSubscription)}
            role="menuitem"
            type="button"
          >
            <CreditCardIcon aria-hidden="true" size={16} />
            <span>订阅</span>
          </button>
          <button
            className="ds-user-menu-item"
            onClick={() => closeAndRun(onOpenSettings)}
            role="menuitem"
            type="button"
          >
            <GearSixIcon aria-hidden="true" size={16} />
            <span>设置</span>
          </button>

          <div className="ds-user-menu-divider" />

          <button
            className="ds-user-menu-item"
            data-tone="danger"
            onClick={() => {
              setOpen(false);
              void onSignOut().catch(() => {
                toast({ title: "退出失败，请重试。", variant: "error" });
              });
            }}
            role="menuitem"
            type="button"
          >
            <SignOutIcon aria-hidden="true" size={16} />
            <span>退出登录</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
