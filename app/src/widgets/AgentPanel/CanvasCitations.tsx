/**
 * [INPUT]: 依赖服务端引用证据、按 ID 正文 API、共享浮层与只读 Paper 预览
 * [OUTPUT]: 提供回复底部引用入口、短引文、原文预览和卡片定位
 * [POS]: AgentPanel 的回答证据视图；引用属于消息，查看时重新验证访问权与版本
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../shared/design-system/components";
import { BookOpenTextIcon, XIcon } from "../../shared/design-system/icons";
import { useLocale } from "../../shared/locale";
import type { CanvasCitation } from "../../shared/api/canvasChat";
import { getMemo, type MemoDetailNode } from "../../shared/api/memo";
import { getCanvas } from "../../shared/api/canvas";
import { useCanvasWorkspaceStore } from "../../shared/store/canvasWorkspaceStore";
import { CanvasPreviewOverlay } from "../KnowledgeCanvas/CanvasPreviewOverlay";
import { AgentPopover } from "./AgentPopover";
import { requestCanvasCitationFocus } from "./canvasCitationFocus";

export function CanvasCitations({
  citations,
  accessToken,
}: {
  citations: CanvasCitation[];
  accessToken: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CanvasCitation | null>(null);
  const [availability, setAvailability] = useState<
    Record<string, "ready" | "changed" | "missing">
  >({});
  const [previewDocument, setPreviewDocument] = useState<MemoDetailNode | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const id = useId();
  const canvasId = useCanvasWorkspaceStore((s) => s.canvasId);
  const nodes = useCanvasWorkspaceStore((s) => s.document?.nodes);
  const groups = [
    ...new Map(
      citations.map((c) => [
        `${c.kind}:${c.source_id}`,
        citations.filter(
          (x) => x.kind === c.kind && x.source_id === c.source_id,
        ),
      ]),
    ).values(),
  ];
  const memoCount = groups.filter((g) => g[0]?.kind === "memo").length;
  const graphCount = groups.length - memoCount;
  useEffect(() => {
    if (!open) return;
    let active = true;
    const memoIds = [
      ...new Set(
        citations.filter((c) => c.kind === "memo").map((c) => c.source_id),
      ),
    ];
    const canvasIds = [
      ...new Set(
        citations.filter((c) => c.kind !== "memo").map((c) => c.canvas_id),
      ),
    ];
    void Promise.all([
      ...memoIds.map(async (memoId) => {
        const key = `memo:${memoId}`;
        try {
          const memo = await getMemo(accessToken, memoId);
          return [
            key,
            citations.find((c) => c.source_id === memoId)!.revision ===
            memo.revision
              ? "ready"
              : "changed",
          ] as const;
        } catch {
          return [key, "missing"] as const;
        }
      }),
      ...canvasIds.map(async (cid) => {
        try {
          const canvas = await getCanvas(accessToken, cid);
          return [
            `canvas:${cid}`,
            canvas.canvas.version ===
            citations.find((c) => c.canvas_id === cid && c.kind !== "memo")!
              .revision
              ? "ready"
              : "changed",
          ] as const;
        } catch {
          return [`canvas:${cid}`, "missing"] as const;
        }
      }),
    ]).then((entries) => {
      if (active) setAvailability(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [accessToken, citations, open]);
  const showOriginal = async (c: CanvasCitation) => {
    setError(null);
    try {
      const document = await getMemo(accessToken, c.source_id);
      setPreviewDocument(document);
      setOpen(false);
      setPreview(c);
    } catch {
      setError(
        t("原文暂不可用，请重试。", "The source is unavailable. Please retry."),
      );
    }
  };
  return (
    <>
      <Button
        ref={anchor}
        className="agent-response-action"
        icon={BookOpenTextIcon}
        variant="ghost"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setAvailability({});
          setOpen((v) => !v);
        }}
      >
        {memoCount
          ? t(`引用 ${memoCount}`, `Sources ${memoCount}`)
          : t(`画布依据 ${graphCount}`, `Canvas sources ${graphCount}`)}
      </Button>
      <AgentPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        label={t("这条回答的引用", "Sources for this answer")}
        id={id}
      >
        <header>
          <strong>
            {t(
              `${memoCount ? `${memoCount} 篇笔记` : ""}${graphCount ? `${memoCount ? " · " : ""}${graphCount} 项画布依据` : ""}`,
              `${memoCount} notes${graphCount ? ` · ${graphCount} canvas sources` : ""}`,
            )}
          </strong>
          <Button
            aria-label={t("关闭引用", "Close sources")}
            icon={XIcon}
            variant="ghost"
            size="square"
            onClick={() => {
              setOpen(false);
              anchor.current?.focus();
            }}
          />
        </header>
        {error ? <p role="alert">{error}</p> : null}
        {groups.map((group, index) => {
          const c = group[0]!;
          const status =
            availability[
              c.kind === "memo"
                ? `memo:${c.source_id}`
                : `canvas:${c.canvas_id}`
            ];
          return (
            <section
              className="agent-citation-item"
              key={`${c.kind}:${c.source_id}`}
            >
              <strong>
                {index + 1}.{" "}
                {status === "missing"
                  ? t("来源不可用", "Source unavailable")
                  : c.title}
              </strong>
              {status === undefined ? (
                <p>{t("正在核对来源…", "Checking source…")}</p>
              ) : status === "missing" ? (
                <p>
                  {t(
                    "笔记已删除或暂时无法访问。",
                    "The source was removed or cannot be accessed.",
                  )}
                </p>
              ) : (
                <>
                  {status === "changed" ? (
                    <p className="agent-source-hint">
                      {t(
                        "原文已更新，以下为回答时的引用。",
                        "The source changed; this quote belongs to the original answer.",
                      )}
                    </p>
                  ) : null}
                  {group.map((quote, i) => (
                    <div key={i}>
                      <blockquote>{quote.quote}</blockquote>
                      <p className="agent-source-hint">{quote.claim}</p>
                    </div>
                  ))}
                  <div className="agent-citation-actions">
                    {c.kind === "memo" ? (
                      <Button
                        variant="ghost"
                        onClick={() => void showOriginal(c)}
                      >
                        {t("查看原文", "View source")}
                      </Button>
                    ) : null}
                    {canvasId === c.canvas_id &&
                    c.canvas_node_id &&
                    nodes?.some((n) => n.id === c.canvas_node_id) ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          requestCanvasCitationFocus(
                            c.canvas_id,
                            c.canvas_node_id!,
                          );
                          setOpen(false);
                        }}
                      >
                        {t("定位卡片", "Locate card")}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </AgentPopover>
      {preview ? (
        <CanvasPreviewOverlay
          accessToken={accessToken}
          memoId={preview.source_id}
          title={preview.title}
          onClose={() => {
            setPreview(null);
            anchor.current?.focus({ preventScroll: true });
          }}
          expectedRevision={preview.revision}
          sourceDocument={previewDocument ?? undefined}
          citationQuote={preview.quote}
        />
      ) : null}
    </>
  );
}
