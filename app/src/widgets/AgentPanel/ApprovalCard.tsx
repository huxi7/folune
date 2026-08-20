/**
 * [INPUT]: 依赖 AI SDK approval-requested tool part、共享 ApprovalDock、Design System Button 与批准/拒绝回调
 * [OUTPUT]: 对外提供普通工具单次操作的 ApprovalDock 内容适配
 * [POS]: AgentConversation 的工具审批语义层；与 AI 整理审批共享同一视觉原语，消息正文不承载审批控件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { Button } from "../../shared/design-system/components";
import { ApprovalDock } from "./ApprovalDock";
import {
  getAgentToolPresentation,
  normalizeAgentToolName,
} from "./toolPresentation";

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const approvalCopy = (part: ToolPart) => {
  const input = record(part.input);
  const operation = normalizeAgentToolName(getToolName(part));
  const editOperation = operation === "edit_node" && typeof input?.op === "string"
    ? input.op
    : operation;
  const presentation = getAgentToolPresentation(operation, part);

  if (editOperation === "delete" || editOperation === "trash_node") {
    return {
      confirmLabel: "移到回收站",
      description: "这会把目标移到回收站，之后仍可恢复。",
      title: presentation.name,
      variant: "danger" as const,
    };
  }
  if (editOperation === "move" || editOperation === "move_node") {
    return {
      confirmLabel: "确认移动",
      description: "这会改变目标在笔记库中的位置。",
      title: presentation.name,
      variant: "primary" as const,
    };
  }
  if (editOperation === "reorder" || editOperation === "reorder_node") {
    return {
      confirmLabel: "确认调整",
      description: "这会改变目标在当前层级中的顺序。",
      title: presentation.name,
      variant: "primary" as const,
    };
  }
  if (editOperation === "edit_memo") {
    return {
      confirmLabel: "允许修改",
      description: "这会替换当前备忘录正文，版本检查与撤销仍然生效。",
      title: presentation.name,
      variant: "primary" as const,
    };
  }
  return {
    confirmLabel: "允许一次",
    description: "确认后只执行这一次操作。",
    title: presentation.name,
    variant: "primary" as const,
  };
};

type ApprovalCardProps = {
  onApproval: (id: string, approved: boolean) => void;
  part: ToolPart;
};

export function ApprovalCard({ onApproval, part }: ApprovalCardProps) {
  if (!isToolUIPart(part) || part.state !== "approval-requested") return null;

  const copy = approvalCopy(part);

  return (
    <ApprovalDock
      actions={<>
        <Button onClick={() => onApproval(part.approval.id, false)} variant="ghost">取消</Button>
        <Button onClick={() => onApproval(part.approval.id, true)} variant={copy.variant}>{copy.confirmLabel}</Button>
      </>}
      description={copy.description}
      title={copy.title}
    />
  );
}
