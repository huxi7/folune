/**
 * [INPUT]: 依赖 ComposerSourceChip、画布来源 Hook、AgentPopover、compact SegmentedControl 与共享按钮/图标/语言
 * [OUTPUT]: 提供三段范围切换、简短来源标签和可搜索的精确勾选清单
 * [POS]: Composer 的来源编辑器；浮层左沿对齐胶囊外壳，焦点归还内部按钮；仅修改聊天范围
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useId, useRef, useState } from "react";
import { Button, SegmentedControl } from "../../shared/design-system/components";
import {
  CaretDownIcon,
  XIcon,
  AtIcon,
} from "../../shared/design-system/icons";
import { useLocale } from "../../shared/locale";
import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import { findNode } from "../../shared/store/memoTree";
import { ComposerSourceChip } from "./ComposerSourceChip";
import { AgentPopover } from "./AgentPopover";
import type { useCanvasChatSource } from "./useCanvasChatSource";
export function CanvasSourcePicker({
  state,
  currentCanvas,
  disabled,
}: {
  state: ReturnType<typeof useCanvasChatSource>;
  currentCanvas?: { id: string; title: string } | null;
  disabled: boolean;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectionSnapshot, setSelectionSnapshot] = useState<typeof state.source>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const id = useId();
  const tree = useMemoTreeStore((s) => s.nodes);
  const { source, detail } = state;
  if (!source) return null;
  const scope = source.mode === "all" ? "all" : source === selectionSnapshot ? "selection" : "custom";
  const notes = (detail?.nodes ?? []).filter(
    (n) => n.target && !n.target.deleted_at,
  );
  const visible = notes.filter((n) =>
    n.target!.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <ComposerSourceChip ref={chip} removeLabel={t("移除画布引用", "Remove canvas reference")} disabled={disabled} onRemove={state.remove}>
      <button
        ref={anchor}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="agent-source-trigger"
      >
        <AtIcon size={14} />
        <strong>
          {source.title}{source.mode === "selected" ? t(` · ${source.memoIds.length}篇`, ` · ${source.memoIds.length} notes`) : ""}
        </strong>
        <CaretDownIcon size={14} />
      </button>
      </ComposerSourceChip>
      <AgentPopover
        anchorRef={anchor}
        alignRef={chip}
        id={id}
        open={open}
        onClose={() => setOpen(false)}
        label={t("问答来源", "Chat sources")}
        className="agent-source-picker"
      >
        <header>
          <div className="agent-source-heading"><strong>{t("问答来源", "Chat sources")}</strong><p>{source.title}</p></div>
          <Button
            aria-label={t("关闭来源选择", "Close source picker")}
            icon={XIcon}
            size="square"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              anchor.current?.focus();
            }}
          />
        </header>
        {currentCanvas && currentCanvas.id !== source.id ? (
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() => state.select(currentCanvas.id, currentCanvas.title)}
          >
            {t(
              `切换到 ${currentCanvas.title}`,
              `Switch to ${currentCanvas.title}`,
            )}
          </Button>
        ) : null}
        <div className="agent-source-scope">
          <SegmentedControl
            size="compact"
            ariaLabel={t("问答范围", "Chat scope")}
            value={scope}
            options={[
              { value: "all", label: t("全部", "All"), disabled },
              { value: "custom", label: t("指定", "Custom"), disabled },
              { value: "selection", label: t("选中", "Selection"), disabled: disabled || (!state.selectedMemos.length && scope !== "selection") },
            ]}
            onValueChange={(value) => {
              if (value === "selection") {
                if (!state.selectedMemos.length) return;
                const next = { ...source, mode: "selected" as const, memoIds: [...state.selectedMemos] };
                setSelectionSnapshot(next);
                state.setSource(next);
              } else {
                setSelectionSnapshot(null);
                state.setSource({ ...source, mode: value === "all" ? "all" : "selected" });
              }
            }}
          />
          <p className="agent-source-hint" aria-live="polite">
            {scope === "all" ? t("读取整张画布的内容与关系", "Read all canvas content and connections")
              : scope === "custom" ? t("勾选笔记，包含它们之间的连线", "Choose notes and their mutual connections")
              : t("使用本次画布选中，范围保持不变", "Use this canvas selection; scope stays fixed")}
          </p>
        </div>
        <input
          className="agent-source-search"
          aria-label={t("搜索画布笔记", "Search canvas notes")}
          placeholder={t("搜索笔记", "Search notes")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {state.error ? (
          <div role="alert">
            {state.error}
            <Button variant="ghost" onClick={state.retry}>
              {t("重试", "Retry")}
            </Button>
          </div>
        ) : !detail ? (
          <p>{t("正在读取画布…", "Loading canvas…")}</p>
        ) : (
          <div className="agent-source-list">
            {visible.length === 0 ? <p className="agent-source-hint">{query ? t("没有匹配的笔记", "No matching notes") : t("这张画布还没有笔记", "No notes on this canvas yet")}</p> : null}
            {visible.map((node) => (
              <label key={node.id}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={
                    source.mode === "all" ||
                    source.memoIds.includes(node.target_node_id!)
                  }
                  onChange={(e) => {
                    const ids = new Set(
                      source.mode === "all"
                        ? notes.map((n) => n.target_node_id!)
                        : source.memoIds,
                    );
                    if (e.target.checked) ids.add(node.target_node_id!);
                    else ids.delete(node.target_node_id!);
                    state.setSource({
                      ...source,
                      mode: "selected",
                      memoIds: [...ids],
                    });
                  }}
                />
                <span>
                  {node.target!.title}
                  {notes.filter((n) => n.target!.title === node.target!.title)
                    .length > 1 ? (
                    <small className="agent-source-path">
                      {(() => {
                        const memo = findNode(tree, node.target_node_id!);
                        const parent = memo?.parent_id
                          ? findNode(tree, memo.parent_id)
                          : null;
                        return parent?.title ?? t("根目录", "Root");
                      })()}
                    </small>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        )}
        <footer>
          <span aria-live="polite">
            {t(
              `已选 ${source.mode === "all" ? notes.length : source.memoIds.length} / ${notes.length}`,
              `${source.mode === "all" ? notes.length : source.memoIds.length} / ${notes.length} selected`,
            )}
          </span>
        </footer>
      </AgentPopover>
    </>
  );
}
