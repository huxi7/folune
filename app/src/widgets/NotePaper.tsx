/**
 * [INPUT]: 依赖 React ReactNode、pages/viewTransition 的纸壳/正文命名与 styles/note-paper.css 的 .note-paper thumbnail/reader 纸面契约
 * [OUTPUT]: 对外提供共享 NotePaper 纸面原语、NotePaperVariant 类型与 transitionIdentity（纸壳与纸内正文各自成名）；thumbnail 渐隐，reader 自身滚动
 * [POS]: app/src/widgets 的纸张视觉单一入口；Canvas 卡片缩略与全尺寸预览共用同一纸面，任何新的纸张表现都必须扩展 variant 而不是另写一套样式
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactNode } from "react";

import {
  paperBodyViewTransitionName,
  paperViewTransitionName,
} from "../pages/viewTransition";

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
  /**
   * 这张纸在本次视图过渡里的身份(memo ID)。给出即参与放大缩小: 纸壳与纸内正文各自
   * 成名, 因此正文不会被当成图片拉伸。同一时刻只允许一处持有同一身份。
   */
  transitionIdentity?: string | null;
  title: string;
  variant: NotePaperVariant;
};

/*
 * 纸面几何归浏览器的视图过渡, 因此这里不需要向外交出真实 DOM: 名字挂上去就够了, 谁都
 * 不再测量这张纸。名字由这里给, 而不是由调用方塞一段 style —— 否则"纸壳与正文必须是
 * 两个名字"这条规矩就散落在每个用到纸的地方, 漏一处就是一次字被拉伸的过渡。
 */
export function NotePaper({
  autoFocus = false,
  children,
  className = "",
  emptyLabel = "这页还没有正文",
  excerpt,
  overlay,
  title,
  transitionIdentity = null,
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
      style={transitionIdentity === null
        ? undefined
        : { viewTransitionName: paperViewTransitionName(transitionIdentity) }}
      {...(autoFocus ? { "data-dialog-autofocus": "", tabIndex: -1 } : {})}
    >
      <div
        className="note-paper-column"
        style={transitionIdentity === null
          ? undefined
          : { viewTransitionName: paperBodyViewTransitionName(transitionIdentity) }}
      >
        <h2 className="note-paper-title">{title}</h2>
        <div className="note-paper-body">{body}</div>
      </div>
      {overlay}
    </article>
  );
}
