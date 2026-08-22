/**
 * [INPUT]: 依赖 MemoTreeNode、AI Command 操作类型与 memoTree 不可变树算法
 * [OUTPUT]: 对外提供 AiCommandProjection 与 rollbackAiCommandProjection，按字段 CAS 精确撤销未获批/失败的前端投影
 * [POS]: shared/store 的 AI 乐观事务纯函数；Store 管生命周期，本模块只负责不覆盖用户后续编辑的安全逆投影
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiCommand } from "../api/ai";
import type { MemoTreeNode } from "../api/memo";
import {
  findNode,
  insertNode,
  moveNodeInTree,
  removeNode,
  updateNode,
} from "./memoTree";

export type AiCommandProjection = {
  before: MemoTreeNode | null;
  operation: AiCommand["operation"];
  optimisticId: string | null;
  projected: Readonly<Record<string, unknown>>;
};

export const rollbackAiCommandProjection = (
  nodes: readonly MemoTreeNode[],
  projection: AiCommandProjection,
): MemoTreeNode[] => {
  if (projection.optimisticId !== null) {
    return removeNode(nodes, projection.optimisticId);
  }

  const before = projection.before;
  if (before === null) return [...nodes];
  const current = findNode(nodes, before.id);

  if (projection.operation === "trash_node") {
    return current === null
      ? insertNode(nodes, before, before.parent_id, before.sort_order)
      : [...nodes];
  }
  if (current === null) return [...nodes];
  if (projection.operation === "rename_node"
    && current.title === projection.projected.title) {
    return updateNode(nodes, before.id, (node) => ({
      ...node,
      title: before.title,
    }));
  }
  if ((projection.operation === "move_node" || projection.operation === "reorder_node")
    && current.parent_id === projection.projected.parent_id
    && current.sort_order === projection.projected.sort_order) {
    return moveNodeInTree(
      nodes,
      before.id,
      before.parent_id,
      before.sort_order,
    );
  }

  return [...nodes];
};
