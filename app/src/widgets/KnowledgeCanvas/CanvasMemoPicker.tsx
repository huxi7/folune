/**
 * [INPUT]: 依赖 design-system Dialog/Input、memoTreeStore、useMemoSearch 与 AgentPanel Mention 候选纯函数
 * [OUTPUT]: 对外提供全局 Cmd+K Canvas memo Picker；Enter 只打开对象，显式加号才加入或关联
 * [POS]: KnowledgeCanvas 的上下文选择边界；复用现有树标题/正文搜索，不加载正文、不把搜索结果误当成 Canvas 节点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useMemo, useState } from "react";

import {
  Button,
  Dialog,
  Input,
} from "../../shared/design-system/components";
import {
  FileTextIcon,
  PlusIcon,
} from "../../shared/design-system/icons";
import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import {
  getMentionResults,
  type MentionResult,
} from "../AgentPanel/MentionMenu";
import { useMemoSearch } from "../useMemoSearch";

type CanvasMemoPickerProps = {
  accessToken: string;
  mode: "add" | "connect" | "open";
  onAdd?: (memo: MentionResult) => Promise<void>;
  onClose: () => void;
  onOpenMemo: (memoId: string) => Promise<void>;
  sourceTitle?: string;
};

export function CanvasMemoPicker({
  accessToken,
  mode,
  onAdd,
  onClose,
  onOpenMemo,
  sourceTitle,
}: CanvasMemoPickerProps) {
  const tree = useMemoTreeStore((state) => state.nodes);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);
  const bodyHits = useMemoSearch(accessToken, tree, query, 30);
  const results = useMemo(
    () => getMentionResults(tree, query, [], bodyHits),
    [bodyHits, query, tree],
  );
  const title = mode === "connect"
    ? "关联一篇笔记"
    : mode === "open" ? "打开笔记" : "打开或加入笔记";
  const description = mode === "connect"
    ? `来源：${sourceTitle ?? "当前节点"}。选择加号会原子加入并连接。`
    : mode === "open"
      ? "搜索标题、正文或路径；Enter 只打开当前对象。"
      : "Enter 只打开笔记；使用每行右侧加号才会放入当前 Canvas。";

  const add = async (memo: MentionResult) => {
    if (addingId !== null || onAdd === undefined) return;
    setAddingId(memo.id);
    try {
      await onAdd(memo);
      onClose();
    } finally {
      setAddingId(null);
    }
  };

  const openMemo = async (memoId: string) => {
    await onOpenMemo(memoId);
    onClose();
  };

  return (
    <Dialog
      description={description}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={title}
    >
      <Input
        aria-label="搜索笔记"
        autoFocus
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(results.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(0, index - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const active = results[activeIndex];
            if (active !== undefined) void openMemo(active.id);
          }
        }}
        placeholder="搜索标题或正文…"
        value={query}
      />

      <div aria-label="笔记结果" className="canvas-picker-results" role="listbox">
        {results.length === 0 ? (
          <p className="canvas-picker-empty">没有找到可用笔记</p>
        ) : results.map((memo, index) => (
          <div
            className="canvas-picker-row"
            data-active={index === activeIndex}
            key={memo.id}
          >
            <button
              className="canvas-picker-open"
              onClick={() => void openMemo(memo.id)}
              role="option"
              type="button"
            >
              <FileTextIcon size={14} />
              <span>
                <strong>{memo.title}</strong>
                <small>{memo.path}</small>
              </span>
            </button>
            {onAdd === undefined ? null : (
              <Button
                aria-label={mode === "connect"
                  ? `加入并关联${memo.title}`
                  : `加入${memo.title}`}
                loading={addingId === memo.id}
                onClick={() => void add(memo)}
                size="square"
                variant="secondary"
              >
                <PlusIcon size={14} />
              </Button>
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
