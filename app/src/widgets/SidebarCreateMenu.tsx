/**
 * [INPUT]: 依赖设计系统图标、文件库当前目录语境与上层 memo/canvas/folder 创建意图
 * [OUTPUT]: 对外提供主按钮默认新建笔记、相邻菜单显式选择笔记/Canvas/文件夹的 SidebarCreateMenu
 * [POS]: AppSidebar 的创建入口；只管理菜单焦点和选择，不持有树事务或路由状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useState } from "react";

import {
  CanvasIcon,
  CaretDownIcon,
  FileTextIcon,
  FolderIcon,
  NotePencilIcon,
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

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
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
        <NotePencilIcon size={16} />
      </button>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="选择新建类型"
        className="sidebar-create-more"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title="更多新建选项"
        type="button"
      >
        <CaretDownIcon size={14} />
      </button>
      {open ? (
        <div className="sidebar-create-menu" role="menu">
          <button onClick={() => choose(onCreateMemo)} role="menuitem" type="button">
            <FileTextIcon size={14} />新建备忘录
          </button>
          <button onClick={() => choose(onCreateCanvas)} role="menuitem" type="button">
            <CanvasIcon size={14} />新建 Canvas
          </button>
          <button onClick={() => choose(onCreateFolder)} role="menuitem" type="button">
            <FolderIcon size={14} />新建文件夹
          </button>
        </div>
      ) : null}
    </div>
  );
}
