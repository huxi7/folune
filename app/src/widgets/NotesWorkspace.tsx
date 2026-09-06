/**
 * [INPUT]: 依赖按需加载的 MemoDetailNode、跨临时/真实 ID 保持不变的 memoClientKey、新建聚焦意图、正文加载状态、DocumentView/EditingMode、Motion for React 内容切换、useMemoAutosave、MarkdownEditor/ReadingView、ThemeProvider 与 Toast
 * [OUTPUT]: 对外提供临时节点提交期间不重挂载的纸张内本地草稿写作/阅读列与 NotesWorkspaceHandle，并以不破坏 CodeMirror 会话的淡入切换表达编辑/阅读视图，仅在笔记身份切换时聚焦新纸标题/编辑器
 * [POS]: app/src/widgets 的备忘录编辑会话边界；Paper 外壳不拥有编辑状态，客户端身份隔离后端 ID 置换，Dashboard 只能经显式 handle 跨越自动保存边界；按需正文未到达前绝不把空标题反写轻量树；同级重名在标题区原位提示且不阻断正文自动保存
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/* oxlint-disable jsx-a11y/heading-has-content -- contentEditable h1 的可访问名称由 aria-label 与运行时 textContent 提供 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";

import type { MemoDetailNode } from "../shared/api/memo";
import {
  Skeleton,
  SkeletonGroup,
  useToast,
} from "../shared/design-system/components";
import { useTheme } from "../shared/theme/ThemeProvider";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "./MarkdownEditor";
import { MarkdownReadingView } from "./MarkdownReadingView";
import type { DocumentView, EditingMode } from "./markdownViewTypes";
import { contentSwitch } from "../lib/motion.js";
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

function NotesWorkspaceSkeleton({ visible }: { visible: boolean }) {
  return (
    <main className="notes-workspace notes-workspace-loading">
      <SkeletonGroup
        className="note-editor-canvas note-editor-skeleton"
        label="正在加载备忘录正文"
        visible={visible}
      >
        <Skeleton className="note-skeleton-title" shape="text" />
        <div className="note-skeleton-body" aria-hidden="true">
          <Skeleton className="note-skeleton-line note-skeleton-line-wide" shape="text" />
          <Skeleton className="note-skeleton-line" shape="text" />
          <Skeleton className="note-skeleton-line note-skeleton-line-short" shape="text" />
          <Skeleton className="note-skeleton-line note-skeleton-line-wide" shape="text" />
          <Skeleton className="note-skeleton-line note-skeleton-line-medium" shape="text" />
        </div>
      </SkeletonGroup>
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
      <main className="notes-workspace-state" role="status">
        <strong>暂时无法加载备忘录</strong>
        <span>请检查网络或后端服务，恢复后重新进入工作区。</span>
      </main>
    );
  }

  if (memo === null) {
    return (
      <main className="notes-workspace-state">
        <strong>{emptyTree ? "还没有备忘录" : "选择一条备忘录"}</strong>
        <span>
          {emptyTree
            ? "点击侧边栏标题栏右侧的“新建备忘录”，或在侧边栏空白处右键创建。"
            : "从左侧文件树选择一条备忘录后开始编辑。"}
        </span>
      </main>
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
        <motion.div
          aria-hidden={documentView === "reading"}
          className="note-editor-content"
          hidden={documentView === "reading"}
          animate={documentView === "editing" ? "visible" : "hidden"}
          initial={false}
          variants={contentSwitch}
        >
          <MarkdownEditor
            editingMode={editingMode}
            onBlur={handleContentBlur}
            onChange={updateContent}
            placeholder="开始写…"
            ref={editorRef}
            theme={resolvedTheme}
            value={content}
          />
        </motion.div>
        <AnimatePresence initial={false} mode="wait">
          {documentView === "reading" ? (
            <motion.div
              animate="visible"
              className="note-reading-surface"
              exit="exit"
              initial="hidden"
              key="reading"
              variants={contentSwitch}
            >
              <MarkdownReadingView content={content} preserveSoftBreaks />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </article>
    </main>
  );
});
