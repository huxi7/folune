/**
 * [INPUT]: 依赖 PersistentView 的实例保留式读写淡换、按需加载的 MemoDetailNode、跨临时/真实 ID 保持不变的 memoClientKey、新建聚焦意图、正文加载状态、locale 加载文案、DocumentView/EditingMode、useMemoAutosave、MarkdownEditor/ReadingView、ThemeProvider 与 Toast
 * [OUTPUT]: 对外提供保留编辑会话的写作/阅读列、NotesWorkspaceHandle 与共用版心的 NotesWorkspaceSkeleton；仅在笔记身份切换时聚焦新纸标题/编辑器
 * [POS]: app/src/widgets 的备忘录编辑会话边界；Paper 外壳不拥有编辑状态，客户端身份隔离后端 ID 置换，Dashboard 只能经显式 handle 跨越自动保存边界；按需正文未到达前绝不把空标题反写轻量树；同级重名在标题区原位提示且不阻断正文自动保存
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/* oxlint-disable jsx-a11y/heading-has-content -- contentEditable h1 的可访问名称由 aria-label 与运行时 textContent 提供 */

import { PersistentView } from "../shared/design-system/components/PersistentView";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type { MemoDetailNode } from "../shared/api/memo";
import {
  Skeleton,
  SkeletonGroup,
  useToast,
} from "../shared/design-system/components";
import { useTheme } from "../shared/theme/ThemeProvider";
import { useLocale } from "../shared/locale";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "./MarkdownEditor";
import { MarkdownReadingView } from "./MarkdownReadingView";
import type { DocumentView, EditingMode } from "./markdownViewTypes";
import {
  useMemoAutosave,
  type MemoDraftSnapshot,
  type MemoSaveOptions,
} from "./useMemoAutosave";

export type { MemoDraftSnapshot, MemoSaveOptions } from "./useMemoAutosave";

const MAX_TITLE_LENGTH = 500;
const TITLE_CONFLICT_HINT_ID = "note-editor-title-conflict";

type NotesWorkspaceProps = {
  autoFocus: boolean;
  documentView: DocumentView;
  editingMode: EditingMode;
  emptyTree: boolean;
  /** 标题即时预检查：同级已有同名笔记时返回 true。判据归 memoTitleRules */
  hasTitleConflict: (title: string) => boolean;
  memo: MemoDetailNode | null;
  memoClientKey: string;
  onSave: (
    memoId: string,
    draft: MemoDraftSnapshot,
    options?: MemoSaveOptions,
  ) => Promise<MemoDetailNode>;
  onTitleChange: (title: string) => void;
  revealContent: boolean;
  skeletonVisible: boolean;
  treeStatus: "error" | "loading" | "ready";
};

export type NotesWorkspaceHandle = {
  acceptOrganizedTitle: (title: string) => void;
  flushCurrentDraft: () => Promise<void>;
  /** 把焦点交还给正文编辑器；探索态退场后据此让选区从灰色恢复为活跃 */
  focusEditor: () => void;
  prepareForDelete: () => Promise<void>;
  /** 当前选中的一句话；写作态取自 CodeMirror，阅读态取自阅读视图的 DOM 选区 */
  readSelection: () => string | null;
  replaceContentFromAgent: (content: string) => Promise<void>;
  resumeAfterDeleteFailure: () => void;
};

export function NotesWorkspaceSkeleton({ visible }: { visible: boolean }) {
  const { t } = useLocale();
  return (
    <main className="notes-workspace notes-workspace-loading">
      <SkeletonGroup
        className="note-editor-canvas note-editor-skeleton"
        label={t("正在加载备忘录正文", "Loading your note")}
        visible={visible}
      >
        <Skeleton className="note-skeleton-title" shape="text" />
        <div className="note-skeleton-body" aria-hidden="true">
          <div className="note-skeleton-paragraph">
            <Skeleton className="note-skeleton-line note-skeleton-line-wide" shape="text" />
            <Skeleton className="note-skeleton-line" shape="text" />
            <Skeleton className="note-skeleton-line note-skeleton-line-short" shape="text" />
          </div>
          <div className="note-skeleton-paragraph">
            <Skeleton className="note-skeleton-line note-skeleton-line-wide" shape="text" />
            <Skeleton className="note-skeleton-line note-skeleton-line-medium" shape="text" />
          </div>
          <div className="note-skeleton-paragraph">
            <Skeleton className="note-skeleton-line" shape="text" />
            <Skeleton className="note-skeleton-line note-skeleton-line-short" shape="text" />
          </div>
        </div>
      </SkeletonGroup>
    </main>
  );
}

