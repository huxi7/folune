/**
 * [INPUT]: 依赖 React/motion reduced-motion、Canvas bootstrap/document、React Flow refs 与本地手势产生的 intent/节点/边 ID
 * [OUTPUT]: 对外提供 CanvasMotionReceipt 会话 Hook、只属于首次进入的一次性节点/关系投影、上下文相机、32ms/128ms 有界 stagger 与按布局尺寸乘 zoom 落位的删除 DOM 快照退场
 * [POS]: KnowledgeCanvas 的瞬时因果动效协调边界；receipt 只活在内存并装饰 React Flow data，禁止进入 API、WAL、数据库或 intent digest
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ReactFlowInstance } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { CanvasEntryBootstrap } from "../../pages/canvasEntryBootstrap";
import type { CanvasDetail } from "../../shared/api/canvas";
import type { CanvasIntent } from "../../shared/store/canvasDocument";
import type {
  CanvasFlowEdge,
  CanvasFlowMotionState,
  CanvasFlowNode,
} from "../../pages/canvasPresentation";
import {
  motionDuration,
  staggerMaxMs,
  staggerStepMs,
} from "../../pages/workspaceMotion";

export type CanvasMotionReceiptKind =
  | "ai_expand"
  | "canvas_entry"
  | "connect"
  | "manual_add";

export type CanvasMotionReceipt = {
  consumed: boolean;
  edgeIds: string[];
  gestureId: string;
  kind: CanvasMotionReceiptKind;
  nodeIds: string[];
  sourceNodeId: string | null;
};

export type CanvasMotionReceiptInput = Omit<
  CanvasMotionReceipt,
  "consumed" | "gestureId"
>;

export const createCanvasMotionReceipt = (
  input: CanvasMotionReceiptInput,
): CanvasMotionReceipt => ({
  ...input,
  consumed: false,
  gestureId: crypto.randomUUID(),
});

const delayFor = (index: number) => Math.min(staggerMaxMs, index * staggerStepMs);

export const canvasMotionTargetsFromIntents = (
  intents: readonly CanvasIntent[],
): { edgeIds: string[]; nodeIds: string[] } => {
  const edgeIds: string[] = [];
  const nodeIds: string[] = [];
  for (const intent of intents) {
    if (intent.operation.type === "add_memo") {
      nodeIds.push(intent.operation.node_id);
      if (intent.operation.edge_id !== undefined) {
        edgeIds.push(intent.operation.edge_id);
      }
    } else if (intent.operation.type === "upsert_edge") {
      edgeIds.push(intent.operation.edge_id);
    }
  }
  return { edgeIds, nodeIds };
};

const nodeOffset = (
  source: CanvasFlowNode | undefined,
  target: CanvasFlowNode,
): { x: number; y: number } => {
  if (source === undefined) return { x: 0, y: 10 };
  const dx = source.position.x - target.position.x;
  const dy = source.position.y - target.position.y;
  const length = Math.hypot(dx, dy) || 1;
  const distance = 12;
  return { x: dx / length * distance, y: dy / length * distance };
};

export const applyCanvasMotionReceipt = (
  nodes: readonly CanvasFlowNode[],
  edges: readonly CanvasFlowEdge[],
  receipt: CanvasMotionReceipt | null,
): { edges: CanvasFlowEdge[]; nodes: CanvasFlowNode[] } => {
  if (receipt === null) return { edges: [...edges], nodes: [...nodes] };
  const nodeIndex = new Map(receipt.nodeIds.map((id, index) => [id, index]));
  const edgeIndex = new Map(receipt.edgeIds.map((id, index) => [id, index]));
  const source = receipt.sourceNodeId === null
    ? undefined
    : nodes.find((node) => node.id === receipt.sourceNodeId);

  return {
    edges: edges.map((edge) => {
      const index = edgeIndex.get(edge.id);
      if (index === undefined) return edge;
      const data = edge.data ?? { createdBy: "user" as const, rationale: null };
      return {
        ...edge,
        data: {
          ...data,
          motionState: {
            delayMs: receipt.kind === "ai_expand"
              ? 40 + delayFor(index)
              : receipt.kind === "canvas_entry"
                ? 220 + delayFor(index)
                : delayFor(index),
            gestureId: receipt.gestureId,
            kind: "edge-draw",
          },
        },
      };
    }),
    nodes: nodes.map((node) => {
      const index = nodeIndex.get(node.id);
      let motionState: CanvasFlowMotionState | undefined;
      if (index !== undefined) {
        const offset = nodeOffset(source, node);
        motionState = {
          delayMs: receipt.kind === "ai_expand"
            ? 100 + delayFor(index)
            : receipt.kind === "canvas_entry"
              ? 110 + delayFor(index)
            : delayFor(index),
          gestureId: receipt.gestureId,
          kind: "node-enter",
          offsetX: offset.x,
          offsetY: offset.y,
        };
      } else if (
        receipt.kind === "ai_expand"
        && receipt.sourceNodeId === node.id
      ) {
        motionState = {
          delayMs: 0,
          gestureId: receipt.gestureId,
          kind: "source-confirm",
          offsetX: 0,
          offsetY: 0,
        };
      }
      if (motionState === undefined) return node;
      return { ...node, data: { ...node.data, motionState } };
    }),
  };
};

export const findCanvasNodeElement = (
  root: ParentNode,
  nodeId: string,
): HTMLElement | null => {
  for (const element of root.querySelectorAll<HTMLElement>(
    ".react-flow__node[data-id]",
  )) {
    if (element.dataset.id === nodeId) return element;
  }
  return null;
};

export const useCanvasMotionReceipts = ({
  bootstrap,
  canvasDocument,
  canvasId,
  flowRef,
  instanceRef,
  returning,
}: {
  bootstrap: CanvasEntryBootstrap | null;
  canvasDocument: CanvasDetail | null;
  canvasId: string;
  flowRef: RefObject<HTMLDivElement | null>;
  instanceRef: RefObject<ReactFlowInstance<CanvasFlowNode, CanvasFlowEdge> | null>;
  /** 这一趟是"返回我刚才那张画布", 而不是第一次进来 */
  returning: boolean;
}) => {
  const reducedMotion = Boolean(useReducedMotion());
  const [motionReceipt, setMotionReceipt] = useState<CanvasMotionReceipt | null>(null);
  const receiptTimerRef = useRef<number | null>(null);
  const cameraFrameRef = useRef<number | null>(null);
  const entryIssuedRef = useRef(false);

  const clearReceiptTimer = useCallback(() => {
    if (receiptTimerRef.current !== null) {
      window.clearTimeout(receiptTimerRef.current);
      receiptTimerRef.current = null;
    }
  }, []);

  const issueMotionReceipt = useCallback((input: CanvasMotionReceiptInput) => {
    if (reducedMotion) return;
    clearReceiptTimer();
    setMotionReceipt(createCanvasMotionReceipt(input));
    receiptTimerRef.current = window.setTimeout(() => {
      setMotionReceipt(null);
      receiptTimerRef.current = null;
    }, 720);
  }, [clearReceiptTimer, reducedMotion]);

  const consumeVisibleReceipt = useCallback((
    nodes: readonly CanvasFlowNode[],
    edges: readonly CanvasFlowEdge[],
  ) => {
    setMotionReceipt((current) => {
      if (current === null || current.consumed) return current;
      const visible = nodes.some((node) => current.nodeIds.includes(node.id))
        || edges.some((edge) => current.edgeIds.includes(edge.id));
      return visible ? { ...current, consumed: true } : current;
    });
  }, []);

  const ensureNodesInSafeViewport = useCallback((nodeIds: readonly string[]) => {
    if (cameraFrameRef.current !== null) {
      cancelAnimationFrame(cameraFrameRef.current);
    }
    cameraFrameRef.current = requestAnimationFrame(() => {
      cameraFrameRef.current = null;
      const stage = flowRef.current?.getBoundingClientRect();
      const instance = instanceRef.current;
      if (stage === undefined || instance === null || nodeIds.length === 0) return;
      const inset = Math.min(88, Math.max(32, stage.width * 0.08));
      const safe = {
        bottom: stage.bottom - inset,
        left: stage.left + inset,
        right: stage.right - inset,
        top: stage.top + inset,
      };
      const allVisible = nodeIds.every((nodeId) => {
        const root = flowRef.current;
        const element = root === null ? null : findCanvasNodeElement(root, nodeId);
        if (element === null) return false;
        const rect = element.getBoundingClientRect();
        return rect.left >= safe.left
          && rect.top >= safe.top
          && rect.right <= safe.right
          && rect.bottom <= safe.bottom;
      });
      if (allVisible) return;
      void instance.fitView({
        duration: reducedMotion ? 0 : 240,
        nodes: nodeIds.map((id) => ({ id })),
        padding: 0.28,
      });
    });
  }, [flowRef, instanceRef, reducedMotion]);

  useEffect(() => {
    entryIssuedRef.current = false;
    clearReceiptTimer();
    setMotionReceipt(null);
  }, [canvasId, clearReceiptTimer]);

  /*
   * 入场编排只属于"第一次进来": 从笔记展开成一张图, 让节点依次到位是在讲一件真事。
   * 返回不是这件事 —— 那张图一直在, 什么都没有新增。返回时重播一遍入场, 用户看到的是
   * 一片空白卡片在自己填字, 观感上世界被重建了一次, 而他要的只是回到原处。
   */
  useEffect(() => {
    if (
      bootstrap === null
      || canvasDocument === null
      || entryIssuedRef.current
    ) {
      return;
    }
    entryIssuedRef.current = true;
    if (returning) return;
    const origin = canvasDocument.nodes.find(
      (node) => node.target_node_id === bootstrap.sourceMemoId,
    );
    issueMotionReceipt({
      edgeIds: canvasDocument.edges.map((edge) => edge.id),
      kind: "canvas_entry",
      nodeIds: canvasDocument.nodes
        .filter((node) => node.id !== origin?.id)
        .map((node) => node.id),
      sourceNodeId: origin?.id ?? null,
    });
  }, [bootstrap, canvasDocument, issueMotionReceipt, returning]);

  useEffect(() => () => {
    clearReceiptTimer();
    if (cameraFrameRef.current !== null) {
      cancelAnimationFrame(cameraFrameRef.current);
    }
  }, [clearReceiptTimer]);

  return {
    consumeVisibleReceipt,
    ensureNodesInSafeViewport,
    issueMotionReceipt,
    motionReceipt,
    reducedMotion,
  };
};

