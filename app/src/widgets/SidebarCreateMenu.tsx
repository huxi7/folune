/**
 * [INPUT]: 依赖 PresenceSurface紧凑菜单120/100ms配方、设计系统图标、文件库当前目录语境与上层 memo/canvas/folder 创建意图
 * [OUTPUT]: 对外提供约 80px split 新建控件及只含 Canvas/文件夹的可聚焦菜单，支持方向键/Home/End/Escape、外部关闭与焦点归还
 * [POS]: AppSidebar 的创建入口；只管理菜单焦点和选择，不持有树事务或路由状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { PresenceSurface } from "../shared/design-system/components/PresenceSurface";
import { useEffect, useRef, useState } from "react";

import {
  CanvasIcon,
  CaretDownIcon,
  FolderIcon,
} from "../shared/design-system/icons";

type SidebarCreateMenuProps = {
  disabled: boolean;
  onCreateCanvas: () => void;
  onCreateFolder: () => void;
  onCreateMemo: () => void;
};

export function SidebarCreateMenu({
  disabled,
  onCreateCanvas,
  onCreateFolder,
  onCreateMemo,
}: SidebarCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    window.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    triggerRef.current?.focus();
    action();
  };

  return (
    <div className="sidebar-create-split" ref={rootRef}>
      <button
        aria-label="新建备忘录"
        className="sidebar-create-main"
        disabled={disabled}
        onClick={onCreateMemo}
        title="新建备忘录"
        type="button"
      >
        <span>新建</span>
      </button>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="选择新建类型"
        className="sidebar-create-more"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
        title="更多新建选项"
        type="button"
      >
        <CaretDownIcon aria-hidden size={14} />
      </button>
      <PresenceSurface open={open} kind="compact-menu"
          className="sidebar-create-menu"
          onKeyDown={(event) => {
            const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
              "button",
            ) ?? [])];
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              triggerRef.current?.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const next = index === -1
                ? 0
                : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length)
                  % items.length;
              items[next]?.focus();
            } else if (event.key === "Home") {
              event.preventDefault();
              items[0]?.focus();
            } else if (event.key === "End") {
              event.preventDefault();
              items.at(-1)?.focus();
            }
          }}
          ref={menuRef}
          role="menu"
          tabIndex={-1}
        >
          <button onClick={() => choose(onCreateCanvas)} role="menuitem" type="button">
            <CanvasIcon size={14} />新建 Canvas
          </button>
          <button onClick={() => choose(onCreateFolder)} role="menuitem" type="button">
            <FolderIcon size={14} />新建文件夹
          </button>
      </PresenceSurface>
    </div>
  );
}
