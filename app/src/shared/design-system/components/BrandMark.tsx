/**
 * [INPUT]: 依赖 public/brand/supernote-tight.png 紧边界图、BrandWordmark 固定轮廓与 design-system.css 的 5:4 布局比
 * [OUTPUT]: 对外提供 iconOnly 图标与图字组合两种 BrandMark；--brand-size 仅定义可见图高，字标布局高度与间距由共享比例派生
 * [POS]: 设计系统唯一品牌图形入口，Landing、工作台、认证与组件预览共用；深浅主题不改变图像
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BrandWordmark } from "./BrandWordmark";

type BrandMarkProps = {
  iconOnly?: boolean;
  className?: string;
};

export function BrandMark({ iconOnly = false, className = "" }: BrandMarkProps) {
  return (
    <div className={`ds-brand ${className}`} role="img" aria-label="Folune" data-icon-only={iconOnly || undefined}>
      <img
        className="ds-brand-mark"
        src="/brand/supernote-tight.png"
        alt=""
        width="791"
        height="851"
        draggable={false}
      />
      {iconOnly ? null : <BrandWordmark />}
    </div>
  );
}
