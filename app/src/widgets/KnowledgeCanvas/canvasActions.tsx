/**
 * [INPUT]: 依赖 react 的 createContext/useContext
 * [OUTPUT]: 对外提供 CanvasActionsProvider 与 useCanvasActions，传递正文预取、预览、AI、连接抓手、空间文字编辑/等比缩放和移除命令
 * [POS]: KnowledgeCanvas 的动作通道；React Flow data 只保存可序列化视图事实，回调与交互会话通过稳定 Context 下沉，避免每次状态变化重建全部节点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createContext, useContext, type ReactNode } from "react";

import type { SpatialTextGeometry } from "./spatialTextGeometry";

export type CanvasActions = {
  onCancelText: (nodeId: string) => void;
  onCommitText: (
    nodeId: string,
    text: string,
    geometry: SpatialTextGeometry,
  ) => Promise<void>;
  onConnect: (nodeId: string) => void;
  onEditText: (nodeId: string) => void;
  onExpand: (nodeId: string) => Promise<void>;
  onOpenMemo: (nodeId: string) => void;
  onPrefetchMemo: (memoId: string) => void;
  onPreview: (nodeId: string) => void;
  onRemove: (nodeId: string) => Promise<void>;
  onRemoveEdge: (edgeId: string) => Promise<void>;
  onResize: (nodeId: string, geometry: SpatialTextGeometry) => Promise<void>;
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
