/**
 * [INPUT]: 依赖 PresenceSurface 的统一入退场、 React 弹层/焦点状态、共享 Lucide 视图图标、共享 Button/Toast、当前 title/content 与 Markdown 视图状态协议
 * [OUTPUT]: 对外提供高频编辑/阅读切换、具备完整菜单焦点语义的 More 菜单、原始 Markdown 复制与 .md 导出
 * [POS]: app/src/widgets 的编辑视图命令边界；只操作本地显示状态和原始正文副本，不拼接 title、不触发保存或改造业务数据流
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { PresenceSurface } from "../shared/design-system/components/PresenceSurface";
import {
  BookOpenTextIcon,
  CheckIcon,
  CopyIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  PencilSimpleIcon,
} from "../shared/design-system/icons";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useDismissable } from "../shared/design-system/useDismissable";

import { Button, useToast } from "../shared/design-system/components";
import type { DocumentView, EditingMode } from "./markdownViewTypes";

type MarkdownViewMenuProps = {
  content: string;
  documentView: DocumentView;
  editingMode: EditingMode;
  onDocumentViewChange: (view: DocumentView) => void;
  onEditingModeChange: (mode: EditingMode) => void;
  title: string;
};

const menuItemSelector = '[role="menuitem"], [role="menuitemradio"]';

export function markdownExportFilename(title: string): string {
  const safeTitle = title
    .trim()
    // oxlint-disable-next-line eslint/no-control-regex -- 导出文件名必须显式过滤 ASCII 控制字符
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/[. ]+$/g, "")
    .slice(0, 180);

  return `${safeTitle || "未命名备忘录"}.md`;
}

export function MarkdownViewMenu({
  content,
  documentView,
  editingMode,
  onDocumentViewChange,
  onEditingModeChange,
  title,
}: MarkdownViewMenuProps) {
  const menuId = useId();
  const triggerId = `${menuId}-trigger`;
  const menuRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Button 未 forwardRef, 焦点归还走既有的 id 查询路径
  const dismissAndFocusTrigger = useCallback(() => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  }, [triggerId]);

  useDismissable({ onDismiss: dismissAndFocusTrigger, open, shellRef });

  function focusTrigger() {
    document.getElementById(triggerId)?.focus();
  }

  function closeAndRestoreFocus() {
    setOpen(false);
    requestAnimationFrame(focusTrigger);
  }

  function focusMenuItem(position: "first" | "last") {
    requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
        menuItemSelector,
      );
      const target = position === "first" ? items?.[0] : items?.[items.length - 1];
      target?.focus();
    });
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      focusMenuItem(event.key === "ArrowDown" ? "first" : "last");
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(menuItemSelector) ?? [],
    );
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  function selectEditingMode(mode: EditingMode) {
    onEditingModeChange(mode);
    onDocumentViewChange("editing");
    closeAndRestoreFocus();
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(content);
      toast({ title: "Markdown 已复制", variant: "success" });
    } catch {
      toast({ title: "复制失败，请重试", variant: "error" });
    } finally {
      closeAndRestoreFocus();
    }
  }

  function exportMarkdown() {
    const objectUrl = URL.createObjectURL(
      new Blob([content], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.download = markdownExportFilename(title);
    anchor.href = objectUrl;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    toast({ title: "Markdown 已导出", variant: "success" });
    closeAndRestoreFocus();
  }

  const reading = documentView === "reading";

  return (
    <div className="markdown-view-menu" data-document-view={documentView} data-editing-mode={editingMode}>
      <Button
        aria-label={reading ? "返回编辑" : "进入阅读模式"}
        className="note-view-icon-button"
        icon={reading ? PencilSimpleIcon : BookOpenTextIcon}
        onClick={() => onDocumentViewChange(reading ? "editing" : "reading")}
        size="square"
        title={reading ? "返回编辑" : "阅读模式"}
        variant="ghost"
      />

      <div className="note-more-menu-shell" ref={shellRef}>
        <Button
          aria-controls={menuId}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="打开更多 Markdown 操作"
          className="note-view-icon-button"
          id={triggerId}
          icon={DotsThreeIcon}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          onKeyDown={handleTriggerKeyDown}
          size="square"
          title="更多"
          variant="ghost"
        />

      <PresenceSurface open={open}
            aria-label="Markdown 视图与文件操作"
            className="note-more-menu"
            id={menuId}
            onKeyDown={handleMenuKeyDown}
            ref={menuRef}
            role="menu"
            tabIndex={-1}
          >
            <button
              aria-checked={editingMode === "live"}
              className="note-more-menu-item"
              onClick={() => selectEditingMode("live")}
              role="menuitemradio"
              type="button"
            >
              <span>实时预览</span>
              {editingMode === "live" ? (
                <CheckIcon aria-hidden="true" size={14} />
              ) : null}
            </button>
            <button
              aria-checked={editingMode === "source"}
              className="note-more-menu-item"
              onClick={() => selectEditingMode("source")}
              role="menuitemradio"
              type="button"
            >
              <span>源码模式</span>
              {editingMode === "source" ? (
                <CheckIcon aria-hidden="true" size={14} />
              ) : null}
            </button>

            <div
              aria-label="Markdown 操作分隔"
              className="note-more-menu-separator"
              role="separator"
            />

            <button
              className="note-more-menu-item"
              onClick={() => void copyMarkdown()}
              role="menuitem"
              type="button"
            >
              <CopyIcon aria-hidden="true" size={16} />
              <span>复制 Markdown</span>
            </button>
            <button
              className="note-more-menu-item"
              onClick={exportMarkdown}
              role="menuitem"
              type="button"
            >
              <DownloadSimpleIcon aria-hidden="true" size={16} />
              <span>导出 .md</span>
            </button>
      </PresenceSurface>
      </div>
    </div>
  );
}
