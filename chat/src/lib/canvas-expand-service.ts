/**
 * [INPUT]: 依赖 Business API 的可信 Canvas context/正文/混合召回，以及既有 Explore Workflow 的逐篇判断与引文复核结果
 * [OUTPUT]: 对外提供 runCanvasExpansion：完整 checkpoint 短路、仅排除直接邻居的召回、可信 revision 候选与完成状态
 * [POS]: lib 层 Canvas AI 增量编排内核；浏览器参数只定位 Canvas 节点，正文和版本全部重取，函数本身不写数据库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

import {
  BusinessApiError,
  type CanvasExpansionContext,
  type RelatedHit,
} from "./business-api";
import {
  projectExploreInput,
  type ExploreJudgeInput,
  type ExploreWorkflowOutput,
} from "./explore-contracts";

const memoBodySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  revision: z.number().int().positive(),
  memo: z.object({ content_mdx: z.string() }),
});

export type CanvasExpandInput = {
  canvas_id: string;
  source_canvas_node_id: string;
  limit: number;
};

export type CanvasExpandResult =
  | {
      status: "up_to_date";
      request_id: string;
      source_revision: number;
      corpus_version: number;
    }
  | {
      status: "candidates";
      request_id: string;
      source_revision: number;
      corpus_version: number;
      completion_status: "complete";
      candidates: Array<{
        memo_id: string;
        revision: number;
        title: string;
        excerpt: string;
        reason: string;
        confidence: number;
      }>;
    };

type MemoBody = z.infer<typeof memoBodySchema>;

export type CanvasExpansionDependencies = {
  getContext(canvasId: string, sourceNodeId: string): Promise<CanvasExpansionContext>;
  getMemo(memoId: string): Promise<unknown>;
  judge(
    input: ExploreJudgeInput,
    channels: Readonly<Record<string, string[]>>,
  ): Promise<ExploreWorkflowOutput>;
  randomUUID(): string;
  search(input: {
    query_text: string;
    source_node_id: string;
    limit: number;
    exclude_node_ids: string[];
  }): Promise<RelatedHit[]>;
};

const checkpointIsCurrent = (context: CanvasExpansionContext): boolean =>
  context.checkpoint?.completion_status === "complete"
  && context.checkpoint.source_revision === context.source.revision
  && context.checkpoint.corpus_version === context.corpus_version;

const readMemo = async (
  dependencies: CanvasExpansionDependencies,
  memoId: string,
): Promise<MemoBody> => memoBodySchema.parse(await dependencies.getMemo(memoId));

export async function runCanvasExpansion(
  dependencies: CanvasExpansionDependencies,
  input: CanvasExpandInput,
): Promise<CanvasExpandResult> {
  const context = await dependencies.getContext(
    input.canvas_id,
    input.source_canvas_node_id,
  );
  if (checkpointIsCurrent(context)) {
    return {
      corpus_version: context.corpus_version,
      request_id: dependencies.randomUUID(),
      source_revision: context.source.revision,
      status: "up_to_date",
    };
  }

  const source = await readMemo(dependencies, context.source.memo_id);
  if (source.revision !== context.source.revision) {
    throw new BusinessApiError(
      409,
      "CANVAS_SOURCE_REVISION_CHANGED",
      "Source memo changed while expansion context was being resolved",
    );
  }
  const queryText = source.memo.content_mdx.trim();
  if (queryText.length === 0) {
    throw new BusinessApiError(422, "MEMO_EMPTY", "Empty memo cannot be expanded");
  }

  const candidates = await dependencies.search({
    exclude_node_ids: context.neighbor_memo_ids,
    limit: 12,
    query_text: queryText.slice(0, 2000),
    source_node_id: context.source.memo_id,
  });
  const requestId = dependencies.randomUUID();
  if (candidates.length === 0) {
    return {
      candidates: [],
      completion_status: "complete",
      corpus_version: context.corpus_version,
      request_id: requestId,
      source_revision: context.source.revision,
      status: "candidates",
    };
  }

  const bodies = new Map(
    await Promise.all(candidates.map(async (candidate) => {
      const memo = await readMemo(dependencies, candidate.node_id);
      return [
        candidate.node_id,
        { content_mdx: memo.memo.content_mdx, revision: memo.revision },
      ] as const;
    })),
  );
  const judgeInput = projectExploreInput(
    queryText,
    context.source.title,
    candidates,
    bodies,
    input.limit,
  );
  if (judgeInput === null) {
    return {
      candidates: [],
      completion_status: "complete",
      corpus_version: context.corpus_version,
      request_id: requestId,
      source_revision: context.source.revision,
      status: "candidates",
    };
  }

  const judged = await dependencies.judge(
    judgeInput,
    Object.fromEntries(candidates.map((candidate) => [
      candidate.node_id,
      candidate.matched_channels,
    ])),
  );
  if (judged.dropped.judge_failed > 0 || judged.dropped.excerpt_not_found > 0) {
    throw new BusinessApiError(
      502,
      "CANVAS_EXPANSION_INCOMPLETE",
      "At least one candidate could not be verified",
    );
  }

  return {
    candidates: judged.related.map((candidate) => ({
      confidence: candidate.confidence,
      excerpt: candidate.excerpt,
      memo_id: candidate.node_id,
      reason: candidate.reason,
      revision: candidate.revision,
      title: candidate.title,
    })),
    completion_status: "complete",
    corpus_version: context.corpus_version,
    request_id: requestId,
    source_revision: context.source.revision,
    status: "candidates",
  };
}
