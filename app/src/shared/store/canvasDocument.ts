/**
 * [INPUT]: 依赖 shared/api/canvas 的 V2 文档、操作与 mutation 回执类型
 * [OUTPUT]: 对外提供带本地展示提示的 Canvas intent、操作合并、乐观投影、服务端回执归一与冲突 rebase 纯函数
 * [POS]: shared/store 的 Canvas documentSlice 领域内核；React、网络、IndexedDB 都不能进入这里，保证恢复与在线编辑走同一套确定性投影
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  CanvasDetail,
  CanvasEdge,
  CanvasMutationResult,
  CanvasNode,
  CanvasNodeRow,
  CanvasOperation,
} from "../api/canvas";

export type CanvasIntentHint = {
  excerpt?: string | null;
  revision?: number;
  title?: string;
};

export type CanvasIntent = {
  operation: CanvasOperation;
  hint?: CanvasIntentHint;
};

const cloneDetail = (detail: CanvasDetail): CanvasDetail => ({
  canvas: { ...detail.canvas, metadata: { ...detail.canvas.metadata }, viewport: { ...detail.canvas.viewport } },
  edges: detail.edges.map((edge) => ({ ...edge })),
  node: detail.node,
  nodes: detail.nodes.map((node) => ({
    ...node,
    target: node.target === null ? null : { ...node.target },
  })),
});

const edgePairKey = (sourceId: string, targetId: string): string =>
  sourceId < targetId
    ? `${sourceId}:${targetId}`
    : `${targetId}:${sourceId}`;

const placeholderMemoNode = (
  operation: Extract<CanvasOperation, { type: "add_memo" }>,
  hint?: CanvasIntentHint,
): CanvasNode => ({
  created_by: "user",
  discovered_from_id: operation.discovered_from_id ?? null,
  height: null,
  id: operation.node_id,
  kind: "memo_ref",
  snapshot_excerpt: hint?.excerpt ?? null,
  snapshot_revision: hint?.revision ?? null,
  snapshot_title: hint?.title ?? "等待同步的笔记",
  target: hint?.title === undefined ? null : {
    deleted_at: null,
    excerpt: hint.excerpt ?? null,
    node_id: operation.target_node_id,
    revision: hint.revision ?? 1,
    title: hint.title,
  },
  target_node_id: operation.target_node_id,
  text: null,
  text_scale: null,
  width: null,
  x: operation.x,
  y: operation.y,
});

const applyOne = (
  detail: CanvasDetail,
  { hint, operation }: CanvasIntent,
): void => {
  if (operation.type === "add_memo") {
    let targetNode = detail.nodes.find(
      (node) =>
        node.kind === "memo_ref"
        && node.target_node_id === operation.target_node_id,
    );

    if (targetNode === undefined) {
      targetNode = placeholderMemoNode(operation, hint);
      detail.nodes.push(targetNode);
    }

    if (
      operation.source_node_id !== undefined
      && operation.edge_id !== undefined
      && operation.source_node_id !== targetNode.id
    ) {
      const pair = edgePairKey(operation.source_node_id, targetNode.id);
      const existing = detail.edges.find(
        (edge) => edgePairKey(edge.source_id, edge.target_id) === pair,
      );
      if (existing === undefined) {
        detail.edges.push({
          created_by: "user",
          id: operation.edge_id,
          rationale: operation.rationale ?? null,
          source_id: operation.source_node_id,
          target_id: targetNode.id,
        });
      } else if (operation.rationale !== undefined) {
        existing.rationale = operation.rationale;
      }
    }
    return;
  }

  if (operation.type === "create_text") {
    if (detail.nodes.some((node) => node.id === operation.node_id)) {
      return;
    }
    detail.nodes.push({
      created_by: "user",
      discovered_from_id: null,
      height: operation.height ?? 48,
      id: operation.node_id,
      kind: "native",
      snapshot_excerpt: null,
      snapshot_revision: null,
      snapshot_title: null,
      target: null,
      target_node_id: null,
      text: operation.text,
      text_scale: operation.text_scale ?? 1,
      width: operation.width ?? 240,
      x: operation.x,
      y: operation.y,
    });
    return;
  }

  if (operation.type === "update_node") {
    const node = detail.nodes.find((candidate) => candidate.id === operation.node_id);
    if (node === undefined) {
      return;
    }
    if (operation.x !== undefined) node.x = operation.x;
    if (operation.y !== undefined) node.y = operation.y;
    if (operation.text !== undefined && node.kind === "native") {
      node.text = operation.text;
    }
    if (operation.width !== undefined && node.kind === "native") {
      node.width = operation.width;
    }
    if (operation.height !== undefined && node.kind === "native") {
      node.height = operation.height;
    }
    if (operation.text_scale !== undefined && node.kind === "native") {
      node.text_scale = operation.text_scale;
    }
    return;
  }

  if (operation.type === "remove_node") {
    const removed = detail.nodes.find((node) => node.id === operation.node_id);
    detail.nodes = detail.nodes.filter((node) => node.id !== operation.node_id);
    detail.edges = detail.edges.filter(
      (edge) =>
        edge.source_id !== operation.node_id
        && edge.target_id !== operation.node_id,
    );
    if (
      detail.canvas.canvas_kind === "memo_default"
      && removed?.target_node_id === detail.canvas.origin_node_id
    ) {
      detail.canvas.canvas_kind = "standalone";
      detail.canvas.origin_node_id = null;
      detail.canvas.origin_revision = null;
    }
    return;
  }

  if (operation.type === "upsert_edge") {
    if (
      operation.source_id === operation.target_id
      || !detail.nodes.some((node) => node.id === operation.source_id)
      || !detail.nodes.some((node) => node.id === operation.target_id)
    ) {
      return;
    }
    const pair = edgePairKey(operation.source_id, operation.target_id);
    const existing = detail.edges.find(
      (edge) => edgePairKey(edge.source_id, edge.target_id) === pair,
    );
    if (existing === undefined) {
      detail.edges.push({
        created_by: "user",
        id: operation.edge_id,
        rationale: operation.rationale ?? null,
        source_id: operation.source_id,
        target_id: operation.target_id,
      });
    } else if (operation.rationale !== undefined) {
      existing.rationale = operation.rationale;
    }
    return;
  }

  if (operation.type === "remove_edge") {
    detail.edges = detail.edges.filter((edge) => edge.id !== operation.edge_id);
    return;
  }

  detail.canvas.viewport = { ...operation.viewport };
};

export const applyCanvasIntents = (
  base: CanvasDetail,
  intents: readonly CanvasIntent[],
): CanvasDetail => {
  const next = cloneDetail(base);
  for (const intent of intents) {
    applyOne(next, intent);
  }
  return next;
};

const mergeUpdate = (
  previous: Extract<CanvasOperation, { type: "update_node" }>,
  next: Extract<CanvasOperation, { type: "update_node" }>,
): Extract<CanvasOperation, { type: "update_node" }> => ({
  ...previous,
  ...next,
  node_id: previous.node_id,
  type: "update_node",
});

/**
 * 只合并确定可交换的高频操作：同节点连续更新、同一视口和同一边。
 * 创建后删除仍交给数据库识别 no-op，避免客户端误删一个服务端本已存在的 memo 投影。
 */
