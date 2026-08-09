/**
 * [INPUT]: 依赖客户端工具 zod schema、MemoTreeNode 快照与 shared/store/memoTree 纯树算法
 * [OUTPUT]: 对外提供 Worker 可调用的 planMemoTool，把读请求投影为结果、把单步写意图收敛为现有 Store 命令计划
 * [POS]: AgentPanel 工具的纯规划内核；只计算和校验，不访问网络、Zustand、React 或 DOM
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "../../shared/api/memo";
import {
  appendSortOrder,
  betweenSortOrders,
  findNode,
  findSiblings,
  isDescendant,
  sortNodes,
} from "../../shared/store/memoTree";
import {
  editMemoInputSchema,
  editNodeInputSchema,
  readMemoInputSchema,
  readTreeInputSchema,
  type EditNodeInput,
  type MemoOutput,
  type ReadTreeOutput,
} from "./memoToolSchemas";

export type MemoToolCommand =
  | "read_tree"
  | "edit_node"
  | "read_memo"
  | "edit_memo";

export type MemoToolPlan =
  | { kind: "read_tree"; output: ReadTreeOutput }
  | { kind: "read_memo"; output: MemoOutput }
  | {
      kind: "create_folder";
      op: "create";
      input: { parent_id: string | null; title: string };
    }
  | {
      kind: "create_memo";
      op: "create";
      input: {
        content_mdx?: string;
        parent_id: string | null;
        title: string;
      };
    }
  | {
      kind: "rename_node";
      op: "rename";
      nodeId: string;
      title: string;
    }
  | {
      kind: "move_node";
      op: "move" | "reorder";
      nodeId: string;
      input: { parent_id: string | null; sort_order: string };
    }
  | { kind: "delete_node"; op: "delete"; nodeId: string }
  | {
      kind: "edit_memo";
      nodeId: string;
      contentMdx: string;
    };

const requireNode = (
  nodes: readonly MemoTreeNode[],
  nodeId: string,
): MemoTreeNode => {
  const node = findNode(nodes, nodeId);

  if (node === null) {
    throw new Error(`节点 ${nodeId} 不存在或已不在 active 树中。`);
  }

  return node;
};

const validateParent = (
  nodes: readonly MemoTreeNode[],
  parentId: string | null,
): void => {
  if (parentId === null) {
    return;
  }

  const parent = requireNode(nodes, parentId);

  if (parent.node_type !== "folder") {
    throw new Error("目标父节点不是文件夹。");
  }
};

const flattenTree = (
  nodes: readonly MemoTreeNode[],
  depth = 0,
  ancestors: readonly string[] = [],
): ReadTreeOutput["nodes"] =>
  sortNodes(nodes).flatMap((node) => {
    const pathParts = [...ancestors, node.title];

    return [
      {
        depth,
        id: node.id,
        node_type: node.node_type,
        parent_id: node.parent_id,
        path: pathParts.join(" / "),
        sort_order: node.sort_order,
        title: node.title,
      },
      ...flattenTree(node.children, depth + 1, pathParts),
    ];
  });

const planReadTree = (
  input: unknown,
  nodes: readonly MemoTreeNode[],
): MemoToolPlan => {
  readTreeInputSchema.parse(input);
  const flattened = flattenTree(nodes);

  return {
    kind: "read_tree",
    output: { nodes: flattened, total: flattened.length },
  };
};

const memoOutput = (node: MemoTreeNode): MemoOutput => {
  if (node.node_type !== "memo" || node.memo === null) {
    throw new Error("目标节点不是可读取的备忘录。");
  }

  return {
    content_mdx: node.memo.content_mdx,
    id: node.id,
    parent_id: node.parent_id,
    title: node.title,
    updated_at: node.memo.updated_at,
  };
};

const planReadMemo = (
  input: unknown,
  nodes: readonly MemoTreeNode[],
): MemoToolPlan => {
  const parsed = readMemoInputSchema.parse(input);

  return {
    kind: "read_memo",
    output: memoOutput(requireNode(nodes, parsed.node_id)),
  };
};

const planCreate = (
  input: EditNodeInput,
  nodes: readonly MemoTreeNode[],
): MemoToolPlan => {
  const parentId = input.parent_id ?? null;
  validateParent(nodes, parentId);

  if (input.node_type === "folder") {
    return {
      input: { parent_id: parentId, title: input.title! },
      kind: "create_folder",
      op: "create",
    };
  }

  return {
    input: {
      ...(input.content_mdx === undefined
        ? {}
        : { content_mdx: input.content_mdx }),
      parent_id: parentId,
      title: input.title!,
    },
    kind: "create_memo",
    op: "create",
  };
};

const planMove = (
  input: EditNodeInput,
  nodes: readonly MemoTreeNode[],
): MemoToolPlan => {
  const node = requireNode(nodes, input.node_id!);
  const parentId = input.parent_id!;
  validateParent(nodes, parentId);

  if (
    parentId === node.id ||
    (parentId !== null && isDescendant(nodes, node.id, parentId))
  ) {
    throw new Error("不能把节点移动到自己或自己的后代中。");
  }

  const siblings = findSiblings(nodes, parentId);

  if (siblings === null) {
    throw new Error("目标文件夹不存在。");
  }

  return {
    input: {
      parent_id: parentId,
      sort_order: appendSortOrder(
        siblings.filter((sibling) => sibling.id !== node.id),
      ),
    },
    kind: "move_node",
    nodeId: node.id,
    op: "move",
  };
};

const planReorder = (
  input: EditNodeInput,
  nodes: readonly MemoTreeNode[],
): MemoToolPlan => {
  const node = requireNode(nodes, input.node_id!);
  const reference = requireNode(nodes, input.reference_node_id!);

  if (node.parent_id !== reference.parent_id) {
    throw new Error("reorder 只能在同一父目录内执行；跨目录请使用 move。");
  }

  const siblings = findSiblings(nodes, node.parent_id);

  if (siblings === null) {
    throw new Error("当前同级列表不存在。");
  }

  const withoutNode = sortNodes(
    siblings.filter((sibling) => sibling.id !== node.id),
  );
  const referenceIndex = withoutNode.findIndex(
    (sibling) => sibling.id === reference.id,
  );

  if (referenceIndex < 0) {
    throw new Error("参照节点不在当前同级列表中。");
  }

  const before = input.placement === "before";
  const previous = withoutNode[before ? referenceIndex - 1 : referenceIndex];
  const next = withoutNode[before ? referenceIndex : referenceIndex + 1];

  return {
    input: {
      parent_id: node.parent_id,
      sort_order: betweenSortOrders(previous, next),
    },
    kind: "move_node",
    nodeId: node.id,
    op: "reorder",
  };
};

const planEditNode = (
  input: unknown,
  nodes: readonly MemoTreeNode[],
): MemoToolPlan => {
  const parsed = editNodeInputSchema.parse(input);

  if (parsed.op === "create") {
    return planCreate(parsed, nodes);
  }

  const node = requireNode(nodes, parsed.node_id!);

  if (parsed.op === "rename") {
    return {
      kind: "rename_node",
      nodeId: node.id,
      op: "rename",
      title: parsed.title!,
    };
  }

  if (parsed.op === "move") {
    return planMove(parsed, nodes);
  }

  if (parsed.op === "reorder") {
    return planReorder(parsed, nodes);
  }

  return { kind: "delete_node", nodeId: node.id, op: "delete" };
};

const planEditMemo = (
  input: unknown,
  nodes: readonly MemoTreeNode[],
): MemoToolPlan => {
  const parsed = editMemoInputSchema.parse(input);
  memoOutput(requireNode(nodes, parsed.node_id));

  return {
    contentMdx: parsed.content_mdx,
    kind: "edit_memo",
    nodeId: parsed.node_id,
  };
};

export function planMemoTool(
  command: MemoToolCommand,
  input: unknown,
  nodes: readonly MemoTreeNode[],
): MemoToolPlan {
  if (command === "read_tree") {
    return planReadTree(input, nodes);
  }

  if (command === "read_memo") {
    return planReadMemo(input, nodes);
  }

  if (command === "edit_node") {
    return planEditNode(input, nodes);
  }

  return planEditMemo(input, nodes);
}

