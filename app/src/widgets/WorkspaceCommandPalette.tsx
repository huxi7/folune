/**
 * [INPUT]: 依赖 commandPaletteStore 的唯一开合与 Canvas 次级动作、memoTreeStore 轻量树、recentNodesStore 最近顺序、useMemoSearch 正文命中与 commandResults 排序纯函数
 * [OUTPUT]: 对外提供全局唯一 Command Palette：⌘K 开合、可聚焦 option、稳定 active 身份、六档排序、Tab 进画布与 Canvas 连续加入
 * [POS]: widgets 的唯一 Command Surface，由 AppDashboard 挂载一次即覆盖 Paper 与 Canvas；Sidebar/Paper/Canvas 只是入口，排序归 commandResults，模态行为归 Dialog
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog } from "../shared/design-system/components";
import {
  AddNoteIcon,
  CanvasIcon,
  FileTextIcon,
  FolderIcon,
  MagnifyingGlassIcon,
} from "../shared/design-system/icons";
import { useCommandPaletteStore } from "../shared/store/commandPaletteStore";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { useRecentNodesStore } from "../shared/store/recentNodesStore";
import {
  buildCommandResults,
  recentCommandResults,
  type CommandResult,
} from "./commandResults";
import { useMemoSearch } from "./useMemoSearch";

type WorkspaceCommandPaletteProps = {
  accessToken: string;
  /** memo 行的次级动作：以该笔记的默认画布打开 */
  onOpenCanvas: (memoId: string) => void;
  /** 打开笔记/独立画布，或在文件库中定位文件夹；类型判断留给编排层 */
  onOpenNode: (nodeId: string) => void;
};

const LISTBOX_ID = "workspace-command-results";
const optionDomId = (id: string): string => `workspace-command-option-${id}`;

/*
 * 提示条要写用户键盘上真实存在的那个键。navigator.platform 已废弃但仍是判断
 * Mac 最省事且到处可用的一条: 判错的代价只是提示条上写了 Ctrl 而不是 ⌘, 而
 * 按键处理本身对 metaKey/ctrlKey 一视同仁, 功能不受影响。
 */
const MODIFIER = /mac/iu.test(globalThis.navigator?.platform ?? "") ? "⌘" : "Ctrl";

/** 提示条条目；muted 表示这个键此刻按不动，但位置保留以免列表左右抖动 */
type PaletteHint = {
  keys: string;
  label: string;
  muted: boolean;
};

const kindIcon = {
  canvas: CanvasIcon,
  folder: FolderIcon,
  memo: FileTextIcon,
} as const;

const matchLabel: Partial<Record<CommandResult["match"], string>> = {
  body: "正文命中",
  path: "路径命中",
  recent: "最近打开",
};