export const normalizeCanvasIntents = (
  intents: readonly CanvasIntent[],
): CanvasIntent[] => {
  const normalized: CanvasIntent[] = [];
  const updateIndex = new Map<string, number>();
  const edgeIndex = new Map<string, number>();
  let viewportIndex: number | null = null;

  for (const intent of intents) {
    const operation = intent.operation;

    if (operation.type === "update_node") {
      const createIndex = normalized.findIndex(
        (candidate) =>
          candidate.operation.type === "create_text"
          && candidate.operation.node_id === operation.node_id,
      );
      if (createIndex >= 0) {
        const created = normalized[createIndex]!;
        if (created.operation.type === "create_text") {
          normalized[createIndex] = {
            ...created,
            operation: {
              ...created.operation,
              ...(operation.x === undefined ? {} : { x: operation.x }),
              ...(operation.y === undefined ? {} : { y: operation.y }),
              ...(operation.text === undefined ? {} : { text: operation.text }),
              ...(operation.width === undefined ? {} : { width: operation.width }),
              ...(operation.height === undefined ? {} : { height: operation.height }),
              ...(operation.text_scale === undefined
                ? {}
                : { text_scale: operation.text_scale }),
            },
          };
        }
        continue;
      }

      const index = updateIndex.get(operation.node_id);
      if (index === undefined) {
        updateIndex.set(operation.node_id, normalized.length);
        normalized.push(intent);
      } else {
        const previous = normalized[index]!;
        if (previous.operation.type === "update_node") {
          normalized[index] = {
            ...previous,
            operation: mergeUpdate(previous.operation, operation),
          };
        }
      }
      continue;
    }

    if (operation.type === "set_viewport") {
      if (viewportIndex === null) {
        viewportIndex = normalized.length;
        normalized.push(intent);
      } else {
        normalized[viewportIndex] = intent;
      }
      continue;
    }

    if (operation.type === "upsert_edge") {
      const key = edgePairKey(operation.source_id, operation.target_id);
      const index = edgeIndex.get(key);
      if (index === undefined) {
        edgeIndex.set(key, normalized.length);
        normalized.push(intent);
      } else {
        normalized[index] = intent;
      }
      continue;
    }

    normalized.push(intent);
  }

  return normalized;
};

