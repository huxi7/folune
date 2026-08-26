/**
 * [INPUT]: 依赖 design-system Dialog/Skeleton、memoDocumentStore 的按 ID 正文缓存与 MarkdownReadingView
 * [OUTPUT]: 对外提供不卸载 Canvas 的可滚动 Paper Preview Overlay，并把“编辑原文”交给外层 flush 后导航
 * [POS]: KnowledgeCanvas 的正文阅读边界；Canvas API 永不携带 content_mdx，只有用户明确预览时才按目标 memo ID 加载正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect } from "react";

import {
  Button,
  Dialog,
  Skeleton,
  SkeletonGroup,
} from "../../shared/design-system/components";
import { useMemoDocumentStore } from "../../shared/store/memoDocumentStore";
import { MarkdownReadingView } from "../MarkdownReadingView";

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
      title={title}
    >
      <div className="canvas-preview-paper">
        {document === undefined && status !== "error" ? (
          <SkeletonGroup label="正在读取原文">
            <Skeleton className="canvas-preview-title-skeleton" />
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
      </div>
      <div className="canvas-preview-actions">
        <Button onClick={onClose} variant="secondary">关闭</Button>
        <Button
          disabled={document === undefined}
          onClick={() => void onEditOriginal()}
        >
          编辑原文
        </Button>
      </div>
    </Dialog>
  );
}
