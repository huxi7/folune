/**
 * [INPUT]: 依赖 Zustand、shared/api/memo 的显式 token 命令与 memoTree 纯树算法
 * [OUTPUT]: 对外提供 active tree 单一状态、串行写队列、CRUD、软删快照回滚、恢复 subtree 合并与草稿并发保护
 * [POS]: app/src/shared/store 的 active 备忘录单一数据源；删除先移除、恢复只合并响应，任何写成功都禁止整树 refetch
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import {
  createMemo as createMemoRequest,
  createMemoFolder,
  getMemoTree,
  moveMemoNode,
  restoreMemoNode,
  softDeleteMemoNode,
  updateMemo,
  updateMemoNode,
  type CreateMemoFolderInput,
  type CreateMemoInput,
  type MemoWriteOptions,
  type MemoTreeNode,
  type MoveMemoNodeInput,
  type UpdateMemoInput,
} from "../api/memo";
import {
  findNode,
  findSiblings,
  insertNode,
  isDescendant,
  moveNodeInTree,
  removeNode,
  replaceNode,
  sortNodes,
  updateNode,
} from "./memoTree";

export type MemoTreeState = {
  nodes: MemoTreeNode[];
  fetchTree(accessToken: string, signal?: AbortSignal): Promise<MemoTreeNode[]>;
  createFolder(
    accessToken: string,
    input: CreateMemoFolderInput,
  ): Promise<MemoTreeNode>;
  createMemo(
    accessToken: string,
    input: CreateMemoInput,
  ): Promise<MemoTreeNode>;
  moveNode(
    accessToken: string,
    nodeId: string,
    input: MoveMemoNodeInput,
  ): Promise<void>;
  renameNode(
    accessToken: string,
    nodeId: string,
    title: string,
  ): Promise<MemoTreeNode>;
  softDeleteNode(accessToken: string, nodeId: string): Promise<void>;
  restoreNode(accessToken: string, nodeId: string): Promise<MemoTreeNode>;
  updateMemoContentLocal(nodeId: string, content: string): void;
  saveMemoDraft(
    accessToken: string,
    nodeId: string,
    input: UpdateMemoInput,
    options?: MemoWriteOptions,
  ): Promise<MemoTreeNode>;
  saveMemoContent(
    accessToken: string,
    nodeId: string,
    content: string,
    options?: MemoWriteOptions,
  ): Promise<MemoTreeNode>;
  reset(): void;
};

let treeGeneration = 0;
const moveVersions = new Map<string, number>();
const renameVersions = new Map<string, number>();
const moveQueues = new Map<string, Promise<void>>();
const renameQueues = new Map<string, Promise<void>>();

const nextVersion = (versions: Map<string, number>, nodeId: string): number => {
  const version = (versions.get(nodeId) ?? 0) + 1;
  versions.set(nodeId, version);
  return version;
};

const enqueueNodeRequest = <T>(
  queues: Map<string, Promise<void>>,
  nodeId: string,
  request: () => Promise<T>,
): Promise<T> => {
  const previous = queues.get(nodeId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(request);
  queues.set(
    nodeId,
    current.then(
      () => undefined,
      () => undefined,
    ),
  );
  return current;
};

const optimisticId = (kind: "folder" | "memo"): string =>
  `optimistic-${kind}-${crypto.randomUUID()}`;

const inferUserId = (nodes: readonly MemoTreeNode[]): string =>
  nodes[0]?.user_id ?? "optimistic-user";

const optimisticNode = (
  nodes: readonly MemoTreeNode[],
  nodeType: "folder" | "memo",
  input: CreateMemoFolderInput | CreateMemoInput,
): MemoTreeNode => {
  const now = new Date().toISOString();
  const id = optimisticId(nodeType);
  const content = "content_mdx" in input ? input.content_mdx ?? "" : "";
  const sortOrder = "sort_order" in input ? input.sort_order : undefined;

  return {
    children: [],
    color: null,
    created_at: now,
    deleted_at: null,
    deleted_root_id: null,
    icon: null,
    id,
    memo: nodeType === "memo"
      ? {
          content_mdx: content,
          created_at: now,
          excerpt: content.length === 0 ? null : content.slice(0, 240),
          metadata: {},
          node_id: id,
          updated_at: now,
          user_id: inferUserId(nodes),
          word_count: content.trim().length === 0
            ? 0
            : content.trim().split(/\s+/u).length,
        }
      : null,
    metadata: {},
    node_type: nodeType,
    parent_id: input.parent_id,
    sort_order: sortOrder ?? "0",
    title: input.title,
    updated_at: now,
    user_id: inferUserId(nodes),
  };
};

const mergeServerNode = (
  currentNode: MemoTreeNode,
  serverNode: MemoTreeNode,
): MemoTreeNode => ({
  ...currentNode,
  ...serverNode,
  children: currentNode.children,
  memo: serverNode.memo ?? currentNode.memo,
});

export const useMemoTreeStore = create<MemoTreeState>()((set, get) => ({
  nodes: [],

  async fetchTree(accessToken, signal) {
    const generation = ++treeGeneration;

    const nodes = sortNodes(await getMemoTree(accessToken, signal));

    if (generation === treeGeneration) {
      set({ nodes });
    }

    return nodes;
  },

  async createFolder(accessToken, input) {
    const generation = treeGeneration;
    const previousNodes = get().nodes;

    if (input.parent_id !== null && findSiblings(previousNodes, input.parent_id) === null) {
      throw new Error("目标文件夹不存在。");
    }

    const optimistic = optimisticNode(previousNodes, "folder", input);
    set({ nodes: insertNode(previousNodes, optimistic, input.parent_id) });

    try {
      const created = await createMemoFolder(accessToken, input);

      if (generation === treeGeneration) {
        set((state) => ({
          nodes: sortNodes(
            replaceNode(state.nodes, optimistic.id, created, true),
          ),
        }));
      }

      return created;
    } catch (error) {
      if (generation === treeGeneration) {
        set((state) => ({
          nodes: removeNode(state.nodes, optimistic.id),
        }));
      }

      throw error;
    }
  },

  async createMemo(accessToken, input) {
    const generation = treeGeneration;
    const previousNodes = get().nodes;

    if (input.parent_id !== null && findSiblings(previousNodes, input.parent_id) === null) {
      throw new Error("目标文件夹不存在。");
    }

    const optimistic = optimisticNode(previousNodes, "memo", input);
    set({
      nodes: insertNode(
        previousNodes,
        optimistic,
        input.parent_id,
        input.sort_order,
      ),
    });

    try {
      const created = await createMemoRequest(accessToken, input);

      if (generation === treeGeneration) {
        set((state) => ({
          nodes: sortNodes(
            replaceNode(state.nodes, optimistic.id, created, true),
          ),
        }));
      }

      return created;
    } catch (error) {
      if (generation === treeGeneration) {
        set((state) => ({
          nodes: removeNode(state.nodes, optimistic.id),
        }));
      }

      throw error;
    }
  },

  async moveNode(accessToken, nodeId, input) {
    const generation = treeGeneration;
    const previousNodes = get().nodes;
    const sourceNode = findNode(previousNodes, nodeId);
    const version = nextVersion(moveVersions, nodeId);

    if (
      sourceNode === null ||
      input.parent_id === nodeId ||
      (input.parent_id !== null && findSiblings(previousNodes, input.parent_id) === null) ||
      (input.parent_id !== null && isDescendant(previousNodes, nodeId, input.parent_id))
    ) {
      throw new Error("不能把节点移动到自己或自己的后代中。");
    }

    set({
      nodes: moveNodeInTree(
        previousNodes,
        nodeId,
        input.parent_id,
        input.sort_order,
      ),
    });

    try {
      const updated = await enqueueNodeRequest(
        moveQueues,
        nodeId,
        () => moveMemoNode(accessToken, nodeId, input),
      );

      if (
        generation === treeGeneration &&
        moveVersions.get(nodeId) === version
      ) {
        set((state) => ({
          nodes: sortNodes(
            updateNode(state.nodes, nodeId, (currentNode) =>
              mergeServerNode(currentNode, updated)),
          ),
        }));
      }
    } catch (error) {
      if (
        generation === treeGeneration &&
        moveVersions.get(nodeId) === version
      ) {
        set((state) => ({
          nodes: moveNodeInTree(
            state.nodes,
            nodeId,
            sourceNode.parent_id,
            sourceNode.sort_order,
          ),
        }));
      }

      throw error;
    }
  },

  async renameNode(accessToken, nodeId, title) {
    const normalizedTitle = title.trim();

    if (normalizedTitle.length === 0) {
      throw new Error("名称不能为空。");
    }

    const generation = treeGeneration;
    const previousNodes = get().nodes;
    const previousTitle = findNode(previousNodes, nodeId)?.title;
    const version = nextVersion(renameVersions, nodeId);

    if (previousTitle === undefined) {
      throw new Error("要重命名的节点不存在。");
    }

    set({
      nodes: updateNode(previousNodes, nodeId, (node) => ({
        ...node,
        title: normalizedTitle,
      })),
    });

    try {
      const updated = await enqueueNodeRequest(
        renameQueues,
        nodeId,
        () => updateMemoNode(
          accessToken,
          nodeId,
          { title: normalizedTitle },
        ),
      );

      if (
        generation === treeGeneration &&
        renameVersions.get(nodeId) === version
      ) {
        set((state) => ({
          nodes: updateNode(state.nodes, nodeId, (currentNode) =>
            mergeServerNode(currentNode, updated)),
        }));
      }

      return updated;
    } catch (error) {
      if (
        generation === treeGeneration &&
        renameVersions.get(nodeId) === version
      ) {
        set((state) => ({
          nodes: updateNode(state.nodes, nodeId, (node) => ({
            ...node,
            title: previousTitle,
          })),
        }));
      }

      throw error;
    }
  },

  async softDeleteNode(accessToken, nodeId) {
    const generation = treeGeneration;
    const sourceNode = findNode(get().nodes, nodeId);

    if (sourceNode === null) {
      throw new Error("要删除的节点不存在。");
    }

    set((state) => ({ nodes: removeNode(state.nodes, nodeId) }));

    try {
      await softDeleteMemoNode(accessToken, nodeId);
    } catch (error) {
      if (generation === treeGeneration) {
        set((state) => ({
          nodes: insertNode(
            state.nodes,
            sourceNode,
            sourceNode.parent_id,
            sourceNode.sort_order,
          ),
        }));
      }

      throw error;
    }
  },

  async restoreNode(accessToken, nodeId) {
    const generation = treeGeneration;
    const restored = await restoreMemoNode(accessToken, nodeId);

    if (generation === treeGeneration) {
      set((state) => {
        if (findNode(state.nodes, restored.id) !== null) {
          return state;
        }

        return {
          nodes: insertNode(
            state.nodes,
            restored,
            restored.parent_id,
            restored.sort_order,
          ),
        };
      });
    }

    return restored;
  },

  updateMemoContentLocal(nodeId, content) {
    set((state) => ({
      nodes: updateNode(state.nodes, nodeId, (node) =>
        node.memo === null
          ? node
          : {
              ...node,
              memo: { ...node.memo, content_mdx: content },
            }),
    }));
  },

  async saveMemoDraft(accessToken, nodeId, input, options) {
    const generation = treeGeneration;
    const currentNode = findNode(get().nodes, nodeId);

    if (currentNode?.memo === null || currentNode === null) {
      throw new Error("要保存的备忘录不存在。");
    }

    if (input.title === undefined && input.content_mdx === undefined) {
      throw new Error("没有需要保存的备忘录字段。");
    }

    const previousTitle = currentNode.title;

    if (input.title !== undefined) {
      set((state) => ({
        nodes: updateNode(state.nodes, nodeId, (node) => ({
          ...node,
          title: input.title ?? node.title,
        })),
      }));
    }

    let updated: MemoTreeNode;

    try {
      updated = await updateMemo(accessToken, nodeId, input, options);
    } catch (error) {
      if (generation === treeGeneration && input.title !== undefined) {
        set((state) => ({
          nodes: updateNode(state.nodes, nodeId, (node) =>
            node.title === input.title
              ? { ...node, title: previousTitle }
              : node),
        }));
      }

      throw error;
    }

    if (generation === treeGeneration) {
      set((state) => {
        const current = findNode(state.nodes, nodeId);

        if (current?.memo === null || current === null) {
          return state;
        }

        const titleStillCurrent =
          input.title !== undefined && current.title === input.title;
        const contentStillCurrent =
          input.content_mdx !== undefined &&
          current.memo.content_mdx === input.content_mdx;

        if (!titleStillCurrent && !contentStillCurrent) {
          return state;
        }

        return {
          nodes: updateNode(state.nodes, nodeId, (currentNode) => ({
            ...currentNode,
            title: titleStillCurrent ? updated.title : currentNode.title,
            memo: contentStillCurrent
              ? updated.memo ?? currentNode.memo
              : currentNode.memo,
            updated_at: updated.updated_at,
          })),
        };
      });
    }

    return updated;
  },

  async saveMemoContent(accessToken, nodeId, content, options) {
    return get().saveMemoDraft(
      accessToken,
      nodeId,
      { content_mdx: content },
      options,
    );
  },

  reset() {
    treeGeneration += 1;
    moveVersions.clear();
    renameVersions.clear();
    moveQueues.clear();
    renameQueues.clear();
    set({ nodes: [] });
  },
}));
