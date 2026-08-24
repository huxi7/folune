/**
 * [INPUT]: 依赖 motion/react 的 useReducedMotion、explorationStore 的相位机、exploreClient 的 exploreMemo、NotesWorkspaceHandle 的 flush/选区/聚焦、explorePresentation 的时序与亲疏映射、Toast
 * [OUTPUT]: 对外提供探索态生命周期: explore/dismiss/drill/save 命令、⌘E 开关、候选与相位、已保存画布 id、给舞台的 items、给纸张的 paperView
 * [POS]: pages 层 AI 探索生命周期 Hook；与 useMemoOrganize 同构但更轻——探索是只读判断，不创建 Run、不写数据库、不经审批链，结果只住 explorationStore，退出即弃。下钻是「导航到那一篇再从它重新展开一层」，因此深度恒为 1: 中心永远是当前这张纸
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";

import type { MemoDetailNode } from "../shared/api/memo";
import { useToast } from "../shared/design-system/components";
import {
  isExplorationActive,
  isExplorationMounted,
  useExplorationStore,
  type ExplorationPhase,
} from "../shared/store/explorationStore";
import { saveExplorationCanvas } from "../shared/api/canvas";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { useWorkspaceChromeStore } from "../shared/store/workspaceChromeStore";
import { exploreMemo } from "../widgets/AgentPanel/exploreClient";
import type { NotesWorkspaceHandle } from "../widgets/NotesWorkspace";
import {
  EXPLORE_STAGE_MOTION,
  exploreStageItems,
  type ExploreStageItem,
} from "./explorePresentation";

type UseMemoExploreInput = {
  /** 只有笔记视图在前台时才响应快捷键 */
  active: boolean;
  currentDocument: MemoDetailNode | null;
  currentMemoId: string | null;
  onSelectMemo: (memoId: string) => void;
  workspaceRef: RefObject<NotesWorkspaceHandle | null>;
};

