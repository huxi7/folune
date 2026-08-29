/**
 * [INPUT]: 依赖 @xyflow/react v12 的 Pane 指针/坐标协议、Canvas Chat、useCanvasSessionCoordinator、canvasWorkspaceStore 的来源卡片统一判据、空间文字几何、纯投影/增量布局、memo document Store 与本地 Dialog/Toast/Button
 * [OUTPUT]: 对外提供始终挂载真实 React Flow 的 Canvas V2：受控节点/边/视口、空白 Pane 双击空间文字、向全局 Command Palette 登记"加入当前画布"、连接、Preview、框选、整组坐标原子回写、带完整关系快照的移除回执/撤销、来源卡片单删/批量事前确认、AI 增量拓展和可靠保存状态
 * [POS]: KnowledgeCanvas 的会话内容根；节点几何只跟随文档、选择只有 React Flow 一个所有者而 Store 是它的镜像，UI 只产生可由协调器/WAL 原子重放的 intent；来源血缘解除先由最内层 Dialog 收束，混合批量只允许撤销普通节点，正文只在 Preview 按 ID 加载
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
  canExpandFromNode,
  canvasNodesBounds,
  canvasPositionOperations,
  canvasViewportShowsNodes,
  shouldRestoreCanvasViewport,
  toCanvasFlow,
  type CanvasFlowNode,
} from "../../pages/canvasPresentation";
import type {
  CanvasDetail,
  CanvasEdge,
  CanvasNode,
} from "../../shared/api/canvas";
import {
  Button,
  Dialog,
  Skeleton,
  SkeletonGroup,
  useToast,
} from "../../shared/design-system/components";
import {
  isCanvasOriginNode,
  type CanvasIntent,
} from "../../shared/store/canvasDocument";
import type { CanvasChromeState } from "../../shared/store/canvasChromePolicy";
import {
  useCommandPaletteStore,
  type CommandAddTarget,
} from "../../shared/store/commandPaletteStore";
import { useCanvasWorkspaceStore } from "../../shared/store/canvasWorkspaceStore";
import type { CanvasReturnDescriptor } from "../../shared/store/canvasReturnStore";
import { expandCanvas } from "../AgentPanel/canvasExpandClient";
import { CanvasActionsProvider } from "./canvasActions";
import { CanvasCardNode } from "./CanvasCardNode";
import { CanvasControls } from "./CanvasControls";
import { CanvasCordEdge } from "./CanvasCordEdge";
import { CanvasPersistenceStatus } from "./CanvasPersistenceStatus";
import { CanvasPreviewOverlay } from "./CanvasPreviewOverlay";
import { CanvasSelectionBounds } from "./CanvasSelectionBounds";
import {
  useCanvasSessionCoordinator,
  type CanvasSessionControls,
} from "./useCanvasSessionCoordinator";
import {
  CANVAS_TEXT_DEFAULT_HEIGHT,
  CANVAS_TEXT_DEFAULT_WIDTH,
  normalizeTextGeometry,
  type SpatialTextGeometry,
} from "./spatialTextGeometry";

const nodeTypes = { canvasNode: CanvasCardNode };
const edgeTypes = { cord: CanvasCordEdge };
const panOnDrag = [1, 2];
const proOptions = { hideAttribution: true };

type KnowledgeCanvasProps = {
  accessToken: string;
  canvasId: string;
  entryChrome: CanvasChromeState;
  onCoordinatorReady?: (controls: CanvasSessionControls | null) => void;
  onEditMemo: (nodeId: string) => void;
  onSelectMemo: (nodeId: string) => void;
  restore?: CanvasReturnDescriptor | null;
  userId: string;
};

type TransientTextNode = {
  height: number;
  id: string;
  scale: number;
  text: string;
  width: number;
  x: number;
  y: number;
};

type CanvasRemovalSnapshot = {
  canvasTitle: string;
  edges: CanvasEdge[];
  includesOrigin: boolean;
  includesTombstone: boolean;
  nodes: CanvasNode[];
  originNodeId: string | null;
};

/*
 * 键盘加速器落在输入框或空间文字编辑态里时必须让路: 那时用户在打字, Delete 是
 * 删字符、⌘E 不该拓展。
 */
const typingInto = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (
    target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
  );

