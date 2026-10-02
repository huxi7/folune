/**
 * [INPUT]: 依赖 AI SDK approval-requested part、locale 文案、共享 ApprovalDock/Button 与批准/拒绝回调
 * [OUTPUT]: 对外提供原子或明确批量操作的 ApprovalDock 内容适配
 * [POS]: AgentConversation 的工具审批语义层；与 AI 整理审批共享同一视觉原语，消息正文不承载审批控件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { Button } from "../../shared/design-system/components";
import { useLocale, type Locale } from "../../shared/locale";
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

const approvalCopy = (part: ToolPart, t: (chinese: string, english: string) => string, locale: Locale) => {
  const input = record(part.input);
  const operation = normalizeAgentToolName(getToolName(part));
  const editOperation = (operation === "edit_node" || operation === "edit_nodes") && typeof input?.op === "string"
    ? input.op
    : operation;
  const presentation = getAgentToolPresentation(operation, part, undefined, locale);

  if (editOperation === "delete" || editOperation === "trash_node") {
    return {
      confirmLabel: t("移到回收站", "Move to Trash"),
      description: t("这会把目标移到回收站，之后仍可恢复。", "Move the selected items to Trash. They can be restored later."),
      title: presentation.name,
      variant: "danger" as const,
    };
  }
  if (editOperation === "move" || editOperation === "move_node") {
    return {
      confirmLabel: t("确认移动", "Move items"),
      description: t("这会改变目标在笔记库中的位置。", "This changes where the selected items are stored in your library."),
      title: presentation.name,
      variant: "primary" as const,
    };
  }
  if (editOperation === "reorder" || editOperation === "reorder_node") {
    return {
      confirmLabel: t("确认调整", "Reorder items"),
      description: t("这会改变目标在当前层级中的顺序。", "This changes the order of items in their current location."),
      title: presentation.name,
      variant: "primary" as const,
    };
  }
  if (editOperation === "edit_memo") {
    return {
      confirmLabel: t("允许修改", "Allow changes"),
      description: t("这会替换当前备忘录正文，版本检查与撤销仍然生效。", "This replaces the note content. Version checks and undo remain available."),
      title: presentation.name,
      variant: "primary" as const,
    };
  }
  return {
    confirmLabel: t("允许一次", "Allow once"),
    description: t("确认后只执行这一次操作。", "Your approval applies to this operation only."),
    title: presentation.name,
    variant: "primary" as const,
  };
};

type ApprovalCardProps = {
  onApproval: (id: string, approved: boolean) => void;
  part: ToolPart;
};

export function ApprovalCard({ onApproval, part }: ApprovalCardProps) {
  const { t, locale } = useLocale();
  if (!isToolUIPart(part) || part.state !== "approval-requested") return null;

  const copy = approvalCopy(part, t, locale);

  return (
    <ApprovalDock
      actions={<>
        <Button onClick={() => onApproval(part.approval.id, false)} variant="ghost">{t("取消", "Cancel")}</Button>
        <Button onClick={() => onApproval(part.approval.id, true)} variant={copy.variant}>{copy.confirmLabel}</Button>
      </>}
      description={copy.description}
      ariaLabel={t("操作确认", "Confirm operation")}
      title={copy.title}
    />
  );
}
