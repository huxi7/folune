/**
 * [INPUT]: 依赖 design-system Dialog（bare 表面）/Skeleton、共享 NotePaper reader 纸面、memoDocumentStore 的按 ID 正文缓存与 MarkdownReadingView
 * [OUTPUT]: 对外提供不卸载 Canvas 的全尺寸 Paper 预览层：柔和遮罩、纸张自身滚动、纸外右上角 44px 圆形关闭，以及交回外层 flush 的“编辑原文”
 * [POS]: KnowledgeCanvas 的正文阅读边界；Canvas API 永不携带 content_mdx，只有用户明确预览时才按目标 memo ID 加载正文；Esc/遮罩/焦点归还统一复用 Dialog 的模态行为，不另造第二套弹窗
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect } from "react";

import {
  Dialog,
  Skeleton,
  SkeletonGroup,
} from "../../shared/design-system/components";
import { XIcon } from "../../shared/design-system/icons";
import { useMemoDocumentStore } from "../../shared/store/memoDocumentStore";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { NotePaper } from "../NotePaper";

type CanvasPreviewOverlayProps = {
  accessToken: string;
  memoId: string;
  onClose: () => void;
  onEditOriginal: () => Promise<void>;
  title: string;
};

export function CanvasPreviewOverlay({
  accessToken,
  memoId,
  onClose,
  onEditOriginal,
  title,
}: CanvasPreviewOverlayProps) {
  const document = useMemoDocumentStore((state) => state.documents[memoId]);
  const status = useMemoDocumentStore((state) => state.statuses[memoId] ?? "idle");
  const error = useMemoDocumentStore((state) => state.errors[memoId]);
  const loadMemo = useMemoDocumentStore((state) => state.loadMemo);

  useEffect(() => {
    if (document !== undefined || status === "loading") return;
    const controller = new AbortController();
    void loadMemo(accessToken, memoId, controller.signal).catch(() => undefined);
    return () => controller.abort();
    // status 由本次 loadMemo 自己切到 loading；若把它放进依赖，effect
    // 会立即 cleanup 并中止刚发出的请求，随后 error/loading 互相重试。
  }, [accessToken, document, loadMemo, memoId]);

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
      <div className="canvas-preview-shell">
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
          {/* 唯一的纸内动作: 遮罩中央只允许出现纸张本身, 因此不再有纸外按钮行 */}
          <button
            className="canvas-preview-edit"
            disabled={document === undefined}
            onClick={() => void onEditOriginal()}
            type="button"
          >
            编辑原文
          </button>
        </NotePaper>
        <button
          aria-label="关闭预览"
          className="canvas-preview-close"
          onClick={onClose}
          title="关闭预览"
          type="button"
        >
          <XIcon size={16} />
        </button>
      </div>
    </Dialog>
  );
}
