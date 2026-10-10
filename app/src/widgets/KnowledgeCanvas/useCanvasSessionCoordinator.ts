/**
 * [INPUT]: 依赖 Canvas V2 API、可选一次性 CanvasEntryBootstrap、CanvasSaveCoordinator/IndexedDB WAL、canvasWorkspaceStore、进入侧栏状态与当前 React Flow 视口
 * [OUTPUT]: 首次进入时报告 Canvas 内容就绪/失败给入口过渡； 对外提供 useCanvasSessionCoordinator，优先消费对应 bootstrap detail，并完成 Store 建会话、WAL 恢复、pagehide 与会话控制注册
 * [POS]: KnowledgeCanvas 的会话基础设施 Hook；一次会话的身份只有 (登录用户, 这张画布)，进入语境与回调走渲染期 latest ref，因此记录返回描述、面板开合或上层重渲染都不会 reset Store、掐断在飞的保存或让预览在过渡取景前消失；初始 detail 只取一次，后续冲突重取仍归 Coordinator
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useWorkspaceEntryReady } from "../../pages/useWorkspaceEntryReady";
import { useWorkspaceEntryStore } from "../../shared/store/workspaceEntryStore";
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
import {
  consumeCanvasEntryBootstrap,
  resolveInitialCanvasDetail,
  type CanvasEntryBootstrap,
} from "../../pages/canvasEntryBootstrap";
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
  bootstrap?: CanvasEntryBootstrap | null;
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
  bootstrap = null,
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
  const bootstrapRef = useRef(
    bootstrap?.canvasId === canvasId ? bootstrap : null,
  );
  /*
   * 一次会话的身份只有 (登录用户, 这张画布)。别的东西一律不许结束它。
   *
   * 进入语境(bootstrap / entryChrome / restore)是"挂载那一刻解释一次"的输入, 而不是
   * 重新订阅的条件; 回调也一样。把它们写进 deps 的代价是真实的: 上层记录一次返回描述
   * 就会让这条 effect 清理一遍 —— resetSession() 清空文档与预览、coordinator.dispose()
   * 掐掉正在飞的保存, 然后重新取一次画布。用户看到的是"点了编辑原文, 预览凭空消失,
   * 结果页面直接弹出来", 因为视图过渡拍旧截图时预览已经不在了。
   *
   * 因此这里用渲染期写入的 latest ref: 读到的永远是最新值, 而会话不因它们重建。
   */
  const entryRef = useRef({ entryChrome, restore });
  const callbacksRef = useRef({ getViewport, onCoordinatorReady, toast });
  // oxlint-disable-next-line react/no-render-phase-updates -- 只写 ref, 不触发渲染
  entryRef.current = { entryChrome, restore };
  callbacksRef.current = { getViewport, onCoordinatorReady, toast };
  const [loadStatus, setLoadStatus] =
    useState<"loading" | "ready" | "error">("loading");
  const [entryId] = useState(() => useWorkspaceEntryStore.getState().id);
  useWorkspaceEntryReady(entryId, loadStatus);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const storage = createIndexedDbCanvasWalStorage();
    setLoadStatus("loading");

    void resolveInitialCanvasDetail(
      canvasId,
      userId,
      bootstrapRef.current,
      async () => await getCanvas(accessToken, canvasId, controller.signal),
    )
      .then(async ({ detail, usedBootstrap }) => {
        if (!active) return;
        if (usedBootstrap && bootstrapRef.current !== null) {
          consumeCanvasEntryBootstrap(
            canvasId,
            bootstrapRef.current.token,
            userId,
          );
        }
        const { entryChrome: chrome, restore: entry } = entryRef.current;
        beginSession({
          canvasId,
          detail,
          focusNodeId: entry?.canvasId === canvasId
            ? entry.selectedNodeId
            : detail.canvas.origin_node_id === null
              ? null
              : detail.nodes.find(
                (node) => node.target_node_id === detail.canvas.origin_node_id,
              )?.id ?? null,
          libraryOpen: chrome.libraryOpen,
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
              callbacksRef.current.toast({
                description: "已保留能提交的部分；移出一些节点或关系后可继续拓展。",
                title: "Canvas 容量不足",
                variant: "info",
              });
            } else if (result.dropped.length > 0) {
              callbacksRef.current.toast({
                description: result.dropped[0]?.reason,
                title: "部分操作未保存",
                variant: "info",
              });
            }
          },
          onDiscardedExpansion() {
            callbacksRef.current.toast({
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
        callbacksRef.current.onCoordinatorReady?.({
          flush: async () => await coordinator.flush(),
          getReturnDescriptor(title) {
            const state = useCanvasWorkspaceStore.getState();
            return {
              canvasId,
              libraryOpen: state.libraryOpen,
              selectedNodeId: state.selectedNodeIds.length === 1
                ? state.selectedNodeIds[0]!
                : null,
              title,
              viewport: callbacksRef.current.getViewport(),
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
        callbacksRef.current.toast({
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
      callbacksRef.current.onCoordinatorReady?.(null);
      resetSession();
    };
    // 只认会话身份: 进入语境与回调走 latest ref, 见上方注释
  }, [accessToken, beginSession, canvasId, resetSession, userId]);

  return { coordinatorRef, loadStatus };
}
