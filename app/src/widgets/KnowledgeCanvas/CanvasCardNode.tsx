/**
 * [INPUT]: 依赖 CanvasCardView、细粒度 canvasWorkspaceStore 与连接判据
 * [OUTPUT]: 对外提供生产 CanvasCardNode 与 isCanvasNodeAiLoading
 * [POS]: Canvas 节点的业务状态适配器；共享视图不读取 Store，生产会话与隔离演示各自提供状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { CanvasFlowNode } from "../../pages/canvasPresentation";
import { useCanvasWorkspaceStore, type CanvasWorkspaceState } from "../../shared/store/canvasWorkspaceStore";
import { canvasConnectionEligibility } from "./canvasConnectionEligibility";
import { CanvasCardView } from "./CanvasCardView";

export const isCanvasNodeAiLoading = (
  state: Pick<CanvasWorkspaceState, "aiLoading" | "aiSourceNodeId">,
  nodeId: string,
): boolean => state.aiLoading && state.aiSourceNodeId === nodeId;

export const CanvasCardNode = memo(function CanvasCardNode(props: NodeProps<CanvasFlowNode>) {
  const editing = useCanvasWorkspaceStore(s => s.editingTextNodeId === props.id);
  const previewing = useCanvasWorkspaceStore(s => s.previewNodeId === props.id);
  const aiLoading = useCanvasWorkspaceStore(s => isCanvasNodeAiLoading(s, props.id));
  const connectionSourceId = useCanvasWorkspaceStore(s => s.connectionSourceId);
  const validConnectionTarget = useCanvasWorkspaceStore(s => s.connectionSourceId !== null
    && canvasConnectionEligibility(s.document, s.connectionSourceId, props.id).valid);
  return <CanvasCardView {...props} editing={editing} previewing={previewing}
    aiLoading={aiLoading} connectionSourceId={connectionSourceId} validConnectionTarget={validConnectionTarget} />;
});
