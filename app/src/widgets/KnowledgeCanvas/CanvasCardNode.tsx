/**
 * [INPUT]: 依赖 @xyflow/react 的 Handle/NodeProps/四角 NodeResizeControl、CanvasFlowNode 数据、空间文字几何、设计系统图标与 canvasActions Context
 * [OUTPUT]: 对外提供 memo_ref 三态卡片与静止无表面、可原地编辑、四角等比缩放的 native 空间文字节点
 * [POS]: KnowledgeCanvas 的节点表现层；memo 正文只经 Preview Overlay 读取，空间文字把自身 scale 与视口 zoom 分离，全部持久修改仍交给统一协调器
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
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { CanvasFlowNode } from "../../pages/canvasPresentation";
import {
  EyeIcon,
  MagicWandIcon,
  PlusIcon,
  TrashIcon,
} from "../../shared/design-system/icons";
import { MarkdownReadingView } from "../MarkdownReadingView";
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

const measuredTextBase = (
  element: HTMLElement | null,
  fallback: { height: number; width: number },
): { height: number; width: number } => {
  if (element === null) return fallback;
  const measuredHeight = Math.max(element.offsetHeight, element.scrollHeight);
  const measuredWidth = Math.max(element.offsetWidth, element.scrollWidth);
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
  const singleSelected = selected
    && actions.selectedNodeIds.length === 1
    && actions.selectedNodeIds[0] === id;
  const [text, setText] = useState(data.body ?? "");
  const [resizingScale, setResizingScale] = useState<number | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setText(data.body ?? "");
  }, [data.body, editing]);

  useEffect(() => {
    if (editing) {
      editorRef.current?.focus();
      editorRef.current?.select();
    }
  }, [editing]);

  if (data.kind === "native") {
    const persistedGeometry = normalizeTextGeometry({
      height: data.textHeight ?? height ?? CANVAS_TEXT_DEFAULT_HEIGHT,
      scale: data.textScale,
      width: data.textWidth ?? width ?? CANVAS_TEXT_DEFAULT_WIDTH,
    });
    const baseGeometry = textBaseGeometry(persistedGeometry);
    const activeScale = resizingScale ?? persistedGeometry.scale;
    const surfaceStyle = {
      height: baseGeometry.height,
      transform: `scale(${activeScale})`,
      width: baseGeometry.width,
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
              onBlur={() => {
                if (cancelledRef.current) {
                  cancelledRef.current = false;
                  return;
                }
                const natural = measuredTextBase(measureRef.current, baseGeometry);
                void actions.onCommitText(
                  id,
                  text,
                  scaleTextGeometry(natural, persistedGeometry.scale),
                ).catch(() => undefined);
              }}
              onChange={(event) => setText(event.target.value)}
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
            <div className="canvas-text-copy">{data.body ?? ""}</div>
          )}
        </div>
        {editing ? (
          <span aria-hidden className="canvas-text-measure" ref={measureRef}>
            {text.length === 0 ? "\u200b" : text}
          </span>
        ) : null}
      </article>
    );
  }

  const previewable = data.targetNodeId !== null && !data.tombstone;
  const expandable = previewable && !data.targetDeleted;

  return (
    <article
      className="canvas-card"
      data-kind={data.kind}
      data-selected={selected}
      data-tombstone={data.tombstone}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (previewable) actions.onPreview(id);
      }}
    >
      <Handle isConnectable={false} position={Position.Left} type="target" />
      <header className="canvas-card-header">
        <span className="canvas-card-title">{data.title}</span>
        {data.drifted ? <span className="canvas-card-flag">原文已更新</span> : null}
        {data.targetDeleted ? <span className="canvas-card-flag">在回收站</span> : null}
      </header>

      {data.body === null || data.body.length === 0 ? null : (
        <div className="canvas-card-body">
          <MarkdownReadingView content={data.body} preserveSoftBreaks />
        </div>
      )}

      {singleSelected ? (
        <footer className="canvas-card-actions nodrag">
          {expandable ? (
            <button
              className="canvas-card-action"
              disabled={actions.aiLoading}
              onClick={() => void actions.onExpand(id)}
              type="button"
            >
              <MagicWandIcon size={14} />
              AI 拓展
            </button>
          ) : null}
          {expandable ? (
            <button
              className="canvas-card-action"
              onClick={() => actions.onConnect(id)}
              type="button"
            >
              <PlusIcon size={14} />
              关联
            </button>
          ) : null}
          {previewable ? (
            <button
              className="canvas-card-action"
              onClick={() => actions.onPreview(id)}
              type="button"
            >
              <EyeIcon size={14} />
              预览
            </button>
          ) : null}
          <button
            className="canvas-card-action"
            onClick={() => void actions.onRemove(id).catch(() => undefined)}
            type="button"
          >
            <TrashIcon size={14} />
            移除
          </button>
        </footer>
      ) : null}

      {data.tombstone ? (
        <span className="canvas-card-note">原笔记已被永久删除</span>
      ) : null}
      <Handle isConnectable={false} position={Position.Right} type="source" />
    </article>
  );
}
