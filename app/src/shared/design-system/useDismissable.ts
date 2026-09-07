/**
 * [INPUT]: 依赖 react 的 useEffect/useRef，依赖 DOM 的 document 级 pointerdown/keydown 事件
 * [OUTPUT]: 对外提供 useDismissable hook，统一弹层的外部点击关闭、Escape 关闭与焦点归还
 * [POS]: app/src/shared/design-system 的弹层消散原语，被 Select/UserMenu/MarkdownViewMenu/PermissionModeControl 等一切"点外部或按 Escape 就该收起"的浮层共同消费；它同时是 Escape 层级仲裁协议的下半部分——每次消散都 preventDefault，使 PaperWorkspaceShell 的壳层守卫得以让行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, type RefObject } from "react";

type UseDismissableInput = {
  /** 弹层是否展开；关闭时不挂载任何监听器 */
  open: boolean;
  /** 弹层外壳（触发器 + 浮层）的容器，用于判定点击是否落在外部 */
  shellRef: RefObject<HTMLElement | null>;
  /** 请求关闭 */
  onDismiss: () => void;
  /** 关闭后接收焦点的元素（通常是触发器）；不传则不归还 */
  focusRef?: RefObject<HTMLElement | null>;
};

/**
 * 弹层消散的单一实现。
 *
 * 收敛前本项目有 5 处各自手写，行为三向分叉：两处没有 Escape 关闭（键盘
 * 用户打开后无退出路径）、两处不归还焦点（Tab 序列退回文档顶部）、一处
 * 依赖数组写成 `[]` 使监听器在整个挂载期常驻。
 *
 * Escape 分支必定 `preventDefault()`：这是与 PaperWorkspaceShell 壳层
 * 守卫之间的协议——内层消费过的 Escape 不得再关闭外层 Panel，否则一次
 * 误触会连带卸载 Panel 并销毁其中的本地草稿。
 */
export function useDismissable({
  open,
  shellRef,
  onDismiss,
  focusRef,
}: UseDismissableInput): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        onDismiss();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      onDismiss();
      focusRef?.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusRef, onDismiss, open, shellRef]);
}
