/**
 * [INPUT]: 依赖 React ReactNode 与 styles/note-paper.css 的 .note-paper thumbnail/reader 纸面契约
 * [OUTPUT]: 对外提供共享 NotePaper 纸面原语、NotePaperVariant 类型；thumbnail 用纯文本摘录配合 CSS 连续失焦渐隐，reader 承载完整正文并自身滚动
 * [POS]: app/src/widgets 的纸张视觉单一入口；Canvas 卡片缩略与全尺寸预览共用同一纸面，任何新的纸张表现都必须扩展 variant 而不是另写一套样式
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from "react";

export type NotePaperVariant = "reader" | "thumbnail";

type NotePaperProps = {
  /** reader 变体作为模态阅读面时的初始焦点目标，复用 Dialog 的 data-dialog-autofocus 契约 */
  autoFocus?: boolean;
  /** 正文渲染结果；省略时回落到 excerpt 纯文本 */
  children?: ReactNode;
  className?: string;
  excerpt?: string | null;
  /** 空正文占位文字，保证缩略卡片在没有正文时仍然是一张纸 */
  emptyLabel?: string;
  /** 绝对定位于纸面内部的附加层（如展开按钮），不参与纸张内容流 */
  overlay?: ReactNode;
  title: string;
  variant: NotePaperVariant;
};

export function NotePaper({
  autoFocus = false,
  children,
  className = "",
  emptyLabel = "这页还没有正文",
  excerpt,
  overlay,
  title,
  variant,
}: NotePaperProps) {
  const excerptText = excerpt?.trim() ?? "";
  const body = children ?? (excerptText.length === 0
    ? <p className="note-paper-placeholder">{emptyLabel}</p>
    : <p className="note-paper-excerpt">{excerptText}</p>);

  return (
    <article
      className={["note-paper", className].filter(Boolean).join(" ")}
      data-variant={variant}
      {...(autoFocus ? { "data-dialog-autofocus": "", tabIndex: -1 } : {})}
    >
      <div className="note-paper-column">
        <h2 className="note-paper-title">{title}</h2>
        <div className="note-paper-body">{body}</div>
      </div>
      {overlay}
    </article>
  );
}
