/**
 * [INPUT]: 依赖 React Flow Panel、设计系统 Dialog/图标与上层明确的加入/视口命令
 * [OUTPUT]: 对外提供 Canvas 底部中央加入、适配、缩放和操作说明控件
 * [POS]: KnowledgeCanvas 的无状态空间命令条；顶层四块分区里它只占底部中央，说明 Overlay 状态局部自持，不读写图数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Panel } from "@xyflow/react";
import { useState } from "react";

import { Dialog } from "../../shared/design-system/components";
import {
  FitViewIcon,
  InfoIcon,
  MinusIcon,
  PlusIcon,
} from "../../shared/design-system/icons";

type CanvasControlsProps = {
  onAdd: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function CanvasControls({
  onAdd,
  onFit,
  onZoomIn,
  onZoomOut,
}: CanvasControlsProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <Panel className="canvas-controls" position="bottom-center">
        <button aria-label="加入笔记" className="canvas-control" onClick={onAdd} type="button">
          <PlusIcon size={16} />
        </button>
        <button aria-label="适配视图" className="canvas-control" onClick={onFit} type="button">
          <FitViewIcon size={16} />
        </button>
        <button aria-label="缩小" className="canvas-control" onClick={onZoomOut} type="button">
          <MinusIcon size={16} />
        </button>
        <button aria-label="放大" className="canvas-control" onClick={onZoomIn} type="button">
          <PlusIcon size={16} />
        </button>
        <button aria-label="操作说明" className="canvas-control" onClick={() => setHelpOpen(true)} type="button">
          <InfoIcon size={16} />
        </button>
      </Panel>
      {helpOpen ? (
        <Dialog
          description="Canvas 只保存卡片、关系和空间位置；笔记正文始终留在原文。"
          onOpenChange={setHelpOpen}
          open
          title="Canvas 操作"
        >
          <ul className="canvas-help-list">
            <li>双击空白：新建自由文字；双击文字：编辑。</li>
            <li>空白左拖：框选；Space + 拖动或中键：平移。</li>
            <li>⌘K / Ctrl+K：查找；Enter：预览；显式加号：加入。</li>
            <li>选中笔记可 AI 拓展、关联、预览或移出 Canvas。</li>
          </ul>
        </Dialog>
      ) : null}
    </>
  );
}
