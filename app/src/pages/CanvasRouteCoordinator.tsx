/**
 * [INPUT]: 依赖 React Router、canvasReturnStore、上层树重命名命令与 CanvasWorkspace/共享 Panel 插槽
 * [OUTPUT]: 对外提供 /app/notes/:id 的 Canvas 路由协调器，统一 Canvas→原文→Canvas 返回描述、会话恢复与画布重命名下传
 * [POS]: pages 的 Canvas 路由边界；AppDashboard 不再拥有 Canvas 内部 flush/视口/选择/Panel 细节
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useNavigate } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";

import { useCanvasReturnStore } from "../shared/store/canvasReturnStore";
import { CanvasWorkspace } from "../widgets/CanvasWorkspace";

type CanvasRouteCoordinatorProps = {
  accessToken: string;
  assistant: ReactNode;
  canvasId: string;
  library: ReactNode;
  onRename: (nodeId: string, title: string) => Promise<void>;
  style: CSSProperties;
  title: string;
  userId: string;
};

export function CanvasRouteCoordinator({
  accessToken,
  assistant,
  canvasId,
  library,
  onRename,
  style,
  title,
  userId,
}: CanvasRouteCoordinatorProps) {
  const navigate = useNavigate();
  const descriptor = useCanvasReturnStore((state) => state.descriptor);
  const rememberReturn = useCanvasReturnStore((state) => state.set);
  const restore = descriptor?.canvasId === canvasId ? descriptor : null;

  return (
    <CanvasWorkspace
      accessToken={accessToken}
      assistant={assistant}
      canvasId={canvasId}
      library={library}
      onNavigateMemo={(memoId, nextDescriptor) => {
        rememberReturn(nextDescriptor);
        navigate(`/app/notes/${encodeURIComponent(memoId)}`);
      }}
      onRename={(title) => onRename(canvasId, title)}
      restore={restore}
      style={style}
      title={title}
      userId={userId}
    />
  );
}
