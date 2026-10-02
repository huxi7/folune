/**
 * [INPUT]: 依赖 useLocale 的界面文案（用户内容保留原文）；依赖共享 PresenceSurface/KeyboardShortcut/语义图标、工具栏锚点与开合状态
 * [OUTPUT]: 提供工具栏上方的画布操作速查，以动作/手势两列说明真实快捷键与连接路径
 * [POS]: CanvasControls 的非模态说明层；Portal 越过 React Flow 层叠边界，锚点只从工具栏真实坐标读取，外部点击/Escape 由工具栏统一消散
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLocale } from "../../shared/locale";
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
  const { t } = useLocale();
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
        <h2 id={`${id}-title`}><KeyboardIcon aria-hidden size={16} />{t("画布操作", "Canvas guide")}</h2>
        <button aria-label={t("关闭操作说明", "Close canvas guide")} className="canvas-control canvas-help-close" onClick={onClose} type="button"><XIcon aria-hidden size={16} /></button>
      </header>
      <div className="canvas-help-body">
        <section className="canvas-help-section" aria-label={t("在画布上", "On the canvas")}>
          <h3>{t("在画布上", "On the canvas")}</h3>
          <dl>
            <HelpRow action={t("查找笔记", "Find notes")}><KeyboardShortcut keys={["mod", "K"]} /></HelpRow>
            <HelpRow action={t("加入画布", "Add to canvas")}><span className="canvas-help-context">{t("搜索结果中", "In search results")}</span><KeyboardShortcut keys={["mod", "Enter"]} /></HelpRow>
            <HelpRow action={t("添加 / 编辑文字", "Add / edit text")}>{t("双击空白 / 文字", "Double-click space / text")}</HelpRow>
            <HelpRow action={t("框选", "Select an area")}>{t("拖动空白处", "Drag empty space")}</HelpRow>
            <HelpRow action={t("平移", "Pan")}><KeyboardShortcut keys={["Space"]} /><span>{t("+ 拖动 / 中键拖动", "+ drag / middle-button drag")}</span></HelpRow>
            <HelpRow action={t("缩放", "Zoom")}>{t("滚轮 / 双指捏合", "Scroll / pinch")}</HelpRow>
          </dl>
        </section>
        <section className="canvas-help-section" aria-label={t("选中笔记后", "With a note selected")}>
          <h3>{t("选中笔记后", "With a note selected")}</h3>
          <dl>
            <HelpRow action={t("预览笔记", "Preview note")}><KeyboardShortcut keys={["Enter"]} /></HelpRow>
            <HelpRow action={t("AI 拓展", "Explore with AI")}><KeyboardShortcut keys={["mod", "E"]} /></HelpRow>
            <HelpRow action={t("移除卡片", "Remove card")}><KeyboardShortcut keys={["Backspace"]} /></HelpRow>
          </dl>
        </section>
        <div className="canvas-help-connection">
          <ConnectionHandleIcon aria-hidden size={16} />
          <p>{t("拖动卡片右下的抓手，连到另一张卡片。", "Drag the handle at the bottom right of a card to another card.")}<br /><span>{t("也可先点抓手，再点目标。", "Or click the handle, then the target card.")}</span></p>
        </div>
      </div>
      <footer className="canvas-help-footer">{t("移除卡片不会删除原笔记。", "Removing a card keeps the original note.")}<span><KeyboardShortcut keys={["Esc"]} />{t("关闭", "Close")}</span></footer>
    </PresenceSurface>, document.body,
  );
}
