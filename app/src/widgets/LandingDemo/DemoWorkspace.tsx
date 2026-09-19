/**
 * [INPUT]: 依赖生产 PaperWorkspaceShell/Toolbar/Markdown/Panel/归档线与确定性 Demo 数据
 * [OUTPUT]: 对外提供笔记/画布直接切换、工具条进入与返回的纸面过渡、内存编辑、整理和本页会话
 * [POS]: Demo 唯一状态所有者；文件树导航清除笔记来路，工具条入口才记录返回对象，左右 Panel 持续挂载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { PaperWorkspaceShell } from "../PaperWorkspaceShell";
import { AppMainToolbar } from "../AppMainToolbar";
import { WorkspacePanelLayer } from "../WorkspacePanelLayer";
import { MarkdownEditor } from "../MarkdownEditor";
import { MarkdownReadingView } from "../MarkdownReadingView";
import { PersistentView } from "../../shared/design-system/components";
import { ArchiveCordOverlay } from "../ArchiveCordOverlay";
import { getAncestorFolderIds } from "../memoLibrary";
import type { WorkspaceOrganizePresentation } from "../archiveCordPolicy";
import type { DocumentView, EditingMode } from "../markdownViewTypes";
import type { AiCommand } from "../../shared/api/ai";
import { runViewTransition } from "../../pages/viewTransition";
import { DemoSidebar } from "./DemoSidebar";
import { DemoAssistant } from "./DemoAssistant";
import { DemoCanvas } from "./DemoCanvas";
import { ARCHIVE_LABEL, createNotes, demoTree, INITIAL_MEMO, organizeNote, UNFILED_TARGET } from "./model";

/*
 * 边栏宽度的规范：按视口百分比取，窄屏有下限、宽屏有上限。
 *   20% + 26% = 46%，中间那张纸因此稳定拿到约 50% —— 正在写的东西必须永远是最大的一块。
 *   左窄右宽不是审美：文件树里是短标题，AI 栏里是成句的话，后者需要更长的行。
 *   上下限的用处：再窄树会折行，再宽行会太长读不下去。
 * 原来的 220/288 是固定像素，占比会随窗口一路漂（1088 时 20%/26%、1600 时 14%/18%），
 * 那才是它真正的问题——边栏不跟窗口一起长，窗口一大三栏就散架。
 * original 档保留固定像素，只为让人看见改之前是什么样。
 */
const RULE_TRACKS = { agent: "clamp(240px, 26%, 340px)", sidebar: "clamp(180px, 20%, 260px)" } as const;
const TRACKS = {
  original: { agent: "288px", sidebar: "220px" },
  pinned: RULE_TRACKS,
  uniform: RULE_TRACKS,
} as const;
export type DemoVariant = keyof typeof TRACKS;

