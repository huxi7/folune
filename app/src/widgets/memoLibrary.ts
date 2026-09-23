/**
 * [INPUT]: 依赖 shared/api/memo 的后端树类型与 shared/store/memoTree 的唯一树算法
 * [OUTPUT]: 对外提供首个 memo、祖先/路径、全文搜索、跨视图笔记拖拽载荷与统一 DropTarget 校验/稀疏排序计划
 * [POS]: app/src/widgets 的 memo tree 视图模型，只解释可见路径和拖拽意图；实际树变更、乐观事务与回滚归 Zustand Store
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  MemoNode,
  MemoTreeNode,
  MoveMemoNodeInput,
} from "../shared/api/memo";
import {
  appendSortOrder,
  betweenSortOrders,
  findNode,
  findSiblings,
  isDescendant,
  replaceNode,
  sortNodes,
  updateNode,
} from "../shared/store/memoTree";

export type MemoSearchResult = {
  id: string;
  path: string;
  title: string;
};

export type MemoDropPlacement = "after" | "before" | "inside" | "root-end";

export type MemoDropTarget = {
  nodeId: string | null;
  parentId: string | null;
  placement: MemoDropPlacement;
};

export type MemoMovePlan = MoveMemoNodeInput;

export const FOLUNE_MEMO_DRAG_MIME = "application/x-folune-memo";

export type MemoCanvasDragPayload = {
  id: string;
  kind: "memo";
  revision: number;
  title: string;
};

export const serializeMemoCanvasDrag = (
  node: MemoTreeNode,
): string | null => node.node_type === "memo"
  ? JSON.stringify({
      id: node.id,
      kind: "memo",
      revision: node.revision,
      title: node.title,
    } satisfies MemoCanvasDragPayload)
  : null;

export const parseMemoCanvasDrag = (
  value: string,
): MemoCanvasDragPayload | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object"
      || parsed === null
      || !("kind" in parsed)
      || parsed.kind !== "memo"
      || !("id" in parsed)
      || typeof parsed.id !== "string"
      || parsed.id.length === 0
      || !("title" in parsed)
      || typeof parsed.title !== "string"
      || !("revision" in parsed)
      || typeof parsed.revision !== "number"
      || !Number.isInteger(parsed.revision)
      || parsed.revision < 0
    ) return null;
    return parsed as MemoCanvasDragPayload;
  } catch {
    return null;
  }
};

export const findMemoNode = findNode;

export function findFirstMemoId(
  tree: readonly MemoTreeNode[],
): string | null {
  const pending = [...sortNodes(tree)];

  while (pending.length > 0) {
    const node = pending.shift();

    if (node === undefined) {
      continue;
    }

    if (node.node_type === "memo") {
      return node.id;
    }

    pending.unshift(...sortNodes(node.children));
  }

  return null;
}

export function getFolderIds(
  tree: readonly MemoTreeNode[],
): string[] {
  const folderIds: string[] = [];
  const pending = [...tree];

  while (pending.length > 0) {
    const node = pending.shift();

    if (node === undefined) {
      continue;
    }

    if (node.node_type === "folder") {
      folderIds.push(node.id);
      pending.unshift(...node.children);
    }
  }

  return folderIds;
}

export function getAncestorFolderIds(
  tree: readonly MemoTreeNode[],
  nodeId: string,
): string[] {
  const visit = (
    nodes: readonly MemoTreeNode[],
    ancestors: readonly string[],
  ): string[] | null => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return [...ancestors];
      }

      if (node.node_type === "folder") {
        const found = visit(node.children, [...ancestors, node.id]);

        if (found !== null) {
          return found;
        }
      }
    }

    return null;
  };

  return visit(tree, []) ?? [];
}

export function getMemoFolderPath(
  tree: readonly MemoTreeNode[],
  nodeId: string,
): string {
  const visit = (
    nodes: readonly MemoTreeNode[],
    folders: readonly string[],
  ): string[] | null => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return [...folders];
      }

      if (node.node_type === "folder") {
        const found = visit(node.children, [...folders, node.title]);

        if (found !== null) {
          return found;
        }
      }
    }

    return null;
  };

  const folders = visit(tree, []);
  return folders === null || folders.length === 0
    ? "根目录"
    : folders.join(" / ");
}

export function searchMemoTree(
  tree: readonly MemoTreeNode[],
  query: string,
  bodyHitIds: ReadonlySet<string> = new Set(),
): MemoSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return [];
  }

  const results: MemoSearchResult[] = [];

  const visit = (
    nodes: readonly MemoTreeNode[],
    folders: readonly string[],
  ): void => {
    for (const node of nodes) {
      if (node.node_type === "folder") {
        visit(node.children, [...folders, node.title]);
        continue;
      }

      const path = folders.length === 0 ? "根目录" : folders.join(" / ");
      const values = [node.title, path];

      if (bodyHitIds.has(node.id) || values.some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery))) {
        results.push({ id: node.id, path, title: node.title });
      }
    }
  };

  visit(tree, []);
  return results;
}

export function updateNodeInMemoTree(
  tree: readonly MemoTreeNode[],
  updatedNode: MemoNode,
): MemoTreeNode[] {
  return updateNode(tree, updatedNode.id, (currentNode) => ({
    ...currentNode,
    ...updatedNode,
  }));
}

export function replaceNodeInMemoTree(
  tree: readonly MemoTreeNode[],
  updatedNode: MemoTreeNode,
): MemoTreeNode[] {
  return replaceNode(tree, updatedNode.id, updatedNode);
}

const canMoveIntoParent = (
  tree: readonly MemoTreeNode[],
  draggedNodeId: string,
  parentId: string | null,
): boolean =>
  parentId === null || (
    parentId !== draggedNodeId &&
    !isDescendant(tree, draggedNodeId, parentId) &&
    findNode(tree, parentId)?.node_type === "folder"
  );

const createBoundaryMovePlan = (
  tree: readonly MemoTreeNode[],
  draggedNodeId: string,
  target: MemoDropTarget,
): MemoMovePlan | null => {
  if (target.placement !== "before" && target.placement !== "after") {
    return null;
  }

  const siblings = findSiblings(tree, target.parentId);

  if (
    siblings === null ||
    !canMoveIntoParent(tree, draggedNodeId, target.parentId)
  ) {
    return null;
  }

  const available = sortNodes(
    siblings.filter((node) => node.id !== draggedNodeId),
  );
  const previous = target.placement === "after" ? available.at(-1) : undefined;
  const next = target.placement === "before" ? available[0] : undefined;

  return {
    parent_id: target.parentId,
    sort_order: betweenSortOrders(previous, next),
  };
};

export function createMemoMovePlan(
  tree: readonly MemoTreeNode[],
  draggedNodeId: string,
  dropTarget: MemoDropTarget,
): MemoMovePlan | null {
  const draggedNode = findNode(tree, draggedNodeId);

  if (draggedNode === null) {
    return null;
  }

  if (dropTarget.placement === "root-end") {
    const roots = tree.filter((node) => node.id !== draggedNodeId);
    return {
      parent_id: null,
      sort_order: appendSortOrder(roots),
    };
  }

  if (dropTarget.nodeId === null) {
    return createBoundaryMovePlan(tree, draggedNodeId, dropTarget);
  }

  if (draggedNodeId === dropTarget.nodeId) {
    return null;
  }

  const target = findNode(tree, dropTarget.nodeId);

  if (target === null) {
    return null;
  }

  if (dropTarget.placement === "inside") {
    if (
      target.node_type !== "folder" ||
      !canMoveIntoParent(tree, draggedNodeId, target.id)
    ) {
      return null;
    }

    const firstChild = sortNodes(
      target.children.filter((node) => node.id !== draggedNodeId),
    )[0];

    return {
      parent_id: target.id,
      sort_order: betweenSortOrders(undefined, firstChild),
    };
  }

  if (
    dropTarget.parentId !== target.parent_id ||
    !canMoveIntoParent(tree, draggedNodeId, target.parent_id)
  ) {
    return null;
  }

  const siblings = findSiblings(tree, target.parent_id);

  if (siblings === null) {
    return null;
  }

  const available = sortNodes(
    siblings.filter((node) => node.id !== draggedNodeId),
  );
  const targetIndex = available.findIndex((node) => node.id === target.id);

  if (targetIndex < 0) {
    return null;
  }

  const previous = dropTarget.placement === "before"
    ? available[targetIndex - 1]
    : available[targetIndex];
  const next = dropTarget.placement === "before"
    ? available[targetIndex]
    : available[targetIndex + 1];

  return {
    parent_id: target.parent_id,
    sort_order: betweenSortOrders(previous, next),
  };
}
