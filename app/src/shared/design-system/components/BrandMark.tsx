/**
 * [INPUT]: 依赖 public/brand/supernote.png 原始透明母图与 design-system.css 的品牌尺寸规则
 * [OUTPUT]: 对外提供 iconOnly 图标与图标加 Folune 标题两种 BrandMark，className 允许所在布局等比缩放
 * [POS]: 设计系统唯一品牌图形入口，Landing、工作台、认证与组件预览共用；深浅主题不改变图像
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
type BrandMarkProps = {
  iconOnly?: boolean;
  className?: string;
};

export function BrandMark({ iconOnly = false, className = "" }: BrandMarkProps) {
  return (
    <div className={`ds-brand flex items-center gap-2.5 font-sans ${className}`} data-icon-only={iconOnly || undefined}>
      <img
        className="ds-brand-mark"
        src="/brand/supernote.png"
        alt={iconOnly ? "Folune" : ""}
        width="1254"
        height="1254"
        draggable={false}
      />
      {iconOnly ? null : (
        <div className="leading-none">
          <p className="text-sm font-semibold tracking-tight text-foreground">Folune</p>
        </div>
      )}
    </div>
  );
}
