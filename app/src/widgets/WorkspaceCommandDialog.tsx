/**
 * [INPUT]: 依赖全局键盘事件、CanvasMemoPicker 的共享搜索结果原语与上层路由打开命令
 * [OUTPUT]: 对外提供任意 Workspace 可用的 ⌘K/Ctrl+K 打开对象 Dialog；Enter 永远只导航
 * [POS]: widgets 的全局对象命令入口；Canvas 增量加入仍归其局部 Picker，本组件没有任何写操作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useState } from "react";

import { CanvasMemoPicker } from "./KnowledgeCanvas/CanvasMemoPicker";

type WorkspaceCommandDialogProps = {
  accessToken: string;
  enabled: boolean;
  onOpenMemo: (memoId: string) => void;
};

export function WorkspaceCommandDialog({
  accessToken,
  enabled,
  onOpenMemo,
}: WorkspaceCommandDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  return open ? (
    <CanvasMemoPicker
      accessToken={accessToken}
      mode="open"
      onClose={() => setOpen(false)}
      onOpenMemo={async (memoId) => onOpenMemo(memoId)}
    />
  ) : null;
}