export function useMemoExplore({
  active,
  currentDocument,
  currentMemoId,
  onSelectMemo,
  workspaceRef,
}: UseMemoExploreInput) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const candidates = useExplorationStore((state) => state.candidates);
  const dropped = useExplorationStore((state) => state.dropped);
  const phase = useExplorationStore((state) => state.phase);
  const begin = useExplorationStore((state) => state.begin);
  const fail = useExplorationStore((state) => state.fail);
  const leave = useExplorationStore((state) => state.leave);
  const reset = useExplorationStore((state) => state.reset);
  const succeed = useExplorationStore((state) => state.succeed);
  const markSaved = useExplorationStore((state) => state.markSaved);
  const savedCanvasId = useExplorationStore((state) => state.savedCanvasId);
  const mergeServerNode = useMemoTreeStore((state) => state.mergeServerNode);
  const openLibrary = useWorkspaceChromeStore((state) => state.openLibrary);
  const leaveTimerRef = useRef(0);
  const savingRef = useRef(false);
  const drillTargetRef = useRef<string | null>(null);
  const previousPhaseRef = useRef<ExplorationPhase>("idle");
  const exploreRef = useRef<() => Promise<void>>(async () => {});

  const clearLeaveTimer = useCallback(() => {
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = 0;
  }, []);

  const explore = useCallback(async () => {
    if (currentMemoId === null || phase === "pending") {
      return;
    }

    const selection = workspaceRef.current?.readSelection() ?? null;
    const content = currentDocument?.memo.content_mdx ?? null;
    if (selection === null && content !== null && content.trim().length === 0) {
      toast({ title: "空白备忘录无需探索", variant: "info" });
      return;
    }

    // 先开场再取数: 那 19 秒要用起来，骨架必须与手势同帧出现，不能等响应
    clearLeaveTimer();
    const requestId = begin({
      memoId: currentMemoId,
      query: selection === null
        ? { kind: "memo", text: null }
        : { kind: "selection", text: selection },
    });

    try {
      // 让服务端读到刚写下的那句话，而不是上一次保存的版本
      await workspaceRef.current?.flushCurrentDraft();
      const result = await exploreMemo({ memoId: currentMemoId, selection });
      succeed(requestId, { candidates: result.related, dropped: result.dropped });
    } catch (error) {
      fail(requestId);
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "探索关联笔记失败",
        variant: "error",
      });
    }
  }, [
    begin,
    clearLeaveTimer,
    currentDocument?.memo.content_mdx,
    currentMemoId,
    fail,
    phase,
    succeed,
    toast,
    workspaceRef,
  ]);
  exploreRef.current = explore;

  const dismiss = useCallback(() => {
    if (!isExplorationMounted(useExplorationStore.getState().phase)) {
      return;
    }
    leave();
    clearLeaveTimer();
    // 候选活到收拢动画结束；纸也正好在此刻回到原位，编辑器随之归还
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = 0;
      reset();
    }, EXPLORE_STAGE_MOTION.retreatMs);
  }, [clearLeaveTimer, leave, reset]);

  /**
   * 把这一次探索保存成一张画布。虚线到此变成实线: AI 的推荐在用户按下保存的那一刻
   * 才写入关系表。坐标由舞台给出（相对中心的偏移），画布因此复现同一片排布。
   * 刻意不接受外部 accessToken——走 apiRequest 的实时取 token，不新增第 31 个硬取点。
   */
  const save = useCallback(async (
    offsets: readonly { id: string; x: number; y: number }[],
  ) => {
    const state = useExplorationStore.getState();

    if (
      state.savedCanvasId !== null
      || state.phase !== "ready"
      || currentDocument === null
      || savingRef.current
    ) {
      return;
    }

    savingRef.current = true;
    const offsetById = new Map(offsets.map((offset) => [offset.id, offset]));
    try {
      const result = await saveExplorationCanvas(undefined, {
        items: state.candidates.map((candidate) => ({
          confidence: candidate.confidence,
          excerpt: candidate.excerpt,
          matched_channels: candidate.matched_channels,
          node_id: candidate.node_id,
          reason: candidate.reason,
          revision: candidate.revision,
          x: offsetById.get(candidate.node_id)?.x ?? 0,
          y: offsetById.get(candidate.node_id)?.y ?? 0,
        })),
        origin_node_id: currentDocument.id,
        parent_id: currentDocument.parent_id,
        title: `「${currentDocument.title}」的关联`,
      });
      // 新画布就地并入文件树并唤醒文件库，让用户看见它出现在哪
      mergeServerNode(result.node);
      markSaved(result.node.id);
      openLibrary();
      toast({
        description: result.skipped_count === 0
          ? undefined
          : `${result.skipped_count} 篇已不在，未收入`,
        title: `已保存为画布 · ${result.card_count} 条关联`,
        variant: "success",
      });
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "保存画布失败",
        variant: "error",
      });
    } finally {
      savingRef.current = false;
    }
  }, [currentDocument, markSaved, mergeServerNode, openLibrary, toast]);

  const drill = useCallback((nodeId: string) => {
    if (nodeId === currentMemoId) {
      return;
    }
    drillTargetRef.current = nodeId;
    onSelectMemo(nodeId);
  }, [currentMemoId, onSelectMemo]);

  useEffect(() => () => window.clearTimeout(leaveTimerRef.current), []);

  // 切换 memo: 下钻则以新中心重新展开一层，其他情况（侧栏点选、删除跳转）直接收场
  useEffect(() => {
    if (drillTargetRef.current !== null && drillTargetRef.current === currentMemoId) {
      drillTargetRef.current = null;
      void exploreRef.current();
      return;
    }
    drillTargetRef.current = null;
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = 0;
    reset();
  }, [currentMemoId, reset]);

  // 退场结束才把焦点交还编辑器: 此刻纸已回位、编辑器已可见，选区从灰恢复为活跃。
  // 只在「主动消散」后归还，切换笔记导致的收场不抢焦点。
  useEffect(() => {
    if (previousPhaseRef.current === "leaving" && phase === "idle") {
      workspaceRef.current?.focusEditor();
    }
    previousPhaseRef.current = phase;
  }, [phase, workspaceRef]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        !active
        || !(event.metaKey || event.ctrlKey)
        || event.key.toLowerCase() !== "e"
      ) {
        return;
      }
      event.preventDefault();
      if (isExplorationMounted(useExplorationStore.getState().phase)) {
        dismiss();
        return;
      }
      void explore();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [active, dismiss, explore]);

  const items = useMemo<ExploreStageItem[]>(
    () => exploreStageItems(candidates, phase === "pending"),
    [candidates, phase],
  );

  const mounted = isExplorationMounted(phase);

  return {
    active: isExplorationActive(phase),
    candidates,
    dismiss,
    drill,
    dropped,
    explore,
    exploring: phase === "pending",
    items,
    mounted,
    /** 探索态强制纸张进入阅读投影: 活编辑器随之隐藏但不卸载，缩放的子树里于是没有需要测量光标的编辑器 */
    paperView: mounted ? ("reading" as const) : null,
    phase,
    reducedMotion: Boolean(reduceMotion),
    save,
    savedCanvasId,
  };
}
