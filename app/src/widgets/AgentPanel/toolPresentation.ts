/**
 * [INPUT]: 依赖 AgentPanel 客户端工具协议名与 Phosphor 极简图标
 * [OUTPUT]: 对外提供工具协议名到中文名称、相关图标的唯一展示映射及未知工具回退
 * [POS]: AgentPanel 的工具展示适配层，隔离执行注册表与 Message UI，避免业务执行逻辑携带视觉职责
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

import type { AgentClientToolName } from "./clientTools";

export type AgentToolPresentation = {
  icon: Icon;
  name: string;
};

export const agentClientToolPresentation: Record<
  AgentClientToolName,
  AgentToolPresentation
> = {
  celebration: { icon: ConfettiIcon, name: "庆祝" },
  edit_memo: { icon: NotePencilIcon, name: "编辑备忘录" },
  edit_node: { icon: TreeStructureIcon, name: "编辑文件树" },
  read_memo: { icon: FileTextIcon, name: "读取备忘录" },
  read_tree: { icon: FolderOpenIcon, name: "读取文件树" },
};

export const getAgentToolPresentation = (
  toolName: string,
): AgentToolPresentation =>
  Object.prototype.hasOwnProperty.call(agentClientToolPresentation, toolName)
    ? agentClientToolPresentation[toolName as AgentClientToolName]
    : { icon: ToolboxIcon, name: toolName };