const directPair = (sourceId: string, targetId: string): string =>
  sourceId < targetId ? `${sourceId}:${targetId}` : `${targetId}:${sourceId}`;

const captureRemoval = (
  detail: CanvasDetail,
  nodeIds: readonly string[],
): CanvasRemovalSnapshot => {
  const removedIds = new Set(nodeIds);
  const nodes = detail.nodes
    .filter((node) => removedIds.has(node.id))
    .map((node) => ({
      ...node,
      target: node.target === null ? null : { ...node.target },
    }));
  const capturedIds = new Set(nodes.map((node) => node.id));
  const originNode = nodes.find((node) =>
    isCanvasOriginNode(detail.canvas, node)
  );

  return {
    canvasTitle: detail.node.title,
    edges: detail.edges
      .filter((edge) =>
        capturedIds.has(edge.source_id) || capturedIds.has(edge.target_id)
      )
      .map((edge) => ({ ...edge })),
    includesOrigin: originNode !== undefined,
    includesTombstone: nodes.some(
      (node) => node.kind === "memo_ref" && node.target_node_id === null,
    ),
    nodes,
    originNodeId: originNode?.id ?? null,
  };
};

/*
 * 来源卡片不可恢复，但同一批次里的普通节点仍应保留既有撤销能力。过滤所有依赖
 * 已永久移除节点的发现来源与关系，避免用一个注定失败的“撤销”继续欺骗用户。
 */
const restorableOrdinaryRemoval = (
  snapshot: CanvasRemovalSnapshot,
): CanvasRemovalSnapshot => {
  const nodes = snapshot.nodes.filter((node) =>
    node.id !== snapshot.originNodeId
    && !(node.kind === "memo_ref" && node.target_node_id === null)
  );
  const restorableIds = new Set(nodes.map((node) => node.id));
  const excludedIds = new Set(
    snapshot.nodes
      .filter((node) => !restorableIds.has(node.id))
      .map((node) => node.id),
  );

  return {
    canvasTitle: snapshot.canvasTitle,
    edges: snapshot.edges.filter(
      (edge) =>
        !excludedIds.has(edge.source_id) && !excludedIds.has(edge.target_id),
    ),
    includesOrigin: false,
    includesTombstone: false,
    nodes: nodes.map((node) =>
      node.discovered_from_id !== null
        && excludedIds.has(node.discovered_from_id)
        ? { ...node, discovered_from_id: null }
        : node
    ),
    originNodeId: null,
  };
};

/* 首次发现来源必须先恢复，add_memo 才能在同一原子 mutation 中通过端点校验。 */
const orderNodesForRestore = (nodes: readonly CanvasNode[]): CanvasNode[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: CanvasNode[] = [];

  const visit = (node: CanvasNode) => {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) {
      throw new Error("Canvas 节点的首次发现来源形成了循环，无法安全撤销。");
    }
    visiting.add(node.id);
    const source = node.discovered_from_id === null
      ? undefined
      : byId.get(node.discovered_from_id);
    if (source !== undefined) visit(source);
    visiting.delete(node.id);
    visited.add(node.id);
    ordered.push(node);
  };

  nodes.forEach(visit);
  return ordered;
};

const removalRestoreIntents = (
  snapshot: CanvasRemovalSnapshot,
): CanvasIntent[] => {
  const intents: CanvasIntent[] = [];

  for (const node of orderNodesForRestore(snapshot.nodes)) {
    if (node.kind === "memo_ref") {
      if (node.target_node_id === null) {
        throw new Error("原笔记已永久删除，墓碑卡片无法恢复。");
      }
      intents.push({
        hint: {
          excerpt: node.snapshot_excerpt,
          ...(node.snapshot_revision === null
            ? {}
            : { revision: node.snapshot_revision }),
          ...(node.snapshot_title === null ? {} : { title: node.snapshot_title }),
        },
        operation: {
          ...(node.discovered_from_id === null
            ? {}
            : { discovered_from_id: node.discovered_from_id }),
          node_id: node.id,
          target_node_id: node.target_node_id,
          type: "add_memo",
          x: node.x,
          y: node.y,
        },
      });
      continue;
    }

    if (node.text === null || node.text.length === 0) {
      throw new Error("自由文字快照无效，无法安全撤销。");
    }
    intents.push({
      operation: {
        ...(node.height === null ? {} : { height: node.height }),
        node_id: node.id,
        text: node.text,
        ...(node.text_scale === null ? {} : { text_scale: node.text_scale }),
        type: "create_text",
        ...(node.width === null ? {} : { width: node.width }),
        x: node.x,
        y: node.y,
      },
    });
  }

  for (const edge of snapshot.edges) {
    intents.push({
      operation: {
        edge_id: edge.id,
        rationale: edge.rationale,
        source_id: edge.source_id,
        target_id: edge.target_id,
        type: "upsert_edge",
      },
    });
  }

  return intents;
};

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
    textHeight: node.height,
    textScale: node.scale,
    textWidth: node.width,
    title: "自由文字",
    tombstone: false,
  },
  id: node.id,
  position: { x: node.x, y: node.y },
  style: { height: node.height, width: node.width },
  type: "canvasNode",
});

