/**
 * [INPUT]: 依赖 locale 界面文案、PresenceSurface 向上入退场、memo tree、查询/选择和搜索纯函数
 * [OUTPUT]: 菜单识别画布图标；普通 memo 搜索函数继续仅返回笔记； 对外提供只显示文件图标与文件名的 @笔记搜索列表、搜索纯函数与 mouse down 选择交互
 * [POS]: Prompt Bar 的无状态原生 @笔记命令菜单；结果保持内容宽度，键盘、IME 与选择生命周期归 AgentConversation 统一控制
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { PresenceSurface } from "../../shared/design-system/components/PresenceSurface";
import { FileTextIcon, CanvasIcon } from "../../shared/design-system/icons";
import type { MemoTreeNode } from "../../shared/api/memo";
import { findNode } from "../../shared/store/memoTree";
import { searchMemoTree } from "../memoLibrary";
import { useLocale } from "../../shared/locale";

export type MentionResult = {
  kind?: "memo" | "canvas";
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
      else if (node.node_type === "memo") recent.push({
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

  const results: MentionResult[] = [];
  for (const result of raw) {
    if (selectedIds.includes(result.id)) continue;
    const node = findNode(tree, result.id);
    if (node?.node_type !== "memo") continue;
    results.push({ ...result, revision: node.revision });
    if (results.length === 8) break;
  }
  return results;
};

type MentionMenuProps = {
  open: boolean;
  activeIndex: number;
  onSelect: (memo: MentionResult) => void;
  results: readonly MentionResult[];
};

export function MentionMenu({ activeIndex, onSelect, results, open }: MentionMenuProps) {
  const { t } = useLocale();
  return (
    <PresenceSurface open={open} placement="top" aria-label={t("引用笔记", "Reference a note")} className="agent-mention-menu" role="listbox">
      {results.length === 0 ? (
        <p>{t("没有可引用的笔记", "No notes to reference")}</p>
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
            {memo.kind === "canvas" ? <CanvasIcon aria-hidden="true" size={14} /> : <FileTextIcon aria-hidden="true" size={14} />}
          </span>
          <strong>{memo.title}</strong>
        </button>
      ))}
    </PresenceSurface>
  );
}
