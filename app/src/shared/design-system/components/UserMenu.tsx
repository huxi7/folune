/**
 * [INPUT]: 依赖 WarmTooltip 原位功能提示；依赖 AccountSubscribeButton 独立流光按钮、PresenceSurface菜单/子菜单配方与useDismissable 的浮层生命周期、UserButton 的视口几何/ResizeObserver 与上层受控的语言/主题、真实积分和账户命令
 * [OUTPUT]: 提供两层账户底卡、以身份按钮为锚点左移8px并间隔8px向上展开的256px主菜单（仅窄视口缩宽）及1px贴边子菜单；子菜单末行与触发行对齐、其余行向上排列，国旗/主题状态及悬停/键盘/触屏交互同源
 * [POS]: 账户菜单纯展示边界；Portal 避开侧栏裁剪，统一内容边界负责外点关闭，价格/语言持久化/业务跳转均交给上层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import WarmTooltip from "./WarmTooltip";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CaretRightIcon, CreditCardIcon, DesktopIcon, GearSixIcon, GlobeIcon, MoonIcon, SunIcon } from "../icons";
import { useDismissable } from "../useDismissable";
import { formatCreditAmount } from "../../locale/credits";
import type { Locale } from "../../locale";
import { AccountSubscribeButton } from "./AccountSubscribeButton";
import { PresenceSurface } from "./PresenceSurface";
import { UserAvatar, UserButton } from "./UserButton";
import { useToast } from "./Toast";

type Theme = "system" | "light" | "dark";
type Submenu = "language" | "theme";
type UserMenuProps = {
  avatarUrl?: string;
  email: string;
  name: string;
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
  onOpen?: () => void;
  onThemeChange?: (theme: Theme) => void;
  theme?: Theme;
  planName?: string;
  remainingCredits?: number | null;
  onOpenBilling?: () => void;
  onOpenCredits?: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenSubscription: () => void;
  onOpenUsage?: () => void;
  onSignOut: () => Promise<void>;
};

const themes = [
  { icon: DesktopIcon, label: "跟随系统", english: "System", value: "system" },
  { icon: SunIcon, label: "白天", english: "Day", value: "light" },
  { icon: MoonIcon, label: "黑暗", english: "Night", value: "dark" },
] as const;
const languages = [
  { label: "简体中文", value: "zh-CN", flag: "/account/flag-cn.svg" },
  { label: "English", value: "en", flag: "/account/flag-us.svg" },
] as const;
const MENU_WIDTH = 256;
const SUBMENU_WIDTH = 160;
const VIEWPORT_GAP = 8;
const MENU_GAP = 8;
const MENU_START_OFFSET = -8;
const SUBMENU_GAP = 1;
const HOVER_CLOSE_DELAY = 180;
const menuItemSelector = '[role="menuitem"], [role="menuitemradio"]';
type Position = { left: number; top: number; width: number; maxHeight: number; side?: "left" | "right" };

export function UserMenu({
  avatarUrl, email, name, locale = "zh-CN", onLocaleChange, onOpen, onThemeChange,
  theme = "system", planName, remainingCredits, onOpenBilling, onOpenCredits,
  onOpenProfile, onOpenSettings, onOpenSubscription, onOpenUsage, onSignOut,
}: UserMenuProps) {
  const menuId = useId();
  const submenuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const languageTriggerRef = useRef<HTMLButtonElement>(null);
  const themeTriggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<Submenu | null>(null);
  const [menuPosition, setMenuPosition] = useState<Position | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<Position | null>(null);
  const { toast } = useToast();
  const t = (chinese: string, english: string) => locale === "en" ? english : chinese;
  const activeTheme = themes.find((item) => item.value === theme) ?? themes[0];
  const credits = remainingCredits == null ? "—" : formatCreditAmount(remainingCredits, locale);
  const activeSubmenuTrigger = submenu === "language" ? languageTriggerRef : themeTriggerRef;

  const cancelSubmenuClose = useCallback(() => {
    if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);
  const closeMenu = useCallback(() => {
    cancelSubmenuClose();
    setOpen(false);
    setSubmenu(null);
  }, [cancelSubmenuClose]);
  useDismissable({ focusRef: triggerRef, onDismiss: closeMenu, open, shellRef, contentRef: floatingRef });
  useEffect(() => cancelSubmenuClose, [cancelSubmenuClose]);

  // 菜单与子菜单共享 Portal 命中边界，定位始终按视口计算，不受 Panel transform/overflow 影响。
  useLayoutEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      // 浮层跟随实际触发按钮；固定开本允许越过侧栏，只在视口边缘让位。
      const anchor = triggerRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const height = menuRef.current?.offsetHeight ?? 0;
      const width = Math.min(MENU_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
      const spaceAbove = anchor.top - VIEWPORT_GAP - MENU_GAP;
      const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_GAP - MENU_GAP;
      const placeAbove = spaceAbove >= height || spaceAbove >= spaceBelow;
      const maxHeight = Math.max(48, placeAbove ? spaceAbove : spaceBelow);
      const top = placeAbove ? Math.max(VIEWPORT_GAP, anchor.top - Math.min(height, maxHeight) - MENU_GAP) : anchor.bottom + MENU_GAP;
      setMenuPosition({ left: Math.max(VIEWPORT_GAP, Math.min(anchor.left + MENU_START_OFFSET, window.innerWidth - width - VIEWPORT_GAP)), top, width, maxHeight });
    };
    positionMenu();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(positionMenu);
    if (triggerRef.current) observer?.observe(triggerRef.current);
    if (menuRef.current) observer?.observe(menuRef.current);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, locale]);

  useLayoutEffect(() => {
    if (!submenu || !menuPosition) return;
    const positionSubmenu = () => {
      const anchor = activeSubmenuTrigger.current?.getBoundingClientRect();
      const main = menuRef.current?.getBoundingClientRect();
      if (!anchor || !main) return;
      const width = Math.min(SUBMENU_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
      const height = submenuRef.current?.offsetHeight ?? 0;
      const side = main.right + SUBMENU_GAP + width + VIEWPORT_GAP <= window.innerWidth ? "right" : "left";
      const left = side === "right" ? main.right + SUBMENU_GAP : main.left - SUBMENU_GAP - width;
      const options = submenuRef.current?.querySelectorAll<HTMLButtonElement>(menuItemSelector);
      const lastOption = options?.[options.length - 1];
      const surfaceStyle = submenuRef.current ? window.getComputedStyle(submenuRef.current) : null;
      // 对齐两行的中心；浮层底边还需容纳末行下半部、内边距和边框。
      const bottomInset = (lastOption?.offsetHeight ?? 0) / 2
        + (Number.parseFloat(surfaceStyle?.paddingBottom ?? "0") || 0)
        + (Number.parseFloat(surfaceStyle?.borderBottomWidth ?? "0") || 0);
      const bottom = Math.min(anchor.top + anchor.height / 2 + bottomInset, window.innerHeight - VIEWPORT_GAP);
      setSubmenuPosition({
        left: Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - width - VIEWPORT_GAP)),
        top: Math.max(VIEWPORT_GAP, bottom - height),
        width, maxHeight: window.innerHeight - VIEWPORT_GAP * 2, side,
      });
    };
    positionSubmenu();
    window.addEventListener("resize", positionSubmenu);
    return () => window.removeEventListener("resize", positionSubmenu);
  }, [activeSubmenuTrigger, menuPosition, submenu]);

  function openMenu() {
    if (open) return;
    setOpen(true);
    onOpen?.();
  }
  function closeAndRun(action: () => void) {
    // Dialog 打开前归还稳定触发器，确保下游焦点归还不会指向退出中的菜单。
    triggerRef.current?.focus();
    closeMenu();
    action();
  }
  function focusItem(container: HTMLDivElement | null, position: "first" | "last") {
    const items = container?.querySelectorAll<HTMLButtonElement>(menuItemSelector);
    (position === "first" ? items?.[0] : items?.[items.length - 1])?.focus();
  }
  function openSubmenu(kind: Submenu, focus = false) {
    cancelSubmenuClose();
    if (submenu !== kind) setSubmenuPosition(null);
    setSubmenu(kind);
    if (focus) requestAnimationFrame(() => focusItem(submenuRef.current, "first"));
  }
  function scheduleSubmenuClose() {
    cancelSubmenuClose();
    closeTimerRef.current = setTimeout(() => setSubmenu(null), HOVER_CLOSE_DELAY);
  }
  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const targetMenu = (event.target as HTMLElement).closest('[role="menu"]') as HTMLDivElement | null;
    if (event.key === "Escape" && submenu) {
      event.preventDefault();
      activeSubmenuTrigger.current?.focus();
      setSubmenu(null);
      return;
    }
    if (event.key === "ArrowLeft" && targetMenu === submenuRef.current) {
      event.preventDefault();
      activeSubmenuTrigger.current?.focus();
      setSubmenu(null);
      return;
    }
    if (event.key === "ArrowRight") {
      const kind = (event.target as HTMLElement).dataset["submenu"] as Submenu | undefined;
      if (kind) { event.preventDefault(); openSubmenu(kind, true); }
      return;
    }
    if (event.key === "Tab") { closeMenu(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(targetMenu?.querySelectorAll<HTMLButtonElement>(menuItemSelector) ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : event.key === "ArrowDown" ? (index + 1 + items.length) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }
  const trigger = <UserButton
    aria-controls={menuId} aria-expanded={open} aria-haspopup="menu" aria-label={t("打开用户菜单", "Open user menu")}
    avatarUrl={avatarUrl} email={email} name={name} planName={planName} open={open} ref={triggerRef}
    onClick={() => { if (open) closeMenu(); else openMenu(); }}
    onKeyDown={(event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault(); openMenu();
      requestAnimationFrame(() => focusItem(menuRef.current, event.key === "ArrowDown" ? "first" : "last"));
    }}
  />;

  return <div className="ds-user-menu-shell" ref={shellRef}>
    <div className="ds-user-account-card">
      {onOpenUsage ?
        <div className="ds-user-account-summary">
          <WarmTooltip asChild content={t(`今日剩余 ${credits} 积分`, `${credits} credits remaining today`)} side="bottom">
          <button className="ds-user-account-credits" onClick={onOpenUsage} type="button" aria-label={t(`今日剩余 ${credits} 积分`, `${credits} credits remaining today`)}>
            <strong>{credits}</strong><span>{t("积分", "credits")}</span>
          </button>
          </WarmTooltip>
          <button className="ds-user-account-upgrade" onClick={onOpenSubscription} type="button">{t("订阅 Folune", "Get Folune")}</button>
        </div>
      : null}
      {trigger}
    </div>
    {typeof document !== "undefined" ? createPortal(<div className="ds-user-menu-portals" onKeyDown={handleMenuKeyDown} ref={floatingRef}>
      <PresenceSurface
        aria-label={t("用户菜单", "User menu")} className="ds-user-menu-popover" id={menuId} open={open} placement="top"
        ref={menuRef} role="menu" tabIndex={-1} onPointerEnter={cancelSubmenuClose} onPointerLeave={scheduleSubmenuClose}
        style={{ ...menuPosition, visibility: menuPosition ? "visible" : "hidden" }}
      >
        <div className="ds-user-menu-header" role="none">
          <WarmTooltip asChild content={email} side="bottom">
          <button aria-label={t(`打开 ${name} 的个人资料`, `Open ${name}'s profile`)} className="ds-user-menu-identity"
            onClick={() => closeAndRun(onOpenProfile)} role="menuitem" type="button">
            <UserAvatar avatarUrl={avatarUrl} className="ds-user-menu-identity-avatar" name={name} />
            <span className="ds-user-menu-identity-copy"><strong>{name}</strong><span className="ds-user-menu-plan">{planName ?? t("个人账户", "Personal")}</span></span>
          </button>
          </WarmTooltip>
          <AccountSubscribeButton className="ds-user-menu-subscribe" onClick={() => closeAndRun(onOpenSubscription)} role="menuitem">{t("订阅 Folune", "Get Folune")}</AccountSubscribeButton>
        </div>
        {onOpenUsage ? <button className="ds-user-menu-item ds-user-menu-credits" onClick={() => closeAndRun(onOpenUsage)} role="menuitem" type="button"><span>{t("积分", "Credits")}</span><strong>{credits}</strong></button> : null}
        {onOpenCredits ? <button className="ds-user-menu-item ds-user-menu-add-credits" onClick={() => closeAndRun(onOpenCredits)} role="menuitem" type="button">{t("添加积分", "Add credits")}</button> : null}
        {onOpenBilling ? <button className="ds-user-menu-item" onClick={() => closeAndRun(onOpenBilling)} role="menuitem" type="button"><span>{t("订阅与账单", "Subscription & billing")}</span><CreditCardIcon aria-hidden="true" size={16} /></button> : null}
        <div aria-hidden="true" className="ds-user-menu-divider" role="separator" />
        {onLocaleChange ? <WarmTooltip asChild content={t("界面语言：简体中文", "Language: English")} side="bottom" disabled={submenu === "language"}>
        <button
          aria-label={t("界面语言：简体中文", "Language: English")} aria-controls={submenu === "language" ? submenuId : undefined}
          aria-expanded={submenu === "language"} aria-haspopup="menu" className="ds-user-menu-item" data-submenu="language"
          onClick={() => { if (submenu === "language") setSubmenu(null); else openSubmenu("language"); }}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") openSubmenu("language"); }} onPointerLeave={scheduleSubmenuClose} ref={languageTriggerRef} role="menuitem" type="button">
          <span>{locale === "en" ? "English" : "简体中文"}</span><GlobeIcon aria-hidden="true" size={16} />
        </button></WarmTooltip> : null}
        {onThemeChange ? <WarmTooltip asChild content={t(`界面主题：${activeTheme.label}`, `Appearance: ${activeTheme.english}`)} side="bottom" disabled={submenu === "theme"}>
        <button
          aria-label={t(`界面主题：${activeTheme.label}`, `Appearance: ${activeTheme.english}`)} aria-controls={submenu === "theme" ? submenuId : undefined}
          aria-expanded={submenu === "theme"} aria-haspopup="menu" className="ds-user-menu-item" data-submenu="theme"
          onClick={() => { if (submenu === "theme") setSubmenu(null); else openSubmenu("theme"); }}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") openSubmenu("theme"); }} onPointerLeave={scheduleSubmenuClose} ref={themeTriggerRef} role="menuitem" type="button">
          <span>{t(activeTheme.label, activeTheme.english)}</span><CaretRightIcon aria-hidden="true" size={16} />
        </button></WarmTooltip> : null}
        <button className="ds-user-menu-item" onClick={() => closeAndRun(onOpenSettings)} role="menuitem" type="button"><span>{t("设置", "Settings")}</span><GearSixIcon aria-hidden="true" size={16} /></button>
        <div aria-hidden="true" className="ds-user-menu-divider" role="separator" />
        <button className="ds-user-menu-item" role="menuitem" type="button" onClick={() => closeAndRun(() => { void onSignOut().catch(() => toast({ title: t("退出失败，请重试。", "Could not sign out. Please try again."), variant: "error" })); })}>{t("退出登录", "Log out")}</button>
      </PresenceSurface>
      <PresenceSurface
        aria-label={submenu === "language" ? t("界面语言", "Language") : t("界面主题", "Appearance")}
        className="ds-user-menu-popover ds-user-menu-submenu" data-side={submenuPosition?.side} id={submenuId} kind="submenu"
        onPointerEnter={cancelSubmenuClose} onPointerLeave={scheduleSubmenuClose} open={open && submenu !== null}
        placement="top" ref={submenuRef} role="menu" style={{ left: submenuPosition?.left, top: submenuPosition?.top, width: submenuPosition?.width, maxHeight: submenuPosition?.maxHeight, visibility: submenuPosition ? "visible" : "hidden" }}
      >
        {submenu === "theme" ? themes.map(({ icon: IconComponent, label, english, value }) => <button
          aria-checked={theme === value} className="ds-user-menu-item ds-user-menu-submenu-option" key={value} role="menuitemradio" type="button"
          onClick={() => closeAndRun(() => onThemeChange?.(value))}><IconComponent aria-hidden="true" size={20} /><span>{t(label, english)}</span>
        </button>) : languages.map(({ label, value, flag }) => <button
          aria-checked={locale === value} className="ds-user-menu-item ds-user-menu-submenu-option" key={value} role="menuitemradio" type="button"
          onClick={() => closeAndRun(() => onLocaleChange?.(value))}><img alt="" aria-hidden="true" className="ds-user-menu-language-flag" src={flag} width={20} height={20} /><span>{label}</span>
        </button>)}
      </PresenceSurface>
    </div>, document.body) : null}
  </div>;
}
