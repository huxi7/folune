/**
 * [INPUT]: 依赖 React 的 ButtonHTMLAttributes/ReactNode、../icons 的 Icon、./ShaderGlow 的流光层与 styles/shader-glow.css 的合成层，复用 button.css 的 ds-button-spinner
 * [OUTPUT]: 对外提供 GlowButton 组件（墨蓝底色 + WebGL 流光 + 玻璃高光合成的强调 CTA）与 GlowButtonProps 类型
 * [POS]: app/src/shared/design-system/components 的强调型命令件，与 Button 平级但材质独立，只用于登录/升级一类主 CTA
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Icon } from "../icons";
import { ShaderGlow, type ShaderGlowProps } from "./ShaderGlow";

export type GlowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  icon?: Icon;
  loading?: boolean;
  // 覆写流光参数(色/速度/密度等); 省略时自动取品牌墨蓝并沿用来源默认
  glow?: ShaderGlowProps;
};

export function GlowButton({
  "aria-busy": ariaBusy,
  children,
  className = "",
  disabled = false,
  glow,
  icon: IconComponent,
  loading = false,
  type = "button",
  ...props
}: GlowButtonProps) {
  return (
    <button
      aria-busy={loading ? true : ariaBusy}
      className={["glow-button", loading ? "glow-button-loading" : "", className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      <span className="glow-button-base" aria-hidden="true" />
      <span className="glow-button-flow" aria-hidden="true">
        <ShaderGlow
          {...glow}
          className={["glow-button-canvas", glow?.className].filter(Boolean).join(" ")}
        />
      </span>
      <span className="glow-button-sheen" aria-hidden="true" />
      <span className="glow-button-content">
        {loading ? (
          <span aria-hidden="true" className="ds-button-spinner" />
        ) : IconComponent ? (
          <IconComponent aria-hidden="true" size={16} />
        ) : null}
        {children}
      </span>
    </button>
  );
}
