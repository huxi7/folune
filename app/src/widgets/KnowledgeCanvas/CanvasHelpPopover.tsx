/**
 * [INPUT]: 依赖共享 PresenceSurface/KeyboardShortcut/语义图标、工具栏锚点与开合状态
 * [OUTPUT]: 提供工具栏上方的画布操作速查，以动作/手势两列说明真实快捷键与连接路径
 * [POS]: CanvasControls 的非模态说明层；Portal 越过 React Flow 层叠边界，锚点只从工具栏真实坐标读取，外部点击/Escape 由工具栏统一消散
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { KeyboardShortcut, PresenceSurface } from "../../shared/design-system/components";
import { ConnectionHandleIcon, KeyboardIcon, XIcon } from "../../shared/design-system/icons";
import "./CanvasHelpPopover.css";

type CanvasHelpPopoverProps = {
  id: string;
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
};

function HelpRow({ action, children }: { action: string; children: ReactNode }) {
  return <div className="canvas-help-row"><dt>{action}</dt><dd>{children}</dd></div>;
}

export function CanvasHelpPopover({ id, open, onClose, anchorRef, panelRef }: CanvasHelpPopoverProps) {
  const [position, setPosition] = useState<{ left: number; bottom: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!open || !anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      setPosition({ left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top, maxHeight: rect.top });
    };
    place();
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, open, panelRef]);

  if (typeof document === "undefined" || position === null) return null;

  return createPortal(
    <PresenceSurface
      aria-labelledby={`${id}-title`}
      className="canvas-help-popover"
      id={id}
      open={open}
      placement="top"
      ref={panelRef}
      role="dialog"
      style={{ left: position.left, bottom: `calc(${position.bottom}px + var(--space-3))`, maxHeight: `calc(${position.maxHeight}px - var(--space-3) * 2)` }}
      tabIndex={-1}
    >
      <header className="canvas-help-header">
        <h2 id={`${id}-title`}><KeyboardIcon aria-hidden size={16} />画布操作</h2>
        <button aria-label="关闭操作说明" className="canvas-control canvas-help-close" onClick={onClose} type="button"><XIcon aria-hidden size={16} /></button>
      </header>
      <div className="canvas-help-body">
        <section className="canvas-help-section" aria-label="在画布上">
          <h3>在画布上</h3>
          <dl>
            <HelpRow action="查找笔记"><KeyboardShortcut keys={["mod", "K"]} /></HelpRow>
            <HelpRow action="加入画布"><span className="canvas-help-context">搜索结果中</span><KeyboardShortcut keys={["mod", "Enter"]} /></HelpRow>
            <HelpRow action="添加 / 编辑文字">双击空白 / 文字</HelpRow>
            <HelpRow action="框选">拖动空白处</HelpRow>
            <HelpRow action="平移"><KeyboardShortcut keys={["Space"]} /><span>+ 拖动 / 中键拖动</span></HelpRow>
            <HelpRow action="缩放">滚轮 / 双指捏合</HelpRow>
          </dl>
        </section>
        <section className="canvas-help-section" aria-label="选中笔记后">
          <h3>选中笔记后</h3>
          <dl>
            <HelpRow action="预览笔记"><KeyboardShortcut keys={["Enter"]} /></HelpRow>
            <HelpRow action="AI 拓展"><KeyboardShortcut keys={["mod", "E"]} /></HelpRow>
            <HelpRow action="移除卡片"><KeyboardShortcut keys={["Backspace"]} /></HelpRow>
          </dl>
        </section>
        <div className="canvas-help-connection">
          <ConnectionHandleIcon aria-hidden size={16} />
          <p>拖动卡片右下的抓手，连到另一张卡片。<br /><span>也可先点抓手，再点目标。</span></p>
        </div>
      </div>
      <footer className="canvas-help-footer">移除卡片不会删除原笔记。<span><KeyboardShortcut keys={["Esc"]} />关闭</span></footer>
    </PresenceSurface>, document.body,
  );
}
