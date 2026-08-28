/**
 * [INPUT]: 依赖 Zustand、轻量 memo/ai API、memoTree 算法、memoTitleRules 的默认画布标题跟随、memoDocumentStore 与 AI Command 投影/事实对账
 * [OUTPUT]: 对外提供不含正文的 active tree、真人乐观结构 CRUD、AI tool_call 结构投影/回滚与 command 幂等对账
 * [POS]: app/src/shared/store 的目录结构唯一状态源；正文交给 memoDocumentStore，api command output 才是 AI 写事实。任何本地改标题都顺带镜像数据库的默认画布同步触发器，否则文件树会显示一个服务端已经改掉的旧画布名
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from "zustand";

import type { AiCommand, AiRun } from "../api/ai";
import {
  createMemo as createMemoRequest,
  createMemoFolder,
  getMemoTree,
  moveMemoNode,
  restoreMemoNode,
  softDeleteMemoNode,
  updateMemoNode,
  type CreateMemoFolderInput,
  type CreateMemoInput,
  type MemoDetailNode,
  type MemoWriteOptions,
  type MemoTreeNode,
  type MoveMemoNodeInput,
  type UpdateMemoInput,
} from "../api/memo";
import {
  appendSortOrder,
  betweenSortOrders,
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
import { summarizeMemoDetail } from "../api/memo.mapper";
import { useMemoDocumentStore } from "./memoDocumentStore";
import { withDefaultCanvasTitles } from "./memoTitleRules";
import { reconcileAiRunTree } from "./aiRunTree";
import { reconcileAiCommandTree } from "./aiCommandTree";
import {
  type AiCommandProjection,
  rollbackAiCommandProjection,
} from "./aiCommandProjection";

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
  waitForMemoId(nodeId: string): Promise<string>;
  updateMemoContentLocal(nodeId: string, content: string): void;
  updateMemoTitleLocal(nodeId: string, title: string): void;
  mergeMemoDetail(detail: MemoDetailNode): void;
  mergeServerNode(node: MemoTreeNode): void;
  saveMemoDraft(
    accessToken: string,
    nodeId: string,
    input: UpdateMemoInput,
    options?: MemoWriteOptions,
  ): Promise<MemoDetailNode>;
  saveMemoContent(
    accessToken: string,
    nodeId: string,
    content: string,
    options?: MemoWriteOptions,
  ): Promise<MemoDetailNode>;
  reconcileAiRun(run: AiRun): void;
  reconcileAiCommand(command: AiCommand): void;
  projectAiToolCall(
    toolCallId: string,
    operation: AiCommand["operation"],
    input: Readonly<Record<string, unknown>>,
  ): void;
  rollbackAiToolCall(toolCallId: string): void;
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
const reconciledAiCommandStates = new Map<string, AiCommand["status"]>();
const aiProjections = new Map<string, AiCommandProjection>();

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
    revision: 1,
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
    useMemoDocumentStore.getState().primeMemo({
      ...optimistic,
      children: [],
      memo: {
        ...(optimistic.memo!),
        content_mdx: input.content_mdx ?? "",
      },
    });
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
        const createdDetail = await createMemoRequest(accessToken, input);
        const created = summarizeMemoDetail(createdDetail);
        let reconciled = created;

        // ---- id 身份映射: 无条件记录 ----
        // 节点身份能跨越整树重取, 只有视觉 set() 受 generation 门禁,
        // 映射本身必须无条件落账, 否则在飞期间的 fetchTree/reset 会把
        // 临时 id -> 真实 id 的对应关系连坐清掉, 编辑器继续用临时 id 寻址。
        resolvedMemoIds.set(optimistic.id, created.id);
        memoClientKeys.set(created.id, optimistic.id);
        useMemoDocumentStore.getState().rekeyMemo(
          optimistic.id,
          createdDetail,
          input.content_mdx ?? "",
          input.title,
        );

        if (generation === treeGeneration) {
          set((state) => {
            const current = findNode(state.nodes, optimistic.id);

            if (current === null) {
              return state;
            }

            const localPositionChanged =
              current.parent_id !== input.parent_id ||
              current.sort_order !== (input.sort_order ?? current.sort_order);
            reconciled = {
              ...created,
              children: current.children,
              parent_id: localPositionChanged ? current.parent_id : created.parent_id,
              sort_order: localPositionChanged ? current.sort_order : created.sort_order,
              title: current.title !== input.title ? current.title : created.title,
            };
            return {
              nodes: sortNodes(
                replaceNode(state.nodes, optimistic.id, reconciled, true),
              ),
            };
          });
        }

        return reconciled;
      } catch (error) {
        // 失败记账同属身份层, 不受 generation 门禁 (同上)
        failedMemoCreations.set(optimistic.id, error);

        if (generation === treeGeneration) {
          set((state) => ({
            nodes: removeNode(state.nodes, optimistic.id),
          }));
        }
        useMemoDocumentStore.getState().removeMemos(new Set([optimistic.id]));

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

    // 默认 Canvas 的标题跟随来源笔记：数据库触发器在同一事务里改，本地树同步镜像
    set({
      nodes: withDefaultCanvasTitles(updateNode(previousNodes, nodeId, (node) => ({
        ...node,
        title: normalizedTitle,
      }))),
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
          nodes: withDefaultCanvasTitles(
            updateNode(state.nodes, targetNodeId, (currentNode) =>
              mergeServerNode(currentNode, updated)),
          ),
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
          nodes: withDefaultCanvasTitles(
            updateNode(state.nodes, targetNodeId, (node) => ({
              ...node,
              title: previousTitle,
            })),
          ),
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

  waitForMemoId(nodeId) {
    return resolveCommittedMemoId(nodeId);
  },

  updateMemoContentLocal(nodeId, content) {
    useMemoDocumentStore.getState().updateContentLocal(resolveMemoId(nodeId), content);
  },

  updateMemoTitleLocal(nodeId, title) {
    const targetNodeId = resolveMemoId(nodeId);
    set((state) => ({
      nodes: withDefaultCanvasTitles(updateNode(state.nodes, targetNodeId, (node) => ({
        ...node,
        title,
      }))),
    }));
  },

  mergeMemoDetail(detail) {
    const summary = summarizeMemoDetail(detail);
    set((state) => ({
      nodes: withDefaultCanvasTitles(updateNode(state.nodes, detail.id, (current) => ({
        ...current,
        ...summary,
        children: current.children,
        title: current.title === detail.title ? detail.title : current.title,
      }))),
    }));
  },

  /**
   * 并入一个服务端已经建成的节点（保存画布、卡片晋升）。
   * 服务端已经算好 parent_id 与 sort_order，因此原样落位；重复并入按 id 幂等替换。
   * 存在的理由只有一个: 写成功后严禁刷新整棵树。
   */
  mergeServerNode(node) {
    set((state) => {
      const existing = findNode(state.nodes, node.id);
      const merged: MemoTreeNode = {
        ...node,
        children: existing?.children ?? node.children ?? [],
      };

      return {
        nodes: existing === null
          ? insertNode(state.nodes, merged, node.parent_id, node.sort_order)
          : replaceNode(state.nodes, node.id, merged),
      };
    });
  },

  async saveMemoDraft(accessToken, nodeId, input, options) {
    const localNodeId = resolveMemoId(nodeId);
    const previousTitle = findNode(get().nodes, localNodeId)?.title;
    if (input.title !== undefined) get().updateMemoTitleLocal(localNodeId, input.title);
    const targetNodeId = await resolveCommittedMemoId(nodeId);
    let detail: MemoDetailNode;
    try {
      detail = await useMemoDocumentStore.getState().saveMemoDraft(
        accessToken,
        targetNodeId,
        input,
        options,
      );
    } catch (error) {
      if (input.title !== undefined && previousTitle !== undefined) {
        set((state) => ({
          nodes: withDefaultCanvasTitles(
            updateNode(state.nodes, targetNodeId, (node) =>
              node.title === input.title ? { ...node, title: previousTitle } : node),
          ),
        }));
      }
      throw error;
    }
    get().mergeMemoDetail(detail);
    return detail;
  },

  saveMemoContent(accessToken, nodeId, content, options) {
    return get().saveMemoDraft(
      accessToken,
      nodeId,
      { content_mdx: content },
      options,
    );
  },

  reconcileAiRun(run) {
    set((state) => ({
      nodes: withDefaultCanvasTitles(reconcileAiRunTree(state.nodes, run)),
    }));
  },

  reconcileAiCommand(command) {
    if (reconciledAiCommandStates.get(command.id) === command.status) return;
    reconciledAiCommandStates.set(command.id, command.status);
    const toolCallId = command.tool_call_id;
    const projection = toolCallId === null ? undefined : aiProjections.get(toolCallId);
    if (toolCallId !== null) aiProjections.delete(toolCallId);
    set((state) => {
      const withoutProjection = projection === undefined
        ? state.nodes
        : command.status === "succeeded"
          ? projection.optimisticId === null
            ? state.nodes
            : removeNode(state.nodes, projection.optimisticId)
          : rollbackAiCommandProjection(state.nodes, projection);
      return {
        nodes: withDefaultCanvasTitles(
          reconcileAiCommandTree(withoutProjection, command),
        ),
      };
    });
  },

  projectAiToolCall(toolCallId, operation, input) {
    if (aiProjections.has(toolCallId)) return;
    const currentNodes = get().nodes;
    const nodeId = typeof input.node_id === "string" ? input.node_id : null;
    const before = nodeId === null ? null : findNode(currentNodes, nodeId);

    if (operation === "create_node") {
      const nodeType = input.node_type === "folder" ? "folder" : "memo";
      const parentId = typeof input.parent_id === "string" ? input.parent_id : null;
      const optimistic = optimisticNode(currentNodes, nodeType, {
        title: typeof input.title === "string" ? input.title : "新笔记",
        parent_id: parentId,
        ...(nodeType === "memo" && typeof input.content_mdx === "string"
          ? { content_mdx: input.content_mdx }
          : {}),
      });
      aiProjections.set(toolCallId, {
        before: null,
        operation,
        optimisticId: optimistic.id,
        projected: {},
      });
      set({ nodes: insertNode(currentNodes, optimistic, parentId) });
      return;
    }

    if (before === null) return;
    if (operation === "rename_node" && typeof input.title === "string") {
      aiProjections.set(toolCallId, { before, operation, optimisticId: null, projected: { title: input.title } });
      set({
        nodes: withDefaultCanvasTitles(
          updateNode(currentNodes, before.id, (node) => ({
            ...node,
            title: input.title as string,
          })),
        ),
      });
      return;
    }
    if (operation === "edit_memo" && typeof input.content_mdx === "string" && before.memo !== null) {
      aiProjections.set(toolCallId, { before, operation, optimisticId: null, projected: {} });
      return;
    }
    if (operation === "trash_node") {
      aiProjections.set(toolCallId, { before, operation, optimisticId: null, projected: {} });
      set({ nodes: removeNode(currentNodes, before.id) });
      return;
    }

    let parentId = before.parent_id;
    let sortOrder = before.sort_order;
    if (operation === "move_node") {
      parentId = typeof input.parent_id === "string" ? input.parent_id : null;
      const siblings = findSiblings(currentNodes, parentId)?.filter((node) => node.id !== before.id) ?? [];
      sortOrder = typeof input.planned_sort_order === "string"
        ? input.planned_sort_order
        : appendSortOrder(siblings);
    } else if (operation === "reorder_node" && typeof input.reference_node_id === "string") {
      const siblings = findSiblings(currentNodes, before.parent_id)?.filter((node) => node.id !== before.id) ?? [];
      const referenceIndex = siblings.findIndex((node) => node.id === input.reference_node_id);
      if (referenceIndex < 0) return;
      const insertionIndex = input.placement === "before" ? referenceIndex : referenceIndex + 1;
      sortOrder = typeof input.planned_sort_order === "string"
        ? input.planned_sort_order
        : betweenSortOrders(
            siblings[insertionIndex - 1],
            siblings[insertionIndex],
          );
    } else {
      return;
    }
    aiProjections.set(toolCallId, { before, operation, optimisticId: null, projected: { parent_id: parentId, sort_order: sortOrder } });
    set({ nodes: moveNodeInTree(currentNodes, before.id, parentId, sortOrder) });
  },

  rollbackAiToolCall(toolCallId) {
    const projection = aiProjections.get(toolCallId);
    if (projection === undefined) return;
    aiProjections.delete(toolCallId);
    set((state) => ({
      nodes: withDefaultCanvasTitles(
        rollbackAiCommandProjection(state.nodes, projection),
      ),
    }));
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
    reconciledAiCommandStates.clear();
    aiProjections.clear();
    useMemoDocumentStore.getState().reset();
    set({ nodes: [] });
  },
}));
