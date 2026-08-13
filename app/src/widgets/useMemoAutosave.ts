/**
 * [INPUT]: 依赖 React state/effect/ref、真实 MemoTreeNode、Store 正文本地更新命令与显式 memoId 的后台保存命令
 * [OUTPUT]: 对外提供 useMemoAutosave、加载期无本地草稿的服务端初值接纳、可等待强制 flush、删除期 pause/resume、已提交标题接纳、草稿类型、调度参数与可测试重试器
 * [POS]: app/src/widgets 的编辑会话协调边界；删除前可证明保存完成并暂停卸载 flush，普通输入仍沿用单一自动保存状态机
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { MemoTreeNode } from "../shared/api/memo";

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
  initialContent: string;
  initialTitle: string;
  memoId: string;
  onContentChange: (content: string) => void;
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
};

type UseMemoAutosaveResult = {
  acceptCommittedTitle: (title: string) => void;
  content: string;
  flush: (options?: MemoFlushOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  restoreTitleIfEmpty: () => void;
  title: string;
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
): Promise<T> {
  let retryIndex = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      const delayMs = AUTOSAVE_RETRY_DELAYS_MS[retryIndex];

      if (delayMs === undefined) {
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

const draftForSession = (
  session: AutosaveSession,
): MemoDraftSnapshot | null => {
  const normalizedTitle = session.latestTitle.trim();
  const contentChanged = session.latestContent !== session.lastSavedContent;
  const titleChanged =
    normalizedTitle.length > 0 && normalizedTitle !== session.lastSavedTitle;

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
  initialContent,
  initialTitle,
  memoId,
  onContentChange,
  onFailure,
  onSave,
}: UseMemoAutosaveInput): UseMemoAutosaveResult {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const onContentChangeRef = useRef(onContentChange);
  const onFailureRef = useRef(onFailure);
  const onSaveRef = useRef(onSave);
  const sessionRef = useRef(
    createSession(memoId, initialTitle, initialContent),
  );
  const flushSessionRef = useRef<(
    session: AutosaveSession,
    options?: MemoFlushOptions,
  ) => Promise<void>>(async () => undefined);

  onContentChangeRef.current = onContentChange;
  onFailureRef.current = onFailure;
  onSaveRef.current = onSave;

  const flushSession = useCallback(async (
    session: AutosaveSession,
    options?: MemoFlushOptions,
  ) => {
    clearAutosaveTimers(session);

    if (session.paused) {
      return;
    }

    const draft = draftForSession(session);

    if (draft === null) {
      return;
    }

    if (session.savingPromise !== null) {
      try {
        await session.savingPromise;
      } catch (error) {
        if (options?.throwOnFailure) {
          throw error;
        }
      }

      if (options?.throwOnFailure && draftForSession(session) !== null) {
        return flushSession(session, options);
      }

      return;
    }

    const submittedKey = draftKey(draft);
    let request!: Promise<void>;
    request = (async () => {
      try {
        const updated = await saveWithRetry(() =>
          onSaveRef.current(
            session.memoId,
            draft,
            options?.keepalive ? { keepalive: true } : undefined,
          ));

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
        const latestDraft = draftForSession(session);

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

        const latestDraft = draftForSession(session);

        if (
          !session.paused &&
          !options?.throwOnFailure &&
          latestDraft !== null &&
          draftKey(latestDraft) !== submittedKey
        ) {
          window.setTimeout(() => {
            void flushSessionRef.current(session);
          }, 0);
        }
      }
    })();

    session.savingPromise = request;
    await request;

    if (options?.throwOnFailure && draftForSession(session) !== null) {
      return flushSession(session, options);
    }
  }, []);

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

    if (draftForSession(session) !== null) {
      scheduleAutosave(session);
    }
  }, [scheduleAutosave]);

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
    onContentChangeRef.current(nextContent);
    scheduleAutosave(session);
  }, [scheduleAutosave]);

  const updateTitle = useCallback((nextTitle: string) => {
    const session = sessionRef.current;
    session.latestTitle = nextTitle;
    session.failedDraftKey = null;
    setTitle(nextTitle);
    scheduleAutosave(session);
  }, [scheduleAutosave]);

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
    setTitle(nextTitle);
  }, []);

  return {
    acceptCommittedTitle,
    content,
    flush,
    pause,
    resume,
    restoreTitleIfEmpty,
    title,
    updateContent,
    updateTitle,
  };
}
