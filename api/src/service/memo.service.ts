/**
 * [INPUT]: 依赖可信 AuthUser、请求期 access token、memo DTO 输入、memo repository、领域模型与 HttpError
 * [OUTPUT]: 对外提供供画布层复用的 nextSortOrder/memoContentData 派生规则，以及轻量 active tree、单篇正文、关键词命中、带命中通道与名次的相似候选、folder/memo CRUD（系统默认名撞名顺位让开、用户输入撞名回 MEMO_TITLE_CONFLICT）、节点移动与恢复 subtree
 * [POS]: service 层 active 备忘录写入与读取编排边界；树组装委托 memo-tree.service，正文原样存储并派生摘要；检索 RPC 的失败在此收敛为稳定 HTTP 错误，且相似候选只出摘录不出正文。PATCH /memos 固定先写正文后写标题——标题会撞唯一约束、正文不会，先写正文才让重名只挂起 title 而不连坐正文，也就不再需要半写回滚
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import {
  createWithAvailableTitle,
  withTitleConflictTranslation,
} from "../common/memo-title.ts";
import type {
  CreateMemoFolderInput,
  CreateMemoInput,
  MemoRelatedSearchInput,
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
  MemoRelatedHit,
  MemoSearchHit,
  MemoTreeNode,
  UpdateMemoContentData,
} from "../model/memo.model.ts";
import { canvasRepository } from "../repository/canvas.repository.ts";
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

/**
 * 新同级节点的 sort_order 规则只有这一处实现: 取同级最大值再加一个间隔。
 * 画布保存与卡片晋升同样是「在树里插一个新节点」，因此复用它而不是各自算一遍。
 */
export const nextSortOrder = async (
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

/**
 * 摘要与字数的派生规则同样只有这一处实现: 先剥掉 Markdown 记号，再按汉字逐字、
 * 西文按词计数。晋升把画布卡片的正文搬成笔记时必须复用它，否则同一段文字会得到
 * 两种摘要。派生只读副本，绝不回写正文。
 */
export const memoContentData = (
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
  const sortOrder = await nextSortOrder(authUser, accessToken, parentId);
  // 用户亲手命名文件夹：撞名不替他改名，翻译成可原位提示的业务冲突。
  const created = await withTitleConflictTranslation(() =>
    memoRepository.createNode(
      {
        user_id: authUser.id,
        parent_id: parentId,
        node_type: "folder",
        title: input.title,
        sort_order: sortOrder,
      },
      accessToken,
    ));

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
  const sortOrder = input.sort_order
    ?? (await nextSortOrder(authUser, accessToken, parentId));
  /*
   * 新建备忘录的标题永远是系统默认名（「未命名备忘录」）。同一目录里连着新建
   * 两次时它必然撞上同父同类型唯一约束, 所以默认名在冲突时顺位让开, 拿到
   * 「未命名备忘录 2」而不是让最高频的动作直接失败。
   */
  const node = await createWithAvailableTitle(input.title, (title) =>
    memoRepository.createNode(
      {
        user_id: authUser.id,
        parent_id: parentId,
        node_type: "memo",
        title,
        sort_order: sortOrder,
      },
      accessToken,
    ));

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

/** canvases 行 → 树节点身份；tree 与 restore 共用同一条翻译 */
const canvasIdentities = async (
  authUser: AuthUser,
  accessToken: string,
): Promise<{ identity: { kind: "memo_default" | "standalone"; origin_node_id: string | null }; node_id: string }[]> =>
  (await canvasRepository.listIdentities(authUser.id, accessToken)).map((row) => ({
    identity: { kind: row.canvas_kind, origin_node_id: row.origin_node_id },
    node_id: row.node_id,
  }));

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
  // 画布身份是树结构的一部分（哪张画布是哪篇笔记的默认视图），不是图内容
  const identities = nodes.some((node) => node.node_type === "canvas")
    ? await canvasIdentities(authUser, accessToken)
    : [];

  return buildMemoTree(authUser, nodes, summaries, identities);
};

const getMemo = async (
  authUser: AuthUser,
  accessToken: string,
  nodeId: string,
): Promise<MemoDetailNode> => {
  const memo = await findOwnedMemo(authUser, accessToken, nodeId);

  return toMemoDetailNode(memo.node, memo.content);
};

// 检索 RPC 的 status 判别式在此收敛为稳定 HTTP 错误，与 ai-run.service 的 requireRpcRun 同形。
// 跨租户与不存在同样返回 not_found，故映射为 404 而非 403。
const requireSearchHits = <T>(
  result: { status: "ok"; hits: T[] } | { status: "invalid"; error_code: string } | { status: "not_found" },
): T[] => {
  if (result.status === "ok") {
    return result.hits;
  }

  if (result.status === "invalid") {
    throw new HttpError(400, result.error_code, "Memo search input was invalid");
  }

  throw new HttpError(404, "MEMO_SEARCH_NOT_FOUND", "Memo search scope was not found");
};

const searchMemos = async (
  authUser: AuthUser,
  accessToken: string,
  input: MemoSearchQuery,
): Promise<MemoSearchHit[]> => {
  const result = await memoRepository.searchKeyword(
    authUser.id,
    input.q,
    input.limit,
    accessToken,
  );

  return requireSearchHits(result);
};

const searchRelatedMemos = async (
  authUser: AuthUser,
  accessToken: string,
  input: MemoRelatedSearchInput,
): Promise<MemoRelatedHit[]> => {
  const result = await memoRepository.searchRelated(
    authUser.id,
    input.query_text,
    input.source_node_id ?? null,
    input.limit ?? 12,
    input.exclude_node_ids ?? [],
    accessToken,
  );

  return requireSearchHits(result);
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
  let content = current.content;

  /*
   * ---- 顺序是正文先、标题后 ----
   * 标题会撞上同父同类型唯一约束，正文不会。先写正文，标题冲突就只挂起标题
   * 这一件事：用户在冲突状态下写的正文已经落库，不会被一次注定失败的改名
   * 连坐带走，也不再需要"标题已改、正文未改"的半写回滚补偿。
   */
  if (input.content_mdx !== undefined) {
    const updatedContent = await memoRepository.updateContent(
      authUser.id,
      current.node.id,
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
  }

  let node = current.node;

  if (input.title !== undefined) {
    const updatedNode = await withTitleConflictTranslation(() =>
      memoRepository.updateNode(
        authUser.id,
        current.node.id,
        { title: input.title as string },
        accessToken,
      ));

    if (updatedNode === null) {
      throw new HttpError(
        409,
        "MEMO_UPDATE_CONFLICT",
        "Memo changed before it could be updated",
      );
    }

    node = assertOwnedNode(authUser, updatedNode);
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
  const updated = await withTitleConflictTranslation(() =>
    memoRepository.updateNode(
      authUser.id,
      nodeId,
      { title: input.title },
      accessToken,
    ));

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
    result.nodes.some((node) => node.node_type === "canvas")
      ? await canvasIdentities(authUser, accessToken)
      : [],
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
  searchRelatedMemos,
  updateMemo,
  renameNode,
  moveNode,
  restoreNode,
};
