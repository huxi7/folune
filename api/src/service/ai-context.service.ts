/**
 * [INPUT]: 依赖可信 AuthUser、请求期 JWT、resolve DTO、AI/memo repositories 与 MemoNode/MemoContent
 * [OUTPUT]: 对外提供服务端可信的 primary/references 正文、路径、revision 与失效引用解析结果
 * [POS]: service 层 AI 上下文边界，按本轮冻结当前笔记、显式引用、会话置顶引用的顺序分配字符预算，正文只作为数据返回给 chat
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type { ResolveAiContextInput } from "../dto/ai.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  ResolvedAiContext,
  ResolvedMemoContext,
} from "../model/ai.model.ts";
import type { MemoContent, MemoNode } from "../model/memo.model.ts";
import { aiRepository } from "../repository/ai.repository.ts";
import { memoRepository } from "../repository/memo.repository.ts";

const MAX_CONTEXT_CHARACTERS = 60_000;

const memoPath = (
  node: MemoNode,
  nodesById: ReadonlyMap<string, MemoNode>,
): string => {
  const parts: string[] = [node.title];
  const visited = new Set([node.id]);
  let parentId = node.parent_id;
  while (parentId !== null) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = nodesById.get(parentId);
    if (parent === undefined) break;
    parts.push(parent.title);
    parentId = parent.parent_id;
  }
  return `/${parts.reverse().join("/")}`;
};

const allocateContext = (
  node: MemoNode,
  content: MemoContent,
  nodesById: ReadonlyMap<string, MemoNode>,
  remaining: number,
): { context: ResolvedMemoContext; remaining: number } => {
  const characters = Array.from(content.content_mdx);
  const included = characters.slice(0, Math.max(0, remaining));
  return {
    context: {
      memo_id: node.id,
      title: node.title,
      content_mdx: included.join(""),
      path: memoPath(node, nodesById),
      revision: node.revision,
      updated_at: node.updated_at,
      truncated: included.length < characters.length,
    },
    remaining: Math.max(0, remaining - included.length),
  };
};

export const aiContextService = {
  async resolve(
    authUser: AuthUser,
    accessToken: string,
    input: ResolveAiContextInput,
  ): Promise<ResolvedAiContext> {
    const thread = await aiRepository.findThread(
      authUser.id,
      input.thread_id,
      accessToken,
    );
    if (thread === null) {
      throw new HttpError(404, "AI_THREAD_NOT_FOUND", "AI thread was not found");
    }

    const [nodes, references] = await Promise.all([
      memoRepository.listActiveNodes(authUser.id, accessToken),
      aiRepository.listReferences(authUser.id, input.thread_id, accessToken),
    ]);
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    // 当前笔记已收敛为 Composer 的默认 @引用；本轮显式 ID 一经发送，
    // 不能再被随后发生的页面切换或会话偏好改写。
    const primaryNode = input.active_memo_id !== null
      ? nodesById.get(input.active_memo_id) ?? null
      : null;
    const selectedReferenceNodes: MemoNode[] = [];
    const missingReferenceIds: string[] = [];

    const referenceIds = [
      ...input.reference_memo_ids,
      ...(input.include_thread_references
        ? references.map((reference) => reference.memo_id)
        : []),
    ];

    for (const referenceId of referenceIds) {
      if (referenceId === primaryNode?.id) continue;
      if (selectedReferenceNodes.some((node) => node.id === referenceId)) continue;
      const node = nodesById.get(referenceId);
      if (node === undefined || node.node_type !== "memo") {
        missingReferenceIds.push(referenceId);
      } else {
        selectedReferenceNodes.push(node);
      }
    }

    const selectedNodes = [
      ...(primaryNode?.node_type === "memo" ? [primaryNode] : []),
      ...selectedReferenceNodes,
    ];
    const changedNode = selectedNodes.find((node) => {
      const expectedRevision = input.expected_revisions[node.id];
      return expectedRevision !== undefined && node.revision !== expectedRevision;
    });
    if (changedNode !== undefined) {
      throw new HttpError(
        409,
        "AI_CONTEXT_STALE",
        "One or more frozen memo revisions changed after the message was sent",
      );
    }
    const contents = await memoRepository.listContents(
      authUser.id,
      accessToken,
      selectedNodes.map((node) => node.id),
    );
    const contentsById = new Map(contents.map((content) => [content.node_id, content]));
    let remaining = MAX_CONTEXT_CHARACTERS;
    let primary: ResolvedMemoContext | null = null;
    const resolvedReferences: ResolvedMemoContext[] = [];

    for (const node of selectedNodes) {
      const content = contentsById.get(node.id);
      if (content === undefined) {
        if (node.id !== primaryNode?.id) missingReferenceIds.push(node.id);
        continue;
      }
      const allocated = allocateContext(node, content, nodesById, remaining);
      remaining = allocated.remaining;
      if (node.id === primaryNode?.id) primary = allocated.context;
      else resolvedReferences.push(allocated.context);
    }

    return {
      primary,
      references: resolvedReferences,
      missing_reference_ids: [...new Set(missingReferenceIds)],
    };
  },
};
