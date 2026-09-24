/**
 * [INPUT]: 依赖 Bun 测试运行器、共享 Lucide 图标与基于工具 part 的展示适配器
 * [OUTPUT]: 验证读取快照支持执行中/失败动作的目标名、自然动作命名、安全详情、状态结果及未知协议不外露
 * [POS]: AgentPanel 工具 Message UI 的展示契约测试，防止协议名、UUID、正文或原始 JSON 回流界面
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, it } from "bun:test";
import {
  FolderOpenIcon,
  ToolboxIcon,
  TreeStructureIcon,
} from "../../shared/design-system/icons";

import {
  agentClientToolPresentation,
  getAgentToolPresentation,
  getAgentToolPresentations,
} from "./toolPresentation";

describe("agent tool presentation", () => {
  it("使用自然动作名称并保留相关图标", () => {
    expect(agentClientToolPresentation.read_tree).toEqual({
      icon: FolderOpenIcon,
      name: "查看现有内容",
    });
    expect(agentClientToolPresentation.move_node.icon).toBe(TreeStructureIcon);
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
      input: { op: "delete", node_id: "173b31e2-15ab-4eaf-8f14-2208d7d16b13" },
      state: "approval-requested",
    }).name).toBe("移入回收站");

    expect(getAgentToolPresentation("create_node", {
      input: { node_type: "memo", title: "读书" },
      state: "input-available",
    })).toMatchObject({
      details: [
        { label: "目标", value: "「读书」" },
      ],
      name: "创建笔记「读书」",
    });

    expect(getAgentToolPresentation("trash_node", {
      input: { node_id: "173b31e2-15ab-4eaf-8f14-2208d7d16b13" },
      output: { after_state: { node: { title: "旧笔记" } } },
      state: "output-available",
    }).name).toBe("移入回收站「旧笔记」");
  });

  it("拒绝审批后显示已取消，不伪装成继续执行", () => {
    expect(getAgentToolPresentation("edit_node", {
      approval: { approved: false },
      input: { op: "delete" },
      state: "approval-responded",
    }).details).toEqual([{ label: "状态", value: "操作已取消。" }]);
  });

  it("namespaced 服务端工具仍使用同一人话展示", () => {
    expect(getAgentToolPresentation("memo.rename_node", {
      input: { title: "路线图" },
      state: "input-available",
    }).name).toBe("重命名笔记「路线图」");
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

it("并发删除在执行中和失败后沿用本轮结构中的笔记名，历史回放无需活动树", () => {
  const parts = [
    { type: "dynamic-tool" as const, toolName: "read_tree", toolCallId: "tree", state: "output-available" as const, input: {}, output: { nodes: [
      { id: "a", title: "未命名备忘录 14" }, { id: "b", title: "未命名备忘录 13" },
    ] } },
    { type: "dynamic-tool" as const, toolName: "edit_node", toolCallId: "delete-a", state: "input-available" as const, input: { op: "delete", node_id: "a" } },
    { type: "dynamic-tool" as const, toolName: "edit_node", toolCallId: "delete-b", state: "output-error" as const, input: { op: "delete", node_id: "b" }, errorText: "失败" },
  ];
  const names = getAgentToolPresentations(parts);
  expect(names.get("delete-a")?.name).toBe("移入回收站「未命名备忘录 14」");
  expect(names.get("delete-b")?.name).toBe("移入回收站「未命名备忘录 13」");
});

it("失败命令仍可通过 before_state 命名，更新正文读取命令节点标题", () => {
  for (const tool of ["edit_node", "edit_memo"]) {
    expect(getAgentToolPresentation(tool, {
      input: { op: "delete" }, output: { before_state: { node: { title: "研究笔记" } } }, state: "output-error",
    }).name).toContain("研究笔记");
  }
});