const fromNodeRow = (
  row: CanvasNodeRow,
  previous: CanvasNode | undefined,
): CanvasNode => ({
  created_by: row.created_by,
  discovered_from_id: row.discovered_from_id,
  height: row.height,
  id: row.id,
  kind: row.kind,
  snapshot_excerpt: row.snapshot_excerpt,
  snapshot_revision: row.snapshot_revision,
  snapshot_title: row.snapshot_title,
  target: previous?.target ?? null,
  target_node_id: row.target_node_id,
  text: row.text,
  text_scale: row.kind === "native"
    ? typeof row.metadata.text_scale === "number"
      ? row.metadata.text_scale
      : 1
    : null,
  width: row.width,
  x: Number(row.position_x),
  y: Number(row.position_y),
});

const remapAlias = (
  detail: CanvasDetail,
  clientId: string,
  nodeId: string,
): void => {
  if (clientId === nodeId) return;
  const clientNode = detail.nodes.find((node) => node.id === clientId);
  const canonical = detail.nodes.find((node) => node.id === nodeId);

  if (clientNode !== undefined && canonical === undefined) {
    clientNode.id = nodeId;
  } else {
    detail.nodes = detail.nodes.filter((node) => node.id !== clientId);
  }

  detail.edges = detail.edges.map((edge) => ({
    ...edge,
    source_id: edge.source_id === clientId ? nodeId : edge.source_id,
    target_id: edge.target_id === clientId ? nodeId : edge.target_id,
  }));
};

/** 把数据库回执收敛为新的服务端基线；dropped 操作不会被错误固化。 */
export const applyCanvasMutationResult = (
  base: CanvasDetail,
  intents: readonly CanvasIntent[],
  result: CanvasMutationResult,
): CanvasDetail => {
  const dropped = new Set(result.dropped.map((notice) => notice.index));
  const accepted = intents.filter((_, index) => !dropped.has(index));
  const next = applyCanvasIntents(base, accepted);

  for (const alias of result.aliases) {
    remapAlias(next, alias.client_id, alias.node_id);
  }

  for (const row of result.upserted_nodes) {
    const index = next.nodes.findIndex((node) => node.id === row.id);
    const node = fromNodeRow(row, index < 0 ? undefined : next.nodes[index]);
    if (index < 0) next.nodes.push(node);
    else next.nodes[index] = node;
  }

  for (const row of result.upserted_edges) {
    const edge: CanvasEdge = {
      created_by: row.created_by,
      id: row.id,
      rationale: row.rationale,
      source_id: row.source_id,
      target_id: row.target_id,
    };
    const index = next.edges.findIndex((candidate) => candidate.id === row.id);
    if (index < 0) next.edges.push(edge);
    else next.edges[index] = edge;
  }

  const removedNodeIds = new Set(result.removed_node_ids);
  const removedEdgeIds = new Set(result.removed_edge_ids);
  next.nodes = next.nodes.filter((node) => !removedNodeIds.has(node.id));
  next.edges = next.edges.filter(
    (edge) =>
      !removedEdgeIds.has(edge.id)
      && !removedNodeIds.has(edge.source_id)
      && !removedNodeIds.has(edge.target_id),
  );
  next.canvas.version = result.version;
  return next;
};
