/**
 * [INPUT]: 依赖PresenceSurface紧凑菜单120/100ms配方、WarmTooltip、React弹层/焦点状态、locale双语文案、共享图标/Button/Toast与Markdown视图/文件协议
 * [OUTPUT]: 编辑/阅读与更多入口共享Canvas同款提示；更多展开时提示退场，保留菜单焦点语义、原文复制及.md下载
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

import { Button, WarmTooltip, useToast } from "../shared/design-system/components";
import { useLocale } from "../shared/locale";
import type { DocumentView, EditingMode } from "./markdownViewTypes";

type MarkdownViewMenuProps = {
  content: string;
  fileActionsEnabled?: boolean;
  documentView: DocumentView;
  editingMode: EditingMode;
  onDocumentViewChange: (view: DocumentView) => void;
  onEditingModeChange: (mode: EditingMode) => void;
  title: string;
};

const menuItemSelector = '[role="menuitem"], [role="menuitemradio"]';

export function markdownExportFilename(title: string, fallback = "未命名备忘录"): string {
  const safeTitle = title
    .trim()
    // oxlint-disable-next-line eslint/no-control-regex -- 导出文件名必须显式过滤 ASCII 控制字符
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/[. ]+$/g, "")
    .slice(0, 180);

  return `${safeTitle || fallback}.md`;
}

export function MarkdownViewMenu({
  content,
  fileActionsEnabled = true,
  documentView,
  editingMode,
  onDocumentViewChange,
  onEditingModeChange,
  title,
}: MarkdownViewMenuProps) {
  const { t } = useLocale();
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
      toast({ title: t("Markdown 已复制", "Markdown copied"), variant: "success" });
    } catch {
      toast({ title: t("复制失败，请重试", "Couldn't copy. Please try again."), variant: "error" });
    } finally {
      closeAndRestoreFocus();
    }
  }

  function exportMarkdown() {
    const objectUrl = URL.createObjectURL(
      new Blob([content], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.download = markdownExportFilename(title, t("未命名备忘录", "Untitled note"));
    anchor.href = objectUrl;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    closeAndRestoreFocus();
  }

  const reading = documentView === "reading";

  return (
    <div className="markdown-view-menu" data-document-view={documentView} data-editing-mode={editingMode}>
      <WarmTooltip content={reading ? t("返回编辑", "Back to editing") : t("阅读模式", "Reading mode")} side="bottom" disabled={open}>
      <Button
        aria-label={reading ? t("返回编辑", "Back to editing") : t("进入阅读模式", "Enter reading mode")}
        className="note-view-icon-button"
        icon={reading ? PencilSimpleIcon : BookOpenTextIcon}
        onClick={() => onDocumentViewChange(reading ? "editing" : "reading")}
        size="square"
        variant="ghost"
      />
      </WarmTooltip>

      <div className="note-more-menu-shell" ref={shellRef}>
        <WarmTooltip content={t("更多操作", "More actions")} side="bottom" disabled={open || !fileActionsEnabled}>
        <Button
          disabled={!fileActionsEnabled}
          aria-controls={menuId}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t("打开更多 Markdown 操作", "More Markdown actions")}
          className="note-view-icon-button"
          id={triggerId}
          icon={DotsThreeIcon}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          onKeyDown={handleTriggerKeyDown}
          size="square"
          variant="ghost"
        />
        </WarmTooltip>

      <PresenceSurface open={open} kind="compact-menu"
            aria-label={t("Markdown 视图与文件操作", "Markdown view and file actions")}
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
              <span>{t("实时预览", "Live preview")}</span>
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
              <span>{t("源码模式", "Source mode")}</span>
              {editingMode === "source" ? (
                <CheckIcon aria-hidden="true" size={14} />
              ) : null}
            </button>

            <div
              aria-label={t("Markdown 操作分隔", "Markdown actions")}
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
              <span>{t("复制 Markdown", "Copy Markdown")}</span>
            </button>
            <button
              className="note-more-menu-item"
              onClick={exportMarkdown}
              role="menuitem"
              type="button"
            >
              <DownloadSimpleIcon aria-hidden="true" size={16} />
              <span>{t("导出 .md", "Export .md")}</span>
            </button>
      </PresenceSurface>
      </div>
    </div>
  );
}
