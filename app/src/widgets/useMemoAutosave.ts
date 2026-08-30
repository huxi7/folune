/**
 * [INPUT]: 依赖 React state/effect/ref、真实 MemoTreeNode 与显式 memoId 的后台保存命令
 * [OUTPUT]: 对外提供以 memoId 为唯一 session 身份、编辑器内本地草稿、具名递归 flush、晚到初值独立接纳、删除 pause/resume 与标题冲突隔离的 useMemoAutosave
 * [POS]: app/src/widgets 的编辑会话协调边界；删除前可证明保存完成并暂停卸载 flush，普通输入仍沿用单一自动保存状态机。标题与正文是两条独立提交路径：同级重名只挂起 title 字段并原位提示，正文永远继续自动保存
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { MemoTreeNode } from "../shared/api/memo";
import { isMemoTitleConflictError } from "../shared/store/memoTitleRules";

export const AUTOSAVE_CHAR_THRESHOLD = 32;
export const AUTOSAVE_IDLE_MS = 1_500;
export const AUTOSAVE_MAX_WAIT_MS = 8_000;
export const AUTOSAVE_RETRY_DELAYS_MS = [400, 800, 1_600] as const;

export type MemoDraftSnapshot = {
  content: string;
  contentChanged: boolean;
  title: string;
  titleChanged: boolean;
};

export type MemoSaveOptions = {
  keepalive?: boolean;
};

type MemoFlushOptions = MemoSaveOptions & {
  throwOnFailure?: boolean;
};

type UseMemoAutosaveInput = {
  /** 标题即时预检查：同级已有同名对象时返回 true */
  hasTitleConflict: (title: string) => boolean;
  initialContent: string;
  initialTitle: string;
  memoId: string;
  onFailure: (error: unknown) => void;
  onSave: (
    memoId: string,
    draft: MemoDraftSnapshot,
    options?: MemoSaveOptions,
  ) => Promise<MemoTreeNode>;
};

type AutosaveSession = {
  charsSinceFlush: number;
  debounceTimer: number | null;
  disposed: boolean;
  failedDraftKey: string | null;
  lastSavedContent: string;
  lastSavedTitle: string;
  latestContent: string;
  latestTitle: string;
  maxWaitTimer: number | null;
  memoId: string;
  paused: boolean;
  savingPromise: Promise<void> | null;
  /** 被服务端唯一约束驳回的那个标题；只挂起 title，正文照常保存 */
  serverRejectedTitle: string | null;
};

type UseMemoAutosaveResult = {
  acceptCommittedTitle: (title: string) => void;
  content: string;
  flush: (options?: MemoFlushOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  restoreTitleIfEmpty: () => void;
  title: string;
  /** 当前标题与同级重名：原位提示的唯一状态源 */
  titleConflict: boolean;
  updateContent: (content: string) => void;
  updateTitle: (title: string) => void;
};

type Sleep = (delayMs: number) => Promise<void>;

const sleep: Sleep = (delayMs) =>
  new Promise((resolve) => window.setTimeout(resolve, delayMs));

export const countChangedCharacters = (
  previousValue: string,
  nextValue: string,
): number => Math.abs(nextValue.length - previousValue.length) || 1;

export const shouldAdoptInitialMemo = (input: {
  initialContent: string;
  initialTitle: string;
  lastSavedContent: string;
  lastSavedTitle: string;
  latestContent: string;
  latestTitle: string;
}): boolean =>
  input.latestContent === input.lastSavedContent
  && input.latestTitle === input.lastSavedTitle
  && (
    input.initialContent !== input.lastSavedContent
    || input.initialTitle !== input.lastSavedTitle
  );

export async function saveWithRetry<T>(
  operation: () => Promise<T>,
  wait: Sleep = sleep,
  shouldRetry: (error: unknown) => boolean = () => true,
): Promise<T> {
  let retryIndex = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      const delayMs = AUTOSAVE_RETRY_DELAYS_MS[retryIndex];

      // 结构性拒绝（同级重名）重试三次也只会得到同一个答案；退避只对
      // 瞬时故障有意义，对确定性冲突只是把提示推迟了 2.8 秒。
      if (delayMs === undefined || !shouldRetry(error)) {
        throw error;
      }

      retryIndex += 1;
      await wait(delayMs);
    }
  }
}

