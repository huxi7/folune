/**
 * [INPUT]: 依赖 Canvas Workspace persistence slice、CanvasSaveCoordinator 重试入口与设计系统 Button
 * [OUTPUT]: 对外提供 CanvasPersistenceStatus，正常保存/恢复静默，仅展示需处理的持久化异常与重试
 * [POS]: KnowledgeCanvas 的持久化状态视图；只解释协调器状态，不参与 mutation 排队或服务器确认
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { RefObject } from "react";

import { Button } from "../../shared/design-system/components";
import type { CanvasSaveCoordinator } from "../../shared/store/CanvasSaveCoordinator";
import { useCanvasWorkspaceStore } from "../../shared/store/canvasWorkspaceStore";

type CanvasPersistenceStatusProps = {
  coordinatorRef: RefObject<CanvasSaveCoordinator | null>;
};

const statusLabel = (
  status: ReturnType<typeof useCanvasWorkspaceStore.getState>["persistenceStatus"],
): string => {
  if (status === "unsaved") return "尚未同步";
  if (status === "conflict") return "存在版本冲突";
  if (status === "local_recovery_unavailable") return "本机恢复不可用";
  if (status === "recovery_error") return "请检查恢复内容";
  return "";
};

export function CanvasPersistenceStatus({
  coordinatorRef,
}: CanvasPersistenceStatusProps) {
  const status = useCanvasWorkspaceStore((state) => state.persistenceStatus);
  const message = useCanvasWorkspaceStore((state) => state.persistenceMessage);
  const label = statusLabel(status);
  if (!label) return null;

  return (
    <div className="canvas-save-state" data-status={status} role="status">
      <span>{label}</span>
      {message === null ? null : <small>{message}</small>}
      {status === "unsaved" ? (
        <Button
          onClick={() => void coordinatorRef.current?.retry()}
          variant="secondary"
        >
          重试
        </Button>
      ) : null}
    </div>
  );
}
