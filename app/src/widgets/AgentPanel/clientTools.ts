/**
 * [INPUT]: 依赖 @mastra/client-js createTool、zod 与浏览器庆祝执行器
 * [OUTPUT]: 对外提供 celebration、四个原子 memo 工具与 edit_nodes 批量工具的客户端注册表、字符串入参归一化、schema 校验与庆祝执行入口
 * [POS]: AgentPanel 客户端工具边界；memo 工具由纯 Planner 规划并交 api command，庆祝仍由浏览器视觉执行器直接完成
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createTool } from "@mastra/client-js";
import { z } from "zod";

import { playCelebration } from "./celebration";
import {
  editMemoInputSchema,
  editNodeInputSchema,
  editNodesInputSchema,
  readMemoInputSchema,
  readTreeInputSchema,
} from "./memoToolSchemas";

export function createAgentClientTools() {
  const celebration = createTool({
    id: "celebration",
    description: "庆祝工具。count 必须忠实等于用户要求的次数。",
    inputSchema: z.object({
      count: z.number().int().positive().default(1),
      reason: z.string().trim().min(1).max(80),
    }),
    outputSchema: z.object({
      durationMs: z.number().int().nonnegative(),
      particleCount: z.number().int().nonnegative(),
      reducedMotion: z.boolean(),
      renderedWaves: z.number().int().nonnegative(),
      requestedCount: z.number().int().positive(),
      success: z.literal(true),
    }),
    execute: async (input) => playCelebration(input.count),
  });

  const read_tree = createTool({
    id: "read_tree",
    description: "读取当前 active 文件树快照。",
    inputSchema: readTreeInputSchema,
  });
  const read_memo = createTool({
    id: "read_memo",
    description: "读取当前备忘录快照。",
    inputSchema: readMemoInputSchema,
  });
  const edit_node = createTool({
    id: "edit_node",
    description: "规划一次树节点创建、重命名、移动、重排或软删除。",
    inputSchema: editNodeInputSchema,
  });
  const edit_memo = createTool({
    id: "edit_memo",
    description: "规划一次备忘录正文替换。",
    inputSchema: editMemoInputSchema,
  });

  const edit_nodes = createTool({
    id: "edit_nodes",
    description: "对明确目标清单批量移动、重命名或软删除备忘录；每项独立执行并保留结果。",
    inputSchema: editNodesInputSchema,
  });

  return { edit_nodes, celebration, edit_memo, edit_node, read_memo, read_tree };
}

export type AgentClientTools = ReturnType<typeof createAgentClientTools>;
export type AgentClientToolName = keyof AgentClientTools;

export function normalizeToolInput(input: unknown): Record<string, unknown> {
  const normalized = typeof input === "string" ? JSON.parse(input) as unknown : input;
  if (typeof normalized !== "object" || normalized === null || Array.isArray(normalized)) {
    throw new TypeError("工具入参必须是 JSON object。");
  }
  return normalized as Record<string, unknown>;
}

export function isAgentClientToolName(
  tools: AgentClientTools,
  name: string,
): name is AgentClientToolName {
  return name in tools;
}

export type MemoClientToolName = "edit_memo" | "edit_node" | "read_memo" | "read_tree";

export const isMemoClientToolName = (name: string): name is MemoClientToolName =>
  name === "edit_memo" || name === "edit_node" || name === "read_memo" || name === "read_tree";

export const parseAgentClientToolInput = (
  tools: AgentClientTools,
  name: AgentClientToolName,
  input: Record<string, unknown>,
): unknown => {
  const schema = tools[name].inputSchema;
  if (!schema) throw new Error(`客户端工具 ${name} 没有输入 schema。`);
  return schema.parse(input);
};

export async function executeAgentClientTool(
  tools: AgentClientTools,
  name: AgentClientToolName,
  input: Record<string, unknown>,
): Promise<unknown> {
  const parsed = parseAgentClientToolInput(tools, name, input);
  if (name !== "celebration") {
    throw new Error(`客户端 memo 工具 ${name} 必须通过纯 Planner 规划。`);
  }
  return tools.celebration.execute!(
    parsed as { count: number; reason: string },
    {} as never,
  );
}
