/**
 * [INPUT]: 依赖 WarmTooltip 原位功能提示；依赖 useLocale 的界面文案（用户内容保留原文）；依赖 design-system motion=none Dialog/延迟文字Skeleton、纸面视图过渡身份、NotePaper reader、卡片摘录快照、正文缓存与 MarkdownReadingView
 * [OUTPUT]: 引用预览接受已核验正文，隐藏编辑入口并提示版本变化、定位引文段落； 预览关闭入口不重复提示，编辑命令保留功能提示；对外提供不卸载 Canvas、只有纸拥有过渡身份而遮罩随 root 一起换、正文未到时以卡片摘录保持同一段字的小开本 Preview
 * [POS]: KnowledgeCanvas 的正文阅读边界；Canvas API 永不携带 content_mdx，只有用户明确预览时才按目标 memo ID 加载正文；纸内只有正文，动作一律在纸外，因此正文长度不影响任何入口的可达性；Esc/遮罩/焦点归还统一复用 Dialog 的模态行为，不另造第二套弹窗
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import WarmTooltip from "../../shared/design-system/components/WarmTooltip";
import { useLocale } from "../../shared/locale";
import type { MemoDetailNode } from "../../shared/api/memo";
import { useEffect, useRef } from "react";

import {
  Dialog,
  Skeleton,
  SkeletonGroup,
  useDelayedSkeleton,
} from "../../shared/design-system/components";
import { PencilSimpleIcon, XIcon } from "../../shared/design-system/icons";
import { useMemoDocumentStore } from "../../shared/store/memoDocumentStore";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { NotePaper } from "../NotePaper";

type CanvasPreviewOverlayProps = {
  accessToken: string;
  memoId: string;
  onClose: () => void;
  onEditOriginal?: () => Promise<void>;
  expectedRevision?: number;
  sourceDocument?: MemoDetailNode;
  citationQuote?: string;
  /** 卡片上的摘录快照：正文在路上时纸里先放它，放大的始终是同一段字 */
  pendingExcerpt?: string | null;
  title: string;
};

export function CanvasPreviewOverlay({
  accessToken,
  memoId,
  onClose,
  onEditOriginal,
  expectedRevision,
  sourceDocument, citationQuote,
  pendingExcerpt = null,
  title,
}: CanvasPreviewOverlayProps) {
  const { t } = useLocale();
  const cachedDocument = useMemoDocumentStore((state) => state.documents[memoId]);
  const document = sourceDocument ?? cachedDocument;
  const quoteContainer = useRef<HTMLDivElement>(null);
  const cachedStatus = useMemoDocumentStore((state) => state.statuses[memoId] ?? "idle");
  const status = sourceDocument ? "ready" : cachedStatus;
  const error = useMemoDocumentStore((state) => state.errors[memoId]);
  const skeletonVisible = useDelayedSkeleton(document === undefined && status !== "error" && !pendingExcerpt?.trim());
  const loadMemo = useMemoDocumentStore((state) => state.loadMemo);

  // status 由本次 loadMemo 自己切到 loading；若加入依赖会 cleanup 并中止刚发出的请求。
  // oxlint-disable react-hooks/exhaustive-deps -- 请求状态是 effect 结果，不是重启条件
  useEffect(() => {
    if (document !== undefined || status === "loading") return;
    const controller = new AbortController();
    void loadMemo(accessToken, memoId, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [accessToken, document, loadMemo, memoId]);
  // oxlint-enable react-hooks/exhaustive-deps

  useEffect(() => {
    if (!document || !citationQuote || (expectedRevision !== undefined && document.revision !== expectedRevision)) return;
    const root = quoteContainer.current;
    const normalize = (value: string) => value.replace(/\s+/gu, "").replace(/[*_`#]/gu, "");
    const target = [...(root?.querySelectorAll("p,li,pre,h1,h2,h3,blockquote") ?? [])].find(element => normalize(element.textContent ?? "").includes(normalize(citationQuote)));
    if (!target) return;
    target.setAttribute("data-citation-highlight", "true");
    target.scrollIntoView?.({ block: "center", behavior: "instant" });
    return () => target.removeAttribute("data-citation-highlight");
  }, [citationQuote, document, expectedRevision]);
  return (
    <Dialog
      description={t("预览不会改变画布位置或尺寸。", "Preview keeps your canvas position and size.")}
      motion="none"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      surface="bare"
      title={title}
    >
      <div className="canvas-preview-shell">
        <NotePaper
          autoFocus
          title={title}
          transitionIdentity={memoId}
          variant="reader"
        >
          {/*
            正文在路上: 有摘录就先显示摘录 —— 那是同一篇笔记的开头, 用户放大的字因此
            从头到尾没被换过一次。真的一个字都没有时才退回 Skeleton。
          */}
          {document === undefined && status !== "error" ? (
            pendingExcerpt !== null && pendingExcerpt.trim().length > 0 ? (
              <p aria-busy="true" className="note-paper-excerpt">{pendingExcerpt}</p>
            ) : (
              <SkeletonGroup label={t("正在读取原文", "Loading note")} visible={skeletonVisible}>
                <Skeleton className="canvas-preview-line-skeleton" shape="text" />
                <Skeleton className="canvas-preview-line-skeleton" shape="text" />
                <Skeleton className="canvas-preview-line-skeleton" shape="text" />
              </SkeletonGroup>
            )
          ) : status === "error" ? (
            <p className="canvas-preview-error">{error ?? t("原文读取失败。", "Could not load the note.")}</p>
          ) : (
            <div ref={quoteContainer}>{expectedRevision !== undefined && document?.revision !== expectedRevision ? <p className="agent-source-hint">{t("原文已更新，当前显示最新版本。", "The source changed. This is the latest version.")}</p> : null}<MarkdownReadingView
              content={document?.memo.content_mdx ?? ""}
              preserveSoftBreaks
            /></div>
          )}
        </NotePaper>
        {/*
          纸内只有正文。动作住在纸外的工具列里, 与纸顶右角对齐后向下排列:
          正文再长也不会把「编辑原文」推到看不见的地方, 而纸面保持一张干净的纸。
        */}
        <div className="canvas-preview-tools">
          <button
            aria-label={t("关闭预览", "Close preview")}
            className="canvas-preview-tool"
            onClick={onClose}
            type="button"
          >
            <XIcon size={16} />
          </button>
          {onEditOriginal ? <WarmTooltip asChild content={t("编辑原文", "Edit original")} disabled={document === undefined}>
          <button
            aria-label={t("编辑原文", "Edit original")}
            className="canvas-preview-tool"
            disabled={document === undefined}
            onClick={() => void onEditOriginal()}
            type="button"
          >
            <PencilSimpleIcon size={16} />
          </button>
          </WarmTooltip> : null}
        </div>
      </div>
    </Dialog>
  );
}
