/**
 * [INPUT]: 依赖 React Flow Panel、持续挂载的设计系统 Dialog/图标与上层明确的加入/视口命令
 * [OUTPUT]: 对外提供一个 Panel 内彼此留白、同为中性材质的图标内容动作面与视口动作面
 * [POS]: KnowledgeCanvas 的无状态空间命令条；外壳只负责 bottom-center 定位，两个独立 surface 用留白而非强调色表达语义边界，不读写图数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Panel } from "@xyflow/react";
import { useState } from "react";

import { Dialog } from "../../shared/design-system/components";
import {
  AddNoteIcon,
  FitViewIcon,
  InfoIcon,
  ZoomInIcon,
  ZoomOutIcon,
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
        <div className="canvas-control-group" data-surface="content">
          <button aria-label="加入笔记" className="canvas-control canvas-control-add" onClick={onAdd} title="加入笔记" type="button">
            <AddNoteIcon aria-hidden size={16} />
          </button>
        </div>
        <div className="canvas-control-group canvas-control-group-viewport" data-surface="viewport">
          <button aria-label="适配视图" className="canvas-control" onClick={onFit} type="button">
            <FitViewIcon aria-hidden size={16} />
          </button>
          <button aria-label="缩小" className="canvas-control" onClick={onZoomOut} type="button">
            <ZoomOutIcon aria-hidden size={16} />
          </button>
          <button aria-label="放大" className="canvas-control" onClick={onZoomIn} type="button">
            <ZoomInIcon aria-hidden size={16} />
          </button>
          <button aria-label="操作说明" className="canvas-control" onClick={() => setHelpOpen(true)} type="button">
            <InfoIcon aria-hidden size={16} />
          </button>
        </div>
      </Panel>
        <Dialog
          description="Canvas 只保存卡片、关系和空间位置；笔记正文始终留在原文。"
          onOpenChange={setHelpOpen}
          open={helpOpen}
          title="Canvas 操作"
        >
          <ul className="canvas-help-list">
            <li>双击空白：新建自由文字；双击文字：编辑。</li>
            <li>空白左拖：框选；Space + 拖动或中键：平移。</li>
            <li>底部「加入笔记」图标：查找并连续加入已有笔记；Enter：预览。</li>
            <li>选中笔记可 AI 拓展、预览或移出；右下连接柄用于建立关系。</li>
          </ul>
        </Dialog>
    </>
  );
}
