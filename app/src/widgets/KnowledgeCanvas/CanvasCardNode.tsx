/**
 * [INPUT]: 依赖 @xyflow/react 的 Handle/NodeProps/四角 NodeResizeControl、CanvasFlowNode 数据、共享 NotePaper thumbnail 纸面、空间文字几何、设计系统图标与 canvasActions Context
 * [OUTPUT]: 对外提供 280x360 纵向 memo_ref 笔记预览卡（嵌套纸张、渐隐摘录、悬浮展开按钮、固定高度元信息行）与静止无表面、编辑态稳定聚焦且无边框、四角等比缩放的 native 空间文字节点
 * [POS]: KnowledgeCanvas 的节点表现层；卡片只读快照标题/摘录，正文只经 Preview Overlay 按 ID 读取，空间文字把自身 scale 与视口 zoom 分离，全部持久修改仍交给统一协调器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Handle,
  NodeResizeControl,
  Position,
  ResizeControlVariant,
  type NodeProps,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { CanvasFlowNode } from "../../pages/canvasPresentation";
import {
  ExpandIcon,
  MagicWandIcon,
  PlusIcon,
  TrashIcon,
} from "../../shared/design-system/icons";
import { NotePaper } from "../NotePaper";
import { useCanvasActions } from "./canvasActions";
import {
  CANVAS_TEXT_DEFAULT_HEIGHT,
  CANVAS_TEXT_DEFAULT_WIDTH,
  CANVAS_TEXT_MAX_HEIGHT,
  CANVAS_TEXT_MAX_SCALE,
  CANVAS_TEXT_MAX_WIDTH,
  CANVAS_TEXT_MIN_HEIGHT,
  CANVAS_TEXT_MIN_SCALE,
  CANVAS_TEXT_MIN_WIDTH,
  normalizeTextGeometry,
  resizedTextScale,
  scaleTextGeometry,
  textBaseGeometry,
} from "./spatialTextGeometry";

const textResizeCorners = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

const TEXT_WRAP_TOLERANCE = 1;

const measuredTextBase = (
  element: HTMLElement | null,
  fallback: { height: number; width: number },
): { height: number; width: number } => {
  if (element === null) return fallback;
  const measuredHeight = Math.ceil(Math.max(
    element.offsetHeight,
    element.scrollHeight,
  ));
  const measuredWidth = Math.ceil(Math.max(
    element.offsetWidth,
    element.scrollWidth,
  )) + TEXT_WRAP_TOLERANCE;
  return {
    height: measuredHeight > 0
      ? Math.max(CANVAS_TEXT_MIN_HEIGHT, measuredHeight)
      : fallback.height,
    width: measuredWidth > 0
      ? Math.max(CANVAS_TEXT_MIN_WIDTH, measuredWidth)
      : fallback.width,
  };
};

export function CanvasCardNode({
  data,
  height,
  id,
  selected,
  width,
}: NodeProps<CanvasFlowNode>) {
  const actions = useCanvasActions();
  const editing = actions.editingTextNodeId === id;
  const [text, setText] = useState(data.body ?? "");
  const [resizingScale, setResizingScale] = useState<number | null>(null);
  const [draftBaseGeometry, setDraftBaseGeometry] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const cancelledRef = useRef(false);
  const finishingRef = useRef(false);
  const draftChangedRef = useRef(false);
  const persistedGeometry = normalizeTextGeometry({
    height: data.textHeight ?? height ?? CANVAS_TEXT_DEFAULT_HEIGHT,
    scale: data.textScale,
    width: data.textWidth ?? width ?? CANVAS_TEXT_DEFAULT_WIDTH,
  });
  const baseGeometry = textBaseGeometry(persistedGeometry);
  const finishEditing = useCallback(() => {
    if (finishingRef.current) return;
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    finishingRef.current = true;
    const natural = measuredTextBase(measureRef.current, baseGeometry);
    void actions.onCommitText(
      id,
      text,
      scaleTextGeometry(natural, persistedGeometry.scale),
    ).catch(() => {
      finishingRef.current = false;
    });
  }, [
    actions,
    baseGeometry,
    id,
    persistedGeometry.scale,
    text,
  ]);

  useEffect(() => {
    if (!editing) {
      finishingRef.current = false;
      draftChangedRef.current = false;
      setDraftBaseGeometry(null);
      setText(data.body ?? "");
    }
  }, [data.body, editing]);

  useEffect(() => {
    if (!editing) return;
    const focusEditor = () => {
      editorRef.current?.focus();
      const cursor = editorRef.current?.value.length ?? 0;
      editorRef.current?.setSelectionRange(cursor, cursor);
    };
    focusEditor();
    const timer = window.setTimeout(focusEditor, 0);
    return () => window.clearTimeout(timer);
  }, [editing]);

  useLayoutEffect(() => {
    if (!editing) return;
    const finishEditingOutside = (event: PointerEvent) => {
      const editor = editorRef.current;
      if (editor !== null && !event.composedPath().includes(editor)) {
        if (document.activeElement === editor) editor.blur();
        else finishEditing();
      }
    };
    window.addEventListener("pointerdown", finishEditingOutside, true);
    return () => window.removeEventListener(
      "pointerdown",
      finishEditingOutside,
      true,
    );
  }, [editing, finishEditing]);

  useLayoutEffect(() => {
    if (!editing || data.kind !== "native" || !draftChangedRef.current) return;
    const measured = measuredTextBase(measureRef.current, baseGeometry);
    setDraftBaseGeometry((current) =>
      current?.height === measured.height && current.width === measured.width
        ? current
        : measured);
  }, [baseGeometry.height, baseGeometry.width, data.kind, editing, text]);

  if (data.kind === "native") {
    const activeScale = resizingScale ?? persistedGeometry.scale;
    const activeBaseGeometry = editing && draftBaseGeometry !== null
      ? draftBaseGeometry
      : baseGeometry;
    const surfaceStyle = {
      height: activeBaseGeometry.height,
      transform: `scale(${activeScale})`,
      width: activeBaseGeometry.width,
    } satisfies CSSProperties;

    return (
      <article
        className="canvas-text-node"
        data-editing={editing}
        data-selected={selected}
        data-text-scale={activeScale}
        onDoubleClick={(event) => {
          event.stopPropagation();
          actions.onEditText(id);
        }}
      >
        {selected && !editing ? textResizeCorners.map((position) => (
          <NodeResizeControl
            className="canvas-node-resize-handle"
            key={position}
            keepAspectRatio
            maxHeight={Math.min(
              CANVAS_TEXT_MAX_HEIGHT,
              baseGeometry.height * CANVAS_TEXT_MAX_SCALE,
            )}
            maxWidth={Math.min(
              CANVAS_TEXT_MAX_WIDTH,
              baseGeometry.width * CANVAS_TEXT_MAX_SCALE,
            )}
            minHeight={Math.max(
              CANVAS_TEXT_MIN_HEIGHT,
              baseGeometry.height * CANVAS_TEXT_MIN_SCALE,
            )}
            minWidth={Math.max(
              CANVAS_TEXT_MIN_WIDTH,
              baseGeometry.width * CANVAS_TEXT_MIN_SCALE,
            )}
            onResize={(_, parameters) => {
              setResizingScale(resizedTextScale(
                persistedGeometry.width,
                persistedGeometry.scale,
                parameters.width,
              ));
            }}
            onResizeEnd={(_, parameters) => {
              const scale = resizedTextScale(
                persistedGeometry.width,
                persistedGeometry.scale,
                parameters.width,
              );
              void actions.onResize(id, {
                height: parameters.height,
                scale,
                width: parameters.width,
                x: parameters.x,
                y: parameters.y,
              }).finally(() => setResizingScale(null));
            }}
            position={position}
            variant={ResizeControlVariant.Handle}
          />
        )) : null}
        <div className="canvas-text-surface" style={surfaceStyle}>
          {editing ? (
            <textarea
              aria-label="自由文字"
              className="canvas-text-editor nodrag nowheel"
              maxLength={5000}
              onBlur={finishEditing}
              onChange={(event) => {
                draftChangedRef.current = true;
                setText(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelledRef.current = true;
                  actions.onCancelText(id);
                  event.currentTarget.blur();
                }
              }}
              ref={editorRef}
              value={text}
            />
          ) : (
            <div className="canvas-text-copy">
              <span>{data.body ?? ""}</span>
            </div>
          )}
        </div>
        {editing ? (
          <span
            aria-hidden
            className="canvas-text-measure"
            ref={measureRef}
            style={{ maxWidth: CANVAS_TEXT_MAX_WIDTH / persistedGeometry.scale }}
          >
            {text.length === 0 ? "\u200b" : text}
          </span>
        ) : null}
      </article>
    );
  }

  // 目标笔记仍然可读时才提供阅读/AI/关联: 回收站与永久删除的目标读不出正文,
  // 给出一个注定报错的入口比不给更糟。
  const available = data.targetNodeId !== null
    && !data.tombstone
    && !data.targetDeleted;
  const status = data.tombstone
    ? "原笔记已被永久删除"
    : data.targetDeleted
      ? "在回收站"
      : data.drifted
        ? "原文已更新"
        : "";

  return (
    <article
      className="canvas-card"
      data-kind={data.kind}
      data-selected={selected}
      data-tombstone={data.tombstone}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (available) actions.onPreview(id);
      }}
    >
      <Handle isConnectable={false} position={Position.Left} type="target" />

      <NotePaper
        className="canvas-card-paper"
        emptyLabel={data.tombstone ? "原文已不在库中" : "这页还没有正文"}
        excerpt={data.body}
        overlay={available ? (
          <button
            aria-label={`展开阅读${data.title}`}
            className="canvas-card-expand nodrag"
            onClick={(event) => {
              event.stopPropagation();
              actions.onPreview(id);
            }}
            title="展开阅读"
            type="button"
          >
            <ExpandIcon size={16} />
          </button>
        ) : null}
        title={data.title}
        variant="thumbnail"
      />

      {/* 元信息行高度固定: 上下文操作只改变透明度, 出现与消失都不移动纸张 */}
      <footer className="canvas-card-meta nodrag">
        <span className="canvas-card-status">{status}</span>
        <span className="canvas-card-actions">
          {available ? (
            <button
              aria-label="AI 拓展这条分支"
              className="canvas-card-action"
              disabled={actions.aiLoading}
              onClick={() => void actions.onExpand(id)}
              title="AI 拓展"
              type="button"
            >
              <MagicWandIcon size={14} />
            </button>
          ) : null}
          {available ? (
            <button
              aria-label="关联另一篇笔记"
              className="canvas-card-action"
              onClick={() => actions.onConnect(id)}
              title="关联"
              type="button"
            >
              <PlusIcon size={14} />
            </button>
          ) : null}
          <button
            aria-label="从画布移除"
            className="canvas-card-action"
            onClick={() => void actions.onRemove(id).catch(() => undefined)}
            title="移除"
            type="button"
          >
            <TrashIcon size={14} />
          </button>
        </span>
      </footer>

      <Handle isConnectable={false} position={Position.Right} type="source" />
    </article>
  );
}
