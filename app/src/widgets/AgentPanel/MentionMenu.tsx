/**
 * [INPUT]: 依赖 memo tree、当前查询、已选 ID、激活索引和搜索纯函数
 * [OUTPUT]: 对外提供 @笔记搜索列表、路径/版本提示与 mouse down 选择交互
 * [POS]: Prompt Bar 的无状态命令菜单视图；键盘、IME 与选择生命周期归 AgentConversation 统一控制
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

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
  visit(tree, []);
  const raw = query.trim().length === 0 ? recent : searchMemoTree(tree, query);

  return raw
    .filter((result) => !selectedIds.includes(result.id))
    .map((result) => {
      const node = findNode(tree, result.id);
      return { ...result, revision: node?.revision ?? 1 };
    })
    .slice(0, 8);
};

type MentionMenuProps = {
  activeIndex: number;
  onSelect: (memo: MentionResult) => void;
  results: readonly MentionResult[];
};

export function MentionMenu({ activeIndex, onSelect, results }: MentionMenuProps) {
  return (
    <div className="agent-mention-menu" role="listbox">
      <div className="agent-mention-heading">引用笔记</div>
      {results.length === 0 ? (
        <p>继续输入标题搜索笔记</p>
      ) : results.map((memo, index) => (
        <button
          aria-selected={index === activeIndex}
          key={memo.id}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(memo);
          }}
          role="option"
          type="button"
        >
          <strong>{memo.title}</strong>
          <span>{memo.path} · v{memo.revision}</span>
        </button>
      ))}
    </div>
  );
}
