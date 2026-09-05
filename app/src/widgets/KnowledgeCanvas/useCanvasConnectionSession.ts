/**
 * [INPUT]: 依赖 React、React Flow 连接生命周期、CanvasDetail/CanvasIntent、单一连接判据、现有 receipt/enqueue/select/startConnection 回调
 * [OUTPUT]: 对外提供 commitCanvasConnection 与 useCanvasConnectionSession 的拖/点等效状态机、合法性回调和合成 click 抑制
 * [POS]: KnowledgeCanvas 的瞬态连接会话控制器；临时手势只活内存，正式写入仍只签发一次 upsert_edge 给既有 enqueue
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useCallback,
  useRef,
  useState,
} from "react";
import type {
  Connection,
  OnConnectEnd,
  OnConnectStart,
} from "@xyflow/react";

import type { CanvasDetail } from "../../shared/api/canvas";
import type { CanvasIntent } from "../../shared/store/canvasDocument";
import type {
  CanvasFlowEdge,
} from "../../pages/canvasPresentation";
import type { CanvasMotionReceiptInput } from "./canvasMotionReceipts";
import {
  canvasConnectionEligibility,
  type CanvasConnectionEligibility,
} from "./canvasConnectionEligibility";

type CommitCanvasConnectionInput = {
  detail: CanvasDetail | null;
  enqueue: (intent: CanvasIntent) => Promise<void>;
  issueMotionReceipt: (input: CanvasMotionReceiptInput) => void;
  selectOnly: (nodeIds: readonly string[]) => void;
  sourceId: string;
  targetId: string;
};

export async function commitCanvasConnection({
  detail,
  enqueue,
  issueMotionReceipt,
  selectOnly,
  sourceId,
  targetId,
}: CommitCanvasConnectionInput): Promise<CanvasConnectionEligibility> {
  const eligibility = canvasConnectionEligibility(detail, sourceId, targetId);
  if (!eligibility.valid) return eligibility;
  const edgeId = crypto.randomUUID();
  issueMotionReceipt({
    edgeIds: [edgeId],
    kind: "connect",
    nodeIds: [],
    sourceNodeId: eligibility.source.id,
  });
  await enqueue({
    operation: {
      edge_id: edgeId,
      source_id: eligibility.source.id,
      target_id: eligibility.target.id,
      type: "upsert_edge",
    },
  });
  selectOnly([eligibility.source.id]);
  return eligibility;
}

type UseCanvasConnectionSessionInput = Omit<
  CommitCanvasConnectionInput,
  "detail" | "sourceId" | "targetId"
> & {
  connectionSourceId: string | null;
  detail: CanvasDetail | null;
  startConnection: (nodeId: string | null) => void;
};

export function useCanvasConnectionSession({
  connectionSourceId,
  detail,
  enqueue,
  issueMotionReceipt,
  selectOnly,
  startConnection,
}: UseCanvasConnectionSessionInput) {
  const [dragging, setDragging] = useState(false);
  const detailRef = useRef(detail);
  const sourceRef = useRef(connectionSourceId);
  const dragCommittedRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  detailRef.current = detail;
  sourceRef.current = connectionSourceId;

  const commit = useCallback((sourceId: string, targetId: string) =>
    commitCanvasConnection({
      detail: detailRef.current,
      enqueue,
      issueMotionReceipt,
      selectOnly,
      sourceId,
      targetId,
    }), [enqueue, issueMotionReceipt, selectOnly]);

  const armClick = useCallback((nodeId: string) => {
    if (performance.now() < suppressClickUntilRef.current) return;
    startConnection(sourceRef.current === nodeId ? null : nodeId);
  }, [startConnection]);

  const onNodeClick = useCallback((nodeId: string) => {
    if (dragging || performance.now() < suppressClickUntilRef.current) return;
    const sourceId = sourceRef.current;
    if (sourceId === null) return;
    const eligibility = canvasConnectionEligibility(detailRef.current, sourceId, nodeId);
    startConnection(null);
    if (!eligibility.valid) return;
    void commit(sourceId, nodeId).catch(() => undefined);
  }, [commit, dragging, startConnection]);

  const isValidConnection = useCallback((connection: CanvasFlowEdge | Connection) =>
    canvasConnectionEligibility(
      detailRef.current,
      connection.source,
      connection.target,
    ).valid, []);

  const onConnectStart = useCallback<OnConnectStart>((_, params) => {
    if (params.nodeId === null) return;
    dragCommittedRef.current = false;
    setDragging(true);
    startConnection(params.nodeId);
  }, [startConnection]);

  const onConnect = useCallback((connection: Connection) => {
    if (dragCommittedRef.current) return;
    const eligibility = canvasConnectionEligibility(
      detailRef.current,
      connection.source,
      connection.target,
    );
    if (!eligibility.valid) return;
    dragCommittedRef.current = true;
    void commit(connection.source, connection.target).catch(() => undefined);
  }, [commit]);

  const onConnectEnd = useCallback<OnConnectEnd>(() => {
    suppressClickUntilRef.current = performance.now() + 240;
    setDragging(false);
    startConnection(null);
  }, [startConnection]);

  return {
    armClick,
    dragging,
    isValidConnection,
    onConnect,
    onConnectEnd,
    onConnectStart,
    onNodeClick,
  };
}
