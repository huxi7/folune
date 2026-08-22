/**
 * [INPUT]: 依赖 memo tree、当前查询、已选 ID、激活索引和搜索纯函数
 * [OUTPUT]: 对外提供只显示文件图标与文件名的 @笔记搜索列表、搜索纯函数与 mouse down 选择交互
 * [POS]: Prompt Bar 的无状态原生 @笔记命令菜单；结果保持内容宽度，键盘、IME 与选择生命周期归 AgentConversation 统一控制
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { FileTextIcon } from "../../shared/design-system/icons";
import type { MemoTreeNode } from "../../shared/api/memo";
import { findNode } from "../../shared/store/memoTree";
import { searchMemoTree } from "../memoLibrary";

export type MentionResult = {
  id: string;
  path: string;
  revision: number;
  title: string;
};

export const getMentionResults = (
  tree: readonly MemoTreeNode[],
  query: string,
  selectedIds: readonly string[],
  bodyHitIds: ReadonlySet<string> = new Set(),
): MentionResult[] => {
  const recent: Array<{ id: string; path: string; title: string }> = [];
  const visit = (nodes: readonly MemoTreeNode[], folders: readonly string[]) => {
    for (const node of nodes) {
      if (node.node_type === "folder") visit(node.children, [...folders, node.title]);
      else recent.push({
        id: node.id,
        path: folders.length === 0 ? "根目录" : folders.join(" / "),
        title: node.title,
      });
    }
  };
  // recent 只在空 query 分支被消费, 无条件 visit 等于每次按键白扫一遍全树
  const hasQuery = query.trim().length > 0;

  if (!hasQuery) {
    visit(tree, []);
  }

  const raw = hasQuery ? searchMemoTree(tree, query, bodyHitIds) : recent;

  // 先裁剪到 8 条再回树里取 revision: 原先在 map 内对每个候选做一次
  // findNode 全树查找, 裁剪前的结果数就是全树查找的次数。
  return raw
    .filter((result) => !selectedIds.includes(result.id))
    .slice(0, 8)
    .map((result) => {
      const node = findNode(tree, result.id);
      return { ...result, revision: node?.revision ?? 1 };
    });
};

type MentionMenuProps = {
  activeIndex: number;
  onSelect: (memo: MentionResult) => void;
  results: readonly MentionResult[];
};

export function MentionMenu({ activeIndex, onSelect, results }: MentionMenuProps) {
  return (
    <div aria-label="引用笔记" className="agent-mention-menu" role="listbox">
      {results.length === 0 ? (
        <p>没有可引用的笔记</p>
      ) : results.map((memo, index) => (
        <button
          aria-selected={index === activeIndex}
          className="agent-mention-option"
          key={memo.id}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(memo);
          }}
          role="option"
          type="button"
        >
          <span className="agent-mention-option-icon">
            <FileTextIcon aria-hidden="true" size={14} />
          </span>
          <strong>{memo.title}</strong>
        </button>
      ))}
    </div>
  );
}