const createSession = (
  memoId: string,
  title: string,
  content: string,
): AutosaveSession => ({
  charsSinceFlush: 0,
  debounceTimer: null,
  disposed: false,
  failedDraftKey: null,
  lastSavedContent: content,
  lastSavedTitle: title,
  latestContent: content,
  latestTitle: title,
  maxWaitTimer: null,
  memoId,
  paused: false,
  savingPromise: null,
  serverRejectedTitle: null,
});

const clearAutosaveTimers = (session: AutosaveSession) => {
  if (session.debounceTimer !== null) {
    window.clearTimeout(session.debounceTimer);
    session.debounceTimer = null;
  }

  if (session.maxWaitTimer !== null) {
    window.clearTimeout(session.maxWaitTimer);
    session.maxWaitTimer = null;
  }
};

/**
 * 标题是否被挂起。两个来源：本地预检查发现同级重名，或服务端唯一约束刚驳回过
 * 这个标题。挂起只影响 title 字段——正文永远继续保存，否则用户在冲突状态下
 * 写的正文会随着一次注定失败的改名一起丢掉。
 */
const isTitleBlocked = (
  session: AutosaveSession,
  hasConflict: (title: string) => boolean,
): boolean => {
  const normalizedTitle = session.latestTitle.trim();

  if (normalizedTitle.length === 0) return false;
  if (session.serverRejectedTitle === normalizedTitle) return true;

  return hasConflict(normalizedTitle);
};

const draftForSession = (
  session: AutosaveSession,
  titleBlocked: boolean,
): MemoDraftSnapshot | null => {
  const normalizedTitle = session.latestTitle.trim();
  const contentChanged = session.latestContent !== session.lastSavedContent;
  const titleChanged = !titleBlocked
    && normalizedTitle.length > 0
    && normalizedTitle !== session.lastSavedTitle;

  if (!contentChanged && !titleChanged) {
    return null;
  }

  return {
    content: session.latestContent,
    contentChanged,
    title: normalizedTitle,
    titleChanged,
  };
};

const draftKey = (draft: MemoDraftSnapshot): string =>
  JSON.stringify([
    draft.contentChanged ? draft.content : null,
    draft.titleChanged ? draft.title : null,
  ]);

