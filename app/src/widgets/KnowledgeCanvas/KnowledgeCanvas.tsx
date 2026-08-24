/**
 * [INPUT]: 依赖 @xyflow/react v12 与其基础样式、shared/api/canvas 的读取/布局/晋升、pages/canvasPresentation 的投影、memoTreeStore 的 mergeServerNode、Skeleton/Toast 与 styles/knowledge-canvas.css
 * [OUTPUT]: 对外提供 KnowledgeCanvas 只读画布视图与「写一张卡片 → 成为笔记」的沉淀入口
 * [POS]: app/src/widgets 的已保存画布内容根，住在独立全屏 CanvasWorkspace 内；此处允许 pan/zoom 与极淡点阵，因为没有活编辑器。刻意不开 onlyRenderVisibleElements——maintainer 明说它当前效果相反，真瓶颈是节点组件的反复挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Viewport,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "@xyflow/react/dist/style.css";

import {
  CANVAS_DEFAULT_VIEWPORT,
  canvasLayoutFromNodes,
  nextCanvasCardPosition,
  shouldRestoreCanvasViewport,
  toCanvasFlow,
  toCanvasFlowNode,
  type CanvasFlowNode,
} from "../../pages/canvasPresentation";
import {
  createCanvasCard,
  getCanvas,
  promoteCanvasCard,
  updateCanvasLayout,
  type CanvasDetail,
} from "../../shared/api/canvas";
import {
  Button,
  Dialog,
  Skeleton,
  SkeletonGroup,
  useToast,
} from "../../shared/design-system/components";
import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import { CanvasActionsProvider } from "./canvasActions";
import { CanvasCardNode } from "./CanvasCardNode";
import { CanvasCordEdge } from "./CanvasCordEdge";

/** 模块级常量: React Flow 要求 nodeTypes/edgeTypes 引用稳定，否则每次渲染都重建节点 */
const nodeTypes = { canvasCard: CanvasCardNode };
const edgeTypes = { cord: CanvasCordEdge };
/** 拖拽与平移停下后再回写，避免每一帧一个 PATCH */
const LAYOUT_FLUSH_MS = 700;

type KnowledgeCanvasProps = {
  accessToken: string;
  canvasId: string;
  onSelectMemo: (nodeId: string) => void;
};

type UserCanvasViewport = Viewport & { user_moved: true };

