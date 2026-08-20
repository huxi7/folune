/**
 * [INPUT]: 依赖 AI Run api/chat organize、当前 memo、NotesWorkspace flush/标题接纳、Memo Store 局部归并、WorkspaceChrome 分流与 Toast
 * [OUTPUT]: 对外提供当前/最近 Organize Run、整理中状态、触发/确认/拒绝/撤销命令及 ⌘/Ctrl+Enter 快捷键
 * [POS]: pages 层 AI 整理生命周期 Hook；成功/撤销只唤醒文件库、待确认只唤醒 AI，stale/失败不强迫打开工具
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useState, type RefObject } from "react";

import {
  applyAiRun,
  getAiRun,
  rejectAiRun,
  undoAiRun,
  type AiRun,
} from "../shared/api/ai";
import type { MemoTreeNode } from "../shared/api/memo";
import { useToast } from "../shared/design-system/components";
import { findNode } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { useWorkspaceChromeStore } from "../shared/store/workspaceChromeStore";
import { organizeMemo } from "../widgets/AgentPanel/organizeClient";
import type { NotesWorkspaceHandle } from "../widgets/NotesWorkspace";
import {
  getOrganizeWakeTarget,
  shouldPresentOrganizeResult,
} from "./organizePresentation";

const LAST_RUN_KEY_PREFIX = "supernote:last-organize-run:";
const lastRunStorageKey = (userId: string): string =>
  `${LAST_RUN_KEY_PREFIX}${userId}`;

const isMemo = (node: MemoTreeNode | null): node is MemoTreeNode =>
  node?.node_type === "memo" && node.memo !== null;

type UseMemoOrganizeInput = {
  accessToken: string;
  active: boolean;
  currentMemo: MemoTreeNode | null;
  onCommittedTitle: () => void;
  userId: string;
  workspaceRef: RefObject<NotesWorkspaceHandle | null>;
};

export function useMemoOrganize({
  accessToken,
  active,
  currentMemo,
  onCommittedTitle,
  userId,
  workspaceRef,
}: UseMemoOrganizeInput) {
  const { toast } = useToast();
  const openAssistant = useWorkspaceChromeStore((state) => state.openAssistant);
  const openLibrary = useWorkspaceChromeStore((state) => state.openLibrary);
  const reconcileAiRun = useMemoTreeStore((state) => state.reconcileAiRun);
  const [run, setRun] = useState<AiRun | null>(null);
  const [presentationRun, setPresentationRun] = useState<AiRun | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    const runId = window.localStorage.getItem(lastRunStorageKey(userId));
    if (runId === null) {
      setRun(null);
      return;
    }
    let cancelled = false;
    void getAiRun(accessToken, runId)
      .then((storedRun) => !cancelled && setRun(storedRun))
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
      setPresentationRun(nextRun);
      openLibrary();
      return;
    }

    setPresentationRun(null);
  }, [currentMemo?.id, onCommittedTitle, openAssistant, openLibrary, reconcileAiRun, userId, workspaceRef]);

  useEffect(() => {
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
      if (!isMemo(latest) || latest.memo?.content_mdx.trim().length === 0) {
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
  }, [currentMemo, mergeRun, organizing, threadId, toast, workspaceRef]);

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