export function WorkspaceCommandPalette({
  accessToken,
  onOpenCanvas,
  onOpenNode,
}: WorkspaceCommandPaletteProps) {
  const open = useCommandPaletteStore((state) => state.open);
  const close = useCommandPaletteStore((state) => state.close);
  const toggle = useCommandPaletteStore((state) => state.toggle);
  const canvas = useCommandPaletteStore((state) => state.canvas);
  const tree = useMemoTreeStore((state) => state.nodes);
  const recentIds = useRecentNodesStore((state) => state.order);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  // IME 合成期的 Enter 属于候选词确认, 不能当成"打开这一条"
  const composingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();
  const { bodyHitIds, status } = useMemoSearch(
    accessToken,
    tree,
    open ? query : "",
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveId(null);
    setFeedback(null);
  }, [open]);

  const results = useMemo(
    () => trimmed.length === 0
      ? recentCommandResults({ recentIds, tree })
      : buildCommandResults({
        bodyHitIds: [...bodyHitIds],
        query,
        recentIds,
        tree,
      }),
    [bodyHitIds, query, recentIds, tree, trimmed],
  );

  /*
   * active 身份是结果 id 而不是数组下标: 正文命中在防抖之后补入会改变列表长度与
   * 顺序, 下标会让选中项无故跳走。这里只在当前 active 真的消失时才回到首项。
   */
  useEffect(() => {
    setActiveId((current) =>
      current !== null && results.some((result) => result.id === current)
        ? current
        : results[0]?.id ?? null);
  }, [results]);

  useEffect(() => {
    if (activeId === null) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionDomId(activeId))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);


  const activeIndex = results.findIndex((result) => result.id === activeId);
  const active = activeIndex === -1 ? null : results[activeIndex] ?? null;
  const move = (delta: number) => {
    if (results.length === 0) return;
    const next = activeIndex === -1
      ? 0
      : (activeIndex + delta + results.length) % results.length;
    setActiveId(results[next]?.id ?? null);
  };

  const openResult = (result: CommandResult) => {
    onOpenNode(result.id);
    close();
  };

  const openAsCanvas = (result: CommandResult) => {
    if (result.defaultCanvasId === null) return;
    onOpenCanvas(result.id);
    close();
  };

  /** 只有笔记能作为 memo_ref 加入画布: 画布与文件夹都不是可引用的正文对象 */
  const addable = (result: CommandResult): boolean =>
    canvas !== null && result.kind === "memo";

  const addToCanvas = async (result: CommandResult) => {
    if (!addable(result) || canvas === null || addingId !== null) return;
    setAddingId(result.id);
    try {
      await canvas.onAdd({
        id: result.id,
        revision: result.revision,
        title: result.title,
      });
      // 连续加入: 面板保持打开, 只清查询并就地给回执
      setFeedback(`已加入《${result.title}》`);
      setQuery("");
      setActiveId(null);
    } finally {
      setAddingId(null);
    }
  };

  const statusLine = status === "error"
    ? "正文搜索暂时不可用，下面只有标题与路径结果。"
    : trimmed.length === 0
      ? results.length === 0
        ? "输入关键词，搜索标题、正文或文件夹路径。"
        : "最近打开"
      : status === "loading"
        ? results.length === 0 ? "正在搜索…" : "正在补入正文结果…"
        : results.length === 0
          ? `没有与“${trimmed}”匹配的对象。`
          : `${results.length} 个结果`;

  /*
   * 提示条只声明此刻真能按的键: 语境决定条目在不在（不在画布里就没有"加入当前
   * 画布"这回事）, 当前行决定条目灰不灰。两级分开之后位置恒定——上下移动选中行
   * 时提示条不左右跳动, 而灰掉的那条仍然让用户知道这个键存在。
   */
  const hints: PaletteHint[] = [
    { keys: "↑↓", label: "导航", muted: results.length === 0 },
    { keys: "↵", label: "打开", muted: active === null },
    {
      keys: "⇥",
      label: "打开画布",
      muted: (active?.defaultCanvasId ?? null) === null,
    },
    ...canvas === null ? [] : [{
      keys: `${MODIFIER}↵`,
      label: "加入当前画布",
      muted: active === null || !addable(active),
    }],
    { keys: "esc", label: "关闭", muted: false },
  ];

  return (
    <Dialog
      align="top"
      headerMode="embedded"
      onOpenChange={(next) => {
        if (!next) close();
      }}
      open={open}
      title="打开或搜索对象"
      width="command"
    >
      <div className="command-palette">
        <div className="command-palette-search">
          <MagnifyingGlassIcon aria-hidden size={20} />
          <input
            aria-activedescendant={activeId === null
              ? undefined
              : optionDomId(activeId)}
            aria-autocomplete="list"
            aria-controls={LISTBOX_ID}
            aria-expanded
            aria-label="搜索笔记、画布与文件夹"
            className="command-palette-input"
            data-dialog-autofocus=""
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveId(null);
              setFeedback(null);
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                move(1);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                move(-1);
                return;
              }
              if (composingRef.current) return;
              /*
               * Palette 内除了这个输入框没有第二个可聚焦元素（结果行按钮全是
               * tabIndex=-1）, 原生 Tab 只是在焦点陷阱里原地循环, 这一格键位
               * 本来就是空的——交给"打开这一行的画布"。Shift+Tab 不接管, 留作
               * 键盘用户穿出弹窗的逃生口。
               */
              if (event.key === "Tab" && !event.shiftKey) {
                event.preventDefault();
                if (active !== null) openAsCanvas(active);
                return;
              }
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (active === null) return;
              if ((event.metaKey || event.ctrlKey) && addable(active)) {
                void addToCanvas(active);
                return;
              }
              openResult(active);
            }}
            placeholder={canvas === null
              ? "搜索笔记、画布或文件夹…"
              : "搜索并加入当前画布…"}
            role="combobox"
            spellCheck={false}
            value={query}
          />
        </div>

        <p aria-live="polite" className="command-palette-status" role="status">
          {feedback ?? statusLine}
        </p>

        <div
          aria-label="搜索结果"
          className="command-palette-results"
          id={LISTBOX_ID}
          ref={listRef}
          role="listbox"
        >
          {results.map((result) => {
            const Icon = kindIcon[result.kind];
            const selected = result.id === activeId;
            const tag = matchLabel[result.match];

            return (
              <div
                aria-selected={selected}
                className="command-row"
                data-active={selected}
                id={optionDomId(result.id)}
                key={result.id}
                onMouseEnter={() => setActiveId(result.id)}
                role="option"
                tabIndex={-1}
              >
                <button
                  className="command-row-open"
                  onClick={() => openResult(result)}
                  onMouseDown={(event) => event.preventDefault()}
                  tabIndex={-1}
                  type="button"
                >
                  <Icon aria-hidden size={16} />
                  <span className="command-row-copy">
                    <strong>{result.title}</strong>
                    <small>
                      {result.path}
                      {result.originTitle === null ? null : (
                        <span className="command-row-origin">
                          {`由《${result.originTitle}》展开`}
                        </span>
                      )}
                      {tag === undefined ? null : (
                        <span className="command-row-tag">{tag}</span>
                      )}
                    </small>
                  </span>
                </button>
                {/*
                  * 动作装在一个靠右收口的容器里, 而不是各占一条 grid 轨道:
                  * 空轨道宽度塌成 0 但 gap 还在, 于是"有画布徽标"和"没有"两种
                  * 行的加号会差几个像素, 上下扫的时候整列看着是歪的。
                  */}
                <span className="command-row-actions">
                  {result.defaultCanvasId === null ? null : (
                    <button
                      aria-keyshortcuts="Tab"
                      aria-label={`以画布打开${result.title}`}
                      className="command-row-action"
                      onClick={() => openAsCanvas(result)}
                      onMouseDown={(event) => event.preventDefault()}
                      tabIndex={-1}
                      title="以画布打开（Tab）"
                      type="button"
                    >
                      <CanvasIcon aria-hidden size={16} />
                    </button>
                  )}
                  {!addable(result) ? null : (
                    <button
                      aria-label={`加入当前画布：${result.title}`}
                      className="command-row-action"
                      disabled={addingId !== null}
                      onClick={() => void addToCanvas(result)}
                      onMouseDown={(event) => event.preventDefault()}
                      tabIndex={-1}
                      title="加入当前画布（⌘/Ctrl + Enter）"
                      type="button"
                    >
                      <AddNoteIcon aria-hidden size={16} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        <footer className="command-palette-hints">
          {hints.map((hint) => (
            <span
              className="command-palette-hint"
              data-muted={hint.muted}
              key={hint.label}
            >
              <kbd>{hint.keys}</kbd>
              {hint.label}
            </span>
          ))}
        </footer>
      </div>
    </Dialog>
  );
}
