/**
 * [INPUT]: 依赖 React 原生 button 属性、WarmTooltip 与 sidebar-button.css 的 compact 导航材质
 * [OUTPUT]: 对外提供保留原生ref与外层提示去重、统一导航选中语义、default/icon 共享 32px 尺寸的 SidebarButton、SidebarButtonSize 与 SidebarButtonTone
 * [POS]: app/src/shared/design-system/components 的侧栏导航原子件，选中态与显著态直接继承 Secondary Button 质感和统一平滑圆角，被 AppSidebar、AccountDialog 与 Design System 预览复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type {
  ComponentPropsWithRef,
  ReactNode,
} from "react";
import WarmTooltip from "./WarmTooltip";

export type SidebarButtonSize = "default" | "icon";
export type SidebarButtonTone = "default" | "prominent";

type SidebarButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "children"
> & {
  "data-warm-tooltip-trigger"?: boolean;
  active?: boolean;
  label: ReactNode;
  leading?: ReactNode;
  size?: SidebarButtonSize;
  tone?: SidebarButtonTone;
  trailing?: ReactNode;
};

export function SidebarButton({
  active = false,
  className = "",
  label,
  leading,
  size = "default",
  tone = "default",
  trailing,
  type = "button",
  title,
  ...props
}: SidebarButtonProps) {
  const button = (
    <button
      className={["ds-sidebar-button", className].filter(Boolean).join(" ")}
      data-active={active}
      data-size={size}
      data-tone={tone}
      type={type}
      {...props}
    >
      {leading ? (
        <span aria-hidden="true" className="ds-sidebar-button-leading">
          {leading}
        </span>
      ) : null}
      <span className="ds-sidebar-button-label">{label}</span>
      {trailing !== undefined && trailing !== null ? (
        <span className="ds-sidebar-button-trailing">{trailing}</span>
      ) : null}
    </button>
  );
  const hint = title ?? (size === "icon" ? props["aria-label"] : undefined);
  return hint && !props["data-warm-tooltip-trigger"] ? <WarmTooltip asChild content={hint} disabled={props.disabled}>{button}</WarmTooltip> : button;
}
