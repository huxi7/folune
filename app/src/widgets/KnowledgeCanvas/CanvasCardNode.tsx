/**
 * [INPUT]: 依赖 @xyflow/react 的 Handle/Position/NodeProps、pages/canvasPresentation 的 CanvasFlowNode 数据、MarkdownReadingView 与 canvasActions Context
 * [OUTPUT]: 对外提供 CanvasCardNode 只读卡片节点
 * [POS]: KnowledgeCanvas 的卡片视图；引用卡片只提供「跳转到那一篇」，摘录/原生卡片提供「成为笔记」。卡片永不原地展开——展开等于把画布变成第二个编辑器，而正文只有一个家
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Handle, Position, type NodeProps } from "@xyflow/react";

import { ArrowRightIcon, NotePencilIcon } from "../../shared/design-system/icons";
import type { CanvasFlowNode } from "../../pages/canvasPresentation";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { useCanvasActions } from "./canvasActions";

export function CanvasCardNode({ data, id, selected }: NodeProps<CanvasFlowNode>) {
  const actions = useCanvasActions();
  const jumpable = data.targetNodeId !== null && !data.tombstone;

  return (
    <article
      className="canvas-card"
      data-kind={data.kind}
      data-selected={selected}
      data-tombstone={data.tombstone}
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

      <footer className="canvas-card-actions">
        {data.promotable ? (
          <button
            className="canvas-card-action"
            disabled={actions.busyCardId === id}
            onClick={() => void actions.onPromote(id)}
            type="button"
          >
            <NotePencilIcon size={14} />
            成为笔记
          </button>
        ) : null}
        {jumpable ? (
          <button
            className="canvas-card-action"
            onClick={() => actions.onOpenMemo(data.targetNodeId as string)}
            type="button"
          >
            <ArrowRightIcon size={14} />
            打开这一篇
          </button>
        ) : null}
        {data.tombstone ? (
          <span className="canvas-card-note">原笔记已被永久删除</span>
        ) : null}
      </footer>
      <Handle isConnectable={false} position={Position.Right} type="source" />
    </article>
  );
}
