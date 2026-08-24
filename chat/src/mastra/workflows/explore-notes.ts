/**
 * [INPUT]: 依赖 Mastra workflow/agent、explore-contracts 的单篇判断解析与摘录复核、explore 单篇请求构造器
 * [OUTPUT]: 对外提供 exploreNotesWorkflow，产出已复核并按把握排序的关联结果与丢弃计数
 * [POS]: workflows 子域探索编排器；一篇候选一次判断并行执行，故单篇失败只丢那一篇。凡模型声称的引文都在此对着真实正文复核后才允许出站。不持有 JWT、不写数据库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import {
  collectExploreResults,
  exploreJudgeInputSchema,
  exploreWorkflowOutputSchema,
  parseExploreJudgementText,
  type ExploreJudgeCandidate,
  type ExploreJudgement,
} from "@/lib/explore-contracts";
import { buildExploreRequest } from "@/mastra/prompts/explore";

/** 命中通道来自数据库召回，与模型判断无关，故单独随输入透传 */
const exploreStepInputSchema = exploreJudgeInputSchema.extend({
  matched_channels: z.record(z.string(), z.array(z.string())),
});

/**
 * 单篇判断的输出预算。判断本身只有四个字段，但模型会先思考——推理与正文共享同一预算，
 * 预算给小了就会出现「思考塞满、正文为空」的静默失败，因此这里按「够它把一篇想完」给。
 */
const JUDGE_OUTPUT_TOKENS = 16_384;

const judgeRelatedStep = createStep({
  id: "judge-related-notes",
  description: "Judge each candidate on its own, then verify every claimed excerpt against the real body",
  inputSchema: exploreStepInputSchema,
  outputSchema: exploreWorkflowOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("explore-agent");
    const logger = mastra.getLogger();

    /** 一篇判不出来不该拖垮整次探索，故失败在此收敛为 null 而不是抛出 */
    const judgeOne = async (
      candidate: ExploreJudgeCandidate,
    ): Promise<ExploreJudgement | null> => {
      try {
        const generation = await agent.generate(
          buildExploreRequest({
            candidate,
            query_text: inputData.query_text,
            source_title: inputData.source_title,
          }),
          { modelSettings: { maxOutputTokens: JUDGE_OUTPUT_TOKENS } },
        );

        if (generation.finishReason === "length") {
          // 只记形状不记内容: 笔记正文不得进日志
          logger?.warn("Explore judgement truncated by output budget", {
            finishReason: generation.finishReason,
            outputTokens: generation.usage?.outputTokens,
            reasoningTokens: generation.usage?.reasoningTokens,
          });
          return null;
        }

        return parseExploreJudgementText(generation.text);
      } catch (error) {
        logger?.warn("Explore judgement unusable", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        return null;
      }
    };

    const judged = await Promise.all(
      inputData.candidates.map(async (candidate) => ({
        candidate,
        judgement: await judgeOne(candidate),
      })),
    );

    return collectExploreResults(
      judged,
      new Map(Object.entries(inputData.matched_channels)),
      inputData.keep_limit,
    );
  },
});

export const exploreNotesWorkflow = createWorkflow({
  id: "explore-notes-workflow",
  description: "Judge each retrieved candidate independently and keep only those whose excerpt is verifiable",
  inputSchema: exploreStepInputSchema,
  outputSchema: exploreWorkflowOutputSchema,
})
  .then(judgeRelatedStep)
  .commit();