const folders = () => new Set(["demo-life", "demo-observation", "demo-reading", "demo-projects", "demo-newsletter"]);
export function DemoWorkspace({ variant = "uniform" }: { variant?: DemoVariant }) {
  const tracks = TRACKS[variant];
  const style = useMemo(() => ({
    "--workspace-sidebar-track": tracks.sidebar,
    "--workspace-agent-track": tracks.agent,
  }) as CSSProperties, [tracks]);
  const [notes, setNotes] = useState(createNotes);
  const [selected, setSelected] = useState(INITIAL_MEMO);
  const [canvas, setCanvas] = useState(false);
  const [canvasOrigin, setCanvasOrigin] = useState<string | null>(null);
  const [libraryOpen, setLibrary] = useState(() => window.innerWidth >= 760);
  const [assistantOpen, setAssistant] = useState(() => window.innerWidth >= 1024);
  const [width, setWidth] = useState(window.innerWidth);
  const [expanded, setExpanded] = useState(folders);
  const [view, setView] = useState<DocumentView>("editing");
  const [mode, setMode] = useState<EditingMode>("live");
  const [organizing, setOrganizing] = useState(false);
  const [presentations, setPresentations] = useState<Record<string, WorkspaceOrganizePresentation>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lock = useRef(false);
  // 命令台账：只有从对话里发出的写操作才有 commandId，因此只有它能被撤销。
  const undoLog = useRef(new Map<string, { memoId: string; parentId: string | null }>());
  const note = notes[selected]!;
  const tree = useMemo(() => demoTree(notes), [notes]);
  const presentation = presentations[selected] ?? null;
  const filedAt = note.parent_id ? ARCHIVE_LABEL[note.parent_id] ?? null : null;
  const closeLibrary = useCallback(() => setLibrary(false), []);
  const closeAssistant = useCallback(() => setAssistant(false), []);
  const openLibrary = useCallback(() => { setLibrary(true); if (window.innerWidth < 1024) setAssistant(false); }, []);
  const openAssistant = useCallback(() => { setAssistant(true); if (window.innerWidth < 1024) setLibrary(false); }, []);
  const hint = useCallback(() => {}, []);
  useEffect(() => {
    const resize = () => { setWidth(window.innerWidth); if (window.innerWidth < 1024) setAssistant(false); if (window.innerWidth < 760) setLibrary(false); };
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); if (timer.current) clearTimeout(timer.current); };
  }, []);
  const changeSpace = useCallback((update: () => void, kind: "to-canvas" | "to-editor") => {
    if (!runViewTransition(() => flushSync(update), kind)) update();
  }, []);
  const select = useCallback((id: string) => {
    setCanvasOrigin(null);
    if (id === "demo-canvas") { setCanvas(true); return; }
    setSelected(id); setCanvas(false);
    if (window.innerWidth < 760) setLibrary(false);
  }, []);
  const openMemo = useCallback((id: string) => {
    changeSpace(() => select(id), "to-editor");
  }, [changeSpace, select]);
  const locate = () => { setExpanded(old => new Set([...old, ...getAncestorFolderIds(tree, selected)])); openLibrary(); };
  /** 工具条与 AI 对话共用的唯一归档入口；返回的 Promise 在树真正落定后兑现。 */
  const organize = useCallback((memoId: string, commandId?: string) => new Promise<void>(resolve => {
    if (lock.current) { resolve(); return; }
    lock.current = true; setOrganizing(true);
    const from = notes[memoId]?.parent_id ?? null;
    timer.current = setTimeout(() => {
      setNotes(old => organizeNote(old, memoId));
      if (commandId) undoLog.current.set(commandId, { memoId, parentId: from });
      setPresentations(old => ({ ...old, [memoId]: { memoId, origin: "fresh", path: ARCHIVE_LABEL[from ?? UNFILED_TARGET]!, runId: `demo-organize-${memoId}`, status: "succeeded" } }));
      setExpanded(folders()); setLibrary(true);
      if (window.innerWidth < 1024) setAssistant(false);
      setOrganizing(false); lock.current = false;
      resolve();
    }, 850);
  }), [notes]);
  const undo = useCallback(async (commands: readonly AiCommand[]) => {
    const restored = commands.flatMap(command => {
      const entry = undoLog.current.get(command.id);
      if (!entry) return [];
      undoLog.current.delete(command.id);
      return [entry];
    });
    if (restored.length === 0) return;
    setNotes(old => restored.reduce((next, entry) => {
      const node = next[entry.memoId];
      return node ? { ...next, [entry.memoId]: { ...node, parent_id: entry.parentId } } : next;
    }, old));
    setPresentations(old => {
      const next = { ...old };
      for (const entry of restored) delete next[entry.memoId];
      return next;
    });
  }, []);
  const compact = width < 760;
  return <div className="demo-root" style={style} data-canvas={canvas}>
    <div className="demo-workspace-frame">
      <div className="demo-canvas-layer" hidden={!canvas} inert={!canvas} aria-hidden={!canvas}>
        <DemoCanvas notes={notes} active={canvas} origin={canvasOrigin} onEdit={openMemo} onHint={hint}
          libraryOpen={libraryOpen} assistantOpen={assistantOpen} onLibrary={openLibrary} onAssistant={openAssistant} />
      </div>
      {!canvas && <PaperWorkspaceShell style={style} assistantOpen={assistantOpen} libraryOpen={libraryOpen}
        compactViewport={compact} overlayPanels={compact} organizing={organizing}
        onCloseAssistant={closeAssistant} onCloseLibrary={closeLibrary} onToggleAssistant={openAssistant} onToggleLibrary={openLibrary}
        paperIdentity={selected} paperTransitionIdentity={selected} paper={<>
          <AppMainToolbar fileActionsEnabled={false} currentMemo={note} currentMemoTitle={note.title} documentView={view} editingMode={mode}
            enteringCanvas={false} onDocumentViewChange={setView} onEditingModeChange={setMode}
            onEnterCanvas={() => changeSpace(() => { setCanvasOrigin(selected); setCanvas(true); }, "to-canvas")}
            onOrganize={() => organize(selected)} onLocateArchive={locate} organizePresentation={presentation} organizing={organizing} />
          <main aria-label="备忘录编辑器" className="notes-workspace"><article className="note-editor-canvas" data-document-view={view}>
            <div className="note-editor-heading"><h1 className="note-editor-title">{note.title}</h1></div>
            <div className="note-view-stack">
              <PersistentView active={view === "editing"} className="note-editor-content"><MarkdownEditor key={selected} editingMode={mode} theme="light" onBlur={() => {}} value={note.memo.content_mdx}
                onChange={content => setNotes(old => ({ ...old, [selected]: { ...old[selected]!, memo: { ...old[selected]!.memo, content_mdx: content } } }))} /></PersistentView>
              <PersistentView active={view === "reading"} className="note-reading-surface"><MarkdownReadingView content={note.memo.content_mdx} preserveSoftBreaks /></PersistentView>
            </div>
          </article></main>
        </>} />}
      <WorkspacePanelLayer side="library" open={libraryOpen} style={style}><DemoSidebar tree={tree} selected={canvas ? "demo-canvas" : selected}
        expanded={expanded} onExpanded={setExpanded} onSelect={select} onClose={closeLibrary} onHint={hint} presentation={presentation} /></WorkspacePanelLayer>
      <WorkspacePanelLayer side="assistant" open={assistantOpen} style={style}><DemoAssistant memoId={selected} title={note.title} filedAt={filedAt} onClose={closeAssistant} onHint={hint} onOrganize={organize} onUndo={undo} /></WorkspacePanelLayer>
      {!canvas && <ArchiveCordOverlay libraryOpen={libraryOpen} overlayPanels={compact} presentation={presentation} onLocate={locate} />}
    </div>
  </div>;
}
