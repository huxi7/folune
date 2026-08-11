/**
 * [INPUT]: 依赖 @mastra/client-js createTool、memoTool Worker 单步计划、现有 MemoTree Store 乐观命令、独立庆祝执行器与 Dashboard 草稿/删除协调回调
 * [OUTPUT]: 对外提供同 chat id/schema 且带 execute 的浏览器工具注册表、工具协议名类型、忠实传递庆祝 count、字符串入参归一化与显式工具执行入口
 * [POS]: AgentPanel 客户端工具执行总线；庆祝直达视觉执行器，只有备忘录工具进入 Worker 规划后再复用真人操作同款 Store/API/FLIP 链路
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createTool } from "@mastra/client-js";
import { z } from "zod";

import type { MemoTreeNode } from "../../shared/api/memo";
import { findNode } from "../../shared/store/memoTree";
import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import { playCelebration } from "./celebration";
import type { MemoToolPlan } from "./memoToolPlanner";
import {
  editMemoInputSchema,
  editMemoOutputSchema,
  editNodeInputSchema,
  editNodeOutputSchema,
  memoOutputSchema,
  readMemoInputSchema,
  readTreeInputSchema,
  readTreeOutputSchema,
  type EditNodeOutput,
  type MemoOutput,
} from "./memoToolSchemas";
import { requestMemoToolPlan } from "./memoToolWorkerClient";

export type MemoClientToolRuntime = {
  accessToken: string;
  deleteNode: (nodeId: string) => Promise<void>;
  editMemo: (nodeId: string, contentMdx: string) => Promise<MemoTreeNode>;
  prepareMutation: () => Promise<void>;
};

let mutationQueue: Promise<void> = Promise.resolve();

const enqueueMutation = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = mutationQueue.catch(() => undefined).then(operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const memoOutput = (node: MemoTreeNode): MemoOutput => {
  if (node.node_type !== "memo" || node.memo === null) {
    throw new Error("工具执行后没有得到有效的备忘录。");
  }

  return {
    content_mdx: node.memo.content_mdx,
    id: node.id,
    parent_id: node.parent_id,
    title: node.title,
    updated_at: node.memo.updated_at,
  };
};

const editNodeOutput = (
  op: EditNodeOutput["op"],
  node: MemoTreeNode,
  message: string,
): EditNodeOutput => ({
  message,
  node_id: node.id,
  node_type: node.node_type,
  op,
  parent_id: node.parent_id,
  success: true,
  title: node.title,
});

const requireStoredNode = (nodeId: string): MemoTreeNode => {
  const node = findNode(useMemoTreeStore.getState().nodes, nodeId);

  if (node === null) {
    throw new Error("API 已返回，但更新后的节点未出现在 active tree 中。");
  }

  return node;
};

const executeEditNodePlan = async (
  plan: MemoToolPlan,
  runtime: MemoClientToolRuntime,
): Promise<EditNodeOutput> => {
  const store = useMemoTreeStore.getState();

  if (plan.kind === "create_folder") {
    const created = await store.createFolder(runtime.accessToken, plan.input);
    return editNodeOutput("create", created, `已创建文件夹「${created.title}」。`);
  }

  if (plan.kind === "create_memo") {
    const created = await store.createMemo(runtime.accessToken, plan.input);
    return editNodeOutput("create", created, `已创建备忘录「${created.title}」。`);
  }

  if (plan.kind === "rename_node") {
    const updated = await store.renameNode(
      runtime.accessToken,
      plan.nodeId,
      plan.title,
    );
    return editNodeOutput("rename", updated, `已重命名为「${updated.title}」。`);
  }

  if (plan.kind === "move_node") {
    await store.moveNode(runtime.accessToken, plan.nodeId, plan.input);
    const updated = requireStoredNode(plan.nodeId);
    const verb = plan.op === "move" ? "移动" : "重排";
    return editNodeOutput(plan.op, updated, `已${verb}「${updated.title}」。`);
  }

  if (plan.kind === "delete_node") {
    const deleted = requireStoredNode(plan.nodeId);
    await runtime.deleteNode(plan.nodeId);

    return {
      message: `已将「${deleted.title}」移入回收站。`,
      node_id: deleted.id,
      op: "delete",
      success: true,
    };
  }

  throw new Error("Worker 返回了与 edit_node 不匹配的计划。");
};

export function createAgentClientTools(runtime: MemoClientToolRuntime) {
  const celebration = createTool({
    id: "celebration",
    description:
      "庆祝工具。count 必须忠实等于用户要求的次数，例如‘庆祝10次’必须传 10。",
    inputSchema: z.object({
      count: z
        .number()
        .int()
        .positive()
        .default(1)
        .describe("用户要求的庆祝次数；未指定次数时为 1"),
      reason: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .describe("本次庆祝的简短原因，只陈述用户已经提供的事实"),
    }),
    outputSchema: z.object({
      durationMs: z.number().int().nonnegative().describe("动画实际持续毫秒数"),
      particleCount: z.number().int().nonnegative().describe("实际粒子数量"),
      reducedMotion: z.boolean().describe("是否尊重系统减少动态效果偏好"),
      renderedWaves: z.number().int().nonnegative().describe("实际视觉波次数量"),
      requestedCount: z.number().int().positive().describe("用户要求的庆祝次数"),
      success: z.literal(true).describe("浏览器已完成庆祝执行"),
    }),
    execute: async (input) => playCelebration(input.count),
  });

  const readTree = createTool({
    id: "read_tree",
    description: "读取当前用户完整的 active 文件夹+备忘录树。",
    inputSchema: readTreeInputSchema,
    outputSchema: readTreeOutputSchema,
    execute: async (input) => {
      await mutationQueue;
      const plan = await requestMemoToolPlan("read_tree", input);

      if (plan.kind !== "read_tree") {
        throw new Error("Worker 返回了与 read_tree 不匹配的计划。");
      }

      return plan.output;
    },
  });

  const editNode = createTool({
    id: "edit_node",
    description: "对文件夹+备忘录同一棵树执行一个原子操作。",
    inputSchema: editNodeInputSchema,
    outputSchema: editNodeOutputSchema,
    execute: async (input) =>
      enqueueMutation(async () => {
        await runtime.prepareMutation();
        const plan = await requestMemoToolPlan("edit_node", input);
        return executeEditNodePlan(plan, runtime);
      }),
  });

  const readMemo = createTool({
    id: "read_memo",
    description: "读取一条备忘录的完整标题和 Markdown 正文。",
    inputSchema: readMemoInputSchema,
    outputSchema: memoOutputSchema,
    execute: async (input) => {
      await mutationQueue;
      const plan = await requestMemoToolPlan("read_memo", input);

      if (plan.kind !== "read_memo") {
        throw new Error("Worker 返回了与 read_memo 不匹配的计划。");
      }

      return plan.output;
    },
  });

  const editMemo = createTool({
    id: "edit_memo",
    description: "用完整 Markdown 正文替换一条既有备忘录的正文。",
    inputSchema: editMemoInputSchema,
    outputSchema: editMemoOutputSchema,
    execute: async (input) =>
      enqueueMutation(async () => {
        await runtime.prepareMutation();
        const plan = await requestMemoToolPlan("edit_memo", input);

        if (plan.kind !== "edit_memo") {
          throw new Error("Worker 返回了与 edit_memo 不匹配的计划。");
        }

        const updated = await runtime.editMemo(plan.nodeId, plan.contentMdx);
        return { ...memoOutput(updated), success: true as const };
      }),
  });

  return {
    celebration,
    edit_memo: editMemo,
    edit_node: editNode,
    read_memo: readMemo,
    read_tree: readTree,
  };
}

export type AgentClientTools = ReturnType<typeof createAgentClientTools>;
export type AgentClientToolName = keyof AgentClientTools;

export function normalizeToolInput(input: unknown): Record<string, unknown> {
  const normalized = typeof input === "string"
    ? JSON.parse(input) as unknown
    : input;

  if (
    typeof normalized !== "object" ||
    normalized === null ||
    Array.isArray(normalized)
  ) {
    throw new TypeError("工具入参必须是 JSON object。");
  }

  return normalized as Record<string, unknown>;
}

export function isAgentClientToolName(
  tools: AgentClientTools,
  name: string,
): name is AgentClientToolName {
  return Object.prototype.hasOwnProperty.call(tools, name);
}

export async function executeAgentClientTool(
  tools: AgentClientTools,
  name: AgentClientToolName,
  input: Record<string, unknown>,
): Promise<unknown> {
  const tool = tools[name];
  const parsedInput = tool.inputSchema?.parse(input) ?? input;

  if (tool.execute === undefined) {
    throw new Error(`客户端工具 ${name} 缺少 execute。`);
  }

  const output = await tool.execute(parsedInput as never, {} as never);
  return tool.outputSchema?.parse(output) ?? output;
}