export function KnowledgeCanvas({
  accessToken,
  canvasId,
  onSelectMemo,
}: KnowledgeCanvasProps) {
  const { toast } = useToast();
  const mergeServerNode = useMemoTreeStore((state) => state.mergeServerNode);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading");
  const [viewport, setViewport] = useState<Viewport>(CANVAS_DEFAULT_VIEWPORT);
  const [restoreViewport, setRestoreViewport] = useState(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const flushTimerRef = useRef(0);
  const pendingViewportRef = useRef<UserCanvasViewport | null>(null);
  const nodesRef = useRef<CanvasFlowNode[]>([]);
  nodesRef.current = nodes;

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    void getCanvas(accessToken, canvasId, controller.signal)
      .then((detail: CanvasDetail) => {
        const flow = toCanvasFlow(detail);
        setNodes(flow.nodes);
        setEdges(flow.edges);
        setViewport(flow.viewport);
        setRestoreViewport(shouldRestoreCanvasViewport(detail.canvas.viewport));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setStatus("error");
        toast({
          description: error instanceof Error ? error.message : undefined,
          title: "画布加载失败",
          variant: "error",
        });
      });

    return () => controller.abort();
  }, [accessToken, canvasId, setEdges, setNodes, toast]);

  // 布局回写是「安静的持久化」: 失败不打断阅读，只在下次拖拽时再试
  const scheduleLayoutFlush = useCallback(() => {
    window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = 0;
      const nextViewport = pendingViewportRef.current;
      pendingViewportRef.current = null;
      void updateCanvasLayout(accessToken, canvasId, {
        cards: canvasLayoutFromNodes(nodesRef.current),
        ...(nextViewport === null ? {} : { viewport: nextViewport }),
      }).catch(() => undefined);
    }, LAYOUT_FLUSH_MS);
  }, [accessToken, canvasId]);

  useEffect(() => () => window.clearTimeout(flushTimerRef.current), []);

  const actions = useMemo(() => ({
    busyCardId,
    onOpenMemo: onSelectMemo,
    async onPromote(cardId: string) {
      if (busyCardId !== null) {
        return;
      }
      setBusyCardId(cardId);
      try {
        const promotion = await promoteCanvasCard(accessToken, cardId);

        if (promotion.node !== null) {
          // 新笔记就地并入文件树，绝不因为一次晋升去刷新整棵树
          mergeServerNode(promotion.node);
        }
        setNodes((current) => current.map((node) => (node.id === cardId
          ? {
            ...node,
            data: {
              ...node.data,
              body: promotion.memo?.excerpt ?? node.data.body,
              drifted: false,
              kind: promotion.card.kind,
              promotable: false,
              targetNodeId: promotion.card.target_node_id,
              title: promotion.node?.title ?? node.data.title,
            },
          }
          : node)));
        toast({
          title: promotion.already_promoted ? "这张卡片已经是笔记了" : "已成为笔记",
          variant: promotion.already_promoted ? "info" : "success",
        });
      } catch (error) {
        toast({
          description: error instanceof Error ? error.message : undefined,
          title: "晋升失败",
          variant: "error",
        });
      } finally {
        setBusyCardId(null);
      }
    },
  }), [accessToken, busyCardId, mergeServerNode, onSelectMemo, setNodes, toast]);

  // 卡片正文在弹层里写，画布本身仍然只渲染只读卡片——画布上没有活编辑器
  const commitCard = async () => {
    const text = draft.trim();

    if (text.length === 0 || creating) {
      return;
    }

    setCreating(true);
    try {
      const card = await createCanvasCard(accessToken, canvasId, {
        kind: "native",
        text,
        ...nextCanvasCardPosition(nodesRef.current.length),
      });
      setNodes((current) => [...current, toCanvasFlowNode(card)]);
      setComposing(false);
      setDraft("");
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "卡片没能放上画布",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  if (status === "loading") {
    return (
      <SkeletonGroup className="canvas-loading" label="正在加载画布">
        <Skeleton className="canvas-loading-card" />
        <Skeleton className="canvas-loading-card" />
        <Skeleton className="canvas-loading-card" />
      </SkeletonGroup>
    );
  }

  if (status === "error") {
    return (
      <div className="canvas-state">
        <strong>画布打不开</strong>
        <span>它可能已被删除。回到文件库看看其他内容。</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="canvas-state">
        <strong>这张画布还没有卡片</strong>
        <span>返回笔记重新探索，或在这里写下第一张卡片。</span>
      </div>
    );
  }

  return (
    <CanvasActionsProvider actions={actions}>
      <div className="knowledge-canvas">
        <ReactFlow
          defaultViewport={viewport}
          edgeTypes={edgeTypes}
          edges={edges}
          elementsSelectable
          fitView={!restoreViewport && nodes.length > 0}
          fitViewOptions={{ padding: 0.18 }}
          maxZoom={2}
          minZoom={0.2}
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable
          onEdgesChange={onEdgesChange}
          onMoveEnd={(event, nextViewport) => {
            // fitView/初始化产生的程序化移动没有事件，不得伪装成用户视口落库。
            if (event === null) {
              return;
            }
            pendingViewportRef.current = {
              ...nextViewport,
              user_moved: true,
            };
            scheduleLayoutFlush();
          }}
          onNodeDragStop={scheduleLayoutFlush}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={26} size={1} variant={BackgroundVariant.Dots} />
          <Panel position="top-right">
            <button
              className="canvas-card-action canvas-compose-entry"
              onClick={() => setComposing(true)}
              type="button"
            >
              写一张卡片
            </button>
          </Panel>
        </ReactFlow>

        <Dialog
          description="写在画布上的卡片是只读的；想让它成为一篇笔记，用卡片上的「成为笔记」。"
          onOpenChange={(open) => {
            setComposing(open);
            if (!open) {
              setDraft("");
            }
          }}
          open={composing}
          title="写一张卡片"
        >
          <textarea
            aria-label="卡片正文"
            className="canvas-compose-input"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="第一行会成为它的名字…"
            rows={6}
            value={draft}
          />
          <div className="canvas-compose-actions">
            <Button onClick={() => setComposing(false)} variant="secondary">
              取消
            </Button>
            <Button
              disabled={draft.trim().length === 0}
              loading={creating}
              onClick={() => void commitCard()}
            >
              放到画布
            </Button>
          </div>
        </Dialog>
      </div>
    </CanvasActionsProvider>
  );
}
