/**
 * [INPUT]: 依赖 AgentPanel 工具协议、AI SDK 状态、locale 类型与共享 Lucide 图标
 * [OUTPUT]: 画布来源、关系、正文读取与引用核对使用人话名称； 对外提供基于本轮读取快照与真实 input/output 的人话动作名称、安全轻量详情、区分 SDK 回包与业务终态的 getAgentToolState 及未知工具中性回退
 * [POS]: AgentPanel 工具展示适配层，隔离协议载荷与 Message UI，禁止 UUID、正文、Token 和原始 JSON 进入界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { Locale } from "../../shared/locale";

import {
  ConfettiIcon,
  FileTextIcon,
  FolderOpenIcon,
  NotePencilIcon,
  ToolboxIcon,
  TreeStructureIcon,
  type Icon,
} from "../../shared/design-system/icons";

import type {
  ToolCallDetail,
  ToolCallState,
} from "../../shared/design-system/components";
type ToolPartLike = {
  approval?: { approved?: boolean };
  errorText?: string;
  input?: unknown;
  output?: unknown;
  state: ToolCallState;
};

export type AgentToolPresentation = {
  details: ToolCallDetail[];
  icon: Icon;
  name: string;
};

export const agentClientToolPresentation: Record<
  "celebration" | "create_node" | "edit_memo" | "edit_node" | "move_node" | "read_memo" | "read_tree" | "rename_node" | "reorder_node" | "trash_node",
  Pick<AgentToolPresentation, "icon" | "name">
> = {
  celebration: { icon: ConfettiIcon, name: "庆祝一下" },
  create_node: { icon: TreeStructureIcon, name: "创建笔记" },
  edit_memo: { icon: NotePencilIcon, name: "更新备忘录" },
  edit_node: { icon: TreeStructureIcon, name: "修改笔记库" },
  move_node: { icon: TreeStructureIcon, name: "移动笔记" },
  read_memo: { icon: FileTextIcon, name: "查看备忘录" },
  read_tree: { icon: FolderOpenIcon, name: "查看现有内容" },
  rename_node: { icon: NotePencilIcon, name: "重命名笔记" },
  reorder_node: { icon: TreeStructureIcon, name: "调整顺序" },
  trash_node: { icon: TreeStructureIcon, name: "移入回收站" },
};

const PRIVATE_DETAIL_PATTERN = /(?:\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|bearer|token|uuid|content_mdx|node_id|parent_id|toolcall|\{[\s\S]*\})/i;
const MAX_TITLE_LENGTH = 42;
const MAX_DETAIL_LENGTH = 140;
type Translate = (chinese: string, english: string) => string;
const englishToolNames: Record<keyof typeof agentClientToolPresentation, string> = {
  celebration: "Celebrate", create_node: "Create note", edit_memo: "Update note", edit_node: "Update library",
  move_node: "Move note", read_memo: "Read note", read_tree: "Read library", rename_node: "Rename note",
  reorder_node: "Reorder notes", trash_node: "Move to Trash",
};
export const englishToolStateLabels = {
  states: {
    queued: "Waiting", running: "Running", "input-streaming": "Preparing", "input-available": "Waiting",
    "approval-requested": "Awaiting approval", "approval-responded": "Waiting", "output-available": "Completed",
    "output-error": "Failed", "output-denied": "Canceled",
  },
  interrupted: "Incomplete", details: "View details",
} satisfies { states: Record<ToolCallState, string>; interrupted: string; details: string };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.replace(/\s+/g, " ").trim();

  if (!text || PRIVATE_DETAIL_PATTERN.test(text)) {
    return undefined;
  }

  return text.length > maxLength
    ? `${text.slice(0, maxLength - 1)}…`
    : text;
}

function readField(value: unknown, key: string) {
  return safeText(asRecord(value)?.[key], MAX_DETAIL_LENGTH);
}

function readTitle(value: unknown) {
  return safeText(asRecord(value)?.title, MAX_TITLE_LENGTH);
}

// SDK output-available 只说明工具有回包；命令终态才决定能否显示成功。
export function getAgentToolState(part: ToolPartLike): ToolCallState {
  if (part.state === "approval-responded" && part.approval?.approved === false) return "output-denied";
  const output = asRecord(part.output);
  if (part.state !== "output-available" || typeof output?.operation !== "string") return part.state;
  if (output.status === "failed" || output.status === "stale") return "output-error";
  if (output.status === "rejected" || output.status === "undone") return "output-denied";
  if (output.status === "pending_approval") return "approval-requested";
  if (output.status === "approved" || output.status === "executing") return "input-available";
  return part.state;
}

function resultDetails(
  part: ToolPartLike,
  successMessage: string,
  t: Translate,
): ToolCallDetail[] {
  if (part.state === "output-error") {
    return [{
      label: t("结果", "Result"),
      value: safeText(part.errorText, MAX_DETAIL_LENGTH)
        ?? t("操作没有完成，请重试。", "The operation did not finish. Please try again."),
    }];
  }

  if (part.state === "output-denied") {
    return [{ label: t("结果", "Result"), value: t("操作已取消。", "The operation was canceled.") }];
  }

  if (part.state === "approval-requested") {
    return [{ label: t("状态", "Status"), value: t("等待你的确认。", "Waiting for your approval.") }];
  }

  if (part.state === "approval-responded") {
    return [{
      label: t("状态", "Status"),
      value: part.approval?.approved === false
        ? t("操作已取消。", "The operation was canceled.")
        : t("已确认，正在继续。", "Approved. Continuing."),
    }];
  }

  if (part.state === "output-available") {
    return [{ label: t("结果", "Result"), value: successMessage }];
  }

  return [];
}

function withTarget(
  target: string | undefined,
  details: ToolCallDetail[],
  t: Translate,
): ToolCallDetail[] {
  return target ? [{ label: t("目标", "Target"), value: target }, ...details] : details;
}

export const normalizeAgentToolName = (toolName: string): string =>
  toolName.split(/[.:/]/u).at(-1) ?? toolName;

export function getAgentToolPresentation(
  toolName: string,
  part: ToolPartLike,
  targetTitle?: string,
  locale: Locale = "zh-CN",
): AgentToolPresentation {
  const t: Translate = (chinese, english) => locale === "en" ? english : chinese;
  const toolLabel = (name: keyof typeof agentClientToolPresentation) => t(agentClientToolPresentation[name].name, englishToolNames[name]);
  if (part.state === "output-available") part = { ...part, state: getAgentToolState(part) };
  toolName = normalizeAgentToolName(toolName);
  if (["list_sources", "read_relations", "read_text", "read_source", "cite_sources"].includes(toolName)) {
    const title = readTitle(part.output);
    const label = toolName === "list_sources" ? t("查看问答来源", "Read chat sources")
      : toolName === "read_relations" ? t("查看笔记关系", "Read connections")
      : toolName === "read_text" ? t("阅读画布文字", "Read canvas text")
      : toolName === "cite_sources" ? t("核对引用", "Verify citations")
      : title ? t(`阅读「${title}」`, `Read “${title}”`) : t("阅读笔记原文", "Read source note");
    return { icon: FileTextIcon, name: label, details: resultDetails(part, t("读取与核对已完成。", "Reading and verification completed."), t) };
  }
  if (toolName === "celebration") {
    const reason = readField(part.input, "reason");
    return {
      details: [
        ...(reason ? [{ label: t("原因", "Reason"), value: reason }] : []),
        ...resultDetails(part, t("庆祝效果已呈现。", "The celebration has been shown."), t),
      ],
      ...agentClientToolPresentation.celebration,
      name: toolLabel("celebration"),
    };
  }

  if (toolName === "read_tree") {
    return {
      details: [
        { label: t("范围", "Scope"), value: t("当前笔记库", "Current note library") },
        ...resultDetails(part, t("现有文件夹与备忘录已读取。", "Existing folders and notes have been read."), t),
      ],
      ...agentClientToolPresentation.read_tree,
      name: toolLabel("read_tree"),
    };
  }

  if (toolName === "read_memo") {
    const title = readTitle(part.output)
      ?? readTitle(asRecord(asRecord(part.output)?.after_state)?.node)
      ?? readTitle(asRecord(asRecord(part.output)?.before_state)?.node)
      ?? safeText(targetTitle, MAX_TITLE_LENGTH);
    return {
      details: withTarget(
        title ? `「${title}」` : undefined,
        resultDetails(part, t("备忘录内容已读取。", "The note has been read."), t), t,
      ),
      icon: agentClientToolPresentation.read_memo.icon,
      name: title ? t(`查看「${title}」`, `Read “${title}”`) : toolLabel("read_memo"),
    };
  }

  if (toolName === "edit_memo") {
    const title = readTitle(part.output)
      ?? readTitle(asRecord(asRecord(part.output)?.after_state)?.node)
      ?? readTitle(asRecord(asRecord(part.output)?.before_state)?.node)
      ?? safeText(targetTitle, MAX_TITLE_LENGTH);
    return {
      details: withTarget(
        title ? `「${title}」` : undefined,
        resultDetails(part, t("正文修改已保存。", "Changes to the note have been saved."), t), t,
      ),
      icon: agentClientToolPresentation.edit_memo.icon,
      name: title ? t(`更新「${title}」`, `Update “${title}”`) : toolLabel("edit_memo"),
    };
  }

  if (toolName === "edit_nodes") {
    const input = asRecord(part.input);
    const count = Array.isArray(input?.targets) ? input.targets.length : 0;
    if (!count) return { icon: TreeStructureIcon, name: t("准备批量操作", "Preparing batch changes"), details: [] };
    const action = input?.op === "delete" ? t("移入回收站", "Trash") : input?.op === "move" ? t("移动", "Move") : t("重命名", "Rename");
    return { icon: TreeStructureIcon, name: t(`${action} ${count} 篇备忘录`, `${action} ${count} notes`), details: [{ label: t("范围", "Scope"), value: t(`本次明确选定的 ${count} 篇备忘录`, `${count} explicitly selected notes`) }, ...resultDetails(part, t("批量处理已结束，请查看各项结果。", "Batch processing has ended. Review each result."), t)] };
  }
  if (toolName === "edit_node") {
    const input = asRecord(part.input);
    const output = asRecord(part.output);
    const op = readField(input, "op");
    const title = readTitle(input) ?? readTitle(asRecord(output?.after_state)?.node)
      ?? readTitle(asRecord(output?.before_state)?.node) ?? safeText(targetTitle, MAX_TITLE_LENGTH);
    const operation = op === "create" ? toolLabel("create_node")
      : op === "rename" ? toolLabel("rename_node")
      : op === "move" ? toolLabel("move_node")
      : op === "reorder" ? toolLabel("reorder_node")
      : op === "delete" ? toolLabel("trash_node")
      : toolLabel("edit_node");
    return {
      details: withTarget(title ? `「${title}」` : undefined, resultDetails(part, t("命令已安全执行。", "The operation completed."), t), t),
      icon: agentClientToolPresentation.edit_node.icon,
      name: title ? t(`${operation}「${title}」`, `${operation} “${title}”`) : operation,
    };
  }

  if (["create_node", "rename_node", "move_node", "reorder_node", "trash_node"].includes(toolName)) {
    const input = asRecord(part.input);
    const output = asRecord(part.output);
    const title = readTitle(input) ?? readTitle(asRecord(output?.after_state)?.node)
      ?? readTitle(asRecord(output?.before_state)?.node) ?? safeText(targetTitle, MAX_TITLE_LENGTH);
    const base = agentClientToolPresentation[toolName as keyof typeof agentClientToolPresentation];
    return {
      details: withTarget(title ? `「${title}」` : undefined, resultDetails(part, t("命令已安全执行。", "The operation completed."), t), t),
      icon: base.icon,
      name: title ? t(`${base.name}「${title}」`, `${toolLabel(toolName as keyof typeof agentClientToolPresentation)} “${title}”`) : toolLabel(toolName as keyof typeof agentClientToolPresentation),
    };
  }

  return {
    details: resultDetails(part, t("操作已完成。", "The operation completed."), t),
    icon: ToolboxIcon,
    name: t("执行操作", "Run operation"),
  };
}

// 已读取的结构随消息持久化；删除的乐观投影或失败不会抹掉动作名称。
// 单次顺序扫描，禁止为每个工具重新请求整棵树或扫描全部笔记。
export function getAgentToolPresentations(parts: UIMessage["parts"], locale: Locale = "zh-CN") {
  const titles = new Map<string, string>();
  const presentations = new Map<string, AgentToolPresentation>();
  const rememberNode = (value: unknown) => {
    const node = asRecord(value);
    const title = readTitle(node);
    if (typeof node?.id === "string" && title) titles.set(node.id, title);
  };
  for (const part of parts) {
    if (!isToolUIPart(part)) continue;
    const toolName = getToolName(part);
    const output = asRecord(part.output);
    if (normalizeAgentToolName(toolName) === "read_tree" && Array.isArray(output?.nodes)) {
      for (const node of output.nodes) rememberNode(node);
    }
    rememberNode(asRecord(output?.before_state)?.node);
    rememberNode(output);
    const input = asRecord(part.input);
    const targetId = input?.node_id ?? output?.target_node_id;
    presentations.set(part.toolCallId, getAgentToolPresentation(
      toolName, part, typeof targetId === "string" ? titles.get(targetId) : undefined, locale,
    ));
    rememberNode(asRecord(output?.after_state)?.node);
  }
  return presentations;
}