export function KnowledgeCanvas({
  accessToken,
  canvasId,
  entryChrome,
  onCoordinatorReady,
  onEditMemo,
  onSelectMemo,
  restore = null,
  userId,
}: KnowledgeCanvasProps) {
  const { dismissToast, toast } = useToast();
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
  const openPalette = useCommandPaletteStore((state) => state.openPalette);
  const registerCanvasCommand = useCommandPaletteStore(
    (state) => state.registerCanvas,
  );
  const [transientText, setTransientText] = useState<TransientTextNode | null>(null);
  const [pendingOriginRemoval, setPendingOriginRemoval] =
    useState<CanvasRemovalSnapshot | null>(null);
  const [originRemovalBusy, setOriginRemovalBusy] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const instanceRef = useRef<ReactFlowInstance<CanvasFlowNode, Edge> | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const initialViewportAppliedRef = useRef(false);
  const entryFocusAppliedRef = useRef(false);
  const latestDocumentRef = useRef(document);
  // oxlint 的 react/refs 在项目配置中关闭：事件回调必须同步读到本次 render 的文档，
  // 若改成 effect 更新会留出一帧旧快照窗口；这里不参与渲染，也不会触发状态回环。
  latestDocumentRef.current = document;
  const getViewport = useCallback(
    () => instanceRef.current?.getViewport() ?? CANVAS_DEFAULT_VIEWPORT,
    [],
  );
  const { coordinatorRef, loadStatus } = useCanvasSessionCoordinator({
    accessToken,
    canvasId,
    entryChrome,
    getViewport,
    onCoordinatorReady,
    restore,
    toast,
    userId,
  });

  const flow = useMemo(
    () => document === null
      ? { edges: [], nodes: [], viewport: CANVAS_DEFAULT_VIEWPORT }
      : toCanvasFlow(document),
    [document],
  );

  useEffect(() => {
    initialViewportAppliedRef.current = false;
    entryFocusAppliedRef.current = false;
  }, [canvasId]);

  /*
   * 节点几何只跟随文档, 选择不参与这条推导。
   *
   * 选择必须只有一个所有者, 而那个所有者是 React Flow: 指针真正拨动的是它的
   * node.selected, 框选、⌘ 加选与点空白取消都是它算出来的。本地 Store 只是它的
   * 镜像。两边互为输入会在挂载那一刻就开始一帧一帧互相纠正: Store 已经拿着入口
   * 聚焦节点, React Flow 的 store 这一帧还是空的, 于是它报"没有选中"擦掉镜像,
   * 下一帧镜像又把上一帧的选择塞回去, 永不收敛(React 会直接抛 Maximum update
   * depth exceeded)。因此这里只把 React Flow 现有的选择带过新一批节点对象。
   *
   * 顺带解决的是拖动: 坐标不再随选择变化重算, 一次选择变化不会把正在拖的整组
   * 弹回旧文档坐标。
   */
  useEffect(() => {
    setNodes((current) => {
      const selected = new Set(
        current.filter((node) => node.selected === true).map((node) => node.id),
      );
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
      return nextNodes;
    });

    const instance = instanceRef.current;
    if (
      document !== null
      && instance !== null
      && !initialViewportAppliedRef.current
    ) {
      initialViewportAppliedRef.current = true;
      requestAnimationFrame(() => {
        const restored = restore?.canvasId === canvasId
          ? restore.viewport
          : shouldRestoreCanvasViewport(document.canvas.viewport)
            ? flow.viewport
            : null;
        // 视口是按存它时的画布尺寸算的; 换到更小的窗口可能整幅图都在屏幕外
        const rect = flowRef.current?.getBoundingClientRect();
        const usable = restored !== null && canvasViewportShowsNodes(
          canvasNodesBounds(flow.nodes),
          restored,
          { height: rect?.height ?? 0, width: rect?.width ?? 0 },
        );
        if (restored !== null && usable) {
          void instance.setViewport(restored, { duration: 0 });
        } else if (flow.nodes.length > 0) {
          void instance.fitView({ duration: 0, padding: 0.18 });
        }
      });
    }
  }, [canvasId, document, flow, restore, setNodes, transientText]);

  /* 关系的强调是选择的函数, 与坐标无关, 因此自己一条推导 */
  useEffect(() => {
    setEdges(flow.edges.map((edge) => ({
      ...edge,
      className: selectedNodeIds.length === 1
        && (edge.source === selectedNodeIds[0] || edge.target === selectedNodeIds[0])
        ? "canvas-edge-direct"
        : "canvas-edge-muted",
    })));
  }, [flow, selectedNodeIds, setEdges]);

  /*
   * 入队的原子单位是"一次手势", 因此这里只有一个真实实现: 单个 intent 只是长度
   * 为 1 的手势。本机恢复不可用是同一件事, 只在这一处报给用户。
   */
  const enqueueMany = useCallback(async (intents: readonly CanvasIntent[]) => {
    try {
      await coordinatorRef.current?.enqueueMany(intents);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "本机恢复不可用",
        variant: "error",
      });
      throw error;
    }
  }, [coordinatorRef, toast]);

  const enqueue = useCallback(
    async (intent: CanvasIntent) => { await enqueueMany([intent]); },
    [enqueueMany],
  );

  /*
   * 逆流而上的程序化选择(取消、加入后定位、连接完成后回到来源)。既然选择归
   * React Flow, 外部想改它就必须写进它的节点; 只改镜像会让卡片的描边和事实脱节。
   * 镜像随后由 onSelectionChange 自己追上, 因此这里不需要两边都算一遍。
   */
  const selectOnly = useCallback((nodeIds: readonly string[]) => {
    const next = new Set(nodeIds);
    setNodes((current) => current.map((node) => {
      const selected = next.has(node.id);
      return node.selected === selected ? node : { ...node, selected };
    }));
    selectNodes(nodeIds);
  }, [selectNodes, setNodes]);

  const showUndoReceipt = useCallback((
    snapshot: CanvasRemovalSnapshot,
    originRemoved = false,
  ) => {
    let undoing = false;
    let toastId = 0;
    toastId = toast({
      action: {
        label: originRemoved ? "撤销普通节点" : "撤销",
        onClick: () => {
          if (undoing) return;
          undoing = true;
          void enqueueMany(removalRestoreIntents(snapshot))
            .then(() => dismissToast(toastId))
            .catch(() => undefined)
            .finally(() => {
              undoing = false;
            });
        },
      },
      description: originRemoved
        ? "撤销只恢复普通节点及仍可恢复的关联；来源卡片与画布来源关系无法恢复。"
        : snapshot.edges.length === 0
          ? undefined
          : `同时移除了 ${snapshot.edges.length} 条关联。`,
      duration: 10_000,
      title: snapshot.nodes.length === 1
        ? "已从 Canvas 移除"
        : `已从 Canvas 移除 ${snapshot.nodes.length} 个节点`,
      variant: "info",
    });
  }, [dismissToast, enqueueMany, toast]);

  const commitNodeRemoval = useCallback(async (
    snapshot: CanvasRemovalSnapshot,
  ) => {
    if (snapshot.nodes.length === 0) return;
    await enqueueMany(snapshot.nodes.map((node) => ({
      operation: { node_id: node.id, type: "remove_node" },
    })));
    selectOnly([]);

    if (snapshot.includesOrigin) {
      toast({
        description: "原笔记完全不受影响；画布来源关系已永久解除。",
        title: `「${snapshot.canvasTitle}」已转为独立画布`,
        variant: "warning",
      });
      const ordinarySnapshot = restorableOrdinaryRemoval(snapshot);
      if (ordinarySnapshot.nodes.length > 0) {
        showUndoReceipt(ordinarySnapshot, true);
      }
      return;
    }
    if (snapshot.includesTombstone) {
      toast({
        description: "原笔记已永久删除，这次清理无法撤销。",
        title: snapshot.nodes.length === 1
          ? "已清理失效卡片"
          : `已移除 ${snapshot.nodes.length} 个节点`,
        variant: "info",
      });
      return;
    }
    showUndoReceipt(snapshot);
  }, [enqueueMany, selectOnly, showUndoReceipt, toast]);

  const requestNodeRemoval = useCallback(async (nodeIds: readonly string[]) => {
    const current = latestDocumentRef.current;
    if (current === null) return;
    const snapshot = captureRemoval(current, nodeIds);
    if (snapshot.nodes.length === 0) return;
    if (snapshot.includesOrigin) {
      setPendingOriginRemoval(snapshot);
      return;
    }
    await commitNodeRemoval(snapshot);
  }, [commitNodeRemoval]);

  const confirmOriginRemoval = useCallback(async () => {
    if (pendingOriginRemoval === null || originRemovalBusy) return;
    setOriginRemovalBusy(true);
    try {
      await commitNodeRemoval(pendingOriginRemoval);
      setPendingOriginRemoval(null);
    } finally {
      setOriginRemovalBusy(false);
    }
  }, [commitNodeRemoval, originRemovalBusy, pendingOriginRemoval]);

  const removeEdge = useCallback(async (edgeId: string) => {
    const edge = latestDocumentRef.current?.edges.find(
      (candidate) => candidate.id === edgeId,
    );
    if (edge === undefined) return;
    await enqueue({ operation: { edge_id: edgeId, type: "remove_edge" } });

    let undoing = false;
    let toastId = 0;
    toastId = toast({
      action: {
        label: "撤销",
        onClick: () => {
          if (undoing) return;
          undoing = true;
          void enqueue({
            operation: {
              edge_id: edge.id,
              rationale: edge.rationale,
              source_id: edge.source_id,
              target_id: edge.target_id,
              type: "upsert_edge",
            },
          })
            .then(() => dismissToast(toastId))
            .catch(() => undefined)
            .finally(() => {
              undoing = false;
            });
        },
      },
      duration: 10_000,
      title: "已移除关系",
      variant: "info",
    });
  }, [dismissToast, enqueue, toast]);

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

  /*
   * 一次拖拽手势的收尾。React Flow 把整组的最终坐标放在第三个参数里, 无论用户是
   * 抓着组里的某张卡片拖, 还是抓着成组外接框拖, 这里拿到的都是完整的一组; 只回
   * 写指针下那一个, 乐观投影会把其余节点按旧文档弹回原处, 组内相对位置就在松手
   * 那一刻散掉。整组共用一条 WAL 记录, 因此这组坐标要么一起幸存要么一起不存在。
   */
  const handleNodesDragStop = useCallback((
    dragged: readonly CanvasFlowNode[],
  ) => {
    const operations = canvasPositionOperations(dragged);
    if (operations.length === 0) return;
    void enqueueMany(
      operations.map((operation) => ({ operation })),
    ).catch(() => undefined);
  }, [enqueueMany]);

  /* React Flow -> 镜像。这是选择唯一的常规流向 */
  const handleSelectionChange = useCallback(({
    nodes: selectedNodes,
  }: { nodes: CanvasFlowNode[] }) => {
    selectNodes(selectedNodes.map((node) => node.id));
  }, [selectNodes]);

  /*
   * 唯一一次由外部写入选择: 进入这张画布时的聚焦节点(默认 Canvas 的来源笔记卡,
   * 或从预览返回时记住的那一个)。只在这张画布的第一份文档到达时交给 React Flow
   * 一次, 此后选择归它。
   */
  useEffect(() => {
    if (entryFocusAppliedRef.current || document === null) return;
    entryFocusAppliedRef.current = true;
    if (selectedNodeIds.length === 0) return;
    selectOnly(selectedNodeIds);
  }, [document, selectOnly, selectedNodeIds]);

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
      height: CANVAS_TEXT_DEFAULT_HEIGHT,
      id: crypto.randomUUID(),
      scale: 1,
      text: "",
      width: CANVAS_TEXT_DEFAULT_WIDTH,
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
  }, [coordinatorRef, toast]);

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

  const addMemo = useCallback(async (memo: CommandAddTarget) => {
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
      /*
       * 连接落在一张已经在画布上的笔记上时, 要给用户看的是刚刚建立的这条关系,
       * 因此来源与目标一起进视野 —— 只居中目标会把来源推出屏幕, 而宪法 §10 要求
       * 这条流程里来源节点必须清楚可见。两张卡片可能离得很远, 不重新取景的话
       * 关系建好了却在屏幕外, 用户看到的是"什么也没发生"。
       */
      selectOnly([existing.id]);
      instanceRef.current?.fitView({
        duration: 220,
        nodes: [{ id: source.id }, { id: existing.id }],
        padding: 0.8,
      });
      startConnection(null);
      return;
    }

    if (existing !== undefined) {
      selectOnly([existing.id]);
      instanceRef.current?.fitView({
        duration: 220,
        nodes: [{ id: existing.id }],
        padding: 0.8,
      });
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
    selectOnly([nodeId]);
    startConnection(null);
  }, [
    connectionSourceId,
    enqueue,
    selectOnly,
    startConnection,
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
  }, [aiLoading, canvasId, coordinatorRef, setAiLoading, toast]);

  const actions = useMemo(() => ({
    aiLoading,
    editingTextNodeId,
    selectedNodeIds,
    onCancelText(nodeId: string) {
      if (transientText?.id === nodeId) setTransientText(null);
      editText(null);
    },
    async onCommitText(
      nodeId: string,
      text: string,
      geometry: SpatialTextGeometry,
    ) {
      if (text.trim().length === 0) {
        if (transientText?.id === nodeId) {
          setTransientText(null);
        } else {
          await enqueue({ operation: { node_id: nodeId, type: "remove_node" } });
          selectOnly([]);
        }
        editText(null);
        return;
      }
      const nextGeometry = normalizeTextGeometry(geometry);
      if (transientText?.id === nodeId) {
        await enqueue({
          operation: {
            height: nextGeometry.height,
            node_id: nodeId,
            text,
            text_scale: nextGeometry.scale,
            type: "create_text",
            width: nextGeometry.width,
            x: transientText.x,
            y: transientText.y,
          },
        });
        setTransientText(null);
      } else {
        const existing = latestDocumentRef.current?.nodes.find(
          (node) => node.id === nodeId,
        );
        if (existing !== undefined) {
          const operation = {
            node_id: nodeId,
            type: "update_node" as const,
            ...(existing.text === text ? {} : { text }),
            ...(existing.width === nextGeometry.width
              ? {}
              : { width: nextGeometry.width }),
            ...(existing.height === nextGeometry.height
              ? {}
              : { height: nextGeometry.height }),
            ...(existing.text_scale === nextGeometry.scale
              ? {}
              : { text_scale: nextGeometry.scale }),
          };
          if (Object.keys(operation).length > 2) {
            await enqueue({
              operation,
            });
          }
        }
      }
      editText(null);
    },
    onConnect(nodeId: string) {
      startConnection(nodeId);
      openPalette();
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
      await requestNodeRemoval([nodeId]);
    },
    onRemoveEdge: removeEdge,
    async onResize(nodeId: string, geometry: SpatialTextGeometry) {
      const nextGeometry = normalizeTextGeometry(geometry);
      await enqueue({
        operation: {
          height: nextGeometry.height,
          node_id: nodeId,
          ...(nextGeometry.x === undefined ? {} : { x: nextGeometry.x }),
          ...(nextGeometry.y === undefined ? {} : { y: nextGeometry.y }),
          text_scale: nextGeometry.scale,
          type: "update_node",
          width: nextGeometry.width,
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
    openPalette,
    editText,
    removeEdge,
    requestNodeRemoval,
    selectOnly,
    selectedNodeIds,
    startConnection,
    transientText,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      /*
       * ⌘E 在 Paper 里是「进入这篇笔记的画布」, 在这里是「从选中节点继续拓展」。
       * 同一个键在两个互斥的 Workspace 里表达同一件事——往前推进一步——所以不需要
       * 第二个键位, 也不会打架。无选择时按宪法 8.1 只给轻提示, 绝不发请求。
       */
      if (
        (event.metaKey || event.ctrlKey)
        && event.key.toLowerCase() === "e"
        && !typingInto(event.target)
      ) {
        event.preventDefault();
        const node = selectedNodeIds.length === 1
          ? latestDocumentRef.current?.nodes.find(
            (candidate) => candidate.id === selectedNodeIds[0],
          )
          : undefined;
        if (node === undefined || !canExpandFromNode(node)) {
          toast({ title: "先选择一篇笔记", variant: "info" });
          return;
        }
        void expandFromNode(node.id).catch(() => undefined);
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
        && !typingInto(event.target)
      ) {
        event.preventDefault();
        void requestNodeRemoval(selectedNodeIds).catch(() => undefined);
        return;
      }
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (previewNodeId !== null) {
        event.preventDefault();
        openPreview(null);
      } else if (connectionSourceId !== null) {
        event.preventDefault();
        startConnection(null);
      } else if (selectedNodeIds.length > 0) {
        event.preventDefault();
        selectOnly([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    connectionSourceId,
    expandFromNode,
    openPreview,
    previewNodeId,
    requestNodeRemoval,
    selectOnly,
    selectedNodeIds,
    startConnection,
    toast,
  ]);

  /*
   * Canvas 会话期间把"加入当前画布"登记给唯一的 Command Palette。因此不存在
   * 第二个相似 Dialog: Sidebar/Paper/Canvas 的 ⌘K 是同一个面板, 只是这里多了
   * 一个次级动作。
   */
  useEffect(() => {
    registerCanvasCommand({ canvasId, onAdd: addMemo });
    return () => registerCanvasCommand(null);
  }, [addMemo, canvasId, registerCanvasCommand]);

  const previewNode = document?.nodes.find((node) => node.id === previewNodeId) ?? null;
  const previewMemoId = previewNode?.target_node_id ?? null;
  const previewTitle = previewNode?.target?.title
    ?? previewNode?.snapshot_title
    ?? "笔记预览";
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
          onNodeDragStop={(_, __, dragged) => handleNodesDragStop(dragged)}
          onNodesChange={onNodesChange}
          onSelectionChange={handleSelectionChange}
          panActivationKeyCode="Space"
          panOnDrag={panOnDrag}
          proOptions={proOptions}
          selectionOnDrag
          zoomOnDoubleClick={false}
        >
          <Background gap={26} size={1} variant={BackgroundVariant.Dots} />
          <CanvasSelectionBounds nodes={nodes} />
          <CanvasControls
            onAdd={openPalette}
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
            双击空白写一段自由文字，或按 ⌘K 搜索并加入笔记
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

      <Dialog
        description={pendingOriginRemoval !== null
          && pendingOriginRemoval.nodes.length > 1
          ? `所选 ${pendingOriginRemoval.nodes.length} 个节点中包含源笔记卡片。原笔记完全不受影响；继续会移除所选节点，并让「${pendingOriginRemoval.canvasTitle}」永久转为独立画布。以后再从那篇笔记选择「进入画布」，会创建一张新的画布。`
          : `原笔记完全不受影响。移除这张源笔记卡片后，「${pendingOriginRemoval?.canvasTitle ?? "这张画布"}」将永久转为独立画布；以后再从那篇笔记选择「进入画布」，会创建一张新的画布。`}
        onOpenChange={(open) => {
          if (!open && !originRemovalBusy) setPendingOriginRemoval(null);
        }}
        open={pendingOriginRemoval !== null}
        title="移除源笔记卡片？"
      >
        <div className="mt-5 flex justify-end gap-2">
          <Button
            disabled={originRemovalBusy}
            onClick={() => setPendingOriginRemoval(null)}
            variant="ghost"
          >
            取消
          </Button>
          <Button
            data-dialog-autofocus
            loading={originRemovalBusy}
            onClick={() => void confirmOriginRemoval()}
            variant="danger"
          >
            解除并移除
          </Button>
        </div>
      </Dialog>
    </CanvasActionsProvider>
  );
}