const stripSnapshotIdentity = (clone: HTMLElement) => {
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");
  clone.removeAttribute("data-id");
  clone.removeAttribute("id");
  for (const element of clone.querySelectorAll<HTMLElement>("[data-id], [id]")) {
    element.removeAttribute("data-id");
    element.removeAttribute("id");
  }
};

export const captureCanvasRemovalSnapshots = (
  nodeIds: readonly string[],
  reducedMotion: boolean,
): (() => void) => {
  const snapshots: {
    clone: HTMLElement;
    rect: { height: number; width: number };
    scale: number;
  }[] = [];
  for (const nodeId of nodeIds) {
    const source = findCanvasNodeElement(document, nodeId);
    if (source === null) continue;
    const rect = source.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.classList.add("canvas-removal-snapshot");
    stripSnapshotIdentity(clone);
    /*
     * 快照必须按布局尺寸排版, 再乘上卡片自身的 zoom。卡片活在 React Flow 的缩放里,
     * 而快照挂在 body 上不在那个变换里: 若照屏幕矩形钉宽高, 版面会被挤窄而字号照旧,
     * 删除那一下字会先突然变大再淡掉。transform-origin 因此必须是 top left, 基准缩放
     * 才会正好落在 rect 上。
     */
    const layoutWidth = source.offsetWidth || rect.width;
    const layoutHeight = source.offsetHeight || rect.height;
    const scale = layoutWidth === 0 ? 1 : rect.width / layoutWidth;
    Object.assign(clone.style, {
      height: `${layoutHeight}px`,
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      transform: `translate(0px, 0px) scale(${scale})`,
      width: `${layoutWidth}px`,
    });
    document.body.append(clone);
    snapshots.push({ clone, rect, scale });
  }
  return () => {
    for (const { clone, rect, scale } of snapshots) {
      const duration = reducedMotion
        ? 90
        : Math.round(motionDuration.microExit * 1_000);
      let fallbackTimer: number | null = null;
      const remove = () => {
        if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
        clone.remove();
      };
      try {
        /*
         * 基准缩放必须写进关键帧, 否则动画会把 transform 重置成 scale(1), 卡片在退场
         * 第一帧就胀回原始布局尺寸。收缩基点是 top left, 所以补一个 translate 让它读成
         * 朝自身中心收拢, 而不是朝左上角塌。
         */
        const shrink = 0.97;
        const drift = {
          x: (rect.width * (1 - shrink)) / 2,
          y: (rect.height * (1 - shrink)) / 2,
        };
        const animation = clone.animate(
          reducedMotion
            ? [{ opacity: 1 }, { opacity: 0 }]
            : [
              { opacity: 1, transform: `translate(0px, 0px) scale(${scale})` },
              {
                opacity: 0,
                transform: `translate(${drift.x}px, ${drift.y}px) scale(${scale * shrink})`,
              },
            ],
          {
            duration,
            easing: "cubic-bezier(0.4, 0, 1, 1)",
            fill: "forwards",
          },
        );
        fallbackTimer = window.setTimeout(remove, duration + 80);
        void animation.finished.then(remove, remove);
      } catch {
        remove();
      }
    }
  };
};
