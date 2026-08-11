/**
 * [INPUT]: 依赖 Bun 测试运行器、Phosphor 图标与基于工具 part 的展示适配器
 * [OUTPUT]: 验证自然动作命名、安全详情、状态结果及未知协议不外露
 * [POS]: AgentPanel 工具 Message UI 的展示契约测试，防止协议名、UUID、正文或原始 JSON 回流界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from "bun:test";
import {
  FolderOpenIcon,
  ToolboxIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react";

import {
  agentClientToolPresentation,
  getAgentToolPresentation,
} from "./toolPresentation";

describe("agent tool presentation", () => {
  it("使用自然动作名称并保留相关图标", () => {
    expect(agentClientToolPresentation.read_tree).toEqual({
      icon: FolderOpenIcon,
      name: "查看现有内容",
    });
    expect(agentClientToolPresentation.edit_node.icon).toBe(TreeStructureIcon);
  });

  it("用结果中的标题具体命名读取与更新动作", () => {
    const presentation = getAgentToolPresentation("read_memo", {
      input: { node_id: "173b31e2-15ab-4eaf-8f14-2208d7d16b13" },
      output: {
        content_mdx: "不会进入详情",
        id: "173b31e2-15ab-4eaf-8f14-2208d7d16b13",
        title: "订阅页说明",
      },
      state: "output-available",
    });

    expect(presentation.name).toBe("查看「订阅页说明」");
    expect(presentation.details).toEqual([
      { label: "目标", value: "「订阅页说明」" },
      { label: "结果", value: "备忘录内容已读取。" },
    ]);
    expect(JSON.stringify(presentation)).not.toContain("173b31e2");
    expect(JSON.stringify(presentation)).not.toContain("不会进入详情");
  });

  it("根据节点操作生成创建、移动与回收站名称", () => {
    expect(getAgentToolPresentation("edit_node", {
      input: { node_type: "memo", op: "create", title: "读书" },
      state: "input-available",
    })).toMatchObject({
      details: [
        { label: "目标", value: "「读书」" },
        { label: "类型", value: "备忘录" },
      ],
      name: "创建「读书」",
    });

    expect(getAgentToolPresentation("edit_node", {
      input: { node_id: "173b31e2-15ab-4eaf-8f14-2208d7d16b13", op: "delete" },
      output: { message: "已将「旧笔记」移入回收站。", op: "delete" },
      state: "output-available",
    }).name).toBe("将「旧笔记」移入回收站");
  });

  it("失败详情过滤协议字段，未知工具不显示协议名", () => {
    const presentation = getAgentToolPresentation("unknown_tool", {
      errorText: "node_id 173b31e2-15ab-4eaf-8f14-2208d7d16b13 无效",
      state: "output-error",
    });

    expect(presentation).toEqual({
      details: [{ label: "结果", value: "操作没有完成，请重试。" }],
      icon: ToolboxIcon,
      name: "执行操作",
    });
  });
});
