/**
 * [INPUT]: 依赖 Canvas V2 API、CanvasSaveCoordinator/IndexedDB WAL、canvasWorkspaceStore、上层解析好的进入侧栏状态与可注入当前 React Flow 视口
 * [OUTPUT]: 对外提供 useCanvasSessionCoordinator，完成真实读取、Store 建会话、WAL 恢复、pagehide 与会话控制注册
 * [POS]: KnowledgeCanvas 的会话基础设施 Hook；把网络/恢复生命周期从交互组件中剥离，组件只消费 coordinatorRef 与 loadStatus
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  commitCanvasExpansion,
  getCanvas,
  mutateCanvas,
  startCanvasMutationKeepalive,
  type CanvasViewport,
} from "../../shared/api/canvas";
import type { ToastInput } from "../../shared/design-system/components";
import type { CanvasChromeState } from "../../shared/store/canvasChromePolicy";
import {
  CanvasSaveCoordinator,
  type CanvasCoordinatorSink,
} from "../../shared/store/CanvasSaveCoordinator";
import type { CanvasReturnDescriptor } from "../../shared/store/canvasReturnStore";
import { createIndexedDbCanvasWalStorage } from "../../shared/store/canvasWal";
import { useCanvasWorkspaceStore } from "../../shared/store/canvasWorkspaceStore";

export type CanvasSessionControls = {
  flush(): Promise<import("../../shared/store/CanvasSaveCoordinator").CanvasFlushResult>;
  getReturnDescriptor(title: string): CanvasReturnDescriptor;
};

type UseCanvasSessionCoordinatorInput = {
  accessToken: string;
  canvasId: string;
  /** 进入这张画布那一刻由 canvasChromeStore 解析出的左右面板状态 */
  entryChrome: CanvasChromeState;
  getViewport: () => CanvasViewport;
  onCoordinatorReady?: (controls: CanvasSessionControls | null) => void;
  restore: CanvasReturnDescriptor | null;
  toast: (input: ToastInput) => void;
  userId: string;
};

export function useCanvasSessionCoordinator({
  accessToken,
  canvasId,
  entryChrome,
  getViewport,
  onCoordinatorReady,
  restore,
  toast,
  userId,
}: UseCanvasSessionCoordinatorInput) {
  const beginSession = useCanvasWorkspaceStore((state) => state.beginSession);
  const resetSession = useCanvasWorkspaceStore((state) => state.reset);
  const coordinatorRef = useRef<CanvasSaveCoordinator | null>(null);
  const [loadStatus, setLoadStatus] =
    useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const storage = createIndexedDbCanvasWalStorage();
    setLoadStatus("loading");

    void getCanvas(accessToken, canvasId, controller.signal)
      .then(async (detail) => {
        if (!active) return;
        beginSession({
          assistantOpen: entryChrome.assistantOpen,
          canvasId,
          detail,
          focusNodeId: restore?.canvasId === canvasId
            ? restore.selectedNodeId
            : detail.canvas.origin_node_id === null
              ? null
              : detail.nodes.find(
                (node) => node.target_node_id === detail.canvas.origin_node_id,
              )?.id ?? null,
          libraryOpen: entryChrome.libraryOpen,
          userId,
        });

        const sink: CanvasCoordinatorSink = {
          applyLocal(intent) {
            useCanvasWorkspaceStore.getState().applyLocal(intent);
          },
          confirm(intents, result, pending) {
            useCanvasWorkspaceStore.getState()
              .confirmMutation(intents, result, pending);
          },
          getServerVersion() {
            return useCanvasWorkspaceStore.getState()
              .serverDocument?.canvas.version ?? detail.canvas.version;
          },
          replaceServer(next, pending) {
            useCanvasWorkspaceStore.getState().replaceServer(next, pending);
          },
          setPersistence(status, count, message) {
            useCanvasWorkspaceStore.getState()
              .setPersistence(status, count, message);
          },
        };
        const coordinator = new CanvasSaveCoordinator({
          scope: { canvasId, userId },
          sink,
          storage,
          onResult(result) {
            if (result.expansion_status === "incomplete_due_to_capacity") {
              toast({
                description: "已保留能提交的部分；移出一些节点或关系后可继续拓展。",
                title: "Canvas 容量不足",
                variant: "info",
              });
            } else if (result.dropped.length > 0) {
              toast({
                description: result.dropped[0]?.reason,
                title: "部分操作未保存",
                variant: "info",
              });
            }
          },
          onDiscardedExpansion() {
            toast({
              description: "原文在 AI 运行期间发生变化，旧结果没有写入；请重新拓展。",
              title: "已放弃过期的 AI 结果",
              variant: "info",
            });
          },
          transport: {
            commitExpansion: async (request) =>
              await commitCanvasExpansion(accessToken, canvasId, request),
            getCanvas: async () => await getCanvas(accessToken, canvasId),
            keepalive: (request) =>
              startCanvasMutationKeepalive(accessToken, canvasId, request),
            mutate: async (request) =>
              await mutateCanvas(accessToken, canvasId, request),
          },
        });
        coordinatorRef.current = coordinator;
        onCoordinatorReady?.({
          flush: async () => await coordinator.flush(),
          getReturnDescriptor(title) {
            const state = useCanvasWorkspaceStore.getState();
            return {
              assistantOpen: state.assistantOpen,
              canvasId,
              libraryOpen: state.libraryOpen,
              selectedNodeId: state.selectedNodeIds.length === 1
                ? state.selectedNodeIds[0]!
                : null,
              title,
              viewport: getViewport(),
            };
          },
        });
        setLoadStatus("ready");
        await coordinator.recover(detail);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setLoadStatus("error");
        toast({
          description: error instanceof Error ? error.message : undefined,
          title: "Canvas 加载失败",
          variant: "error",
        });
      });

    const handlePageHide = () => coordinatorRef.current?.flushForPageHide();
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("pagehide", handlePageHide);
      coordinatorRef.current?.dispose();
      coordinatorRef.current = null;
      onCoordinatorReady?.(null);
      resetSession();
    };
  }, [
    accessToken,
    beginSession,
    canvasId,
    entryChrome,
    getViewport,
    onCoordinatorReady,
    resetSession,
    restore,
    toast,
    userId,
  ]);

  return { coordinatorRef, loadStatus };
}
