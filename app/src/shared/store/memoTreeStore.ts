/**
 * [INPUT]: 依赖 Zustand、shared/api/memo 的显式 token 命令与 memoTree 纯树算法
 * [OUTPUT]: 对外提供 active tree 单一状态、可立即导航的备忘录创建事务、临时/真实 ID 解析、串行写队列、CRUD、软删快照回滚、恢复 subtree 合并与草稿并发保护
 * [POS]: app/src/shared/store 的 active 备忘录单一数据源；创建先暴露稳定客户端身份再后台提交，删除先移除、恢复只合并响应，任何写成功都禁止整树 refetch
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
  beginCreateMemo(
    accessToken: string,
    input: CreateMemoInput,
  ): OptimisticMemoCreation;
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
  getMemoClientKey(nodeId: string): string;
  resolveMemoId(nodeId: string): string;
  updateMemoContentLocal(nodeId: string, content: string): void;
  updateMemoTitleLocal(nodeId: string, title: string): void;
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

export type OptimisticMemoCreation = {
  committed: Promise<MemoTreeNode>;
  optimistic: MemoTreeNode;
};

let treeGeneration = 0;
const moveVersions = new Map<string, number>();
const renameVersions = new Map<string, number>();
const moveQueues = new Map<string, Promise<void>>();
const renameQueues = new Map<string, Promise<void>>();
const pendingMemoCreations = new Map<string, Promise<MemoTreeNode>>();
const failedMemoCreations = new Map<string, unknown>();
const resolvedMemoIds = new Map<string, string>();
const memoClientKeys = new Map<string, string>();

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

const resolveMemoId = (nodeId: string): string =>
  resolvedMemoIds.get(nodeId) ?? nodeId;

const resolveCommittedMemoId = async (nodeId: string): Promise<string> => {
  const pendingCreation = pendingMemoCreations.get(nodeId);

  if (pendingCreation !== undefined) {
    return (await pendingCreation).id;
  }

  if (failedMemoCreations.has(nodeId)) {
    throw failedMemoCreations.get(nodeId);
  }

  return resolveMemoId(nodeId);
};

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

const reconcileCreatedMemo = (
  currentNode: MemoTreeNode,
  serverNode: MemoTreeNode,
  input: CreateMemoInput,
): MemoTreeNode => {
  const initialContent = input.content_mdx ?? "";
  const localTitleChanged = currentNode.title !== input.title;
  const localContentChanged =
    currentNode.memo?.content_mdx !== initialContent;
  const localPositionChanged =
    currentNode.parent_id !== input.parent_id ||
    currentNode.sort_order !== (input.sort_order ?? currentNode.sort_order);

  return {
    ...serverNode,
    children: currentNode.children,
    parent_id: localPositionChanged
      ? currentNode.parent_id
      : serverNode.parent_id,
    sort_order: localPositionChanged
      ? currentNode.sort_order
      : serverNode.sort_order,
    title: localTitleChanged ? currentNode.title : serverNode.title,
    memo: serverNode.memo === null || currentNode.memo === null
      ? serverNode.memo ?? currentNode.memo
      : {
          ...serverNode.memo,
          content_mdx: localContentChanged
            ? currentNode.memo.content_mdx
            : serverNode.memo.content_mdx,
        },
  };
};

const rekeyMemoNode = (
  node: MemoTreeNode,
  nodeId: string,
): MemoTreeNode => ({
  ...node,
  id: nodeId,
  memo: node.memo === null
    ? null
    : { ...node.memo, node_id: nodeId },
});

export const useMemoTreeStore = create<MemoTreeState>()((set, get) => ({
  nodes: [],

  beginCreateMemo(accessToken, input) {
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

    const committed = (async () => {
      try {
        const created = await createMemoRequest(accessToken, input);
        let reconciled = created;

        if (generation === treeGeneration) {
          resolvedMemoIds.set(optimistic.id, created.id);
          memoClientKeys.set(created.id, optimistic.id);
          set((state) => {
            const current = findNode(state.nodes, optimistic.id);

            if (current === null) {
              return state;
            }

            reconciled = reconcileCreatedMemo(current, created, input);
            return {
              nodes: sortNodes(
                replaceNode(state.nodes, optimistic.id, reconciled, true),
              ),
            };
          });
        }

        return reconciled;
      } catch (error) {
        if (generation === treeGeneration) {
          failedMemoCreations.set(optimistic.id, error);
          set((state) => ({
            nodes: removeNode(state.nodes, optimistic.id),
          }));
        }

        throw error;
      } finally {
        pendingMemoCreations.delete(optimistic.id);
      }
    })();

    pendingMemoCreations.set(optimistic.id, committed);
    return { committed, optimistic };
  },

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

  createMemo(accessToken, input) {
    return get().beginCreateMemo(accessToken, input).committed;
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
        async () => moveMemoNode(
          accessToken,
          await resolveCommittedMemoId(nodeId),
          input,
        ),
      );

      if (
        generation === treeGeneration &&
        moveVersions.get(nodeId) === version
      ) {
        const targetNodeId = resolveMemoId(nodeId);
        set((state) => ({
          nodes: sortNodes(
            updateNode(state.nodes, targetNodeId, (currentNode) =>
              mergeServerNode(currentNode, updated)),
          ),
        }));
      }
    } catch (error) {
      if (
        generation === treeGeneration &&
        moveVersions.get(nodeId) === version
      ) {
        const targetNodeId = resolveMemoId(nodeId);
        set((state) => ({
          nodes: moveNodeInTree(
            state.nodes,
            targetNodeId,
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
        async () => updateMemoNode(
          accessToken,
          await resolveCommittedMemoId(nodeId),
          { title: normalizedTitle },
        ),
      );

      if (
        generation === treeGeneration &&
        renameVersions.get(nodeId) === version
      ) {
        const targetNodeId = resolveMemoId(nodeId);
        set((state) => ({
          nodes: updateNode(state.nodes, targetNodeId, (currentNode) =>
            mergeServerNode(currentNode, updated)),
        }));
      }

      return updated;
    } catch (error) {
      if (
        generation === treeGeneration &&
        renameVersions.get(nodeId) === version
      ) {
        const targetNodeId = resolveMemoId(nodeId);
        set((state) => ({
          nodes: updateNode(state.nodes, targetNodeId, (node) => ({
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
      await softDeleteMemoNode(
        accessToken,
        await resolveCommittedMemoId(nodeId),
      );
    } catch (error) {
      if (generation === treeGeneration) {
        if (failedMemoCreations.has(nodeId)) {
          throw error;
        }

        const targetNodeId = resolveMemoId(nodeId);
        set((state) => ({
          nodes: insertNode(
            state.nodes,
            rekeyMemoNode(sourceNode, targetNodeId),
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

  getMemoClientKey(nodeId) {
    return memoClientKeys.get(nodeId) ?? nodeId;
  },

  resolveMemoId(nodeId) {
    return resolveMemoId(nodeId);
  },

  updateMemoContentLocal(nodeId, content) {
    const targetNodeId = resolveMemoId(nodeId);
    set((state) => ({
      nodes: updateNode(state.nodes, targetNodeId, (node) =>
        node.memo === null
          ? node
          : {
              ...node,
              memo: { ...node.memo, content_mdx: content },
            }),
    }));
  },

  updateMemoTitleLocal(nodeId, title) {
    const targetNodeId = resolveMemoId(nodeId);
    set((state) => ({
      nodes: updateNode(state.nodes, targetNodeId, (node) => ({
        ...node,
        title,
      })),
    }));
  },

  async saveMemoDraft(accessToken, nodeId, input, options) {
    const generation = treeGeneration;
    const localNodeId = resolveMemoId(nodeId);
    const currentNode = findNode(get().nodes, localNodeId);

    if (currentNode?.memo === null || currentNode === null) {
      throw new Error("要保存的备忘录不存在。");
    }

    if (input.title === undefined && input.content_mdx === undefined) {
      throw new Error("没有需要保存的备忘录字段。");
    }

    const previousTitle = currentNode.title;

    if (input.title !== undefined) {
      set((state) => ({
        nodes: updateNode(state.nodes, localNodeId, (node) => ({
          ...node,
          title: input.title ?? node.title,
        })),
      }));
    }

    const targetNodeId = await resolveCommittedMemoId(nodeId);
    let updated: MemoTreeNode;

    try {
      updated = await updateMemo(accessToken, targetNodeId, input, options);
    } catch (error) {
      if (generation === treeGeneration && input.title !== undefined) {
        set((state) => ({
          nodes: updateNode(state.nodes, targetNodeId, (node) =>
            node.title === input.title
              ? { ...node, title: previousTitle }
              : node),
        }));
      }

      throw error;
    }

    if (generation === treeGeneration) {
      set((state) => {
        const current = findNode(state.nodes, targetNodeId);

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
          nodes: updateNode(state.nodes, targetNodeId, (currentNode) => ({
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
    pendingMemoCreations.clear();
    failedMemoCreations.clear();
    resolvedMemoIds.clear();
    memoClientKeys.clear();
    set({ nodes: [] });
  },
}));
