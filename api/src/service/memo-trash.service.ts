/**
 * [INPUT]: 依赖可信 AuthUser、请求期 access token、memo repository 的 owner-scoped 表查询与原子回收站 RPC
 * [OUTPUT]: 对外提供顶层回收站列表、递归软删除、永久删除与当前用户原子清空用例
 * [POS]: service 层回收站业务边界，解释删除批次/已删除祖先可见性并把 RPC 状态收敛为稳定 HTTP 业务错误
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  MemoNode,
  MemoTrashClearResult,
  MemoTrashItem,
  MemoTrashMutation,
} from "../model/memo.model.ts";
import { memoRepository } from "../repository/memo.repository.ts";

const assertOwnedNode = (authUser: AuthUser, node: MemoNode): MemoNode => {
  if (node.user_id !== authUser.id) {
    throw new HttpError(
      502,
      "MEMO_TRASH_INVALID",
      "Memo trash returned an invalid owner",
    );
  }

  return node;
};

const getAncestors = (
  node: MemoNode,
  nodesById: ReadonlyMap<string, MemoNode>,
): MemoNode[] => {
  const ancestors: MemoNode[] = [];
  const visited = new Set<string>([node.id]);
  let parentId = node.parent_id;

  while (parentId !== null) {
    if (visited.has(parentId)) {
      throw new HttpError(
        502,
        "MEMO_TRASH_INVALID",
        "Memo trash contains a cycle",
      );
    }

    const parent = nodesById.get(parentId);

    if (parent === undefined) {
      throw new HttpError(
        502,
        "MEMO_TRASH_INVALID",
        "Memo trash contains an invalid parent",
      );
    }

    visited.add(parent.id);
    ancestors.unshift(parent);
    parentId = parent.parent_id;
  }

  return ancestors;
};

const listTrash = async (
  authUser: AuthUser,
  accessToken: string,
): Promise<MemoTrashItem[]> => {
  const [nodes, excerpts] = await Promise.all([
    memoRepository.listTrashNodes(authUser.id, accessToken),
    memoRepository.listTrashExcerpts(authUser.id, accessToken),
  ]);
  const ownedNodes = nodes.map((node) => assertOwnedNode(authUser, node));
  const nodesById = new Map(ownedNodes.map((node) => [node.id, node]));
  const excerptsByNodeId = new Map(
    excerpts.map((content) => [content.node_id, content.excerpt]),
  );

  return ownedNodes
    .filter((node) =>
      node.deleted_at !== null && node.deleted_root_id === node.id)
    .flatMap((node): MemoTrashItem[] => {
      const ancestors = getAncestors(node, nodesById);

      if (ancestors.some((ancestor) => ancestor.deleted_at !== null)) {
        return [];
      }

      return [{
        id: node.id,
        node_type: node.node_type,
        title: node.title,
        parent_id: node.parent_id,
        original_path: ancestors.length === 0
          ? "根目录"
          : ancestors.map((ancestor) => ancestor.title).join(" / "),
        deleted_at: node.deleted_at as string,
        excerpt: node.node_type === "memo"
          ? excerptsByNodeId.get(node.id) ?? null
          : null,
      }];
    })
    .sort((left, right) =>
      right.deleted_at.localeCompare(left.deleted_at) ||
      left.id.localeCompare(right.id));
};

const softDeleteNode = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
): Promise<MemoTrashMutation> => {
  const result = await memoRepository.softDeleteNode(
    authUser.id,
    nodeId,
    accessToken,
  );

  if (result.status === "not_found") {
    throw new HttpError(
      404,
      "MEMO_NODE_NOT_FOUND",
      "Memo node was not found",
    );
  }

  if (result.status === "already_deleted") {
    throw new HttpError(
      409,
      "MEMO_NODE_ALREADY_DELETED",
      "Memo node is already in the trash",
    );
  }

  const node = assertOwnedNode(authUser, result.node);

  if (node.deleted_at === null || node.deleted_root_id !== node.id) {
    throw new HttpError(
      502,
      "MEMO_TRASH_INVALID",
      "Soft-deleted memo node returned invalid state",
    );
  }

  return { id: node.id, deleted_at: node.deleted_at };
};

const permanentlyDeleteNode = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
): Promise<MemoTrashClearResult> => {
  const result = await memoRepository.permanentlyDeleteNode(
    authUser.id,
    nodeId,
    accessToken,
  );

  if (result.status === "not_found") {
    throw new HttpError(
      404,
      "MEMO_TRASH_ITEM_NOT_FOUND",
      "Memo trash item was not found",
    );
  }

  if (result.status === "active_node") {
    throw new HttpError(
      409,
      "MEMO_NODE_NOT_DELETED",
      "Active memo nodes cannot be permanently deleted",
    );
  }

  if (result.status === "not_root") {
    throw new HttpError(
      409,
      "MEMO_TRASH_NOT_ROOT",
      "Only a deleted root can be permanently deleted",
    );
  }

  if (result.status === "blocked_by_deleted_ancestor") {
    throw new HttpError(
      409,
      "MEMO_TRASH_ITEM_HIDDEN",
      "Delete or restore the outer deleted ancestor first",
    );
  }

  return { deleted_count: result.deleted_count };
};

const emptyTrash = async (
  authUser: AuthUser,
  accessToken: string,
): Promise<MemoTrashClearResult> => {
  const result = await memoRepository.emptyTrash(authUser.id, accessToken);
  return { deleted_count: result.deleted_count };
};

export const memoTrashService = {
  listTrash,
  softDeleteNode,
  permanentlyDeleteNode,
  emptyTrash,
};
