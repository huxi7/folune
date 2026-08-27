/**
 * [INPUT]: 依赖 @xyflow/react v12 的 Pane 指针/坐标协议、Canvas Chat、useCanvasSessionCoordinator、canvasWorkspaceStore、纯投影/增量布局、memo document Store 与本地设计系统
 * [OUTPUT]: 对外提供始终挂载真实 React Flow 的 Canvas V2：受控节点/边/视口、空白 Pane 双击自由文字、Picker/连接、Preview、AI 增量拓展和可靠保存状态
 * [POS]: KnowledgeCanvas 的会话内容根；UI 只产生 intent，人工与 AI 都经同一个协调器/RPC，正文只在 Preview 按 ID 加载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import "@xyflow/react/dist/style.css";

import {
  layoutCanvasCandidates,
  nearestCanvasPlacement,
} from "../../pages/canvasIncrementalLayout";
import {
  CANVAS_DEFAULT_VIEWPORT,
  canvasPositionOperation,
  shouldRestoreCanvasViewport,
  toCanvasFlow,
  type CanvasFlowNode,
} from "../../pages/canvasPresentation";
import { Skeleton, SkeletonGroup, useToast } from "../../shared/design-system/components";
import {
  type CanvasIntent,
} from "../../shared/store/canvasDocument";
import { useCanvasWorkspaceStore } from "../../shared/store/canvasWorkspaceStore";
import type { CanvasReturnDescriptor } from "../../shared/store/canvasReturnStore";
import { expandCanvas } from "../AgentPanel/canvasExpandClient";
import type { MentionResult } from "../AgentPanel/MentionMenu";
import { CanvasActionsProvider } from "./canvasActions";
import { CanvasCardNode } from "./CanvasCardNode";
import { CanvasControls } from "./CanvasControls";
import { CanvasCordEdge } from "./CanvasCordEdge";
import { CanvasMemoPicker } from "./CanvasMemoPicker";
import { CanvasPersistenceStatus } from "./CanvasPersistenceStatus";
import { CanvasPreviewOverlay } from "./CanvasPreviewOverlay";
import {
  useCanvasSessionCoordinator,
  type CanvasSessionControls,
} from "./useCanvasSessionCoordinator";

const nodeTypes = { canvasNode: CanvasCardNode };
const edgeTypes = { cord: CanvasCordEdge };
const panOnDrag = [1, 2];
const proOptions = { hideAttribution: true };

type KnowledgeCanvasProps = {
  accessToken: string;
  canvasId: string;
  initialAssistantOpen: boolean;
  initialLibraryOpen: boolean;
  onCoordinatorReady?: (controls: CanvasSessionControls | null) => void;
  onEditMemo: (nodeId: string) => void;
  onSelectMemo: (nodeId: string) => void;
  restore?: CanvasReturnDescriptor | null;
  userId: string;
};

type TransientTextNode = {
  id: string;
  text: string;
  x: number;
  y: number;
};

const directPair = (sourceId: string, targetId: string): string =>
  sourceId < targetId ? `${sourceId}:${targetId}` : `${targetId}:${sourceId}`;

const flowNodeFromTransient = (node: TransientTextNode): CanvasFlowNode => ({
  data: {
    body: node.text,
    createdBy: "user",
    discoveredFromId: null,
    drifted: false,
    kind: "native",
    snapshotRevision: null,
    targetDeleted: false,
    targetNodeId: null,
    title: "自由文字",
    tombstone: false,
  },
  id: node.id,
  position: { x: node.x, y: node.y },
  style: { height: 120, width: 240 },
  type: "canvasNode",
});

export function KnowledgeCanvas({
  accessToken,
  canvasId,
  initialAssistantOpen,
  initialLibraryOpen,
  onCoordinatorReady,
  onEditMemo,
  onSelectMemo,
  restore = null,
  userId,
}: KnowledgeCanvasProps) {
  const { toast } = useToast();
  const document = useCanvasWorkspaceStore((state) => state.document);
  const selectedNodeIds = useCanvasWorkspaceStore((state) => state.selectedNodeIds);
  const selectNodes = useCanvasWorkspaceStore((state) => state.selectNodes);
  const previewNodeId = useCanvasWorkspaceStore((state) => state.previewNodeId);
  const openPreview = useCanvasWorkspaceStore((state) => state.openPreview);
  const editingTextNodeId = useCanvasWorkspaceStore((state) => state.editingTextNodeId);
  const editText = useCanvasWorkspaceStore((state) => state.editText);
  const connectionSourceId = useCanvasWorkspaceStore((state) => state.connectionSourceId);
  const startConnection = useCanvasWorkspaceStore((state) => state.startConnection);
  const aiLoading = useCanvasWorkspaceStore((state) => state.aiLoading);
  const setAiLoading = useCanvasWorkspaceStore((state) => state.setAiLoading);
  const [pickerMode, setPickerMode] = useState<"add" | "connect" | null>(null);
  const [transientText, setTransientText] = useState<TransientTextNode | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const instanceRef = useRef<ReactFlowInstance<CanvasFlowNode, Edge> | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const initialViewportAppliedRef = useRef(false);
  const latestDocumentRef = useRef(document);
  latestDocumentRef.current = document;
  const getViewport = useCallback(
    () => instanceRef.current?.getViewport() ?? CANVAS_DEFAULT_VIEWPORT,
    [],
  );
  const { coordinatorRef, loadStatus } = useCanvasSessionCoordinator({
    accessToken,
    canvasId,
    getViewport,
    initialAssistantOpen,
    initialLibraryOpen,
    onCoordinatorReady,
    restore,
    toast,
    userId,
  });

  useEffect(() => {
    initialViewportAppliedRef.current = false;
  }, [canvasId]);

  useEffect(() => {
    const flow = document === null
      ? { edges: [], nodes: [], viewport: CANVAS_DEFAULT_VIEWPORT }
      : toCanvasFlow(document);
    const selected = new Set(selectedNodeIds);
    const nextNodes = flow.nodes.map((node) => ({
      ...node,
      selected: selected.has(node.id),
    }));
    if (transientText !== null) {
      nextNodes.push({
        ...flowNodeFromTransient(transientText),
        selected: selected.has(transientText.id),
      });
    }
    setNodes(nextNodes);
    setEdges(flow.edges.map((edge) => ({
      ...edge,
      className: selectedNodeIds.length === 1
        && (edge.source === selectedNodeIds[0] || edge.target === selectedNodeIds[0])
        ? "canvas-edge-direct"
        : "canvas-edge-muted",
    })));

    const instance = instanceRef.current;
    if (
      document !== null
      && instance !== null
      && !initialViewportAppliedRef.current
    ) {
      initialViewportAppliedRef.current = true;
      requestAnimationFrame(() => {
        const restoredViewport = restore?.canvasId === canvasId
          ? restore.viewport
          : null;
        if (restoredViewport !== null) {
          void instance.setViewport(restoredViewport, { duration: 0 });
        } else if (shouldRestoreCanvasViewport(document.canvas.viewport)) {
          void instance.setViewport(flow.viewport, { duration: 0 });
        } else if (flow.nodes.length > 0) {
          void instance.fitView({ duration: 0, padding: 0.18 });
        }
      });
    }
  }, [canvasId, document, restore, selectedNodeIds, setEdges, setNodes, transientText]);

  const enqueue = useCallback(async (intent: CanvasIntent) => {
    try {
      await coordinatorRef.current?.enqueue(intent);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "本机恢复不可用",
        variant: "error",
      });
      throw error;
    }
  }, [toast]);

  const persistViewport = useCallback(() => {
    const viewport = instanceRef.current?.getViewport();
    if (viewport === undefined) return;
    void enqueue({
      operation: { type: "set_viewport", viewport: { ...viewport, user_moved: true } },
    }).catch(() => undefined);
  }, [enqueue]);

  const fitView = useCallback(() => {
    const instance = instanceRef.current;
    if (instance === null) return;
    void instance.fitView({ duration: 220, padding: 0.18 }).then(persistViewport);
  }, [persistViewport]);

  const handleMoveEnd = useCallback((
    event: MouseEvent | TouchEvent | null,
    viewport: { x: number; y: number; zoom: number },
  ) => {
    if (event === null) return;
    void enqueue({
      operation: {
        type: "set_viewport",
        viewport: { ...viewport, user_moved: true },
      },
    }).catch(() => undefined);
  }, [enqueue]);

  const handleNodeDragStop = useCallback((
    _: MouseEvent | TouchEvent,
    node: CanvasFlowNode,
  ) => {
    const operation = canvasPositionOperation(node);
    if (operation !== null) void enqueue({ operation }).catch(() => undefined);
  }, [enqueue]);

  const handleSelectionChange = useCallback(({
    nodes: selectedNodes,
  }: { nodes: CanvasFlowNode[] }) => {
    selectNodes(selectedNodes.map((node) => node.id));
  }, [selectNodes]);

  const handlePaneDoubleClick = useCallback((event: ReactMouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const pane = target.closest(".react-flow__pane");
    const paneSurface = target === pane
      || target.closest(".react-flow__background") !== null;
    if (pane === null || !paneSurface) return;
    const instance = instanceRef.current;
    if (instance === null) return;
    const position = instance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const node = {
      id: crypto.randomUUID(),
      text: "",
      x: position.x,
      y: position.y,
    };
    setTransientText(node);
    editText(node.id);
  }, [editText]);

  const flushBeforeNavigation = useCallback(async (): Promise<boolean> => {
    const coordinator = coordinatorRef.current;
    if (coordinator === null) return true;
    const result = await coordinator.flush();
    if (!result.synced && result.persisted) {
      toast({
        title: "尚未同步，将在重开后继续",
        variant: "info",
      });
    }
    return result.persisted;
  }, [toast]);

  const navigateToMemo = useCallback(async (
    memoId: string,
    editOriginal = false,
  ) => {
    if (!await flushBeforeNavigation()) return;
    if (editOriginal) onEditMemo(memoId);
    else onSelectMemo(memoId);
  }, [flushBeforeNavigation, onEditMemo, onSelectMemo]);

  const viewportCenter = useCallback(() => {
    const instance = instanceRef.current;
    const rect = flowRef.current?.getBoundingClientRect();
    if (instance === null || rect === undefined) return { x: 0, y: 0 };
    return instance.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, []);

  const addMemo = useCallback(async (memo: MentionResult) => {
    const current = latestDocumentRef.current;
    if (current === null) return;
    const existing = current.nodes.find(
      (node) => node.kind === "memo_ref" && node.target_node_id === memo.id,
    );
    const source = connectionSourceId === null
      ? null
      : current.nodes.find((node) => node.id === connectionSourceId) ?? null;

    if (source !== null && existing !== undefined) {
      const pair = directPair(source.id, existing.id);
      if (!current.edges.some(
        (edge) => directPair(edge.source_id, edge.target_id) === pair,
      )) {
        await enqueue({
          operation: {
            edge_id: crypto.randomUUID(),
            source_id: source.id,
            target_id: existing.id,
            type: "upsert_edge",
          },
        });
      }
      selectNodes([existing.id]);
      startConnection(null);
      return;
    }

    if (existing !== undefined) {
      selectNodes([existing.id]);
      instanceRef.current?.fitView({
        duration: 220,
        nodes: [{ id: existing.id }],
        padding: 0.8,
      });
      return;
    }

    if (current.nodes.length >= 50) {
      toast({ title: "Canvas 已达到 50 个节点上限", variant: "error" });
      return;
    }

    const position = source === null
      ? nearestCanvasPlacement(current.nodes, viewportCenter())
      : layoutCanvasCandidates(
        current.nodes,
        source.id,
        [{ confidence: 1, memoId: memo.id }],
      )[0] ?? nearestCanvasPlacement(current.nodes, viewportCenter());
    const nodeId = crypto.randomUUID();
    await enqueue({
      hint: { revision: memo.revision, title: memo.title },
      operation: {
        ...(source === null ? {} : {
          discovered_from_id: source.id,
          edge_id: crypto.randomUUID(),
          source_node_id: source.id,
        }),
        node_id: nodeId,
        target_node_id: memo.id,
        type: "add_memo",
        x: position.x,
        y: position.y,
      },
    });
    selectNodes([nodeId]);
    startConnection(null);
  }, [
    connectionSourceId,
    enqueue,
    selectNodes,
    startConnection,
    toast,
    viewportCenter,
  ]);

  const expandFromNode = useCallback(async (sourceNodeId: string) => {
    const coordinator = coordinatorRef.current;
    if (coordinator === null || aiLoading) return;
    const flushed = await coordinator.flush();
    if (!flushed.synced) {
      toast({ title: "请先恢复网络并保存当前修改", variant: "error" });
      return;
    }

    setAiLoading(true, sourceNodeId);
    try {
      const result = await expandCanvas({
        canvasId,
        limit: 5,
        sourceCanvasNodeId: sourceNodeId,
      });
      if (result.status === "up_to_date") {
        toast({ title: "已是最新", variant: "info" });
        return;
      }

      const current = useCanvasWorkspaceStore.getState().document;
      if (current === null) return;
      const positions = layoutCanvasCandidates(
        current.nodes,
        sourceNodeId,
        result.candidates.map((candidate) => ({
          confidence: candidate.confidence,
          memoId: candidate.memo_id,
        })),
      );
      const positionByMemo = new Map(
        positions.map((position) => [position.memoId, position]),
      );
      const intents: CanvasIntent[] = [];

      for (const candidate of result.candidates) {
        const existing = current.nodes.find(
          (node) =>
            node.kind === "memo_ref"
            && node.target_node_id === candidate.memo_id,
        );
        const targetNodeId = existing?.id ?? crypto.randomUUID();
        const pair = directPair(sourceNodeId, targetNodeId);
        if (existing !== undefined) {
          if (!current.edges.some(
            (edge) => directPair(edge.source_id, edge.target_id) === pair,
          )) {
            intents.push({
              operation: {
                edge_id: crypto.randomUUID(),
                rationale: candidate.reason,
                source_id: sourceNodeId,
                target_id: targetNodeId,
                type: "upsert_edge",
              },
            });
          }
          continue;
        }

        const position = positionByMemo.get(candidate.memo_id);
        if (position === undefined) continue;
        intents.push({
          hint: {
            excerpt: candidate.excerpt,
            revision: candidate.revision,
            title: candidate.title,
          },
          operation: {
            discovered_from_id: sourceNodeId,
            edge_id: crypto.randomUUID(),
            node_id: targetNodeId,
            rationale: candidate.reason,
            source_node_id: sourceNodeId,
            target_node_id: candidate.memo_id,
            type: "add_memo",
            x: position.x,
            y: position.y,
          },
        });
      }

      await coordinator.enqueueExpansion(intents, {
        candidate_revisions: result.candidates.map((candidate) => ({
          memo_id: candidate.memo_id,
          revision: candidate.revision,
        })),
        completion_status: result.completion_status,
        corpus_version: result.corpus_version,
        request_id: result.request_id,
        source_canvas_node_id: sourceNodeId,
        source_revision: result.source_revision,
      });
      if (result.candidates.length === 0) {
        toast({ title: "没有发现新的直接关联", variant: "info" });
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "AI 拓展失败",
        variant: "error",
      });
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, canvasId, setAiLoading, toast]);

  const actions = useMemo(() => ({
    aiLoading,
    editingTextNodeId,
    selectedNodeIds,
    onCancelText(nodeId: string) {
      if (transientText?.id === nodeId) setTransientText(null);
      editText(null);
    },
    async onCommitText(nodeId: string, text: string) {
      if (text.trim().length === 0) {
        if (transientText?.id === nodeId) setTransientText(null);
        editText(null);
        return;
      }
      if (transientText?.id === nodeId) {
        await enqueue({
          operation: {
            height: 120,
            node_id: nodeId,
            text,
            type: "create_text",
            width: 240,
            x: transientText.x,
            y: transientText.y,
          },
        });
        setTransientText(null);
      } else {
        const existing = latestDocumentRef.current?.nodes.find(
          (node) => node.id === nodeId,
        );
        if (existing?.text !== text) {
          await enqueue({
            operation: { node_id: nodeId, text, type: "update_node" },
          });
        }
      }
      editText(null);
    },
    onConnect(nodeId: string) {
      startConnection(nodeId);
      setPickerMode("connect");
    },
    onEditText(nodeId: string) {
      editText(nodeId);
    },
    onExpand: expandFromNode,
    onOpenMemo(nodeId: string) {
      void navigateToMemo(nodeId);
    },
    onPreview(nodeId: string) {
      openPreview(nodeId);
    },
    async onRemove(nodeId: string) {
      await enqueue({ operation: { node_id: nodeId, type: "remove_node" } });
      selectNodes([]);
    },
    async onRemoveEdge(edgeId: string) {
      await enqueue({ operation: { edge_id: edgeId, type: "remove_edge" } });
    },
    async onResize(nodeId: string, width: number, height: number) {
      await enqueue({
        operation: {
          height: Math.max(48, Math.min(480, height)),
          node_id: nodeId,
          type: "update_node",
          width: Math.max(120, Math.min(720, width)),
        },
      });
    },
  }), [
    aiLoading,
    editingTextNodeId,
    enqueue,
    expandFromNode,
    navigateToMemo,
    openPreview,
    selectNodes,
    selectedNodeIds,
    startConnection,
    transientText,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerMode("add");
        return;
      }
      if (event.key === "Enter" && selectedNodeIds.length === 1) {
        const node = latestDocumentRef.current?.nodes.find(
          (candidate) => candidate.id === selectedNodeIds[0],
        );
        if (node?.kind === "memo_ref" && node.target_node_id !== null) {
          event.preventDefault();
          openPreview(node.id);
        }
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace")
        && selectedNodeIds.length > 0
        && !(event.target instanceof HTMLElement && (
          event.target.isContentEditable
          || event.target instanceof HTMLInputElement
          || event.target instanceof HTMLTextAreaElement
        ))
      ) {
        event.preventDefault();
        for (const nodeId of selectedNodeIds) {
          void enqueue({ operation: { node_id: nodeId, type: "remove_node" } })
            .catch(() => undefined);
        }
        selectNodes([]);
        return;
      }
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (pickerMode !== null) {
        event.preventDefault();
        setPickerMode(null);
      } else if (previewNodeId !== null) {
        event.preventDefault();
        openPreview(null);
      } else if (connectionSourceId !== null) {
        event.preventDefault();
        startConnection(null);
      } else if (selectedNodeIds.length > 0) {
        event.preventDefault();
        selectNodes([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    connectionSourceId,
    enqueue,
    openPreview,
    pickerMode,
    previewNodeId,
    selectNodes,
    selectedNodeIds,
    startConnection,
  ]);

  const previewNode = document?.nodes.find((node) => node.id === previewNodeId) ?? null;
  const previewMemoId = previewNode?.target_node_id ?? null;
  const previewTitle = previewNode?.target?.title
    ?? previewNode?.snapshot_title
    ?? "笔记预览";
  const sourceTitle = document?.nodes.find(
    (node) => node.id === connectionSourceId,
  )?.snapshot_title ?? undefined;
  return (
    <CanvasActionsProvider actions={actions}>
      <div
        className="knowledge-canvas"
        ref={flowRef}
      >
        <ReactFlow
          edgeTypes={edgeTypes}
          edges={edges}
          elementsSelectable
          maxZoom={2}
          minZoom={0.2}
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable
          onEdgesChange={onEdgesChange}
          onDoubleClick={handlePaneDoubleClick}
          onInit={(instance) => {
            instanceRef.current = instance;
          }}
          onMoveEnd={handleMoveEnd}
          onNodeClick={(_, node) => {
            if (connectionSourceId === null || node.id === connectionSourceId) return;
            const current = latestDocumentRef.current;
            const source = current?.nodes.find(
              (candidate) => candidate.id === connectionSourceId,
            );
            const target = current?.nodes.find((candidate) => candidate.id === node.id);
            if (source?.kind !== "memo_ref" || target?.kind !== "memo_ref") return;
            void enqueue({
              operation: {
                edge_id: crypto.randomUUID(),
                source_id: source.id,
                target_id: target.id,
                type: "upsert_edge",
              },
            })
              .then(() => startConnection(null))
              .catch(() => undefined);
          }}
          onNodeDragStop={handleNodeDragStop}
          onNodesChange={onNodesChange}
          onSelectionChange={handleSelectionChange}
          panActivationKeyCode="Space"
          panOnDrag={panOnDrag}
          proOptions={proOptions}
          selectionOnDrag
          zoomOnDoubleClick={false}
        >
          <Background gap={26} size={1} variant={BackgroundVariant.Dots} />
          <CanvasControls
            onAdd={() => setPickerMode("add")}
            onFit={fitView}
            onZoomIn={() => void instanceRef.current
              ?.zoomIn({ duration: 160 }).then(persistViewport)}
            onZoomOut={() => void instanceRef.current
              ?.zoomOut({ duration: 160 }).then(persistViewport)}
          />
        </ReactFlow>

        {loadStatus === "loading" ? (
          <SkeletonGroup className="canvas-loading" label="正在加载 Canvas">
            <Skeleton className="canvas-loading-card" />
            <Skeleton className="canvas-loading-card" />
          </SkeletonGroup>
        ) : null}
        {loadStatus === "error" ? (
          <div className="canvas-state">
            <strong>Canvas 打不开</strong>
            <span>它可能已被删除，或当前登录已失效。</span>
          </div>
        ) : null}
        {loadStatus === "ready" && document?.nodes.length === 0 ? (
          <div className="canvas-empty-hint">
            双击空白写一段自由文字，或按 ⌘K 加入笔记
          </div>
        ) : null}

        {connectionSourceId !== null ? (
          <div className="canvas-mode-notice">
            选择另一张笔记卡片建立关系
            <button onClick={() => startConnection(null)} type="button">取消</button>
          </div>
        ) : null}

        <CanvasPersistenceStatus coordinatorRef={coordinatorRef} />

        {aiLoading ? (
          <div className="canvas-ai-state">正在拓展这条知识分支…</div>
        ) : null}
      </div>

      {pickerMode === null ? null : (
        <CanvasMemoPicker
          accessToken={accessToken}
          mode={pickerMode}
          onAdd={addMemo}
          onClose={() => setPickerMode(null)}
          onOpenMemo={async (memoId) => {
            await navigateToMemo(memoId);
          }}
          sourceTitle={sourceTitle}
        />
      )}

      {previewMemoId === null ? null : (
        <CanvasPreviewOverlay
          accessToken={accessToken}
          memoId={previewMemoId}
          onClose={() => openPreview(null)}
          onEditOriginal={async () => {
            await navigateToMemo(previewMemoId, true);
          }}
          title={previewTitle}
        />
      )}
    </CanvasActionsProvider>
  );
}
