/**
 * [INPUT]: 依赖 React Flow Panel、共享 WarmTooltip/KeyboardShortcut/useDismissable、CanvasHelpPopover 与上层加入/视口命令
 * [OUTPUT]: 提供两个中性动作面、同组连续悬浮提示与工具栏上方的轻量操作说明，快捷键只呈现真实绑定
 * [POS]: KnowledgeCanvas 的空间命令条；仅拥有帮助开合，沿用既有命令入口，不读写图数据或另设快捷键
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Panel } from "@xyflow/react";
import { useCallback, useId, useRef, useState } from "react";

import { KeyboardShortcut, WarmTooltip, WarmTooltipGroup } from "../../shared/design-system/components";
import { useDismissable } from "../../shared/design-system/useDismissable";
import { CanvasHelpPopover } from "./CanvasHelpPopover";
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
  const helpId = useId();
  const shellRef = useRef<HTMLDivElement>(null);
  const helpPanelRef = useRef<HTMLDivElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const dismissHelp = useCallback(() => setHelpOpen(false), []);
  useDismissable({ open: helpOpen, shellRef, contentRef: helpPanelRef, focusRef: helpButtonRef, onDismiss: dismissHelp });

  return (
    <Panel className="canvas-controls" position="bottom-center" ref={shellRef}>
      <WarmTooltipGroup>
        <div className="canvas-control-group" data-surface="content">
          <WarmTooltip content="加入笔记" disabled={helpOpen} shortcut={<KeyboardShortcut keys={["mod", "K"]} />}>
            <button aria-label="加入笔记" aria-keyshortcuts="Meta+K Control+K" className="canvas-control canvas-control-add" onClick={onAdd} type="button">
              <AddNoteIcon aria-hidden size={16} />
            </button>
          </WarmTooltip>
        </div>
        <div className="canvas-control-group canvas-control-group-viewport" data-surface="viewport">
          <WarmTooltip content="适配视图" disabled={helpOpen}>
            <button aria-label="适配视图" className="canvas-control" onClick={onFit} type="button">
              <FitViewIcon aria-hidden size={16} />
            </button>
          </WarmTooltip>
          <WarmTooltip content="缩小" disabled={helpOpen}>
            <button aria-label="缩小" className="canvas-control" onClick={onZoomOut} type="button">
              <ZoomOutIcon aria-hidden size={16} />
            </button>
          </WarmTooltip>
          <WarmTooltip content="放大" disabled={helpOpen}>
            <button aria-label="放大" className="canvas-control" onClick={onZoomIn} type="button">
              <ZoomInIcon aria-hidden size={16} />
            </button>
          </WarmTooltip>
          <WarmTooltip content="操作说明" disabled={helpOpen}>
            <button aria-controls={helpOpen ? helpId : undefined} aria-expanded={helpOpen} aria-haspopup="dialog" aria-label="操作说明" className="canvas-control" onClick={() => setHelpOpen((open) => !open)} ref={helpButtonRef} type="button">
              <InfoIcon aria-hidden size={16} />
            </button>
          </WarmTooltip>
        </div>
      </WarmTooltipGroup>
      <CanvasHelpPopover anchorRef={shellRef} panelRef={helpPanelRef} id={helpId} open={helpOpen} onClose={() => { dismissHelp(); helpButtonRef.current?.focus(); }} />
    </Panel>
  );
}
