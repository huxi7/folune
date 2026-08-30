/**
 * [INPUT]: 依赖 design-system Dialog/Skeleton、NotePaper reader、正文缓存、MarkdownReadingView 与共享空间过渡名称
 * [OUTPUT]: 对外提供不卸载 Canvas、与来源卡片共享视觉身份的小开本 Paper 预览层
 * [POS]: KnowledgeCanvas 的正文阅读边界；Canvas API 永不携带 content_mdx，只有用户明确预览时才按目标 memo ID 加载正文；纸内只有正文，动作一律在纸外，因此正文长度不影响任何入口的可达性；Esc/遮罩/焦点归还统一复用 Dialog 的模态行为，不另造第二套弹窗
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect } from "react";

import {
  Dialog,
  Skeleton,
  SkeletonGroup,
} from "../../shared/design-system/components";
import { PencilSimpleIcon, XIcon } from "../../shared/design-system/icons";
import { useMemoDocumentStore } from "../../shared/store/memoDocumentStore";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { NotePaper } from "../NotePaper";
import { canvasPreviewTransitionName } from "./canvasPreviewTransition";

type CanvasPreviewOverlayProps = {
  accessToken: string;
  memoId: string;
  nodeId: string;
  onClose: () => void;
  onEditOriginal: () => Promise<void>;
  title: string;
};

export function CanvasPreviewOverlay({
  accessToken,
  memoId,
  nodeId,
  onClose,
  onEditOriginal,
  title,
}: CanvasPreviewOverlayProps) {
  const document = useMemoDocumentStore((state) => state.documents[memoId]);
  const status = useMemoDocumentStore((state) => state.statuses[memoId] ?? "idle");
  const error = useMemoDocumentStore((state) => state.errors[memoId]);
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

  return (
    <Dialog
      description="预览不会改变画布位置或尺寸。"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      surface="bare"
      title={title}
    >
      <div
        className="canvas-preview-shell"
        style={{ viewTransitionName: canvasPreviewTransitionName(nodeId) }}
      >
        <NotePaper autoFocus title={title} variant="reader">
          {document === undefined && status !== "error" ? (
            <SkeletonGroup label="正在读取原文">
              <Skeleton className="canvas-preview-line-skeleton" />
              <Skeleton className="canvas-preview-line-skeleton" />
              <Skeleton className="canvas-preview-line-skeleton" />
            </SkeletonGroup>
          ) : status === "error" ? (
            <p className="canvas-preview-error">{error ?? "原文读取失败。"}</p>
          ) : (
            <MarkdownReadingView
              content={document?.memo.content_mdx ?? ""}
              preserveSoftBreaks
            />
          )}
        </NotePaper>
        {/*
          纸内只有正文。动作住在纸外的工具列里, 与纸顶右角对齐后向下排列:
          正文再长也不会把「编辑原文」推到看不见的地方, 而纸面保持一张干净的纸。
        */}
        <div className="canvas-preview-tools">
          <button
            aria-label="关闭预览"
            className="canvas-preview-tool"
            onClick={onClose}
            title="关闭预览"
            type="button"
          >
            <XIcon size={16} />
          </button>
          <button
            aria-label="编辑原文"
            className="canvas-preview-tool"
            disabled={document === undefined}
            onClick={() => void onEditOriginal()}
            title="编辑原文"
            type="button"
          >
            <PencilSimpleIcon size={16} />
          </button>
        </div>
      </div>
    </Dialog>
  );
}
