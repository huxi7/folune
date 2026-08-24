/**
 * [INPUT]: 依赖 authenticatedAgentFetch、chat /v1/explore raw 响应、explorationStore 的候选领域类型
 * [OUTPUT]: 对外提供 exploreMemo，发送 memo_id/selection 并校验错误信封，返回已复核的关联笔记列表
 * [POS]: AgentPanel 的 Chat explore HTTP 边界；只调用模型判定端点，是只读操作，不创建 Run、不写数据库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  ExplorationCandidate,
  ExplorationDropped,
} from "../../shared/store/explorationStore";
import { ChatRequestError } from "./chatFetch";
import { authenticatedAgentFetch, getExploreApiUrl } from "./chatTransport";

type ExploreMemoInput = {
  memoId: string;
  selection?: string | null;
  excludeNodeIds?: string[];
  limit?: number;
};

/**
 * 候选的领域形状住在 explorationStore——它是这些数据唯一的家，
 * 这里只负责把线上 JSON 交给它，绝不另立一套结构。
 */
export type ExploreRelatedMemo = ExplorationCandidate;

export type ExploreResult = {
  related: ExplorationCandidate[];
  /** 丢弃原因分布，只用于可观测性：判为不相关、引文对不上真实正文、模型没给出可用判断 */
  dropped: ExplorationDropped;
};

type ErrorPayload = { error?: { code?: unknown; message?: unknown } };

export const exploreMemo = async (
  input: ExploreMemoInput,
): Promise<ExploreResult> => {
  const response = await authenticatedAgentFetch(getExploreApiUrl(), {
    body: JSON.stringify({
      memo_id: input.memoId,
      selection: input.selection ?? null,
      exclude_node_ids: input.excludeNodeIds ?? [],
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ErrorPayload | null;
    throw new ChatRequestError(
      typeof payload?.error?.code === "string"
        ? payload.error.code
        : `HTTP_${response.status}`,
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "探索关联笔记失败。",
    );
  }
  return await response.json() as ExploreResult;
};
