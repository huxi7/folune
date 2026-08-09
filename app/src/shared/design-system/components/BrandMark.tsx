/**
 * [INPUT]: 依赖 index.css 暴露的 ds-brand-mark、ds-brand-note、ds-brand-tab、foreground 与 muted 语义 token
 * [OUTPUT]: 对外提供“品牌图标”与“品牌图标 + SuperNote 标题”两种 BrandMark 形态
 * [POS]: app/src/shared/design-system/components 的品牌基础件，以单一标题锁定统一 Landing 与 Dashboard 品牌入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
type BrandMarkProps = {
  iconOnly?: boolean;
};

export function BrandMark({ iconOnly = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-2.5 font-sans" data-icon-only={iconOnly || undefined}>
      <div aria-hidden="true" className="ds-brand-mark">
        <span className="ds-brand-note">
          <span className="ds-brand-line ds-brand-line-long" />
          <span className="ds-brand-line ds-brand-line-short" />
        </span>
        <span className="ds-brand-tab" />
      </div>
      {iconOnly ? null : (
        <div className="leading-none">
          <p className="text-sm font-semibold tracking-tight text-foreground">SuperNote</p>
        </div>
      )}
    </div>
  );
}
