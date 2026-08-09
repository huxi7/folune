/**
 * [INPUT]: 依赖 React 原生 button 属性、ReactNode 与 sidebar-button.css 复用的无明显描边 Secondary Button 材质、统一高度、hover 固定原位及 smooth-corner token
 * [OUTPUT]: 对外提供统一导航选中语义、default/icon 等高尺寸的 SidebarButton、SidebarButtonSize 与 SidebarButtonTone
 * [POS]: app/src/shared/design-system/components 的侧栏导航原子件，选中态与显著态直接继承 Secondary Button 质感和统一平滑圆角，被 AppSidebar、AccountDialog 与 Design System 预览复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

export type SidebarButtonSize = "default" | "icon";
export type SidebarButtonTone = "default" | "prominent";

type SidebarButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
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
  ...props
}: SidebarButtonProps) {
  return (
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
}
