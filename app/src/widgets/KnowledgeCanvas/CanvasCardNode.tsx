/**
 * [INPUT]: 依赖 @xyflow/react 的 Handle/NodeProps/NodeResizer、CanvasFlowNode 数据、设计系统图标与 canvasActions Context
 * [OUTPUT]: 对外提供 memo_ref 三态卡片与可原地编辑/四角缩放的 native 自由文字节点
 * [POS]: KnowledgeCanvas 的节点表现层；memo 正文只经 Preview Overlay 读取，自由文字才在画布内编辑，所有写入仍交给统一协调器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Handle,
  NodeResizer,
  Position,
  type NodeProps,
} from "@xyflow/react";
import {
  useEffect,
  useRef,
  useState,
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

export function CanvasCardNode({ data, id, selected }: NodeProps<CanvasFlowNode>) {
  const actions = useCanvasActions();
  const editing = actions.editingTextNodeId === id;
  const singleSelected = selected
    && actions.selectedNodeIds.length === 1
    && actions.selectedNodeIds[0] === id;
  const [text, setText] = useState(data.body ?? "");
  const editorRef = useRef<HTMLTextAreaElement>(null);
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
    return (
      <article
        className="canvas-text-node"
        data-editing={editing}
        data-selected={selected}
        onDoubleClick={(event) => {
          event.stopPropagation();
          actions.onEditText(id);
        }}
      >
        <NodeResizer
          handleClassName="canvas-node-resize-handle"
          isVisible={selected && !editing}
          keepAspectRatio={false}
          maxHeight={480}
          maxWidth={720}
          minHeight={48}
          minWidth={120}
          onResizeEnd={(_, parameters) => {
            void actions.onResize(id, parameters.width, parameters.height)
              .catch(() => undefined);
          }}
        />
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
              void actions.onCommitText(id, text).catch(() => undefined);
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
          <div className="canvas-text-copy">
            <MarkdownReadingView content={data.body ?? ""} preserveSoftBreaks />
          </div>
        )}
        {singleSelected && !editing ? (
          <button
            aria-label="移出画布"
            className="canvas-node-icon-action nodrag"
            onClick={() => void actions.onRemove(id).catch(() => undefined)}
            type="button"
          >
            <TrashIcon size={14} />
          </button>
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
