/**
 * [INPUT]: 依赖 Mastra workflow/agent、organize-contracts、整理请求 prompt 与目标 memo/folder 投影
 * [OUTPUT]: 对外提供 organizeMemoWorkflow，产出已校验 OrganizePlan 和确定性 requires_confirmation
 * [POS]: workflows 子域 Planner 编排器，把模型语义判断与文件夹白名单/置信阈值策略串成无副作用计划；不持有 JWT、不写数据库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createStep, createWorkflow } from "@mastra/core/workflows";

import {
  assertPlanTargetsKnownFolders,
  organizePlannerInputSchema,
  organizeWorkflowOutputSchema,
  parseOrganizePlanText,
  requiresOrganizeConfirmation,
} from "@/lib/organize-contracts";
import { buildOrganizePlannerRequest } from "@/mastra/prompts/organize-planner";

const planOrganizeStep = createStep({
  id: "plan-organize-memo",
  description: "Generate and validate one title/folder plan without mutating data",
  inputSchema: organizePlannerInputSchema,
  outputSchema: organizeWorkflowOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("organize-planner-agent");
    const generation = await agent.generate(
      buildOrganizePlannerRequest(inputData),
      { modelSettings: { maxOutputTokens: 4_096 } },
    );
    const plan = parseOrganizePlanText(generation.text);
    assertPlanTargetsKnownFolders(plan, inputData.folders);

    return {
      plan,
      requires_confirmation: requiresOrganizeConfirmation(
        plan,
        inputData.auto_apply_confidence,
      ),
    };
  },
});

export const organizeMemoWorkflow = createWorkflow({
  id: "organize-memo-workflow",
  description: "Plan a memo title and folder, then classify confirmation risk",
  inputSchema: organizePlannerInputSchema,
  outputSchema: organizeWorkflowOutputSchema,
})
  .then(planOrganizeStep)
  .commit();
