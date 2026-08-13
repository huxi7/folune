/**
 * [INPUT]: 依赖 zod，接收 Business API memo tree 与整理阈值
 * [OUTPUT]: 对外提供严格 OrganizePlan/PlannerInput schema、树投影与确定性确认策略
 * [POS]: lib 层整理领域契约，隔离模型输出与数据库命令，确保 Planner 只看目标正文和文件夹导航图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

export const organizeDestinationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("keep_current") }).strict(),
  z.object({ kind: z.literal("existing_folder"), folder_id: z.uuid() }).strict(),
  z.object({
    kind: z.literal("new_folder"),
    parent_id: z.uuid().nullable(),
    folder_title: z.string().trim().min(1).max(500),
  }).strict(),
]);

export const organizePlanSchema = z.object({
  suggested_title: z.string().trim().min(1).max(500),
  destination: organizeDestinationSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(2000),
}).strict();

export const organizeMemoInputSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content_mdx: z.string(),
  parent_id: z.uuid().nullable(),
  path: z.string(),
  revision: z.number().int().positive(),
}).strict();

export const organizeFolderInputSchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  title: z.string(),
  path: z.string(),
}).strict();

export const organizePlannerInputSchema = z.object({
  memo: organizeMemoInputSchema,
  folders: z.array(organizeFolderInputSchema),
  auto_apply_confidence: z.number().min(0).max(1),
}).strict();

export const organizeWorkflowOutputSchema = z.object({
  plan: organizePlanSchema,
  requires_confirmation: z.boolean(),
}).strict();

export type OrganizePlan = z.infer<typeof organizePlanSchema>;
export type OrganizePlannerInput = z.infer<typeof organizePlannerInputSchema>;

export type OrganizeTreeNode = {
  id: string;
  parent_id: string | null;
  node_type: "folder" | "memo";
  title: string;
  revision: number;
  children: OrganizeTreeNode[];
  memo: { content_mdx: string } | null;
};

const stripJsonFence = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1] ?? trimmed;
};

export const parseOrganizePlanText = (text: string): OrganizePlan =>
  organizePlanSchema.parse(JSON.parse(stripJsonFence(text)));

const joinPath = (parentPath: string, title: string): string =>
  `${parentPath}/${title}`.replace(/\/{2,}/g, "/");

export const projectOrganizeInput = (
  memoId: string,
  tree: readonly OrganizeTreeNode[],
  autoApplyConfidence: number,
): OrganizePlannerInput | null => {
  let target: OrganizePlannerInput["memo"] | null = null;
  const folders: OrganizePlannerInput["folders"] = [];

  const visit = (nodes: readonly OrganizeTreeNode[], parentPath: string): void => {
    for (const node of nodes) {
      const path = joinPath(parentPath, node.title);
      if (node.node_type === "folder") {
        folders.push({
          id: node.id,
          parent_id: node.parent_id,
          title: node.title,
          path,
        });
      } else if (node.id === memoId && node.memo !== null) {
        target = {
          id: node.id,
          title: node.title,
          content_mdx: node.memo.content_mdx,
          parent_id: node.parent_id,
          path,
          revision: node.revision,
        };
      }
      visit(node.children, path);
    }
  };

  visit(tree, "");
  return target === null
    ? null
    : organizePlannerInputSchema.parse({
        memo: target,
        folders,
        auto_apply_confidence: autoApplyConfidence,
      });
};

export const assertPlanTargetsKnownFolders = (
  plan: OrganizePlan,
  folders: readonly OrganizePlannerInput["folders"][number][],
): void => {
  const folderIds = new Set(folders.map((folder) => folder.id));
  if (
    plan.destination.kind === "existing_folder" &&
    !folderIds.has(plan.destination.folder_id)
  ) {
    throw new Error("Planner selected an unknown folder");
  }
  if (
    plan.destination.kind === "new_folder" &&
    plan.destination.parent_id !== null &&
    !folderIds.has(plan.destination.parent_id)
  ) {
    throw new Error("Planner selected an unknown folder parent");
  }
};

export const requiresOrganizeConfirmation = (
  plan: OrganizePlan,
  autoApplyConfidence: number,
): boolean =>
  plan.destination.kind === "new_folder" ||
  plan.confidence < autoApplyConfidence;
