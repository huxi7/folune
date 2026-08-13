/**
 * [INPUT]: 依赖 AI SDK tool part approval 状态、SuperNote 命令输出、Design System Button 与批准/拒绝/撤销回调
 * [OUTPUT]: 对外提供目标/旧值/新值/风险理由的审批卡、命令状态提示及成功后撤销入口
 * [POS]: ChatMessage 的可信执行视图；隐藏 UUID/原始 JSON，只把模型意图、数据库事实与用户动作分栏呈现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ArrowCounterClockwiseIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";

import type { AiCommand } from "../../shared/api/ai";
import { Button } from "../../shared/design-system/components";
import { normalizeAgentToolName } from "./toolPresentation";

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const short = (value: unknown) => {
  if (value === null) return "根目录";
  if (typeof value !== "string" && typeof value !== "number") return "—";
  const text = String(value).replace(/\s+/gu, " ").trim();
  return text.length > 72 ? `${text.slice(0, 71)}…` : text || "—";
};

const diffRows = (part: ToolPart) => {
  const input = record(part.input);
  const output = "output" in part ? record(part.output) as AiCommand | null : null;
  const before = record(output?.before_state)?.node as Record<string, unknown> | undefined;
  const after = record(output?.after_state)?.node as Record<string, unknown> | undefined;
  const operation = output?.operation
    ?? normalizeAgentToolName(getToolName(part));

  if (operation === "edit_node") {
    const op = typeof input?.op === "string" ? input.op : "";
    if (op === "rename") return [{ label: "标题", before: "当前标题", after: short(input?.title) }];
    if (op === "move") return [{ label: "位置", before: "当前位置", after: input?.parent_id === null ? "根目录" : "目标文件夹" }];
    if (op === "reorder") return [{ label: "顺序", before: "当前位置", after: input?.placement === "before" ? "参照笔记之前" : "参照笔记之后" }];
    if (op === "delete") return [{ label: "状态", before: "正常", after: "回收站（可撤销）" }];
    return [{ label: "节点", before: "不存在", after: short(input?.title) }];
  }

  if (operation === "rename_node") return [{ label: "标题", before: short(before?.title), after: short(input?.title ?? after?.title) }];
  if (operation === "move_node") return [{ label: "位置", before: "当前位置", after: input?.parent_id === null ? "根目录" : "目标文件夹" }];
  if (operation === "reorder_node") return [{ label: "顺序", before: "当前位置", after: input?.placement === "before" ? "参照笔记之前" : "参照笔记之后" }];
  if (operation === "trash_node") return [{ label: "状态", before: "正常", after: "回收站（可撤销）" }];
  if (operation === "edit_memo") return [{ label: "正文", before: "当前版本", after: "替换为新版本" }];
  return [{ label: "节点", before: "不存在", after: short(input?.title ?? after?.title) }];
};

type ApprovalCardProps = {
  onApproval: (id: string, approved: boolean) => void;
  onUndo?: (command: AiCommand) => void;
  part: ToolPart;
};

export function ApprovalCard({ onApproval, onUndo, part }: ApprovalCardProps) {
  if (!isToolUIPart(part)) return null;
  const output = "output" in part ? record(part.output) as AiCommand | null : null;
  const showApproval = part.state === "approval-requested";
  const showCommand = output !== null && output.id !== undefined;
  if (!showApproval && !showCommand) return null;

  const rows = diffRows(part);
  const operation = output?.operation
    ?? normalizeAgentToolName(getToolName(part));
  const risk = output?.risk
    ?? (operation === "edit_node" && record(part.input)?.op === "delete"
      ? "high"
      : operation.endsWith("trash_node")
      ? "high"
      : operation === "edit_node" && ["move", "reorder"].includes(String(record(part.input)?.op))
        ? "medium"
        : operation.endsWith("move_node") || operation.endsWith("reorder_node")
        ? "medium"
        : "low");
  const riskCopy = { high: "高", low: "低", medium: "中" }[risk];
  const statusCopy = output?.status === "stale"
    ? "版本冲突，未覆盖新内容"
    : output?.status === "failed"
      ? "执行失败，已回滚"
      : output?.status === "undone"
        ? "已撤销"
        : output?.status === "succeeded"
          ? "已安全执行"
          : "等待确认";

  return (
    <section className="agent-approval-card">
      <header><ShieldWarningIcon size={16} /><div><strong>{showApproval ? "确认这次修改" : statusCopy}</strong><p>风险：{riskCopy} · {output?.approval_reason ?? "这是一条可审计、可撤销的原子命令。"}</p></div></header>
      <table><thead><tr><th>项目</th><th>旧值</th><th>新值</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody></table>
      <footer>
        {showApproval ? <><Button onClick={() => onApproval(part.approval.id, false)} size="default" variant="secondary">拒绝</Button><Button onClick={() => onApproval(part.approval.id, true)} size="default" variant="primary">批准</Button></> : null}
        {output?.status === "succeeded" && onUndo ? <Button icon={ArrowCounterClockwiseIcon} onClick={() => onUndo(output)} size="default" variant="secondary">撤销</Button> : null}
      </footer>
    </section>
  );
}
