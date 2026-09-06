/**
 * [INPUT]: 依赖 motion/react、workspaceMotion snappy/reducedFade、设计系统图标、文件库当前目录语境与上层 memo/canvas/folder 创建意图
 * [OUTPUT]: 对外提供约 80px split 新建控件及只含 Canvas/文件夹的可聚焦菜单，支持可打断开合、方向键/Home/End/Escape、外部关闭与焦点归还
 * [POS]: AppSidebar 的创建入口；关闭时立即撤出无障碍树并冻结交互，视觉层单独完成轻微回收，不持有树事务或路由状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import {
  CanvasIcon,
  CaretDownIcon,
  FolderIcon,
} from "../shared/design-system/icons";
import { snappy, reducedFadeTransition } from "../pages/workspaceMotion";

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
  const reduceMotion = useReducedMotion();
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
      <motion.div
          animate={open
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.98, y: -4 }}
          aria-hidden={!open}
          className="sidebar-create-menu"
          data-open={open}
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
          role={open ? "menu" : undefined}
          tabIndex={-1}
          initial={false}
          style={{ pointerEvents: open ? "auto" : "none" }}
          transition={reduceMotion ? reducedFadeTransition : {
            ...snappy,
            opacity: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
          }}
        >
          <button onClick={() => choose(onCreateCanvas)} role="menuitem" type="button">
            <CanvasIcon size={14} />新建 Canvas
          </button>
          <button onClick={() => choose(onCreateFolder)} role="menuitem" type="button">
            <FolderIcon size={14} />新建文件夹
          </button>
      </motion.div>
    </div>
  );
}
