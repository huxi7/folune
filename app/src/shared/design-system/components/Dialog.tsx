/**
 * [INPUT]: 依赖 React 的 effect/id/ref 与 ReactNode，依赖 共享 Lucide XIcon，依赖 Button 与 index.css 暴露的 ds-dialog-panel 弹窗表面类
 * [OUTPUT]: 对外提供 default/compact 密度、default/account 宽度、panel/bare 表面、default/embedded 标题模式、标题描述关联、Esc 关闭、完整表单焦点循环与滚动锁定的 Dialog 受控弹窗组件
 * [POS]: app/src/shared/design-system/components 的唯一模态基础件；Esc、焦点循环、滚动锁定与焦点归还只在此实现一次，bare 表面让 Canvas 全尺寸预览直接把纸张当作模态内容而无需第二套 Dialog
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { XIcon } from "../icons";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "./Button";

type DialogProps = {
  children: ReactNode;
  density?: DialogDensity;
  description?: string;
  headerMode?: DialogHeaderMode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** bare 表面不提供任何弹窗外壳，只保留遮罩与模态行为，由 children 自己拥有视觉 */
  surface?: DialogSurface;
  title: string;
  width?: DialogWidth;
};

export type DialogDensity = "compact" | "default";
export type DialogHeaderMode = "default" | "embedded";
export type DialogSurface = "bare" | "panel";
export type DialogWidth = "account" | "default";

export function Dialog({
  children,
  density = "default",
  description,
  headerMode = "default",
  onOpenChange,
  open,
  surface = "panel",
  title,
  width = "default",
}: DialogProps) {
  // bare 表面没有可见外壳, 可见标题栏在其中没有意义, 统一收敛为读屏可用的隐式标题。
  const resolvedHeaderMode = surface === "bare" ? "embedded" : headerMode;
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = requestAnimationFrame(() => {
      const initialFocusTarget =
        panelRef.current?.querySelector<HTMLElement>("[data-dialog-autofocus]") ??
        panelRef.current;
      initialFocusTarget?.focus();
    });

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        // 标记已消费, 阻止壳层 (PaperWorkspaceShell) 同一次 Escape 再关 Panel
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      ).filter(
        (element) =>
          element.closest("[hidden]") === null && element.tabIndex >= 0,
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const active = document.activeElement;

      // ---- 不变量: 焦点必须仍在 panel 内 ----
      // 只比对首/尾元素是不够的: 焦点停在 panel 容器自身 (tabIndex=-1) 或
      // body 上时, 两个等值判断都不成立, Shift+Tab 直接穿出到被遮住且已锁滚
      // 的应用界面。aria-modal 只影响读屏虚拟光标, 拦不住真实 Tab 序列。
      if (active === null || !panelRef.current.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement)?.focus();
        return;
      }

      if (event.shiftKey && active === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && active === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      className="ds-dialog-overlay fixed inset-0 flex items-center justify-center p-4 backdrop-blur-md"
      role="dialog"
    >
      <button
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={() => onOpenChange(false)}
        tabIndex={-1}
        type="button"
      />
      <div
        className={[
          "relative z-10",
          surface === "bare" ? "ds-dialog-shell" : "ds-dialog-panel",
          ...(surface === "bare" ? [] : [
            width === "account" ? "account-dialog-panel" : "w-full max-w-lg",
            resolvedHeaderMode === "embedded"
              ? "p-0"
              : density === "compact"
                ? "p-4"
                : "p-5",
          ]),
        ].join(" ")}
        data-density={density}
        data-surface={surface}
        data-width={width}
        ref={panelRef}
        tabIndex={-1}
      >
        {resolvedHeaderMode === "embedded" ? (
          <div className="sr-only">
            <h2 id={titleId}>{title}</h2>
            {description ? (
              <p id={descriptionId}>{description}</p>
            ) : null}
          </div>
        ) : (
          <div
            className={density === "compact"
              ? "flex items-start justify-between gap-3"
              : "flex items-start justify-between gap-4"}
          >
            <div>
              <h2
                className={density === "compact"
                  ? "text-base font-semibold leading-tight text-foreground"
                  : "text-xl font-semibold leading-tight text-foreground"}
                id={titleId}
              >
                {title}
              </h2>
              {description ? (
                <p
                  className={density === "compact"
                    ? "mt-1.5 text-xs leading-5 text-muted-foreground"
                    : "mt-3 text-sm leading-6 text-muted-foreground"}
                  id={descriptionId}
                >
                  {description}
                </p>
              ) : null}
            </div>
            <Button
              aria-label="关闭弹窗"
              icon={XIcon}
              onClick={() => onOpenChange(false)}
              size="square"
              title="关闭"
              variant="ghost"
            />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
