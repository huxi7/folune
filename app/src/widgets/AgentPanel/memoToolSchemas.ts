/**
 * [INPUT]: 依赖 zod 的对象 schema、字段描述与条件校验能力
 * [OUTPUT]: 对外提供 read_tree/edit_node/read_memo/edit_memo/edit_nodes 客户端工具 schema、输入类型与 Planner 输出类型
 * [POS]: AgentPanel 胖工具协议源；与 chat 端模型工具保持同构，并把 revision 门禁带入纯 Planner plan
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const editNodesInputSchema = z.object({
  op: z.enum(["delete", "move", "rename"]),
  parent_id: z.uuid().nullable().optional(),
  targets: z.array(z.object({
    node_id: z.uuid(),
    expected_revision: z.number().int().positive(),
    title: z.string().trim().min(1).max(500).optional(),
  }).strict()).min(1).max(500),
}).strict().superRefine((input, context) => {
  if (new Set(input.targets.map((target) => target.node_id)).size !== input.targets.length) {
    context.addIssue({ code: "custom", message: "批量目标不能重复", path: ["targets"] });
  }
  if (input.op === "move" && input.parent_id === undefined) {
    context.addIssue({ code: "custom", message: "移动必须提供目标目录", path: ["parent_id"] });
  }
  if (input.op !== "move" && input.parent_id !== undefined) {
    context.addIssue({ code: "custom", message: "只有移动可以提供目标目录", path: ["parent_id"] });
  }
  input.targets.forEach((target, index) => {
    if ((input.op === "rename") !== (target.title !== undefined)) {
      context.addIssue({ code: "custom", message: "只有重命名必须提供每项目标标题", path: ["targets", index, "title"] });
    }
  });
});

export const editNodeOperationSchema = z
  .enum(["create", "rename", "move", "reorder", "delete"])
  .describe("本次唯一原子操作：创建、重命名、移动、同级重排或移入回收站");

export const editNodeInputSchema = z
  .object({
    op: editNodeOperationSchema,
    node_id: z
      .uuid()
      .optional()
      .describe("rename、move、reorder、delete 操作的目标节点 UUID"),
    expected_revision: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("非 create 操作从 read_tree 原样取得的目标节点 revision"),
    node_type: z
      .enum(["folder", "memo"])
      .optional()
      .describe("create 操作要创建的节点类型：文件夹或备忘录"),
    parent_id: z
      .uuid()
      .nullable()
      .optional()
      .describe("create 的父文件夹或 move 的目标文件夹 UUID；null 表示根目录"),
    title: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional()
      .describe("create 或 rename 使用的节点标题，必须忠实保留用户原意"),
    content_mdx: z
      .string()
      .optional()
      .describe("仅 create memo 可用的 Markdown 正文；创建文件夹时禁止传入"),
    reference_node_id: z
      .uuid()
      .optional()
      .describe("reorder 操作的同级参照节点 UUID，不能与 node_id 相同"),
    placement: z
      .enum(["before", "after"])
      .optional()
      .describe("reorder 操作把目标节点放在参照节点之前或之后"),
  })
  .strict()
  .superRefine((input, context) => {
    const requireField = (
      field: Exclude<keyof typeof input, "op">,
      message: string,
    ) => {
      if (input[field] === undefined) {
        context.addIssue({ code: "custom", message, path: [field] });
      }
    };

    if (input.op === "create") {
      requireField("node_type", "create 必须提供 node_type");
      requireField("title", "create 必须提供 title");

      if (input.node_type === "folder" && input.content_mdx !== undefined) {
        context.addIssue({
          code: "custom",
          message: "创建文件夹时不能提供 content_mdx",
          path: ["content_mdx"],
        });
      }
      return;
    }

    requireField("node_id", `${input.op} 必须提供 node_id`);
    requireField("expected_revision", `${input.op} 必须提供 expected_revision`);

    if (input.op === "rename") {
      requireField("title", "rename 必须提供 title");
      return;
    }

    if (input.op === "move") {
      requireField("parent_id", "move 必须显式提供 parent_id，根目录使用 null");
      return;
    }

    if (input.op === "reorder") {
      requireField("reference_node_id", "reorder 必须提供 reference_node_id");
      requireField("placement", "reorder 必须提供 placement");

      if (
        input.node_id !== undefined &&
        input.node_id === input.reference_node_id
      ) {
        context.addIssue({
          code: "custom",
          message: "reference_node_id 不能与 node_id 相同",
          path: ["reference_node_id"],
        });
      }
    }
  });

export const readTreeInputSchema = z.object({}).strict();

export const readMemoInputSchema = z
  .object({
    node_id: z.uuid().describe("要读取的 memo 节点 UUID"),
  })
  .strict();

export const editMemoInputSchema = z
  .object({
    node_id: z.uuid().describe("要编辑的 memo 节点 UUID"),
    expected_revision: z
      .number()
      .int()
      .positive()
      .describe("从 read_memo 原样取得的目标备忘录 revision"),
    content_mdx: z.string().describe("替换后的完整 Markdown 正文"),
  })
  .strict();

export const treeNodeOutputSchema = z.object({
  id: z.uuid().describe("节点 UUID，后续写操作必须原样使用"),
  node_type: z.enum(["folder", "memo"]).describe("节点类型"),
  title: z.string().describe("节点标题"),
  parent_id: z.uuid().nullable().describe("父文件夹 UUID；null 表示根目录"),
  sort_order: z.string().describe("同级稀疏排序值"),
  revision: z.number().int().positive().describe("节点当前版本"),
  depth: z.number().int().nonnegative().describe("节点在树中的深度，根节点为 0"),
  path: z.string().describe("从根目录到该节点的可读路径"),
});

export const readTreeOutputSchema = z.object({
  nodes: z.array(treeNodeOutputSchema).describe("按树顺序展开的全部 active 节点"),
  total: z.number().int().nonnegative().describe("active 节点总数"),
});

export const editNodeOutputSchema = z.object({
  success: z.literal(true).describe("操作已由业务 API 成功持久化"),
  op: editNodeOperationSchema,
  node_id: z.uuid().describe("本次被创建或修改的节点 UUID"),
  node_type: z
    .enum(["folder", "memo"])
    .optional()
    .describe("操作完成后的节点类型；删除时可省略"),
  parent_id: z
    .uuid()
    .nullable()
    .optional()
    .describe("操作完成后的父文件夹 UUID；根目录为 null"),
  title: z.string().optional().describe("操作完成后的节点标题"),
  message: z.string().describe("可供模型确认结果的简短事实说明"),
});

export const memoOutputSchema = z.object({
  id: z.uuid().describe("备忘录节点 UUID"),
  title: z.string().describe("备忘录标题"),
  parent_id: z.uuid().nullable().describe("父文件夹 UUID；null 表示根目录"),
  content_mdx: z.string().describe("完整 Markdown 正文"),
  updated_at: z.string().describe("服务端最近更新时间"),
  revision: z.number().int().positive().describe("备忘录当前版本"),
});

export const editMemoOutputSchema = memoOutputSchema.extend({
  success: z.literal(true).describe("正文已由业务 API 成功持久化"),
});

export type EditNodeInput = z.infer<typeof editNodeInputSchema>;
export type EditNodeOutput = z.infer<typeof editNodeOutputSchema>;
export type ReadMemoInput = z.infer<typeof readMemoInputSchema>;
export type EditMemoInput = z.infer<typeof editMemoInputSchema>;
export type MemoOutput = z.infer<typeof memoOutputSchema>;
export type ReadTreeOutput = z.infer<typeof readTreeOutputSchema>;
