/**
 * [INPUT]: 依赖 MemoTreeNode、MentionResult 与不可变 memo tree 查找
 * [OUTPUT]: 对外提供统一 ComposerSource、当前笔记/置顶/@来源归并、内联 mention 删除同步、发送后收束及冻结上下文构造
 * [POS]: AgentPanel Prompt Bar 的单一上下文领域层；当前笔记只是 current 来源标记，所有 chip 与发送 metadata 共用同一数组
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type {
  AiMessageContextSnapshot,
  FoluneUIMessageMetadata,
} from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import type { MentionResult } from "./MentionMenu";

export const MAX_COMPOSER_SOURCES = 5;

export type ComposerSource = MentionResult & {
  current: boolean;
  manual: boolean;
  pinned: boolean;
};

const memoResult = (
  tree: readonly MemoTreeNode[],
  memoId: string,
  folders: readonly string[] = [],
): MentionResult | null => {
  for (const node of tree) {
    if (node.id === memoId && node.node_type === "memo") {
      return {
        id: node.id,
        path: folders.length === 0 ? "根目录" : folders.join(" / "),
        revision: node.revision,
        title: node.title,
      };
    }
    if (node.node_type === "folder") {
      const nested = memoResult(node.children, memoId, [...folders, node.title]);
      if (nested !== null) return nested;
    }
  }
  return null;
};

const withOrigin = (
  source: ComposerSource | undefined,
  memo: MentionResult,
  origin: "current" | "manual" | "pinned",
): ComposerSource => ({
  current: source?.current ?? false,
  manual: source?.manual ?? false,
  pinned: source?.pinned ?? false,
  ...source,
  ...memo,
  [origin]: true,
});

export const addComposerSource = (
  sources: readonly ComposerSource[],
  memo: MentionResult,
  origin: "manual" | "pinned" = "manual",
): ComposerSource[] => {
  const existing = sources.find((source) => source.id === memo.id);
  if (existing !== undefined) {
    return sources.map((source) =>
      source.id === memo.id ? withOrigin(source, memo, origin) : source
    );
  }
  if (sources.length >= MAX_COMPOSER_SOURCES) return [...sources];
  return [...sources, withOrigin(undefined, memo, origin)];
};

export const reconcileComposerSources = (
  sources: readonly ComposerSource[],
  tree: readonly MemoTreeNode[],
  currentMemoId: string | null,
  pinnedIds: readonly string[],
  suppressedCurrentMemoId: string | null,
): ComposerSource[] => {
  const byId = new Map(
    sources.map((source) => [source.id, { ...source, current: false, pinned: false }]),
  );

  for (const pinnedId of pinnedIds) {
    const memo = memoResult(tree, pinnedId);
    if (memo !== null) {
      byId.set(pinnedId, withOrigin(byId.get(pinnedId), memo, "pinned"));
    }
  }

  if (currentMemoId !== null && currentMemoId !== suppressedCurrentMemoId) {
    const memo = memoResult(tree, currentMemoId);
    if (memo !== null) {
      byId.set(currentMemoId, withOrigin(byId.get(currentMemoId), memo, "current"));
    }
  }

  const active = [...byId.values()].filter(
    (source) => source.current || source.manual || source.pinned,
  );
  active.sort((left, right) => Number(right.current) - Number(left.current));
  return active.slice(0, MAX_COMPOSER_SOURCES);
};

export const settleComposerSourcesAfterSend = (
  sources: readonly ComposerSource[],
): ComposerSource[] => sources
  .map((source) => ({ ...source, manual: false }))
  .filter((source) => source.current || source.pinned);

export const syncManualComposerSources = (
  sources: readonly ComposerSource[],
  draft: string,
): ComposerSource[] => sources
  .map((source) => source.manual && !draft.includes(`@${source.title}`)
    ? { ...source, manual: false }
    : source)
  .filter((source) => source.current || source.manual || source.pinned);

export const buildFrozenComposerContext = (
  sources: readonly ComposerSource[],
  tree: readonly MemoTreeNode[],
): {
  context: NonNullable<FoluneUIMessageMetadata["context"]>;
  display: AiMessageContextSnapshot;
} => {
  const references = sources.slice(0, MAX_COMPOSER_SOURCES).flatMap((source) => {
    const memo = memoResult(tree, source.id);
    return memo === null
      ? []
      : [{ memo_id: memo.id, revision: memo.revision, title: memo.title }];
  });

  return {
    context: {
      active_memo_id: null,
      reference_memo_ids: references.map((memo) => memo.memo_id),
      revisions: Object.fromEntries(
        references.map((memo) => [memo.memo_id, memo.revision]),
      ),
    },
    display: { primary: null, references },
  };
};
