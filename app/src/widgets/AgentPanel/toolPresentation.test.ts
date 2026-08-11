/**
 * [INPUT]: 依赖 Bun 测试运行器、Phosphor 图标与工具展示映射
 * [OUTPUT]: 验证全部客户端工具拥有稳定名称/图标，并锁定未知工具的中性回退
 * [POS]: AgentPanel 工具 Message UI 的展示契约测试，防止新增工具重新退化为无关通用图标
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from "bun:test";
import {
  ConfettiIcon,
  FileTextIcon,
  FolderOpenIcon,
  NotePencilIcon,
  ToolboxIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react";

import {
  agentClientToolPresentation,
  getAgentToolPresentation,
} from "./toolPresentation";

describe("agent tool presentation", () => {
  it("为每个客户端工具提供相关的名称与图标", () => {
    expect(agentClientToolPresentation).toEqual({
      celebration: { icon: ConfettiIcon, name: "庆祝" },
      edit_memo: { icon: NotePencilIcon, name: "编辑备忘录" },
      edit_node: { icon: TreeStructureIcon, name: "编辑文件树" },
      read_memo: { icon: FileTextIcon, name: "读取备忘录" },
      read_tree: { icon: FolderOpenIcon, name: "读取文件树" },
    });
  });

  it("未知工具使用中性工具箱图标且保留协议名", () => {
    expect(getAgentToolPresentation("unknown_tool")).toEqual({
      icon: ToolboxIcon,
      name: "unknown_tool",
    });
  });
});
