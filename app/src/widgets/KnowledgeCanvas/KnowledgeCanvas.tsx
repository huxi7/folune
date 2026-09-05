/**
 * [INPUT]: 依赖 @xyflow/react v12、同步首帧 Canvas bootstrap、纸面视图过渡、Canvas Chat/Coordinator/Store、瞬时 motion receipt、空间文字、增量布局与拖拽载荷
 * [OUTPUT]: 对外提供始终挂载真实 React Flow 的 Canvas：首帧过渡落点、稳定受控图、尺寸变化时不随节点拖动重建 observer 的响应式视口校准、拖/点等效直接连接、单一 Stage loading、Preview 纸面形变、删除退场与可靠保存
 * [POS]: KnowledgeCanvas 的会话内容根；连接手势只经 useCanvasConnectionSession 产生一次 upsert_edge，响应式校准只读 latest nodes 并保持 observer 稳定，几何/选择/WAL 仍由原系统负责，hydration/rebase/save/rerender 不得重播 UI receipt
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
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
import { flushSync } from "react-dom";

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
  reconcileCanvasFlowEdges,
  reconcileCanvasFlowNodes,
  shouldRestoreCanvasViewport,
  toCanvasFlow,
  type CanvasFlowEdge,
  type CanvasFlowNode,
} from "../../pages/canvasPresentation";
import type {
  CanvasDetail,
  CanvasEdge,
  CanvasNode,
} from "../../shared/api/canvas";
import {
  resolveCanvasRenderDetail,
  storeCanvasEntryBootstrap,
  type CanvasEntryBootstrap,
} from "../../pages/canvasEntryBootstrap";
import {
  Button,
  Dialog,
  useDelayedSkeleton,
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
import { useMemoDocumentStore } from "../../shared/store/memoDocumentStore";
import type { CanvasReturnDescriptor } from "../../shared/store/canvasReturnStore";
import { expandCanvas } from "../AgentPanel/canvasExpandClient";
import {
  parseMemoCanvasDrag,
  SUPERNOTE_MEMO_DRAG_MIME,
} from "../memoLibrary";
import { CanvasActionsProvider } from "./canvasActions";
import { CanvasStageLoading } from "../CanvasStageLoading";
import { NotePaper } from "../NotePaper";
import { CanvasCardNode } from "./CanvasCardNode";
import { CanvasControls } from "./CanvasControls";
import { CanvasCordEdge } from "./CanvasCordEdge";
import { CanvasElasticConnectionLine } from "./CanvasElasticConnectionLine";
import { CanvasPersistenceStatus } from "./CanvasPersistenceStatus";
import { CanvasPreviewOverlay } from "./CanvasPreviewOverlay";
import {
  applyCanvasMotionReceipt,
  canvasMotionTargetsFromIntents,
  captureCanvasRemovalSnapshots,
  useCanvasMotionReceipts,
} from "./canvasMotionReceipts";
import { runViewTransition } from "../../pages/viewTransition";
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
import { useCanvasConnectionSession } from "./useCanvasConnectionSession";

const nodeTypes = { canvasNode: CanvasCardNode };
const edgeTypes = { cord: CanvasCordEdge };
const panOnDrag = [1, 2];
const proOptions = { hideAttribution: true };

const withPaperTransitionIdentity = (
  nodes: readonly CanvasFlowNode[],
  memoId: string | null,
): CanvasFlowNode[] => nodes.map((node) => {
  const active = memoId !== null && node.data.targetNodeId === memoId;
  return node.data.paperTransitionActive === active
    ? node
    : { ...node, data: { ...node.data, paperTransitionActive: active } };
});

function CanvasAiState() {
  const aiLoading = useCanvasWorkspaceStore((state) => state.aiLoading);
  return aiLoading
    ? <div className="canvas-ai-state">正在拓展这条知识分支…</div>
    : null;
}

type KnowledgeCanvasProps = {
  accessToken: string;
  bootstrap?: CanvasEntryBootstrap | null;
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
    kind: "native",
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
  bootstrap = null,
  canvasId,
  entryChrome,
  onCoordinatorReady,
  onEditMemo,
  onSelectMemo,
  restore = null,
  userId,
}: KnowledgeCanvasProps) {
  const { dismissToast, toast } = useToast();
  const sessionCanvasId = useCanvasWorkspaceStore((state) => state.canvasId);
  const document = useCanvasWorkspaceStore((state) => state.document);
  const renderDocument = resolveCanvasRenderDetail(
    canvasId,
    userId,
    sessionCanvasId,
    document,
    bootstrap,
  );
  const selectedNodeIds = useCanvasWorkspaceStore((state) => state.selectedNodeIds);
  const selectNodes = useCanvasWorkspaceStore((state) => state.selectNodes);
  const previewNodeId = useCanvasWorkspaceStore((state) => state.previewNodeId);
  const openPreview = useCanvasWorkspaceStore((state) => state.openPreview);
  const editText = useCanvasWorkspaceStore((state) => state.editText);
  const connectionSourceId = useCanvasWorkspaceStore((state) => state.connectionSourceId);
  const startConnection = useCanvasWorkspaceStore((state) => state.startConnection);
  const setAiLoading = useCanvasWorkspaceStore((state) => state.setAiLoading);
  const preloadMemo = useMemoDocumentStore((state) => state.preloadMemo);
  const openPalette = useCommandPaletteStore((state) => state.openPalette);
  const registerCanvasCommand = useCommandPaletteStore(
    (state) => state.registerCanvas,
  );
  const initialProjected = renderDocument === null
    ? { edges: [], nodes: [], viewport: CANVAS_DEFAULT_VIEWPORT }
    : toCanvasFlow(renderDocument);
  const landingNode = bootstrap === null
    ? null
    : initialProjected.nodes.find(
      (node) => node.data.targetNodeId === bootstrap.sourceMemoId,
    ) ?? null;
  const landingViewport = restore?.canvasId === canvasId ? restore.viewport : null;
  const hasTransitionLanding = landingNode !== null && landingViewport !== null;
  const [transientText, setTransientText] = useState<TransientTextNode | null>(null);
  const [paperTransitionMemoId, setPaperTransitionMemoId] = useState<string | null>(
    hasTransitionLanding ? null : bootstrap?.sourceMemoId ?? null,
  );
  const [transitionLandingVisible, setTransitionLandingVisible] = useState(
    hasTransitionLanding,
  );
  const [pendingOriginRemoval, setPendingOriginRemoval] =
    useState<CanvasRemovalSnapshot | null>(null);
  const [originRemovalBusy, setOriginRemovalBusy] = useState(false);
  const [memoDropActive, setMemoDropActive] = useState(false);
  /*
   * useNodesState 的参数只在挂载时生效。这里直接以 bootstrap 投影初始化，目标卡片才会在
   * Router 拍新页面的第一帧里存在；只在 effect 里 setNodes 已经太晚，只能得到整页淡换。
   */
  const initialFlow = {
    ...initialProjected,
    nodes: withPaperTransitionIdentity(
      initialProjected.nodes,
      hasTransitionLanding ? null : bootstrap?.sourceMemoId ?? null,
    ),
  };
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(
    initialFlow.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasFlowEdge>(
    initialFlow.edges,
  );
  const instanceRef = useRef<ReactFlowInstance<CanvasFlowNode, CanvasFlowEdge> | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const initialViewportAppliedRef = useRef(false);
  const entryFocusAppliedRef = useRef(false);
  const latestDocumentRef = useRef(document);
  // oxlint 的 react/refs 在项目配置中关闭：事件回调必须同步读到本次 render 的文档，
  // 若改成 effect 更新会留出一帧旧快照窗口；这里不参与渲染，也不会触发状态回环。
  latestDocumentRef.current = document;

  useEffect(() => {
    if (!transitionLandingVisible || bootstrap === null) return;
    /*
     * React Flow 在挂载后才建立内部 viewport，Router 的新页面截图早于这一步。落点纸只
     * 跨过原生形变的一帧生命周期；真实卡片稳定后再接过 identity，不产生第二张可见纸。
     */
    const timer = window.setTimeout(() => {
      setTransitionLandingVisible(false);
      setPaperTransitionMemoId(bootstrap.sourceMemoId);
    }, 360);
    return () => window.clearTimeout(timer);
  }, [bootstrap, transitionLandingVisible]);
  const getViewport = useCallback(
    () => instanceRef.current?.getViewport() ?? CANVAS_DEFAULT_VIEWPORT,
    [],
  );
  const {
    consumeVisibleReceipt,
    ensureNodesInSafeViewport,
    issueMotionReceipt,
    motionReceipt,
    reducedMotion: reduceMotion,
  } = useCanvasMotionReceipts({
    bootstrap,
    canvasDocument: renderDocument,
    canvasId,
    flowRef,
    instanceRef,
    returning: hasTransitionLanding,
  });
  const { coordinatorRef, loadStatus } = useCanvasSessionCoordinator({
    accessToken,
    bootstrap,
    canvasId,
    entryChrome,
    getViewport,
    onCoordinatorReady,
    restore,
    toast,
    userId,
  });
  const canvasSkeletonVisible = useDelayedSkeleton(
    bootstrap === null && loadStatus === "loading",
    {
      delayMs: 180,
      minimumVisibleMs: 180,
    },
  );
  /*
   * 卡片 ↔ 预览的放大缩小交给浏览器: 两端截图与中间那段变形都由同一个渲染器完成, 所以
   * 圆角形状、字形抗锯齿、阴影缩放、容器查询字号这些落点细节结构上就不可能对不上。
   * 不支持视图过渡的浏览器直接换页, 不再自己画一张纸去追真纸。
   *
   * flushSync 是这条路的门槛: 浏览器在 update 返回后的下一个渲染时机就要拍新截图,
   * 而 React 默认可以把这次更新排到之后的任务里 —— 那时拍到的还是旧 DOM, 于是整段
   * 过渡退化成"什么都没变"。方向一并交出去, 收起因此可以比展开更短。
   */
  const primePaperTransition = useCallback((memoId: string) => {
    /*
     * 旧截图在 startViewTransition 调用时立刻拍下，所以不能等普通 effect 再删掉其他卡片
     * 的名字。同步把唯一身份写进现有 React Flow nodes，随后两端截图才共享同一张纸。
     */
    flushSync(() => {
      setPaperTransitionMemoId(memoId);
      setNodes((current) => withPaperTransitionIdentity(current, memoId));
    });
  }, [setNodes]);

  const changePreview = useCallback((nodeId: string | null) => {
    if (nodeId !== null) {
      const memoId = renderDocument?.nodes.find(
        (node) => node.id === nodeId,
      )?.target_node_id;
      if (memoId !== null && memoId !== undefined) primePaperTransition(memoId);
    }
    const apply = () => flushSync(() => openPreview(nodeId));
    if (!runViewTransition(apply, nodeId === null ? "collapse" : "expand")) apply();
  }, [openPreview, primePaperTransition, renderDocument]);

  const flow = useMemo(() => {
    const projected = renderDocument === null
      ? { edges: [], nodes: [], viewport: CANVAS_DEFAULT_VIEWPORT }
      : toCanvasFlow(renderDocument);
    const animated = applyCanvasMotionReceipt(
      withPaperTransitionIdentity(projected.nodes, paperTransitionMemoId),
      projected.edges,
      motionReceipt,
    );
    return { ...projected, ...animated };
  }, [motionReceipt, paperTransitionMemoId, renderDocument]);
  const latestFlowNodesRef = useRef(flow.nodes);
  latestFlowNodesRef.current = flow.nodes;
  const hasFlowNodes = flow.nodes.length > 0;

  useEffect(() => {
    consumeVisibleReceipt(flow.nodes, flow.edges);
  }, [consumeVisibleReceipt, flow.edges, flow.nodes]);

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
      const nextNodes = [...flow.nodes];
      if (transientText !== null) {
        nextNodes.push(flowNodeFromTransient(transientText));
      }
      return reconcileCanvasFlowNodes(current, nextNodes);
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

  useEffect(() => {
    if (!hasFlowNodes) return;
    let frame: number | null = null;
    const fitIfNodesLeaveViewport = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const instance = instanceRef.current;
        const stage = flowRef.current;
        if (instance === null || stage === null) return;
        const viewport = instance.getViewport();
        const rect = stage.getBoundingClientRect();
        if (canvasViewportShowsNodes(
          canvasNodesBounds(latestFlowNodesRef.current),
          viewport,
          { height: rect.height, width: rect.width },
        )) return;
        void instance.fitView({ duration: 0, padding: 0.18 });
      });
    };
    window.addEventListener("resize", fitIfNodesLeaveViewport);
    const observer = new ResizeObserver(fitIfNodesLeaveViewport);
    if (flowRef.current !== null) observer.observe(flowRef.current);
    return () => {
      window.removeEventListener("resize", fitIfNodesLeaveViewport);
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [hasFlowNodes]);

  /* 关系的强调是选择的函数, 与坐标无关, 因此自己一条推导 */
  useEffect(() => {
    setEdges((current) =>
      reconcileCanvasFlowEdges(current, flow.edges, selectedNodeIds));
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

  const {
    armClick: armConnectionClick,
    dragging: connectionDragging,
    isValidConnection,
    onConnect: handleConnect,
    onConnectEnd: handleConnectEnd,
    onConnectStart: handleConnectStart,
    onNodeClick: handleConnectionNodeClick,
  } = useCanvasConnectionSession({
    connectionSourceId,
    detail: document,
    enqueue,
    issueMotionReceipt,
    selectOnly,
    startConnection,
  });

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
    const playRemoval = captureCanvasRemovalSnapshots(
      snapshot.nodes.map((node) => node.id),
      reduceMotion,
    );
    try {
      await enqueueMany(snapshot.nodes.map((node) => ({
        operation: { node_id: node.id, type: "remove_node" },
      })));
    } finally {
      playRemoval();
    }
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
  }, [enqueueMany, reduceMotion, selectOnly, showUndoReceipt, toast]);

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

  /*
   * 离开画布进写作区也是同一张纸换了个位置: 写作区那张纸与卡片/预览共用同一个纸面名字。
   * 但这一次的 DOM 更新不归这里 —— 它归路由: 导航是异步的, 状态什么时候落地由 Router
   * 说了算, 在这里包一层视图过渡只会拍到还没换的旧页面。所以画布只管发出跳转意图,
   * 过渡由持有 navigate 的那一层用 viewTransition 起。
   */
  const navigateToMemo = useCallback(async (
    memoId: string,
    editOriginal = false,
  ) => {
    if (!await flushBeforeNavigation()) return;
    primePaperTransition(memoId);
    const state = useCanvasWorkspaceStore.getState();
    if (state.canvasId === canvasId && state.document !== null) {
      /*
       * 用户刚离开的画布就是返回时最准确、最快的目标。把这份短命快照留给下一次导航，
       * 返回按钮无需再等网络，而且目标卡片能参与路由的第一张截图。
       */
      storeCanvasEntryBootstrap({
        canvasId,
        detail: state.document,
        sourceMemoId: memoId,
        userId,
      });
    }
    if (editOriginal) onEditMemo(memoId);
    else onSelectMemo(memoId);
  }, [
    canvasId,
    flushBeforeNavigation,
    onEditMemo,
    onSelectMemo,
    primePaperTransition,
    userId,
  ]);

  const viewportCenter = useCallback(() => {
    const instance = instanceRef.current;
    const rect = flowRef.current?.getBoundingClientRect();
    if (instance === null || rect === undefined) return { x: 0, y: 0 };
    return instance.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, []);

  const addMemo = useCallback(async (
    memo: CommandAddTarget,
    droppedAt?: { x: number; y: number },
  ) => {
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
        const edgeId = crypto.randomUUID();
        issueMotionReceipt({
          edgeIds: [edgeId],
          kind: "connect",
          nodeIds: [],
          sourceNodeId: source.id,
        });
        await enqueue({
          operation: {
            edge_id: edgeId,
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
      ensureNodesInSafeViewport([source.id, existing.id]);
      startConnection(null);
      return;
    }

    if (existing !== undefined) {
      selectOnly([existing.id]);
      ensureNodesInSafeViewport([existing.id]);
      return;
    }

    const position = droppedAt ?? (source === null
      ? nearestCanvasPlacement(current.nodes, viewportCenter())
      : layoutCanvasCandidates(
        current.nodes,
        source.id,
        [{ confidence: 1, memoId: memo.id }],
      )[0] ?? nearestCanvasPlacement(current.nodes, viewportCenter()));
    const nodeId = crypto.randomUUID();
    const edgeId = source === null ? null : crypto.randomUUID();
    issueMotionReceipt({
      edgeIds: edgeId === null ? [] : [edgeId],
      kind: "manual_add",
      nodeIds: [nodeId],
      sourceNodeId: source?.id ?? null,
    });
    await enqueue({
      hint: { revision: memo.revision, title: memo.title },
      operation: {
        ...(source === null ? {} : {
          discovered_from_id: source.id,
          edge_id: edgeId!,
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
    ensureNodesInSafeViewport(source === null ? [nodeId] : [source.id, nodeId]);
    startConnection(null);
  }, [
    connectionSourceId,
    enqueue,
    ensureNodesInSafeViewport,
    issueMotionReceipt,
    selectOnly,
    startConnection,
    viewportCenter,
  ]);

  const expandFromNode = useCallback(async (sourceNodeId: string) => {
    const coordinator = coordinatorRef.current;
    if (coordinator === null || useCanvasWorkspaceStore.getState().aiLoading) return;
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

      const {
        edgeIds: receiptEdgeIds,
        nodeIds: receiptNodeIds,
      } = canvasMotionTargetsFromIntents(intents);
      issueMotionReceipt({
        edgeIds: receiptEdgeIds,
        kind: "ai_expand",
        nodeIds: receiptNodeIds,
        sourceNodeId,
      });
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
      ensureNodesInSafeViewport([sourceNodeId, ...receiptNodeIds]);
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
  }, [
    canvasId,
    coordinatorRef,
    ensureNodesInSafeViewport,
    issueMotionReceipt,
    setAiLoading,
    toast,
  ]);

  const actions = useMemo(() => ({
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
      armConnectionClick(nodeId);
    },
    onEditText(nodeId: string) {
      editText(nodeId);
    },
    onExpand: expandFromNode,
    onOpenMemo(nodeId: string) {
      void navigateToMemo(nodeId);
    },
    onPrefetchMemo(memoId: string) {
      void preloadMemo(accessToken, memoId).catch(() => undefined);
    },
    onPreview(nodeId: string) {
      changePreview(nodeId);
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
    enqueue,
    expandFromNode,
    navigateToMemo,
    accessToken,
    armConnectionClick,
    changePreview,
    preloadMemo,
    editText,
    removeEdge,
    requestNodeRemoval,
    selectOnly,
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
          changePreview(node.id);
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
        changePreview(null);
      } else if (connectionSourceId !== null) {
        event.preventDefault();
        startConnection(null);
      } else if (selectedNodeIds.length > 0) {
        event.preventDefault();
        selectOnly([]);
      }
    };
    /*
     * 这一层必须留在 window。Escape 有三层要分先后: Dialog/弹层(挂 document) > 画布内容
     * (这里) > CanvasWorkspace 的壳层 Panel 守卫。冒泡链只给出 document 先于 window 两档,
     * 所以画布内容与壳层同挂 window、靠 defaultPrevented 让行; 把这一层也搬到 document,
     * 就会和 Dialog 抢同一档 —— 确认框里按 Esc 会连带把节点选择一起清掉。
     */
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    connectionSourceId,
    expandFromNode,
    changePreview,
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

  const previewNode = renderDocument?.nodes.find(
    (node) => node.id === previewNodeId,
  ) ?? null;
  const previewMemoId = previewNode?.target_node_id ?? null;
  const previewTitle = previewNode?.target?.title
    ?? previewNode?.snapshot_title
    ?? "笔记预览";
  /*
   * 卡片上那段摘录就是这篇笔记的开头, 所以正文在路上时先把它放进纸里, 而不是三条灰条:
   * 放大的是同一段字, 从卡片长成一页纸, 中途没有一次内容被抽走再换上。
   */
  const previewExcerpt = previewNode?.target?.excerpt
    ?? previewNode?.snapshot_excerpt
    ?? null;
  return (
    <CanvasActionsProvider actions={actions}>
      <div
        className="knowledge-canvas"
        data-entry-motion={bootstrap === null ? "crossfade" : "view-transition"}
        data-load-status={loadStatus}
        data-memo-drop-active={memoDropActive || undefined}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setMemoDropActive(false);
          }
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(SUPERNOTE_MEMO_DRAG_MIME)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setMemoDropActive(true);
        }}
        onDrop={(event) => {
          const payload = parseMemoCanvasDrag(
            event.dataTransfer.getData(SUPERNOTE_MEMO_DRAG_MIME),
          );
          setMemoDropActive(false);
          if (payload === null || instanceRef.current === null) return;
          event.preventDefault();
          const position = instanceRef.current.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          void addMemo(payload, position).catch(() => undefined);
        }}
        ref={flowRef}
      >
        <ReactFlow<CanvasFlowNode, CanvasFlowEdge>
          connectOnClick={false}
          connectionLineComponent={CanvasElasticConnectionLine}
          edgeTypes={edgeTypes}
          edges={edges}
          elementsSelectable
          maxZoom={2}
          minZoom={0.2}
          nodeTypes={nodeTypes}
          nodes={nodes}
          isValidConnection={isValidConnection}
          nodesConnectable
          nodesDraggable
          onConnect={(connection: Connection) => handleConnect(connection)}
          onConnectEnd={handleConnectEnd}
          onConnectStart={handleConnectStart}
          onEdgesChange={onEdgesChange}
          onDoubleClick={handlePaneDoubleClick}
          onInit={(instance) => {
            instanceRef.current = instance;
          }}
          onMoveEnd={handleMoveEnd}
          onNodeClick={(_, node) => handleConnectionNodeClick(node.id)}
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

        {transitionLandingVisible
          && landingNode !== null
          && landingViewport !== null
          && bootstrap !== null ? (
            <div
              aria-hidden="true"
              className="canvas-transition-landing"
              style={{
                height: Number(landingNode.style?.height ?? 360),
                transform: `translate(${landingViewport.x + landingNode.position.x * landingViewport.zoom}px, ${landingViewport.y + landingNode.position.y * landingViewport.zoom}px) scale(${landingViewport.zoom})`,
                width: Number(landingNode.style?.width ?? 280),
              }}
            >
              <NotePaper
                className="canvas-card-paper"
                excerpt={landingNode.data.body}
                title={landingNode.data.title}
                transitionIdentity={bootstrap.sourceMemoId}
                variant="thumbnail"
              />
            </div>
          ) : null}

        <CanvasStageLoading visible={canvasSkeletonVisible} />
        {loadStatus === "error" ? (
          <div className="canvas-state">
            <strong>Canvas 打不开</strong>
            <span>它可能已被删除，或当前登录已失效。</span>
          </div>
        ) : null}
        {loadStatus === "ready" && renderDocument?.nodes.length === 0 ? (
          <div className="canvas-empty-hint">
            双击空白写一段自由文字，或使用下方「加入笔记」搜索并加入已有笔记
          </div>
        ) : null}

        {connectionSourceId !== null && !connectionDragging ? (
          <div className="canvas-mode-notice">
            选择另一张笔记卡片建立关系
            <button onClick={() => startConnection(null)} type="button">取消</button>
          </div>
        ) : null}

        {memoDropActive ? (
          <div className="canvas-drop-hint">松开以在这里加入笔记</div>
        ) : null}

        <CanvasPersistenceStatus coordinatorRef={coordinatorRef} />

        <CanvasAiState />
      </div>

      {previewMemoId === null || previewNode === null ? null : (
        <CanvasPreviewOverlay
          accessToken={accessToken}
          memoId={previewMemoId}
          onClose={() => changePreview(null)}
          onEditOriginal={async () => {
            await navigateToMemo(previewMemoId, true);
          }}
          pendingExcerpt={previewExcerpt}
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
