/**
 * [INPUT]: 依赖 Mastra createTool、zod 与胖工具的 revision/操作约束
 * [OUTPUT]: 对外提供仅供模型选择的 read_tree/read_memo/edit_memo/edit_node 客户端工具工厂、写工具识别与稳定审批 key
 * [POS]: tools 子域的模型协议源；写审批由 chat 路由按请求裁决，细分 command 不暴露给模型，浏览器 Worker 规划后仍由 api 原子命令执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const titleSchema = z.string().trim().min(1).max(500);
const revisionSchema = z.number().int().positive();

const editNodeInputSchema = z.object({
  op: z.enum(["create", "rename", "move", "reorder", "delete"]),
  node_id: z.uuid().optional(),
  expected_revision: revisionSchema.optional(),
  node_type: z.enum(["folder", "memo"]).optional(),
  parent_id: z.uuid().nullable().optional(),
  title: titleSchema.optional(),
  content_mdx: z.string().optional(),
  reference_node_id: z.uuid().optional(),
  placement: z.enum(["before", "after"]).optional(),
}).strict().superRefine((input, context) => {
  const requireField = (field: keyof typeof input, message: string) => {
    if (input[field] === undefined) {
      context.addIssue({ code: "custom", message, path: [field] });
    }
  };
  if (input.op === "create") {
    requireField("node_type", "create 必须提供 node_type");
    requireField("title", "create 必须提供 title");
    if (input.node_type === "folder" && input.content_mdx !== undefined) {
      context.addIssue({ code: "custom", message: "创建文件夹不能提供正文", path: ["content_mdx"] });
    }
    return;
  }
  requireField("node_id", `${input.op} 必须提供 node_id`);
  requireField("expected_revision", `${input.op} 必须提供 expected_revision`);
  if (input.op === "rename") requireField("title", "rename 必须提供 title");
  if (input.op === "move") requireField("parent_id", "move 必须显式提供 parent_id，根目录使用 null");
  if (input.op === "reorder") {
    requireField("reference_node_id", "reorder 必须提供 reference_node_id");
    requireField("placement", "reorder 必须提供 placement");
    if (input.node_id === input.reference_node_id) {
      context.addIssue({ code: "custom", message: "参照节点不能是目标自身", path: ["reference_node_id"] });
    }
  }
});

export const createMemoClientTools = () => {
  const readTree = createTool({
    id: "read_tree",
    description: "读取浏览器当前 active 文件树快照。既有节点写操作前必须先调用，并原样使用 UUID 与 revision。",
    inputSchema: z.object({}).strict(),
  });
  const readMemo = createTool({
    id: "read_memo",
    description: "读取浏览器当前备忘录快照的完整正文与 revision。编辑正文前必须先调用。",
    inputSchema: z.object({ node_id: z.uuid() }).strict(),
  });
  const editMemo = createTool({
    id: "edit_memo",
    description: "用完整 Markdown 替换一条备忘录正文。必须携带 read_memo 返回的最新 expected_revision。",
    inputSchema: z.object({
      node_id: z.uuid(),
      expected_revision: revisionSchema,
      content_mdx: z.string(),
    }).strict(),
  });
  const editNode = createTool({
    id: "edit_node",
    description: "对单个树节点执行一次 create、rename、move、reorder 或 delete。非创建操作必须先 read_tree 并携带最新 revision；delete 始终是可撤销软删除。",
    inputSchema: editNodeInputSchema,
  });

  return {
    read_tree: readTree,
    read_memo: readMemo,
    edit_memo: editMemo,
    edit_node: editNode,
  };
};

export const memoClientTools = createMemoClientTools();

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
};

export const approvalDecisionKey = (
  toolName: string,
  args: Readonly<Record<string, unknown>>,
): string => JSON.stringify([toolName, stableValue(args)]);

export const WRITE_MEMO_TOOL_NAMES = new Set(["edit_node", "edit_memo"]);

export const resolveMemoWriteToolName = (toolName: string): string | null => {
  for (const candidate of WRITE_MEMO_TOOL_NAMES) {
    if (toolName === candidate
      || toolName.endsWith(`.${candidate}`)
      || toolName.endsWith(`:${candidate}`)
      || toolName.endsWith(`/${candidate}`)) return candidate;
  }
  return null;
};
