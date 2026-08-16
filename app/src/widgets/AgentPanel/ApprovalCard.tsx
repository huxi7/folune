/**
 * [INPUT]: 依赖 AI SDK approval-requested tool part、Design System Dialog/Button 与批准/拒绝回调
 * [OUTPUT]: 对外提供阻塞式目标/旧值/新值/风险确认弹窗，仅人工审批状态可见
 * [POS]: ChatMessage 的可信人工裁决视图；自动执行审计不占回复过程，成功撤销由回复末尾轻量动作栏承载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ShieldWarningIcon } from "../../shared/design-system/icons";
import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { Button, Dialog } from "../../shared/design-system/components";
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
  const operation = normalizeAgentToolName(getToolName(part));

  if (operation === "edit_node") {
    const op = typeof input?.op === "string" ? input.op : "";
    if (op === "rename") return [{ label: "标题", before: "当前标题", after: short(input?.title) }];
    if (op === "move") return [{ label: "位置", before: "当前位置", after: input?.parent_id === null ? "根目录" : "目标文件夹" }];
    if (op === "reorder") return [{ label: "顺序", before: "当前位置", after: input?.placement === "before" ? "参照笔记之前" : "参照笔记之后" }];
    if (op === "delete") return [{ label: "状态", before: "正常", after: "回收站（可撤销）" }];
    return [{ label: "节点", before: "不存在", after: short(input?.title) }];
  }

  if (operation === "rename_node") return [{ label: "标题", before: "当前标题", after: short(input?.title) }];
  if (operation === "move_node") return [{ label: "位置", before: "当前位置", after: input?.parent_id === null ? "根目录" : "目标文件夹" }];
  if (operation === "reorder_node") return [{ label: "顺序", before: "当前位置", after: input?.placement === "before" ? "参照笔记之前" : "参照笔记之后" }];
  if (operation === "trash_node") return [{ label: "状态", before: "正常", after: "回收站（可撤销）" }];
  if (operation === "edit_memo") return [{ label: "正文", before: "当前版本", after: "替换为新版本" }];
  return [{ label: "节点", before: "不存在", after: short(input?.title) }];
};

type ApprovalCardProps = {
  onApproval: (id: string, approved: boolean) => void;
  part: ToolPart;
};

export function ApprovalCard({ onApproval, part }: ApprovalCardProps) {
  if (!isToolUIPart(part) || part.state !== "approval-requested") return null;

  const rows = diffRows(part);
  const operation = normalizeAgentToolName(getToolName(part));
  const risk = operation === "edit_node" && record(part.input)?.op === "delete"
      ? "high"
      : operation.endsWith("trash_node")
      ? "high"
      : operation === "edit_node" && ["move", "reorder"].includes(String(record(part.input)?.op))
        ? "medium"
        : operation.endsWith("move_node") || operation.endsWith("reorder_node")
        ? "medium"
        : "low";
  const riskCopy = { high: "高", low: "低", medium: "中" }[risk];

  return (
    <Dialog
      density="compact"
      description={`风险：${riskCopy}。确认后才会继续执行；版本检查、回收站和撤销保护仍然生效。`}
      onOpenChange={(open) => { if (!open) onApproval(part.approval.id, false); }}
      open
      title="允许这次修改？"
    >
      <section className="agent-approval-dialog">
        <div className="agent-approval-dialog-intro"><ShieldWarningIcon size={17} /><span>助手正在等待你的决定，不会在后台重复尝试。</span></div>
        <table><thead><tr><th>项目</th><th>旧值</th><th>新值</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody></table>
        <footer>
          <Button onClick={() => onApproval(part.approval.id, false)} variant="ghost">拒绝</Button>
          <Button data-dialog-autofocus onClick={() => onApproval(part.approval.id, true)} variant="primary">允许一次</Button>
        </footer>
      </section>
    </Dialog>
  );
}
