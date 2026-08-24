/**
 * [INPUT]: 依赖 react 的 createContext/useContext
 * [OUTPUT]: 对外提供 CanvasActionsProvider 与 useCanvasActions
 * [POS]: KnowledgeCanvas 的动作通道；React Flow 只把 data 交给节点，把回调塞进 data 会让节点在每次 setState 时全部重建，因此改用 Context 传递「跳转」「晋升」两个命令
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createContext, useContext, type ReactNode } from "react";

export type CanvasActions = {
  /** 正在晋升中的卡片 id，用于禁用重复点击 */
  busyCardId: string | null;
  onOpenMemo: (nodeId: string) => void;
  onPromote: (cardId: string) => Promise<void>;
};

const CanvasActionsContext = createContext<CanvasActions | null>(null);

export function CanvasActionsProvider({
  actions,
  children,
}: {
  actions: CanvasActions;
  children: ReactNode;
}) {
  return (
    <CanvasActionsContext.Provider value={actions}>
      {children}
    </CanvasActionsContext.Provider>
  );
}

export function useCanvasActions(): CanvasActions {
  const actions = useContext(CanvasActionsContext);

  if (actions === null) {
    throw new Error("CanvasCardNode 必须在 CanvasActionsProvider 内渲染。");
  }

  return actions;
}