// 纸内空/错误兜底占位: 只有编辑体同源的衬线标题 + 一句引导, 落在写作区中上部。
// 它是安全网而非功能页, 因此刻意克制——不放图标、不做居中仪式感。视觉规则归 workspace.css。
function NotesWorkspacePlaceholder({
  description,
  title,
  tone = "muted",
}: {
  description: string;
  title: string;
  tone?: "error" | "muted";
}) {
  return (
    <main
      className="notes-workspace-state"
      data-tone={tone}
      role={tone === "error" ? "status" : undefined}
    >
      <div className="notes-empty-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </main>
  );
}

export const NotesWorkspace = forwardRef<
  NotesWorkspaceHandle,
  NotesWorkspaceProps
>(function NotesWorkspace({
  autoFocus,
  documentView,
  editingMode,
  emptyTree,
  hasTitleConflict,
  memo,
  memoClientKey,
  onSave,
  onTitleChange,
  revealContent,
  skeletonVisible,
  treeStatus,
}: NotesWorkspaceProps, ref) {
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const onTitleChangeRef = useRef(onTitleChange);
  const titleEditorRef = useRef<HTMLHeadingElement>(null);
  onTitleChangeRef.current = onTitleChange;
  const {
    acceptCommittedTitle,
    content,
    flush,
    pause,
    resume,
    restoreTitleIfEmpty,
    title,
    titleConflict,
    updateContent,
    updateTitle,
  } = useMemoAutosave({
    hasTitleConflict,
    initialContent: memo?.memo?.content_mdx ?? "",
    initialTitle: memo?.title ?? "",
    memoId: memoClientKey,
    onFailure: (error) => {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "自动保存失败",
        variant: "error",
      });
    },
    onSave,
  });

  useImperativeHandle(ref, () => ({
    acceptOrganizedTitle(nextTitle) {
      acceptCommittedTitle(nextTitle);
    },
    async flushCurrentDraft() {
      await flush({ throwOnFailure: true });
    },
    focusEditor() {
      editorRef.current?.focus();
    },
    readSelection() {
      if (documentView === "reading") {
        const selection = window.getSelection();
        const text = selection === null || selection.isCollapsed
          ? ""
          : selection.toString().trim();
        return text.length === 0 ? null : text;
      }
      return editorRef.current?.readSelection() ?? null;
    },
    async prepareForDelete() {
      await flush({ throwOnFailure: true });
      pause();
    },
    async replaceContentFromAgent(nextContent) {
      updateContent(nextContent);
      await flush({ throwOnFailure: true });
    },
    resumeAfterDeleteFailure() {
      resume();
    },
  }), [acceptCommittedTitle, documentView, flush, pause, resume, updateContent]);

  useLayoutEffect(() => {
    const titleEditor = titleEditorRef.current;

    if (titleEditor !== null && titleEditor.textContent !== title) {
      titleEditor.textContent = title;
    }
  }, [memo?.id, title]);

  // memoClientKey 才是编辑会话身份；memo 对象随自动保存刷新时不能重新聚焦或全选标题。
  // oxlint-disable react-hooks/exhaustive-deps -- 避免保存回包抢走正文光标
  useEffect(() => {
    if (!autoFocus || documentView !== "editing" || memo === null) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const titleEditor = titleEditorRef.current;
      if (titleEditor === null) {
        editorRef.current?.focus();
        return;
      }

      titleEditor.focus();
      const selection = window.getSelection();
      if (selection !== null && titleEditor.textContent === "未命名备忘录") {
        const range = document.createRange();
        range.selectNodeContents(titleEditor);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [autoFocus, documentView, memoClientKey]);
  // oxlint-enable react-hooks/exhaustive-deps

  useEffect(() => {
    // 切换到未缓存笔记时，组件先以 memo=null 挂载 Skeleton。此刻 useMemoAutosave
    // 的初值是空串，若反写树就会让侧栏标题闪一下；只有完整 detail 到场后才有
    // 资格把状态机里的规范标题同步回轻量树。
    //
    // 撞名的标题同样不反写：它一次也没提交过，文件树若跟着显示就等于宣称一个
    // 并不存在的改名（还会顺着默认画布传下去），刷新后又悄悄弹回去。
    if (memo === null || titleConflict) {
      return;
    }
    onTitleChangeRef.current(title);
  }, [memo, title, titleConflict]);

  // 编辑与阅读同处一个 PersistentView 栈：编辑期阅读面板只是 hidden、并未卸载。若把每键都在
  // 变的 content 直接喂给它，react-markdown 会在用户看不见时全文重解析。这里只在阅读态把最新
  // 正文 latch 进快照，编辑期沿用上一次快照——隐藏期间 readingContent 恒定、解析被彻底跳过；
  // 切回阅读态是同步写入，不出现一帧陈旧内容。
  const readingSnapshotRef = useRef(content);
  if (documentView === "reading") {
    readingSnapshotRef.current = content;
  }
  const readingContent = readingSnapshotRef.current;
  // MarkdownReadingView 未 memo 化，父组件每键重渲染仍会带着它一起重跑；冻结元素身份，让
  // readingContent 不变时 React 直接跳过整棵 Markdown 解析子树。
  const readingView = useMemo(
    () => <MarkdownReadingView content={readingContent} preserveSoftBreaks />,
    [readingContent],
  );

  function handleKeyboardSave(event: KeyboardEvent<HTMLElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void flush();
    }
  }

  function handleTitleInput(event: FormEvent<HTMLHeadingElement>) {
    const nextTitle = (event.currentTarget.textContent ?? "")
      .replace(/[\r\n]+/g, " ")
      .slice(0, MAX_TITLE_LENGTH);

    if (event.currentTarget.textContent !== nextTitle) {
      event.currentTarget.textContent = nextTitle;
    }

    updateTitle(nextTitle);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLHeadingElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      editorRef.current?.focus();
    }
  }

  function handleTitleBlur() {
    restoreTitleIfEmpty();
    void flush();
  }

  function handleContentBlur() {
    void flush();
  }

  if (treeStatus === "loading") {
    return <NotesWorkspaceSkeleton visible={skeletonVisible} />;
  }

  if (treeStatus === "error") {
    return (
      <NotesWorkspacePlaceholder
        description="请检查网络或后端服务，恢复后重新进入工作区。"
        title="暂时无法加载备忘录"
        tone="error"
      />
    );
  }

  if (memo === null) {
    return emptyTree ? (
      <NotesWorkspacePlaceholder
        description="在左侧点「新建」写下第一个想法，其余的交给 Folune。"
        title="从这里开始记录"
      />
    ) : (
      <NotesWorkspacePlaceholder
        description="从左侧选一条继续书写，或新建一条开始记录。"
        title="选择一条备忘录"
      />
    );
  }

  return (
    <main
      aria-label={documentView === "editing" ? "备忘录编辑器" : "备忘录阅读器"}
      className={["notes-workspace", revealContent ? "loading-content-reveal" : ""].join(" ")}
      onKeyDown={handleKeyboardSave}
    >
      <article className="note-editor-canvas" data-document-view={documentView}>
        {/* 标题与它的校验提示是同一个标题块：包一层才不会在 canvas 网格里多占一行 */}
        <div className="note-editor-heading">
          <h1
            aria-describedby={titleConflict ? TITLE_CONFLICT_HINT_ID : undefined}
            aria-invalid={titleConflict ? true : undefined}
            aria-label="备忘录标题"
            aria-multiline={documentView === "editing" ? "false" : undefined}
            aria-readonly={documentView === "reading" ? true : undefined}
            className="note-editor-title"
            contentEditable={documentView === "editing" ? "plaintext-only" : false}
            data-conflict={titleConflict ? "" : undefined}
            data-placeholder="备忘录标题"
            onBlur={handleTitleBlur}
            onInput={handleTitleInput}
            onKeyDown={handleTitleKeyDown}
            ref={titleEditorRef}
            role={documentView === "editing" ? "textbox" : undefined}
            spellCheck={documentView === "editing"}
            suppressContentEditableWarning
          />
          {titleConflict && documentView === "editing" ? (
            <p
              className="note-editor-title-conflict"
              id={TITLE_CONFLICT_HINT_ID}
              role="alert"
            >
              已存在同名笔记，换一个名字即可继续保存标题；正文仍在自动保存。
            </p>
          ) : null}
        </div>
        <div className="note-view-stack">
        <PersistentView active={documentView === "editing"} className="note-editor-content">
          <MarkdownEditor
            editingMode={editingMode}
            onBlur={handleContentBlur}
            onChange={updateContent}
            placeholder="开始写…"
            ref={editorRef}
            theme={resolvedTheme}
            value={content}
          />
        </PersistentView>
        <PersistentView active={documentView === "reading"} className="note-reading-surface">
            {readingView}
        </PersistentView>
        </div>
      </article>
    </main>
  );
});
