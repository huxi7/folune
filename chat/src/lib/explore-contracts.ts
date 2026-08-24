/**
 * [INPUT]: 依赖 zod 4 与 Business API 的候选/正文形状；不访问网络、不持有 JWT
 * [OUTPUT]: 对外提供 explore 输入/输出 schema、单篇判断的 parseExploreJudgementText、collectExploreResults 摘录复核与排序，以及 projectExploreInput 投影
 * [POS]: lib 层探索领域契约，与 organize-contracts 同构: 模型只给语义判断，凡是「模型声称的事实」都必须在此对着真实正文复核后才允许出站。判断粒度是「一篇候选一次」，因此模型无法指向候选之外的 node_id——这类幻觉在结构上被消灭，而非靠事后检查
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

/** api 混合召回返回的候选，正文不在其中——它按需单取 */
export const exploreCandidateSchema = z.object({
  node_id: z.uuid(),
  title: z.string(),
  excerpt: z.string().nullable(),
  revision: z.number().int().positive(),
  matched_channels: z.array(z.string()),
  rank: z.number().int().positive(),
});

export const exploreJudgeInputSchema = z.object({
  /** 用户选中的那段话，或整篇正文 */
  query_text: z.string().min(1),
  source_title: z.string(),
  candidates: z.array(z.object({
    node_id: z.uuid(),
    title: z.string(),
    revision: z.number().int().positive(),
    content_mdx: z.string(),
  })).min(1),
  /** 最终交给前端的条数上限 */
  keep_limit: z.number().int().min(1).max(12),
});

/**
 * 单篇候选的判断。刻意只要三件事: 留不留、为什么、引哪一句。
 * 不设 relation 枚举——让模型稳定判定「支持还是延伸」很难，判错用户一眼看出，信任当场崩。
 * 判否时只需要 keep=false: 让模型为它准备丢弃的候选编造理由和引文，既浪费输出预算，也在诱导它编造。
 */
export const exploreJudgementSchema = z.discriminatedUnion("keep", [
  z.object({ keep: z.literal(false) }),
  z.object({
    keep: z.literal(true),
    reason: z.string().trim().min(1).max(120),
    excerpt: z.string().trim().min(1).max(300),
    confidence: z.number().min(0).max(1),
  }),
]);

export const exploreRelatedSchema = z.object({
  node_id: z.uuid(),
  title: z.string(),
  revision: z.number().int().positive(),
  reason: z.string(),
  excerpt: z.string(),
  confidence: z.number(),
  matched_channels: z.array(z.string()),
});

export const exploreWorkflowOutputSchema = z.object({
  related: z.array(exploreRelatedSchema),
  /** 被丢弃的候选数与原因分布，供可观测性使用，不含正文 */
  dropped: z.object({
    judged_irrelevant: z.number().int().nonnegative(),
    judge_failed: z.number().int().nonnegative(),
    excerpt_not_found: z.number().int().nonnegative(),
  }),
});

export type ExploreCandidate = z.infer<typeof exploreCandidateSchema>;
export type ExploreJudgeInput = z.infer<typeof exploreJudgeInputSchema>;
/** 已取回正文的单篇候选，是「判断一篇」这个动作的完整输入 */
export type ExploreJudgeCandidate = ExploreJudgeInput["candidates"][number];
export type ExploreJudgement = z.infer<typeof exploreJudgementSchema>;
export type ExploreRelated = z.infer<typeof exploreRelatedSchema>;
export type ExploreWorkflowOutput = z.infer<typeof exploreWorkflowOutputSchema>;

const stripJsonFence = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1] ?? trimmed;
};

export const parseExploreJudgementText = (text: string): ExploreJudgement =>
  exploreJudgementSchema.parse(JSON.parse(stripJsonFence(text)));

/**
 * 归一化后做子串比对: 模型常在引文里改动空白、把直角引号换成别的、或补上省略号。
 * 只在这些噪声层面宽容，语义内容必须逐字来自真实正文。
 */
const normalizeForMatch = (text: string): string =>
  text
    .replace(/\s+/gu, "")
    .replace(/[「」『』“”"'‘’]/gu, "")
    .replace(/[…]/gu, "")
    .toLocaleLowerCase();

export type ExploreVerification = {
  related: ExploreRelated[];
  dropped: ExploreWorkflowOutput["dropped"];
};

/** 一次判断的结果；judgement 为 null 表示模型这一篇没给出可用判断（超预算或输出不合契约） */
export type ExploreJudgedCandidate = {
  candidate: ExploreJudgeCandidate;
  judgement: ExploreJudgement | null;
};

/**
 * 决断五的执行处: 模型声称的引文，必须在对应 revision 的真实正文里存在，否则整条候选丢弃。
 * 防的是编造引文——用户点开发现没这句话，信任当场归零。
 *
 * 判断逐篇独立，因此这里也只做逐篇裁决，最后按置信度排序取前 keep_limit 篇。
 * 排序发生在服务端而不是让模型「自己挑五篇」: 模型对一篇的把握是局部判断，跨篇的相对排序它给不稳，而置信度已经是可比的量。
 */
export const collectExploreResults = (
  judged: readonly ExploreJudgedCandidate[],
  channelsByNodeId: ReadonlyMap<string, string[]>,
  keepLimit: number,
): ExploreVerification => {
  const dropped = {
    excerpt_not_found: 0,
    judge_failed: 0,
    judged_irrelevant: 0,
  };
  // 召回名次只用于同置信度时的稳定排序，不出站，故与出站形状分开持有
  const kept: { recallRank: number; related: ExploreRelated }[] = [];

  judged.forEach(({ candidate, judgement }, recallRank) => {
    if (judgement === null) {
      dropped.judge_failed += 1;
      return;
    }
    if (!judgement.keep) {
      dropped.judged_irrelevant += 1;
      return;
    }
    if (!normalizeForMatch(candidate.content_mdx).includes(
      normalizeForMatch(judgement.excerpt),
    )) {
      dropped.excerpt_not_found += 1;
      return;
    }

    kept.push({
      recallRank,
      related: {
        confidence: judgement.confidence,
        excerpt: judgement.excerpt,
        matched_channels: channelsByNodeId.get(candidate.node_id) ?? [],
        node_id: candidate.node_id,
        reason: judgement.reason,
        revision: candidate.revision,
        title: candidate.title,
      },
    });
  });

  const related = kept
    .sort((left, right) =>
      right.related.confidence - left.related.confidence
      || left.recallRank - right.recallRank,
    )
    .slice(0, keepLimit)
    .map((item) => item.related);

  return { dropped, related };
};

/** 候选 revision 与实际取回正文的 revision 不一致时，以实际为准并原样带出，让前端能判断锚点是否漂移 */
export const projectExploreInput = (
  queryText: string,
  sourceTitle: string,
  candidates: readonly ExploreCandidate[],
  bodies: ReadonlyMap<string, { content_mdx: string; revision: number }>,
  keepLimit: number,
): ExploreJudgeInput | null => {
  const resolved = candidates.flatMap((candidate) => {
    const body = bodies.get(candidate.node_id);
    if (body === undefined || body.content_mdx.trim().length === 0) {
      return [];
    }
    return [{
      content_mdx: body.content_mdx,
      node_id: candidate.node_id,
      revision: body.revision,
      title: candidate.title,
    }];
  });

  if (resolved.length === 0) {
    return null;
  }

  return exploreJudgeInputSchema.parse({
    candidates: resolved,
    keep_limit: keepLimit,
    query_text: queryText,
    source_title: sourceTitle,
  });
};
