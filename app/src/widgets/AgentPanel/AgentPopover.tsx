/**
 * [INPUT]: 依赖真实按钮锚点、可选水平对齐外壳、PresenceSurface 与 useDismissable
 * [OUTPUT]: 提供来源选择与引用共用的原位非模态浮层
 * [POS]: AgentPanel 浮层边界；水平对齐与按钮焦点分离，Portal 避开滚动裁切，事件不穿透画布
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { PresenceSurface } from "../../shared/design-system/components";
import { useDismissable } from "../../shared/design-system/useDismissable";
import "./canvasChat.css";

type Props = {
  open: boolean;
  onClose(): void;
  anchorRef: RefObject<HTMLElement | null>;
  alignRef?: RefObject<HTMLElement | null>;
  label: string;
  id: string;
  children: ReactNode;
  className?: string;
};
export function AgentPopover({
  open,
  onClose,
  anchorRef,
  alignRef,
  label,
  id,
  children,
  className = "",
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    left: 8,
    top: 8,
    width: 320,
    maxHeight: 400,
  });
  useDismissable({
    open,
    onDismiss: onClose,
    shellRef: anchorRef,
    contentRef,
    focusRef: anchorRef,
  });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const left = alignRef?.current?.getBoundingClientRect().left ?? anchor.left;
      const width = Math.min(340, window.innerWidth - 16);
      const desired = Math.min(contentRef.current?.scrollHeight ?? 360, 420);
      const above = anchor.top - 16,
        below = window.innerHeight - anchor.bottom - 16;
      const useAbove = above >= desired || above > below;
      const maxHeight = Math.max(80, Math.min(420, useAbove ? above : below));
      const height = Math.min(desired, maxHeight);
      setPosition({
        left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
        top: useAbove
          ? Math.max(8, anchor.top - height - 8)
          : anchor.bottom + 8,
        width,
        maxHeight,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (contentRef.current) observer.observe(contentRef.current);
    const frame = requestAnimationFrame(() =>
      contentRef.current
        ?.querySelector<HTMLElement>("input, button")
        ?.focus({ preventScroll: true }),
    );
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, alignRef, open]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <PresenceSurface
      open={open}
      ref={contentRef}
      id={id}
      role="dialog"
      aria-label={label}
      className={`agent-context-popover ${className}`}
      style={position}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          anchorRef.current?.focus();
        }
      }}
    >
      {children}
    </PresenceSurface>,
    document.body,
  );
}
