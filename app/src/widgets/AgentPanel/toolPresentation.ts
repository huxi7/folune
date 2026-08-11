/**
 * [INPUT]: 依赖 AgentPanel 客户端工具协议、AI SDK 工具状态与 Phosphor 极简图标
 * [OUTPUT]: 对外提供基于真实 input/output 的人话动作名称、安全轻量详情及未知工具中性回退
 * [POS]: AgentPanel 工具展示适配层，隔离协议载荷与 Message UI，禁止 UUID、正文、Token 和原始 JSON 进入界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ConfettiIcon,
  FileTextIcon,
  FolderOpenIcon,
  NotePencilIcon,
  ToolboxIcon,
  TreeStructureIcon,
  type Icon,
} from "@phosphor-icons/react";

import type {
  ToolCallDetail,
  ToolCallState,
} from "../../shared/design-system/components";
import type { AgentClientToolName } from "./clientTools";

type ToolPartLike = {
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
  AgentClientToolName,
  Pick<AgentToolPresentation, "icon" | "name">
> = {
  celebration: { icon: ConfettiIcon, name: "庆祝一下" },
  edit_memo: { icon: NotePencilIcon, name: "更新备忘录" },
  edit_node: { icon: TreeStructureIcon, name: "整理笔记" },
  read_memo: { icon: FileTextIcon, name: "查看备忘录" },
  read_tree: { icon: FolderOpenIcon, name: "查看现有内容" },
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

function quotedTitle(value: unknown) {
  const message = safeText(value, MAX_DETAIL_LENGTH);
  const match = message?.match(/「([^」]+)」/);
  return safeText(match?.[1], MAX_TITLE_LENGTH);
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
    return [{ label: "状态", value: "已确认，正在继续。" }];
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

function editNodePresentation(part: ToolPartLike): AgentToolPresentation {
  const input = asRecord(part.input);
  const output = asRecord(part.output);
  const op = readField(output, "op") ?? readField(input, "op");
  const message = readField(output, "message");
  const title = readTitle(output)
    ?? readTitle(input)
    ?? quotedTitle(output?.message);
  const target = title ? `「${title}」` : undefined;
  const name = (() => {
    if (op === "create") return title ? `创建「${title}」` : "创建内容";
    if (op === "rename") return title ? `重命名为「${title}」` : "重命名";
    if (op === "move") return title ? `移动「${title}」` : "调整位置";
    if (op === "reorder") return title ? `调整「${title}」的顺序` : "调整顺序";
    if (op === "delete") return title ? `将「${title}」移入回收站` : "移入回收站";
    return agentClientToolPresentation.edit_node.name;
  })();
  const details = withTarget(
    target,
    resultDetails(part, message ?? "更改已保存。"),
  );
  const nodeType = readField(input, "node_type");

  if (op === "create" && nodeType) {
    details.splice(target ? 1 : 0, 0, {
      label: "类型",
      value: nodeType === "folder" ? "文件夹" : "备忘录",
    });
  }

  if (op === "reorder") {
    const placement = readField(input, "placement");

    if (placement) {
      details.splice(target ? 1 : 0, 0, {
        label: "位置",
        value: placement === "before" ? "参照内容之前" : "参照内容之后",
      });
    }
  }

  return {
    details,
    icon: agentClientToolPresentation.edit_node.icon,
    name,
  };
}

export function getAgentToolPresentation(
  toolName: string,
  part: ToolPartLike,
): AgentToolPresentation {
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
    const title = readTitle(part.output);
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
    const title = readTitle(part.output);
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
    return editNodePresentation(part);
  }

  return {
    details: resultDetails(part, "操作已完成。"),
    icon: ToolboxIcon,
    name: "执行操作",
  };
}
