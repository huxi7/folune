/**
 * [INPUT]: 依赖 GlowButton 的 ShaderGlow、底色和玻璃层，user-menu.css 拥有专属紧凑规格
 * [OUTPUT]: 提供 28px 高、12px 字号、白亮边缘与柔光流动的 AccountSubscribeButton
 * [POS]: 账户菜单的独立强调按钮；复用着色器生命周期，隔离普通 Button 和其他页面 CTA 的尺寸与光泽调整
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { GlowButton, type GlowButtonProps } from "./GlowButton";

export function AccountSubscribeButton({ className = "", ...props }: GlowButtonProps) {
  return <GlowButton {...props} className={`account-subscribe-button ${className}`} />;
}
