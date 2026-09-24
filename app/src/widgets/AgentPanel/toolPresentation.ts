/**
 * [INPUT]: 依赖 AgentPanel 客户端工具协议、AI SDK 工具状态与 共享 Lucide 极简图标
 * [OUTPUT]: 对外提供基于本轮读取快照与真实 input/output 的人话动作名称、安全轻量详情及未知工具中性回退
 * [POS]: AgentPanel 工具展示适配层，隔离协议载荷与 Message UI，禁止 UUID、正文、Token 和原始 JSON 进入界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getToolName, isToolUIPart, type UIMessage } from "ai";

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

function resultDetails(
  part: ToolPartLike,
  successMessage: string,
): ToolCallDetail[] {
  if (part.state === "output-error") {
    return [{
      label: "结果",
      value: safeText(part.errorText, MAX_DETAIL_LENGTH)
        ?? "操作没有完成，请重试。",
    }];
  }

  if (part.state === "output-denied") {
    return [{ label: "结果", value: "操作已取消。" }];
  }

  if (part.state === "approval-requested") {
    return [{ label: "状态", value: "等待你的确认。" }];
  }

  if (part.state === "approval-responded") {
    return [{
      label: "状态",
      value: part.approval?.approved === false
        ? "操作已取消。"
        : "已确认，正在继续。",
    }];
  }

  if (part.state === "output-available") {
    return [{ label: "结果", value: successMessage }];
  }

  return [];
}

function withTarget(
  target: string | undefined,
  details: ToolCallDetail[],
): ToolCallDetail[] {
  return target ? [{ label: "目标", value: target }, ...details] : details;
}

export const normalizeAgentToolName = (toolName: string): string =>
  toolName.split(/[.:/]/u).at(-1) ?? toolName;

export function getAgentToolPresentation(
  toolName: string,
  part: ToolPartLike,
  targetTitle?: string,
): AgentToolPresentation {
  toolName = normalizeAgentToolName(toolName);
  if (toolName === "celebration") {
    const reason = readField(part.input, "reason");
    return {
      details: [
        ...(reason ? [{ label: "原因", value: reason }] : []),
        ...resultDetails(part, "庆祝效果已呈现。"),
      ],
      ...agentClientToolPresentation.celebration,
    };
  }

  if (toolName === "read_tree") {
    return {
      details: [
        { label: "范围", value: "当前笔记库" },
        ...resultDetails(part, "现有文件夹与备忘录已读取。"),
      ],
      ...agentClientToolPresentation.read_tree,
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
        resultDetails(part, "备忘录内容已读取。"),
      ),
      icon: agentClientToolPresentation.read_memo.icon,
      name: title ? `查看「${title}」` : agentClientToolPresentation.read_memo.name,
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
        resultDetails(part, "正文修改已保存。"),
      ),
      icon: agentClientToolPresentation.edit_memo.icon,
      name: title ? `更新「${title}」` : agentClientToolPresentation.edit_memo.name,
    };
  }

  if (toolName === "edit_node") {
    const input = asRecord(part.input);
    const output = asRecord(part.output);
    const op = readField(input, "op");
    const title = readTitle(input) ?? readTitle(asRecord(output?.after_state)?.node)
      ?? readTitle(asRecord(output?.before_state)?.node) ?? safeText(targetTitle, MAX_TITLE_LENGTH);
    const operation = op === "create" ? "创建笔记"
      : op === "rename" ? "重命名笔记"
      : op === "move" ? "移动笔记"
      : op === "reorder" ? "调整顺序"
      : op === "delete" ? "移入回收站"
      : "修改笔记库";
    return {
      details: withTarget(title ? `「${title}」` : undefined, resultDetails(part, "命令已安全执行。")),
      icon: agentClientToolPresentation.edit_node.icon,
      name: title ? `${operation}「${title}」` : operation,
    };
  }

  if (["create_node", "rename_node", "move_node", "reorder_node", "trash_node"].includes(toolName)) {
    const input = asRecord(part.input);
    const output = asRecord(part.output);
    const title = readTitle(input) ?? readTitle(asRecord(output?.after_state)?.node)
      ?? readTitle(asRecord(output?.before_state)?.node) ?? safeText(targetTitle, MAX_TITLE_LENGTH);
    const base = agentClientToolPresentation[toolName as keyof typeof agentClientToolPresentation];
    return {
      details: withTarget(title ? `「${title}」` : undefined, resultDetails(part, "命令已安全执行。")),
      icon: base.icon,
      name: title ? `${base.name}「${title}」` : base.name,
    };
  }

  return {
    details: resultDetails(part, "操作已完成。"),
    icon: ToolboxIcon,
    name: "执行操作",
  };
}

// 已读取的结构随消息持久化；删除的乐观投影或失败不会抹掉动作名称。
// 单次顺序扫描，禁止为每个工具重新请求整棵树或扫描全部笔记。
export function getAgentToolPresentations(parts: UIMessage["parts"]) {
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
      toolName, part, typeof targetId === "string" ? titles.get(targetId) : undefined,
    ));
    rememberNode(asRecord(output?.after_state)?.node);
  }
  return presentations;
}
