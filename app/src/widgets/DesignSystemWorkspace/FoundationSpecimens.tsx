/**
 * [INPUT]: 依赖 shared/design-system/icons 的 OrganizeNoteIcon 与 ExpandFromNoteIcon，并消费 Design System 生产 Radius/Color token
 * [OUTPUT]: 对外提供 SemanticIconComparison 与 ControlRadiusInnerPreview 两个 Foundations 决策样板
 * [POS]: DesignSystemWorkspace 的基础公理样板层；把语义字形与同心曲率的冻结证据从综合预览器中隔离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ExpandFromNoteIcon,
  OrganizeNoteIcon,
} from "../../shared/design-system/icons";

const semanticIcons = [
  ["organize", "整理笔记", OrganizeNoteIcon],
  ["expand", "AI 拓展", ExpandFromNoteIcon],
] as const;

const concentricSurfaces = [
  ["button", "Button · 轻面光"],
  ["input", "Input · 内层"],
  ["select", "Select · 内层"],
  ["composite", "复合输入 · 嵌套"],
] as const;

export function SemanticIconComparison() {
  return (
    <section aria-label="AI 整理与 AI 拓展语义图标对比" className="ds-semantic-icon-comparison">
      <header><strong>收拢与发散</strong><span>14 / 16px · Primary / Secondary</span></header>
      {semanticIcons.map(([meaning, label, IconComponent]) => (
        <article data-meaning={meaning} key={meaning}>
          <div>
            <span data-tone="primary"><IconComponent aria-hidden="true" size={14} /></span>
            <span data-tone="primary"><IconComponent aria-hidden="true" size={16} /></span>
            <span data-tone="secondary"><IconComponent aria-hidden="true" size={14} /></span>
            <span data-tone="secondary"><IconComponent aria-hidden="true" size={16} /></span>
          </div>
          <small>{label}</small>
        </article>
      ))}
    </section>
  );
}

export function ControlRadiusInnerPreview() {
  return (
    <div aria-label="16px Control 与 12px inner radius 同心样板" className="ds-radius-inner-preview" role="img">
      {concentricSurfaces.map(([surface, label]) => (
        <span data-surface={surface} key={surface}>
          <i aria-hidden="true"><b /></i>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
}
