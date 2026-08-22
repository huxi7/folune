/**
 * [INPUT]: 依赖可信 AuthUser、请求期 access token、memo DTO 输入、memo repository、领域模型与 HttpError
 * [OUTPUT]: 对外提供轻量 active tree、单篇正文、正文关键词命中、folder/memo CRUD、节点移动与恢复 subtree
 * [POS]: service 层 active 备忘录写入与读取编排边界；树组装委托 memo-tree.service，正文原样存储并派生摘要
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import type {
  CreateMemoFolderInput,
  CreateMemoInput,
  MoveMemoNodeInput,
  MemoSearchQuery,
  PatchMemoInput,
  RenameMemoNodeInput,
} from "../dto/memo.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";
import type {
  MemoContent,
  MemoDetailNode,
  MemoNode,
  MemoSearchHit,
  MemoTreeNode,
  UpdateMemoContentData,
} from "../model/memo.model.ts";
import { memoRepository } from "../repository/memo.repository.ts";
import {
  buildMemoTree,
  toMemoContentSummary,
  toMemoDetailNode,
  toMemoTreeNode,
} from "./memo-tree.service.ts";

const DEFAULT_SORT_GAP = 1000;
const MEMO_EXCERPT_MAX_CHARACTERS = 200;

const assertOwnedNode = (
  authUser: AuthUser,
  node: MemoNode,
): MemoNode => {
  if (node.user_id !== authUser.id) {
    throw new HttpError(
      403,
      "MEMO_NODE_ACCESS_DENIED",
      "Memo node does not belong to the authenticated user",
    );
  }

  return node;
};

const assertOwnedContent = (
  authUser: AuthUser,
  content: MemoContent,
): MemoContent => {
  if (content.user_id !== authUser.id) {
    throw new HttpError(
      403,
      "MEMO_ACCESS_DENIED",
      "Memo content does not belong to the authenticated user",
    );
  }

  return content;
};

const findOwnedNode = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
): Promise<MemoNode> => {
  const node = await memoRepository.findActiveNodeById(
    authUser.id,
    nodeId,
    accessToken,
  );

  if (node === null) {
    throw new HttpError(
      404,
      "MEMO_NODE_NOT_FOUND",
      "Memo node was not found",
    );
  }

  return assertOwnedNode(authUser, node);
};

const findOwnedMemo = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
): Promise<{ node: MemoNode; content: MemoContent }> => {
  const node = await findOwnedNode(authUser, accessToken, nodeId);

  if (node.node_type !== "memo") {
    throw new HttpError(
      404,
      "MEMO_NOT_FOUND",
      "Memo was not found",
    );
  }

  const content = await memoRepository.findContentByNodeId(
    authUser.id,
    node.id,
    accessToken,
  );

  if (content === null) {
    throw new HttpError(
      502,
      "MEMO_CONTENT_MISSING",
      "Memo content was not available",
    );
  }

  return {
    node,
    content: assertOwnedContent(authUser, content),
  };
};

const validateParentFolder = async (
  authUser: AuthUser,
  accessToken: string,
  parentId: string | null,
): Promise<void> => {
  if (parentId === null) {
    return;
  }

  const parent = await findOwnedNode(
    authUser,
    accessToken,
    parentId,
  );

  if (parent.node_type !== "folder") {
    throw new HttpError(
      400,
      "MEMO_PARENT_NOT_FOLDER",
      "Parent node must be a folder",
    );
  }
};

const nextSortOrder = async (
  authUser: AuthUser,
  accessToken: string,
  parentId: string | null,
): Promise<number> => {
  const currentMax = await memoRepository.findMaxSortOrder(
    authUser.id,
    parentId,
    accessToken,
  );

  return (currentMax ?? 0) + DEFAULT_SORT_GAP;
};

const extractMemoMetadataText = (contentMdx: string): string => {
  const textWithoutMarkdownSyntax = contentMdx
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#{|}>*_~]/g, " ");

  return textWithoutMarkdownSyntax.match(/\S+/gu)?.join(" ") ?? "";
};

const memoContentData = (
  contentMdx: string,
): UpdateMemoContentData => {
  const text = extractMemoMetadataText(contentMdx);
  const words = text.match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu);

  return {
    content_mdx: contentMdx,
    excerpt:
      text.length === 0
        ? null
        : Array.from(text)
            .slice(0, MEMO_EXCERPT_MAX_CHARACTERS)
            .join(""),
    word_count: words?.length ?? 0,
  };
};

const createFolder = async (
  authUser: AuthUser,
  accessToken: string,
  input: CreateMemoFolderInput,
): Promise<MemoTreeNode> => {
  const parentId = input.parent_id ?? null;
  await validateParentFolder(authUser, accessToken, parentId);
  const created = await memoRepository.createNode(
    {
      user_id: authUser.id,
      parent_id: parentId,
      node_type: "folder",
      title: input.title,
      sort_order: await nextSortOrder(
        authUser,
        accessToken,
        parentId,
      ),
    },
    accessToken,
  );

  if (created === null) {
    throw new HttpError(
      502,
      "MEMO_FOLDER_CREATE_FAILED",
      "Memo folder was not available after creation",
    );
  }

  return toMemoTreeNode(assertOwnedNode(authUser, created), null);
};

const cleanupCreatedNode = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
): Promise<void> => {
  try {
    await memoRepository.deleteNode(
      authUser.id,
      nodeId,
      accessToken,
    );
  } catch {
    // 补偿失败不能覆盖正文创建的原始错误，也不得记录用户标识或凭据。
  }
};

const createMemo = async (
  authUser: AuthUser,
  accessToken: string,
  input: CreateMemoInput,
): Promise<MemoDetailNode> => {
  const parentId = input.parent_id ?? null;
  await validateParentFolder(authUser, accessToken, parentId);
  const node = await memoRepository.createNode(
    {
      user_id: authUser.id,
      parent_id: parentId,
      node_type: "memo",
      title: input.title,
      sort_order:
        input.sort_order ??
        (await nextSortOrder(authUser, accessToken, parentId)),
    },
    accessToken,
  );

  if (node === null) {
    throw new HttpError(
      502,
      "MEMO_CREATE_FAILED",
      "Memo node was not available after creation",
    );
  }

  assertOwnedNode(authUser, node);
  const contentMdx = input.content_mdx ?? "";

  try {
    const content = await memoRepository.createContent(
      {
        node_id: node.id,
        user_id: authUser.id,
        ...memoContentData(contentMdx),
      },
      accessToken,
    );

    if (content === null) {
      throw new HttpError(
        502,
        "MEMO_CREATE_FAILED",
        "Memo content was not available after creation",
      );
    }

    return toMemoDetailNode(
      node,
      assertOwnedContent(authUser, content),
    );
  } catch (error) {
    await cleanupCreatedNode(authUser, accessToken, node.id);
    throw error;
  }
};

const getTree = async (
  authUser: AuthUser,
  accessToken: string,
): Promise<MemoTreeNode[]> => {
  const nodes = await memoRepository.listActiveNodes(
    authUser.id,
    accessToken,
  );
  const summaries = await memoRepository.listContentSummaries(
    authUser.id,
    accessToken,
  );

  return buildMemoTree(authUser, nodes, summaries);
};

const getMemo = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
): Promise<MemoDetailNode> => {
  const memo = await findOwnedMemo(authUser, accessToken, nodeId);

  return toMemoDetailNode(memo.node, memo.content);
};

const searchMemos = async (
  authUser: AuthUser,
  accessToken: string,
  input: MemoSearchQuery,
): Promise<MemoSearchHit[]> => {
  const summaries = await memoRepository.searchContentSummaries(
    authUser.id,
    input.q,
    input.limit,
    accessToken,
  );

  return summaries.map((summary) => ({
    excerpt: summary.excerpt,
    node_id: summary.node_id,
  }));
};

const restoreTitle = async (
  authUser: AuthUser,
  accessToken: string,
  node: MemoNode,
  currentTitle: string,
): Promise<void> => {
  try {
    await memoRepository.updateNodeTitleIfCurrent(
      authUser.id,
      node.id,
      currentTitle,
      node.title,
      accessToken,
    );
  } catch (error) {
    // 回滚失败不能覆盖正文更新的原始错误，也不得记录用户标识或凭据；
    // 但静默会让半写状态（标题已改、正文未改）永远无法被发现，
    // 所以留下一条不含身份信息的可观测记录。
    console.error(
      `[memo] title rollback failed for node ${node.id}:`,
      error instanceof Error ? error.message : "unknown error",
    );
  }
};

const updateMemo = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
  input: PatchMemoInput,
): Promise<MemoDetailNode> => {
  const current = await findOwnedMemo(
    authUser,
    accessToken,
    nodeId,
  );
  let node = current.node;

  if (input.title !== undefined) {
    const updatedNode = await memoRepository.updateNode(
      authUser.id,
      node.id,
      { title: input.title },
      accessToken,
    );

    if (updatedNode === null) {
      throw new HttpError(
        409,
        "MEMO_UPDATE_CONFLICT",
        "Memo changed before it could be updated",
      );
    }

    node = assertOwnedNode(authUser, updatedNode);
  }

  let content = current.content;

  if (input.content_mdx !== undefined) {
    try {
      const updatedContent = await memoRepository.updateContent(
        authUser.id,
        node.id,
        memoContentData(input.content_mdx),
        accessToken,
      );

      if (updatedContent === null) {
        throw new HttpError(
          409,
          "MEMO_UPDATE_CONFLICT",
          "Memo changed before it could be updated",
        );
      }

      content = assertOwnedContent(authUser, updatedContent);
    } catch (error) {
      if (input.title !== undefined) {
        await restoreTitle(
          authUser,
          accessToken,
          current.node,
          input.title,
        );
      }

      throw error;
    }
  }

  return toMemoDetailNode(node, content);
};

const renameNode = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
  input: RenameMemoNodeInput,
): Promise<MemoNode> => {
  await findOwnedNode(authUser, accessToken, nodeId);
  const updated = await memoRepository.updateNode(
    authUser.id,
    nodeId,
    { title: input.title },
    accessToken,
  );

  if (updated === null) {
    throw new HttpError(
      409,
      "MEMO_NODE_UPDATE_CONFLICT",
      "Memo node changed before it could be renamed",
    );
  }

  return assertOwnedNode(authUser, updated);
};

const validateMoveTarget = async (
  authUser: AuthUser,
  accessToken: string,
  node: MemoNode,
  parentId: string | null,
): Promise<void> => {
  if (parentId === null) {
    return;
  }

  const nodes = await memoRepository.listActiveNodes(
    authUser.id,
    accessToken,
  );
  const nodesById = new Map(
    nodes.map((candidate) => [candidate.id, candidate]),
  );
  const parent = nodesById.get(parentId);

  if (parent === undefined) {
    throw new HttpError(
      404,
      "MEMO_NODE_NOT_FOUND",
      "Parent node was not found",
    );
  }

  assertOwnedNode(authUser, parent);

  if (parent.node_type !== "folder") {
    throw new HttpError(
      400,
      "MEMO_PARENT_NOT_FOLDER",
      "Parent node must be a folder",
    );
  }

  let cursor: MemoNode | undefined = parent;
  const visited = new Set<string>();

  while (cursor !== undefined) {
    if (cursor.id === node.id) {
      throw new HttpError(
        400,
        "MEMO_NODE_CYCLE",
        "Memo node cannot be moved into itself or its descendants",
      );
    }

    if (visited.has(cursor.id)) {
      throw new HttpError(
        502,
        "MEMO_TREE_INVALID",
        "Memo tree contains a cycle",
      );
    }

    visited.add(cursor.id);

    if (cursor.parent_id === null) {
      cursor = undefined;
      continue;
    }

    const ancestor = nodesById.get(cursor.parent_id);

    if (ancestor === undefined) {
      throw new HttpError(
        502,
        "MEMO_TREE_INVALID",
        "Memo tree contains an invalid parent",
      );
    }

    cursor = ancestor;
  }
};

const moveNode = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
  input: MoveMemoNodeInput,
): Promise<MemoNode> => {
  const node = await findOwnedNode(authUser, accessToken, nodeId);
  const parentId =
    input.parent_id === undefined ? node.parent_id : input.parent_id;
  await validateMoveTarget(
    authUser,
    accessToken,
    node,
    parentId,
  );
  const parentChanged = parentId !== node.parent_id;
  const sortOrder =
    input.sort_order ??
    (parentChanged
      ? await nextSortOrder(authUser, accessToken, parentId)
      : node.sort_order);
  const updated = await memoRepository.updateNode(
    authUser.id,
    node.id,
    {
      ...(input.parent_id === undefined
        ? {}
        : { parent_id: parentId }),
      ...(input.sort_order === undefined && !parentChanged
        ? {}
        : { sort_order: sortOrder }),
    },
    accessToken,
  );

  if (updated === null) {
    throw new HttpError(
      409,
      "MEMO_NODE_UPDATE_CONFLICT",
      "Memo node changed before it could be moved",
    );
  }

  return assertOwnedNode(authUser, updated);
};

const restoreNode = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
): Promise<MemoTreeNode> => {
  const result = await memoRepository.restoreNode(
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

  if (result.status === "already_active") {
    throw new HttpError(
      409,
      "MEMO_NODE_NOT_DELETED",
      "Active memo nodes cannot be restored",
    );
  }

  if (result.status === "not_root") {
    throw new HttpError(
      409,
      "MEMO_TRASH_NOT_ROOT",
      "Only a deleted root can be restored",
    );
  }

  if (result.status === "blocked_by_deleted_ancestor") {
    throw new HttpError(
      409,
      "MEMO_RESTORE_BLOCKED",
      "Restore the deleted ancestor before restoring this item",
    );
  }

  const restoredTree = buildMemoTree(
    authUser,
    result.nodes,
    result.contents.map(toMemoContentSummary),
    nodeId,
  );
  const root = restoredTree[0];

  if (restoredTree.length !== 1 || root?.id !== nodeId) {
    throw new HttpError(
      502,
      "MEMO_RESTORE_INVALID",
      "Restored memo subtree was invalid",
    );
  }

  return root;
};

export const memoService = {
  getTree,
  createFolder,
  createMemo,
  getMemo,
  searchMemos,
  updateMemo,
  renameNode,
  moveNode,
  restoreNode,
};
