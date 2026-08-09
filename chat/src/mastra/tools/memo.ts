/**
 * [INPUT]: 依赖 Mastra createTool 与 zod 的对象 schema、条件校验能力
 * [OUTPUT]: 对外提供 read_tree/edit_node/read_memo/edit_memo 四个无 execute 客户端工具契约及 edit_node 原子操作枚举
 * [POS]: tools 子域的备忘录树协议源；只向模型声明读写能力，真实 API 执行权留在 app 浏览器镜像
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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

const treeNodeSchema = z.object({
  id: z.uuid().describe("节点 UUID，后续写操作必须原样使用"),
  node_type: z.enum(["folder", "memo"]).describe("节点类型"),
  title: z.string().describe("节点标题"),
  parent_id: z.uuid().nullable().describe("父文件夹 UUID；null 表示根目录"),
  sort_order: z.string().describe("同级稀疏排序值"),
  depth: z.number().int().nonnegative().describe("节点在树中的深度，根节点为 0"),
  path: z.string().describe("从根目录到该节点的可读路径"),
});

const readTreeOutputSchema = z.object({
  nodes: z.array(treeNodeSchema).describe("按树顺序展开的全部 active 节点"),
  total: z.number().int().nonnegative().describe("active 节点总数"),
});

const editNodeOutputSchema = z.object({
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

const memoOutputSchema = z.object({
  id: z.uuid().describe("备忘录节点 UUID"),
  title: z.string().describe("备忘录标题"),
  parent_id: z.uuid().nullable().describe("父文件夹 UUID；null 表示根目录"),
  content_mdx: z.string().describe("完整 Markdown 正文"),
  updated_at: z.string().describe("服务端最近更新时间"),
});

export const readTreeTool = createTool({
  id: "read_tree",
  description:
    "读取当前用户完整的 active 文件夹+备忘录树。需要查找节点 UUID、判断现有分类或规划移动前先调用；返回按树顺序展开的全部节点，不包含正文。",
  inputSchema: z.object({}).strict(),
  outputSchema: readTreeOutputSchema,
});

export const editNodeTool = createTool({
  id: "edit_node",
  description:
    "对文件夹+备忘录同一棵树执行一个原子操作。op 只能是 create/rename/move/reorder/delete；一次调用只做一个动作，禁止 batch 或 operations 数组。除 create 外必须先用 read_tree 取得真实 UUID。",
  inputSchema: editNodeInputSchema,
  outputSchema: editNodeOutputSchema,
});

export const readMemoTool = createTool({
  id: "read_memo",
  description:
    "读取一条备忘录的完整标题和 Markdown 正文。编辑既有正文前必须先调用，并原样使用 read_tree 返回的 memo UUID。",
  inputSchema: z
    .object({
      node_id: z.uuid().describe("要读取的 memo 节点 UUID"),
    })
    .strict(),
  outputSchema: memoOutputSchema,
});

export const editMemoTool = createTool({
  id: "edit_memo",
  description:
    "用完整 Markdown 正文替换一条既有备忘录的正文。一次只编辑一个 memo；必须先 read_memo，忠实保留用户未要求改动的内容。标题和树结构改动使用 edit_node。",
  inputSchema: z
    .object({
      node_id: z.uuid().describe("要编辑的 memo 节点 UUID"),
      content_mdx: z.string().describe("替换后的完整 Markdown 正文"),
    })
    .strict(),
  outputSchema: memoOutputSchema.extend({
    success: z.literal(true).describe("正文已由业务 API 成功持久化"),
  }),
});

export const memoClientTools = {
  edit_memo: editMemoTool,
  edit_node: editNodeTool,
  read_memo: readMemoTool,
  read_tree: readTreeTool,
};
