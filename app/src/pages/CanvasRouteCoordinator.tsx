/**
 * [INPUT]: 依赖 React Router、轻量 memo tree、canvasReturnStore 与 CanvasWorkspace/共享 Panel 插槽
 * [OUTPUT]: 对外提供 /app/notes/:id 的 Canvas 路由协调器，统一退出目标、Canvas→原文返回描述与会话恢复
 * [POS]: pages 的 Canvas 路由边界；AppDashboard 不再拥有 Canvas 内部 flush/视口/选择/Panel 细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useNavigate } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";

import type { MemoTreeNode } from "../shared/api/memo";
import { findNode } from "../shared/store/memoTree";
import { useCanvasReturnStore } from "../shared/store/canvasReturnStore";
import { CanvasWorkspace } from "../widgets/CanvasWorkspace";

type CanvasRouteCoordinatorProps = {
  accessToken: string;
  assistant: ReactNode;
  assistantOpen: boolean;
  canvasId: string;
  library: ReactNode;
  libraryOpen: boolean;
  memoTree: readonly MemoTreeNode[];
  onSelectMemo: (memoId: string) => void;
  style: CSSProperties;
  title: string;
  userId: string;
};

const lastMemoStorageKey = (userId: string): string =>
  `supernote:last-memo:${userId}`;

export function CanvasRouteCoordinator({
  accessToken,
  assistant,
  assistantOpen,
  canvasId,
  library,
  libraryOpen,
  memoTree,
  onSelectMemo,
  style,
  title,
  userId,
}: CanvasRouteCoordinatorProps) {
  const navigate = useNavigate();
  const descriptor = useCanvasReturnStore((state) => state.descriptor);
  const rememberReturn = useCanvasReturnStore((state) => state.set);
  const clearReturn = useCanvasReturnStore((state) => state.clear);
  const restore = descriptor?.canvasId === canvasId ? descriptor : null;

  const exit = () => {
    clearReturn();
    const lastMemoId = window.localStorage.getItem(lastMemoStorageKey(userId));
    const lastMemo = lastMemoId === null ? null : findNode(memoTree, lastMemoId);
    if (lastMemo?.node_type === "memo") {
      onSelectMemo(lastMemo.id);
      return;
    }
    navigate("/app");
  };

  return (
    <CanvasWorkspace
      accessToken={accessToken}
      assistant={assistant}
      canvasId={canvasId}
      initialAssistantOpen={assistantOpen}
      initialLibraryOpen={libraryOpen}
      library={library}
      onExit={exit}
      onNavigateMemo={(memoId, nextDescriptor) => {
        rememberReturn(nextDescriptor);
        navigate(`/app/notes/${encodeURIComponent(memoId)}`);
      }}
      restore={restore}
      style={style}
      title={title}
      userId={userId}
    />
  );
}