export function useMemoAutosave({
  hasTitleConflict,
  initialContent,
  initialTitle,
  memoId,
  onFailure,
  onSave,
}: UseMemoAutosaveInput): UseMemoAutosaveResult {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [titleConflict, setTitleConflict] = useState(false);
  const hasTitleConflictRef = useRef(hasTitleConflict);
  const onFailureRef = useRef(onFailure);
  const onSaveRef = useRef(onSave);
  const sessionRef = useRef(
    createSession(memoId, initialTitle, initialContent),
  );
  const flushSessionRef = useRef<(
    session: AutosaveSession,
    options?: MemoFlushOptions,
  ) => Promise<void>>(async () => undefined);

  hasTitleConflictRef.current = hasTitleConflict;
  onFailureRef.current = onFailure;
  onSaveRef.current = onSave;

  /*
   * 每次取草稿都重新解释一次"标题是否被挂起", 并把结论同步给视图。判据放在
   * 取草稿这一刻而不是缓存起来: 用户改一个字就可能让冲突消失, 提示必须立刻跟着
   * 消失, 标题也要立刻恢复可提交。
   */
  const draftNow = useCallback((session: AutosaveSession) => {
    const blocked = isTitleBlocked(session, hasTitleConflictRef.current);

    if (sessionRef.current === session && !session.disposed) {
      setTitleConflict(blocked);
    }

    return draftForSession(session, blocked);
  }, []);

  const flushSession = useCallback(async function flushSession(
    session: AutosaveSession,
    options?: MemoFlushOptions,
  ) {
    clearAutosaveTimers(session);

    if (session.paused) {
      return;
    }

    const draft = draftNow(session);

    if (draft === null) {
      return;
    }

    if (session.savingPromise !== null) {
      // ---- page-exit 语义: 不得等待在飞请求 ----
      // 页面正在卸载, 在飞的普通 PATCH 会随之被取消; 等它只会等到一个
      // 已死的 promise, 然后裸 return —— keepalive 从未发出, 快照之后的
      // 增量全部丢失。此处必须为 keepalive 新建一次请求: keepalive 的
      // fetch 由浏览器接管, 能活过卸载。不走 saveWithRetry —— 页面已死,
      // 重试延时没有意义。
      if (options?.keepalive) {
        void onSaveRef.current(session.memoId, draft, { keepalive: true })
          .catch(() => {
            // 卸载路径无处上报, 静默失败 (与 onFailure 不可达的现状一致)
          });

        return;
      }

      try {
        await session.savingPromise;
      } catch (error) {
        if (options?.throwOnFailure) {
          throw error;
        }
      }

      if (options?.throwOnFailure && draftNow(session) !== null) {
        return flushSession(session, options);
      }

      return;
    }

    const submittedKey = draftKey(draft);
    let request!: Promise<void>;
    request = (async () => {
      try {
        const updated = await saveWithRetry(
          () =>
            onSaveRef.current(
              session.memoId,
              draft,
              options?.keepalive ? { keepalive: true } : undefined,
            ),
          undefined,
          (error) => !isMemoTitleConflictError(error),
        );

        if (
          draft.contentChanged &&
          session.latestContent === draft.content
        ) {
          session.lastSavedContent = draft.content;
          session.charsSinceFlush = 0;
        }

        if (
          draft.titleChanged &&
          session.latestTitle.trim() === draft.title
        ) {
          session.lastSavedTitle = updated.title;
          session.latestTitle = updated.title;

          if (sessionRef.current === session && !session.disposed) {
            setTitle(updated.title);
          }
        }

        session.failedDraftKey = null;
      } catch (error) {
        /*
         * ---- 唯一约束驳回：只挂起标题，绝不连坐正文 ----
         * 前端预检查是快速反馈，唯一索引才是并发下的最终真相；预检查放过的
         * 标题仍可能在这里被驳回。记下这个标题后重新取草稿，下一次提交就只
         * 带正文，用户在冲突期间写的字照常落库。冲突不走 onFailure 的错误
         * Toast，但也没有被吞掉——它变成标题编辑区的原位提示。
         */
        if (isMemoTitleConflictError(error) && draft.titleChanged) {
          session.serverRejectedTitle = draft.title;
          // 重新取草稿会把提示点亮并让下一份草稿只剩正文；补发交给 finally 里
          // 既有的"草稿已变化就追赶"分支，不另建第二条重试路径。
          draftNow(session);

          if (!options?.throwOnFailure) {
            return;
          }
        }

        const latestDraft = draftNow(session);

        if (
          latestDraft !== null &&
          draftKey(latestDraft) === submittedKey &&
          session.failedDraftKey !== submittedKey
        ) {
          session.failedDraftKey = submittedKey;
          if (!options?.throwOnFailure) {
            onFailureRef.current(error);
          }
        }

        if (options?.throwOnFailure) {
          throw error;
        }
      } finally {
        if (session.savingPromise === request) {
          session.savingPromise = null;
        }

        const latestDraft = draftNow(session);

        if (
          !session.paused &&
          !options?.throwOnFailure &&
          latestDraft !== null &&
          draftKey(latestDraft) !== submittedKey
        ) {
          window.setTimeout(() => {
            // 补发保留原调用的 keepalive 语义, 否则追赶出的那一次
            // 落在卸载路径上时同样发不出去
            void flushSessionRef.current(
              session,
              options?.keepalive ? { keepalive: true } : undefined,
            );
          }, 0);
        }
      }
    })();

    session.savingPromise = request;
    await request;

    if (options?.throwOnFailure && draftNow(session) !== null) {
      return flushSession(session, options);
    }
  }, [draftNow]);

  flushSessionRef.current = flushSession;

  const scheduleAutosave = useCallback((session: AutosaveSession) => {
    if (session.paused) {
      return;
    }

    if (session.charsSinceFlush >= AUTOSAVE_CHAR_THRESHOLD) {
      void flushSessionRef.current(session);
      return;
    }

    if (session.debounceTimer !== null) {
      window.clearTimeout(session.debounceTimer);
    }

    session.debounceTimer = window.setTimeout(() => {
      session.debounceTimer = null;
      void flushSessionRef.current(session);
    }, AUTOSAVE_IDLE_MS);

    if (session.maxWaitTimer === null) {
      session.maxWaitTimer = window.setTimeout(() => {
        session.maxWaitTimer = null;
        void flushSessionRef.current(session);
      }, AUTOSAVE_MAX_WAIT_MS);
    }
  }, []);

  const flush = useCallback(
    (options?: MemoFlushOptions) =>
      flushSession(sessionRef.current, options),
    [flushSession],
  );

  const pause = useCallback(() => {
    const session = sessionRef.current;
    clearAutosaveTimers(session);
    session.paused = true;
  }, []);

  const resume = useCallback(() => {
    const session = sessionRef.current;

    if (!session.paused) {
      return;
    }

    session.paused = false;

    if (draftNow(session) !== null) {
      scheduleAutosave(session);
    }
  }, [draftNow, scheduleAutosave]);

  // session 只以 memoId 为身份；initial* 的晚到刷新由下一段 effect 安全采纳，不能在这里销毁重建保存会话。
  // oxlint-disable react-hooks/exhaustive-deps -- 避免服务端刷新中断在途自动保存
  useEffect(() => {
    let session = sessionRef.current;

    if (session.memoId !== memoId || session.disposed) {
      session = createSession(memoId, initialTitle, initialContent);
      sessionRef.current = session;
      setContent(initialContent);
      setTitle(initialTitle);
    }

    return () => {
      session.disposed = true;

      if (!session.paused) {
        void flushSession(session);
      }
    };
  }, [flushSession, memoId]);
  // oxlint-enable react-hooks/exhaustive-deps

  useEffect(() => {
    const session = sessionRef.current;

    if (
      session.memoId !== memoId
      || session.disposed
      || !shouldAdoptInitialMemo({
        initialContent,
        initialTitle,
        lastSavedContent: session.lastSavedContent,
        lastSavedTitle: session.lastSavedTitle,
        latestContent: session.latestContent,
        latestTitle: session.latestTitle,
      })
    ) {
      return;
    }

    session.lastSavedContent = initialContent;
    session.latestContent = initialContent;
    session.lastSavedTitle = initialTitle;
    session.latestTitle = initialTitle;
    session.failedDraftKey = null;
    setContent(initialContent);
    setTitle(initialTitle);
  }, [initialContent, initialTitle, memoId]);

  useEffect(() => {
    const flushForPageExit = () => {
      void flush({ keepalive: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushForPageExit();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", flushForPageExit);
    window.addEventListener("pagehide", flushForPageExit);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", flushForPageExit);
      window.removeEventListener("pagehide", flushForPageExit);
    };
  }, [flush]);

  const updateContent = useCallback((nextContent: string) => {
    const session = sessionRef.current;

    if (nextContent === session.latestContent) {
      return;
    }

    session.charsSinceFlush += countChangedCharacters(
      session.latestContent,
      nextContent,
    );
    session.latestContent = nextContent;
    session.failedDraftKey = null;
    setContent(nextContent);
    scheduleAutosave(session);
  }, [scheduleAutosave]);

  const updateTitle = useCallback((nextTitle: string) => {
    const session = sessionRef.current;
    session.latestTitle = nextTitle;
    session.failedDraftKey = null;
    setTitle(nextTitle);
    // 提示必须在敲字的这一刻就出现/消失，不能等 1.5s 的 autosave 才知道
    draftNow(session);
    scheduleAutosave(session);
  }, [draftNow, scheduleAutosave]);

  const restoreTitleIfEmpty = useCallback(() => {
    const session = sessionRef.current;

    if (session.latestTitle.trim().length === 0) {
      session.latestTitle = session.lastSavedTitle;
      setTitle(session.lastSavedTitle);
    }
  }, []);

  const acceptCommittedTitle = useCallback((nextTitle: string) => {
    const session = sessionRef.current;
    session.lastSavedTitle = nextTitle;
    session.latestTitle = nextTitle;
    session.failedDraftKey = null;
    // 这个标题是服务端已提交的事实，之前的驳回记录随之作废
    session.serverRejectedTitle = null;
    setTitle(nextTitle);
    setTitleConflict(false);
  }, []);

  return {
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
  };
}
