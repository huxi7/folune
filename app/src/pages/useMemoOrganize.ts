/**
 * [INPUT]: 依赖 AI Run api/chat organize、轻量当前节点与按需正文、NotesWorkspace flush/标题接纳、Memo Store 局部归并、WorkspaceChrome 与 Toast
 * [OUTPUT]: 对外提供当前/最近 Organize Run、待展示 presentation（区分 fresh 与 restored）、整理中状态、触发/确认/拒绝/撤销命令及 ⌘/Ctrl+Enter 快捷键
 * [POS]: pages 层 AI 整理生命周期 Hook；成功/撤销只唤醒文件库、待确认只唤醒 AI，stale/失败不强迫打开工具。刷新取回的最近 succeeded/undone 以 restored 恢复展示——刷新不是语义事件，不得因此重播成功，也不得因此强行展开文件库
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import {
  applyAiRun,
  getAiRun,
  rejectAiRun,
  undoAiRun,
  type AiRun,
} from "../shared/api/ai";
import type { MemoDetailNode, MemoTreeNode } from "../shared/api/memo";
import { useToast } from "../shared/design-system/components";
import { findNode } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { useWorkspaceChromeStore } from "../shared/store/workspaceChromeStore";
import { organizeMemo } from "../widgets/AgentPanel/organizeClient";
import type { NotesWorkspaceHandle } from "../widgets/NotesWorkspace";
import {
  getOrganizeWakeTarget,
  shouldPresentOrganizeResult,
  type OrganizePresentationRun,
} from "./organizePresentation";

const LAST_RUN_KEY_PREFIX = "folune:last-organize-run:";
const lastRunStorageKey = (userId: string): string =>
  `${LAST_RUN_KEY_PREFIX}${userId}`;

const isMemo = (node: MemoTreeNode | null): node is MemoTreeNode =>
  node?.node_type === "memo" && node.memo !== null;

type UseMemoOrganizeInput = {
  accessToken: string;
  active: boolean;
  currentMemo: MemoTreeNode | null;
  currentDocument: MemoDetailNode | null;
  onCommittedTitle: () => void;
  userId: string;
  workspaceRef: RefObject<NotesWorkspaceHandle | null>;
};

export function useMemoOrganize({
  accessToken,
  active,
  currentMemo,
  currentDocument,
  onCommittedTitle,
  userId,
  workspaceRef,
}: UseMemoOrganizeInput) {
  const { toast } = useToast();
  const openAssistant = useWorkspaceChromeStore((state) => state.openAssistant);
  const openLibrary = useWorkspaceChromeStore((state) => state.openLibrary);
  const reconcileAiRun = useMemoTreeStore((state) => state.reconcileAiRun);
  const [run, setRun] = useState<AiRun | null>(null);
  const [presentationRun, setPresentationRun] =
    useState<OrganizePresentationRun | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  /*
   * 刷新恢复。归档关系是否仍然为真, 与页面是否重载无关: 若最近一次 run 是
   * succeeded/undone, 就把它作为 restored presentation 交回去, 由 Dashboard 用
   * 当前树与当前 memo 决定它现在还成不成立。这里刻意不 openLibrary、不展开祖先、
   * 不重播 fresh —— 那三件事都属于「刚刚发生」, 而这不是。
   */
  useEffect(() => {
    const runId = window.localStorage.getItem(lastRunStorageKey(userId));
    if (runId === null) {
      setRun(null);
      return;
    }
    let cancelled = false;
    void getAiRun(accessToken, runId)
      .then((storedRun) => {
        if (cancelled) return;
        setRun(storedRun);
        if (shouldPresentOrganizeResult(storedRun.status)) {
          setPresentationRun({ origin: "restored", run: storedRun });
        }
      })
      .catch(() => window.localStorage.removeItem(lastRunStorageKey(userId)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, userId]);

  const mergeRun = useCallback((nextRun: AiRun) => {
    setRun(nextRun);
    window.localStorage.setItem(lastRunStorageKey(userId), nextRun.id);
    const wakeTarget = getOrganizeWakeTarget(nextRun.status);
    if (wakeTarget === "assistant") {
      setPresentationRun(null);
      openAssistant();
      return;
    }

    if (wakeTarget === "library" && shouldPresentOrganizeResult(nextRun.status)) {
      reconcileAiRun(nextRun);
      const resultMemo = nextRun.status === "undone"
        ? nextRun.result?.undo?.memo
        : nextRun.result?.memo;
      if (resultMemo !== undefined && resultMemo.id === currentMemo?.id) {
        workspaceRef.current?.acceptOrganizedTitle(resultMemo.title);
        onCommittedTitle();
      }
      setPresentationRun({ origin: "fresh", run: nextRun });
      openLibrary();
      return;
    }

    setPresentationRun(null);
  }, [currentMemo?.id, onCommittedTitle, openAssistant, openLibrary, reconcileAiRun, userId, workspaceRef]);

  /*
   * 切换到另一篇笔记才清除。首次从 null 落定成当前 memo 不是切换 —— 恢复请求是异步的,
   * 把「首帧还没有 currentMemo」也当成切换, 会在树刚到达时把刚恢复的 presentation 抹掉。
   */
  const presentedMemoIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextMemoId = currentMemo?.id ?? null;
    const previousMemoId = presentedMemoIdRef.current;
    if (previousMemoId === nextMemoId) return;
    presentedMemoIdRef.current = nextMemoId;
    if (previousMemoId === null) return;
    setPresentationRun(null);
  }, [currentMemo?.id]);

  const organize = useCallback(async () => {
    if (!isMemo(currentMemo) || organizing) return;
    setPresentationRun(null);
    setOrganizing(true);
    try {
      if (workspaceRef.current === null) {
        throw new Error("当前编辑会话尚未准备好，请稍后重试。");
      }
      await workspaceRef.current.flushCurrentDraft();
      const latest = findNode(useMemoTreeStore.getState().nodes, currentMemo.id);
      if (!isMemo(latest) || currentDocument?.memo.content_mdx.trim().length === 0) {
        toast({ title: "空白备忘录无需整理", variant: "info" });
        return;
      }
      const nextRun = await organizeMemo({
        idempotencyKey: crypto.randomUUID(),
        memoId: latest.id,
        threadId,
      });
      mergeRun(nextRun);
      if (nextRun.status === "awaiting_confirmation") toast({ title: "整理方案需要确认", variant: "info" });
      if (nextRun.status === "stale") toast({ title: "笔记已变化，请重新整理", variant: "warning" });
      if (nextRun.status === "failed") toast({ title: "AI 整理失败，笔记未修改", variant: "error" });
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : undefined, title: "AI 整理失败，笔记未修改", variant: "error" });
    } finally {
      setOrganizing(false);
    }
  }, [currentDocument?.memo.content_mdx, currentMemo, mergeRun, organizing, threadId, toast, workspaceRef]);

  const runCommand = useCallback(async (
    command: "apply" | "reject" | "undo",
  ) => {
    if (run === null || organizing) return;
    setOrganizing(true);
    try {
      const nextRun = command === "apply"
        ? await applyAiRun(accessToken, run.id)
        : command === "reject"
          ? await rejectAiRun(accessToken, run.id)
          : await undoAiRun(accessToken, run.id);
      mergeRun(nextRun);
      if (command === "apply" && nextRun.status === "stale") {
        toast({ title: "笔记已变化，请重新整理", variant: "warning" });
      }
      if (command === "apply" && nextRun.status === "failed") {
        toast({ title: "整理方案执行失败，笔记未修改", variant: "error" });
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: command === "undo" ? "无法自动撤销" : command === "reject" ? "取消整理失败" : "整理方案执行失败",
        variant: "error",
      });
    } finally {
      setOrganizing(false);
    }
  }, [accessToken, mergeRun, organizing, run, toast]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (active && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void organize();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [active, organize]);

  return {
    apply: () => runCommand("apply"),
    organize,
    organizing,
    presentationRun,
    reject: () => runCommand("reject"),
    run,
    setThreadId,
    undo: () => runCommand("undo"),
  };
}
