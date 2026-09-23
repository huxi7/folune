/**
 * [INPUT]: 依赖首次入口就绪桥梁、React Router Profile/token、Canvas bootstrap、轻量 tree/正文/Workspace Store、删除编排、惰性 AI、持久左右工具宿主、按当前树重算的归档 presentation、useOverlayPanels 响应式判据与 Paper/Canvas Workspace
 * [OUTPUT]: 对外提供 useAppDashboardController 状态与命令投影，支撑互斥 Paper/Canvas 舞台、跨路由不卸载且普通笔记切换不参与整页快照的文件库 React 实例、细粒度正文订阅、当前树节点缓存与正文就绪后的预取、Canvas 离场 flush、网络策略约束的 Canvas 预载、归档 canonical 目标下传与账户/视图编排，改名与文件夹创建成功静默
 * [POS]: app/src/pages 的 /app 状态协调 Hook，由 AppDashboard 单次持有；跨 Paper/Canvas 的数据与视觉交接只在此建立一次，深链刷新先确认节点类型，普通业务状态仍留在各自 Store/Workspace，文件库作为共享 Chrome 留在两种内容壳之外。它是「现在是不是覆盖式布局」的唯一持有者并下传给 Paper 壳与归档 Overlay：同一个断点算两遍就会出现两个都自称正确的布局；归档只交出 canonical memo，屏幕上由谁代表它归 AppSidebar
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useLoaderData,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { useWorkspaceEntryReady } from "./useWorkspaceEntryReady";
import { transitionContent } from "./viewTransition";

import type { MemoTreeNode } from "../shared/api/memo";
import { useDelayedSkeleton, useToast } from "../shared/design-system/components";
import { clampCanvasChrome } from "../shared/store/canvasChromePolicy";
import { useCanvasChromeStore } from "../shared/store/canvasChromeStore";
import { useCanvasReturnStore } from "../shared/store/canvasReturnStore";
import { useCanvasWorkspaceStore } from "../shared/store/canvasWorkspaceStore";
import { useCommandPaletteStore } from "../shared/store/commandPaletteStore";
import { useMemoDocumentStore } from "../shared/store/memoDocumentStore";
import { isMemoTitleConflictError } from "../shared/store/memoTitleRules";
import { findNode } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { useRecentNodesStore } from "../shared/store/recentNodesStore";
import { useWorkspaceChromeStore } from "../shared/store/workspaceChromeStore";
import { signOutAuthenticatedUser } from "../shared/supabase/auth";
import type { AccountSection } from "../widgets/AccountDialog";
import { type SidebarView } from "../widgets/AppSidebar";
import type { WorkspaceOrganizePresentation } from "../widgets/archiveCordPolicy";
import { preloadKnowledgeCanvas } from "../widgets/CanvasWorkspace";
import type { CanvasSessionControls } from "../widgets/KnowledgeCanvas/useCanvasSessionCoordinator";
import type {
  DocumentView,
  EditingMode,
} from "../widgets/markdownViewTypes";
import type { MemoMovePlan } from "../widgets/memoLibrary";
import {
  type MemoDraftSnapshot,
  type MemoSaveOptions,
  type NotesWorkspaceHandle
} from "../widgets/NotesWorkspace";
import { type WorkspaceAuxView } from "../widgets/WorkspaceAuxViews";
import type { AccountDialogState, MemoDialogState, TreeStatus, ViewTitleDraft, WorkspaceLoaderData } from "./appDashboardTypes";
import { resolveCanvasNodeId } from "./canvasPresentation";
import { buildWorkspaceOrganizePresentation } from "./organizePresentation";
import { useAccountProfileRefresh } from "./useAccountProfileRefresh";
import { useMemoCanvasEntry } from "./useMemoCanvasEntry";
import { useMemoDocumentLoad } from "./useMemoDocumentLoad";
import { useMemoDocumentPreload } from "./useMemoDocumentPreload";
import { canPreloadWorkspace } from "./workspacePreload";
import { useMemoNodeDeletion } from "./useMemoNodeDeletion";
import { useMemoOrganize } from "./useMemoOrganize";
import { useOptimisticMemoCreation } from "./useOptimisticMemoCreation";
import { useStandaloneCanvasCreation } from "./useStandaloneCanvasCreation";
import {
  AGENT_MAX_WIDTH,
  AGENT_MIN_WIDTH,
  AGENT_WIDTH_KEY,
  DEFAULT_AGENT_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_KEY,
  useOverlayPanels,
  usePersistedPanelWidth,
  type WorkspaceStyle,
} from "./workspaceLayout";

const LAST_MEMO_KEY_PREFIX = "supernote:last-memo:";
const DEFAULT_MEMO_TITLE = "未命名备忘录";
const lastMemoStorageKey = (userId: string): string =>
  `${LAST_MEMO_KEY_PREFIX}${userId}`;
export const isMemo = (node: MemoTreeNode | null): node is MemoTreeNode =>
  node?.node_type === "memo" && node.memo !== null;

export const loadAgentPanel = () => import("../widgets/AgentPanel");


const scheduleIdle = (work: () => void): (() => void) => {
  if (window.requestIdleCallback !== undefined) {
    const idleId = window.requestIdleCallback(work, { timeout: 1_200 });
    return () => window.cancelIdleCallback(idleId);
  }
  const timerId = window.setTimeout(work, 180);
  return () => window.clearTimeout(timerId);
};

export function useAppDashboardController() {
  const { accessToken, entryId, memoTree: initialMemoTree, profile: initialProfile } =
    useLoaderData() as WorkspaceLoaderData;
  const navigate = useNavigate();
  const noteMatch = useMatch("/app/notes/:noteId");
  const routeMemoId = noteMatch?.params.noteId ?? null;
  const { toast } = useToast();
  const assistantOpen = useWorkspaceChromeStore((state) => state.assistantOpen);
  const libraryOpen = useWorkspaceChromeStore((state) => state.libraryOpen);
  const closeAssistant = useWorkspaceChromeStore((state) => state.closeAssistant);
  const openPaperLibrary = useWorkspaceChromeStore((state) => state.openLibrary);
  const closeLibrary = useWorkspaceChromeStore((state) => state.closeLibrary);
  const hydrateWorkspaceChrome = useWorkspaceChromeStore((state) => state.hydrate);
  const hydrateCanvasChrome = useCanvasChromeStore((state) => state.hydrate);
  const peekCanvasEntryChrome = useCanvasChromeStore((state) => state.peekEntryChrome);
  const hydrateRecentNodes = useRecentNodesStore((state) => state.hydrate);
  const rememberRecentNode = useRecentNodesStore((state) => state.remember);
  const openCommandPalette = useCommandPaletteStore((state) => state.openPalette);
  const rememberCanvasEntry = useCanvasChromeStore((state) => state.rememberEntry);
  const toggleAssistant = useWorkspaceChromeStore((state) => state.toggleAssistant);
  const toggleLibrary = useWorkspaceChromeStore((state) => state.toggleLibrary);
  const memoTree = useMemoTreeStore((state) => state.nodes);
  const hydrateTree = useMemoTreeStore((state) => state.hydrateTree);
  const createFolder = useMemoTreeStore((state) => state.createFolder);
  const createMemo = useMemoTreeStore((state) => state.createMemo);
  const moveNode = useMemoTreeStore((state) => state.moveNode);
  const renameNode = useMemoTreeStore((state) => state.renameNode);
  const restoreNode = useMemoTreeStore((state) => state.restoreNode);
  const getMemoClientKey = useMemoTreeStore(
    (state) => state.getMemoClientKey,
  );
  const canvasSessionCanvasId = useCanvasWorkspaceStore((state) => state.canvasId);
  const canvasSessionAssistantOpen = useCanvasWorkspaceStore((state) => state.assistantOpen);
  const canvasSessionLibraryOpen = useCanvasWorkspaceStore((state) => state.libraryOpen);
  const resolveMemoId = useMemoTreeStore((state) => state.resolveMemoId);
  const updateMemoTitleLocal = useMemoTreeStore(
    (state) => state.updateMemoTitleLocal,
  );
  const mergeMemoDetail = useMemoTreeStore((state) => state.mergeMemoDetail);
  const mergeServerNode = useMemoTreeStore((state) => state.mergeServerNode);
  const waitForMemoId = useMemoTreeStore((state) => state.waitForMemoId);
  const resetMemoTree = useMemoTreeStore((state) => state.reset);
  const preloadMemo = useMemoDocumentStore((state) => state.preloadMemo);
  const saveMemoDocument = useMemoDocumentStore((state) => state.saveMemoDraft);
  const [profile, setProfile] = useState(initialProfile);
  const [activeView, setActiveView] = useState<SidebarView>("note");
  const [documentView, setDocumentView] = useState<DocumentView>("editing");
  const [editingMode, setEditingMode] = useState<EditingMode>("live");
  const [viewTitleDraft, setViewTitleDraft] = useState<ViewTitleDraft>(null);
  const [entryStatus, setEntryStatus] = useState<TreeStatus>("loading");
  const [treeStatus, setTreeStatus] = useState<TreeStatus>("loading");
  const [accountDialog, setAccountDialog] = useState<AccountDialogState>(null);
  const [accountProfileRefreshing, setAccountProfileRefreshing] = useState(false);
  const [memoDialog, setMemoDialog] = useState<MemoDialogState>(null);
  const [treeMutating, setTreeMutating] = useState(false);
  const [trashRevision, setTrashRevision] = useState(0);
  const [focusMemoClientKey, setFocusMemoClientKey] = useState<string | null>(null);
  // Command Palette 打开文件夹时只在文件库里定位它; seq 让同一目标可反复定位
  const [revealTarget, setRevealTarget] = useState<
    { nodeId: string; seq: number } | null
  >(null);
  const notesWorkspaceRef = useRef<NotesWorkspaceHandle>(null);
  const canvasControlsRef = useRef<CanvasSessionControls | null>(null);
  const handleCanvasSessionReady = useCallback(
    (controls: CanvasSessionControls | null) => {
      canvasControlsRef.current = controls;
    },
    [],
  );
  const initialTreeHandledRef = useRef<string | null>(null);
  const treePlaceholderWasActiveRef = useRef(false);
  const [revealInitialTreeContent, setRevealInitialTreeContent] = useState(false);
  const canvasReturn = useCanvasReturnStore((state) => state.descriptor);
  const clearCanvasReturn = useCanvasReturnStore((state) => state.clear);
  const [sidebarWidth, setSidebarWidth] = usePersistedPanelWidth(
    SIDEBAR_WIDTH_KEY,
    DEFAULT_SIDEBAR_WIDTH,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH,
  );
  const [agentWidth, setAgentWidth] = usePersistedPanelWidth(
    AGENT_WIDTH_KEY,
    DEFAULT_AGENT_WIDTH,
    AGENT_MIN_WIDTH,
    AGENT_MAX_WIDTH,
  );
  const resolvedRouteMemoId = routeMemoId === null ? null : resolveMemoId(routeMemoId);
  const selectedMemo = useMemo(() => resolvedRouteMemoId === null
    ? null
    : findNode(memoTree, resolvedRouteMemoId), [memoTree, resolvedRouteMemoId]);
  const selectedMemoId = isMemo(selectedMemo) ? selectedMemo.id : null;
  const selectedMemoDocument = useMemoDocumentStore((state) =>
    selectedMemoId === null ? null : state.documents[selectedMemoId] ?? null);
  const selectedMemoDocumentStatus = useMemoDocumentStore((state) =>
    selectedMemoId === null ? "idle" : state.statuses[selectedMemoId] ?? "idle");
  const workspaceStyle: WorkspaceStyle = {
    "--workspace-agent-track": `${agentWidth}px`,
    "--workspace-sidebar-track": `${sidebarWidth}px`,
  };
  const treeSkeletonVisible = useDelayedSkeleton(treeStatus === "loading");
  const documentLoading = selectedMemoId !== null
    && (selectedMemoDocumentStatus === "idle" || selectedMemoDocumentStatus === "loading");
  const documentSkeletonVisible = useDelayedSkeleton(documentLoading);
  const treePlaceholderActive = treeStatus === "loading" || treeSkeletonVisible;
  const renderedTreeStatus: TreeStatus = treePlaceholderActive
    ? "loading"
    : treeStatus;
  const memoOrganize = useMemoOrganize({
    accessToken,
    active: activeView === "note",
    currentMemo: isMemo(selectedMemo) ? selectedMemo : null,
    currentDocument: selectedMemoDocument,
    onCommittedTitle: () => setViewTitleDraft(null),
    userId: profile.id,
    workspaceRef: notesWorkspaceRef,
  });
  const canvasNodeId = resolveCanvasNodeId(selectedMemo);
  useWorkspaceEntryReady(entryId, selectedMemoDocumentStatus === "error" || entryStatus === "error" ? "error"
    : canvasNodeId !== null || entryStatus !== "ready" || treeStatus !== "ready" || treeMutating
      || documentLoading || documentSkeletonVisible || treeSkeletonVisible
      ? "loading" : "ready");
  /*
   * 文件库是跨 Paper/Canvas 的同一个 UI 实例，开合状态却仍由当前空间各自拥有。
   * Canvas 会话尚未 beginSession 时，用只读 entry 预览让持久宿主先拿到正确终态；
   * peek 不消费一次性意图，真正的 CanvasWorkspace 仍是唯一的进入解析者。
   */
  const activeLibraryOpen = canvasNodeId === null
    ? libraryOpen
    : canvasSessionCanvasId === canvasNodeId
      ? canvasSessionLibraryOpen
      : canvasReturn?.canvasId === canvasNodeId
        ? canvasReturn.libraryOpen
        : peekCanvasEntryChrome(
          canvasNodeId,
          typeof window === "undefined" ? 0 : window.innerWidth,
        ).libraryOpen;
  const activeAssistantOpen = canvasNodeId === null
    ? assistantOpen
    : canvasSessionCanvasId === canvasNodeId
      ? canvasSessionAssistantOpen
      : canvasReturn?.canvasId === canvasNodeId
        ? canvasReturn.assistantOpen
        : peekCanvasEntryChrome(
          canvasNodeId,
          typeof window === "undefined" ? 0 : window.innerWidth,
        ).assistantOpen;
  const memoCanvasEntry = useMemoCanvasEntry({
    accessToken,
    mergeServerNode,
    navigate,
    prepare: async () => {
      await notesWorkspaceRef.current?.flushCurrentDraft();
    },
    toast,
    userId: profile.id,
  });
  const canvasCreation = useStandaloneCanvasCreation({ accessToken, mergeServerNode, navigate, toast });
  const memoDeletion = useMemoNodeDeletion({
    accessToken,
    editingSession: notesWorkspaceRef,
    lastMemoStorageKey: lastMemoStorageKey(profile.id),
    mutating: treeMutating,
    navigate,
    onDeleted: () => setTrashRevision((revision) => revision + 1),
    onLeaveRoute: () => {
      setViewTitleDraft(null);
      setActiveView("note");
    },
    routeNodeId: routeMemoId,
    setMutating: setTreeMutating,
    toast,
  });
  const paperView: WorkspaceAuxView = activeView;
  useMemoDocumentLoad({
    accessToken,
    enabled: treeStatus === "ready",
    memo: selectedMemoDocument,
    memoId: selectedMemoId,
  });
  useMemoDocumentPreload({
    accessToken,
    enabled: treeStatus === "ready" && selectedMemoDocument !== null,
    memoId: selectedMemoId,
    tree: memoTree,
  });

  useEffect(() => scheduleIdle(() => {
    void loadAgentPanel()
      .then((module) => module.preloadAiThreads({
        accessToken,
        userId: profile.id,
      }))
      .catch(() => undefined);
    if (canPreloadWorkspace()) preloadKnowledgeCanvas();
  }), [accessToken, profile.id]);

  useEffect(() => {
    hydrateWorkspaceChrome(profile.id);
    hydrateCanvasChrome(profile.id);
    hydrateRecentNodes(profile.id);
  }, [
    hydrateCanvasChrome,
    hydrateRecentNodes,
    hydrateWorkspaceChrome,
    profile.id,
  ]);

  useEffect(() => {
    if (treePlaceholderActive) {
      treePlaceholderWasActiveRef.current = true;
      setRevealInitialTreeContent(false);
      return;
    }

    if (
      treeStatus !== "ready" ||
      !treePlaceholderWasActiveRef.current
    ) {
      return;
    }

    treePlaceholderWasActiveRef.current = false;
    setRevealInitialTreeContent(true);
    const timerId = window.setTimeout(
      () => setRevealInitialTreeContent(false),
      220,
    );

    return () => window.clearTimeout(timerId);
  }, [treePlaceholderActive, treeStatus]);

  useEffect(() => {
    initialTreeHandledRef.current = null;
    setEntryStatus("loading");
    resetMemoTree();
    hydrateTree(initialMemoTree);
    setTreeStatus("ready");
  }, [accessToken, hydrateTree, initialMemoTree, initialProfile.id, resetMemoTree]);

  useEffect(() => {
    if (treeStatus !== "ready") {
      return;
    }

    const handlingKey = `${profile.id}:${routeMemoId ?? "index"}`;

    if (initialTreeHandledRef.current !== null) {
      return;
    }

    initialTreeHandledRef.current = handlingKey;
    const storageKey = lastMemoStorageKey(profile.id);

    if (routeMemoId !== null) {
      const resolvedRouteMemoId = resolveMemoId(routeMemoId);

      const routeNode = findNode(memoTree, resolvedRouteMemoId);

      if (isMemo(routeNode)) {
        window.localStorage.setItem(storageKey, resolvedRouteMemoId);
      } else if (resolveCanvasNodeId(routeNode) === null) {
        navigate("/app", { replace: true });
      }
      setEntryStatus("ready");
      return;
    }

    const lastMemoId = window.localStorage.getItem(storageKey);

    if (lastMemoId !== null && isMemo(findNode(memoTree, lastMemoId))) {
      navigate(`/app/notes/${encodeURIComponent(lastMemoId)}`, {
        replace: true,
      });
      setEntryStatus("ready");
      return;
    }

    if (lastMemoId !== null) {
      window.localStorage.removeItem(storageKey);
    }

    if (memoTree.length === 0) {
      setTreeMutating(true);
      void createMemo(accessToken, {
        content_mdx: "",
        parent_id: null,
        sort_order: "1000",
        title: DEFAULT_MEMO_TITLE,
      })
        .then((created) => {
          window.localStorage.setItem(storageKey, created.id);
          setFocusMemoClientKey(getMemoClientKey(created.id));
          navigate(`/app/notes/${encodeURIComponent(created.id)}`, {
            replace: true,
          });
        })
        .catch((error) => {
          toast({
            description: error instanceof Error ? error.message : undefined,
            title: "初始化备忘录失败",
            variant: "error",
          });
          setEntryStatus("error");
        })
        .finally(() => {
          setTreeMutating(false);
          setEntryStatus((status) => status === "error" ? "error" : "ready");
        });
    } else {
      setEntryStatus("ready");
    }
  }, [
    accessToken,
    createMemo,
    getMemoClientKey,
    memoTree,
    navigate,
    profile.id,
    routeMemoId,
    resolveMemoId,
    toast,
    treeStatus,
  ]);

  useEffect(() => {
    if (treeStatus !== "ready" || !isMemo(selectedMemo)) {
      return;
    }

    window.localStorage.setItem(
      lastMemoStorageKey(profile.id),
      selectedMemo.id,
    );
  }, [profile.id, selectedMemo, treeStatus]);

  /*
   * ⌘E 在两个 Workspace 里表达同一件事——往前推进一步: Paper 里进入这篇笔记的
   * 画布, Canvas 里从选中节点继续 AI 拓展（见 KnowledgeCanvas 的 handleKeyDown）。
   * 两个空间互斥, 所以同一个键位不会打架。AppMainToolbar 的画布按钮一直在 title
   * 与 aria-keyshortcuts 里宣传这个快捷键, 这里才是真正兑现它的地方。
   */
  useEffect(() => {
    if (canvasNodeId !== null || activeView !== "note" || selectedMemoId === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      void memoCanvasEntry.enterCanvas(selectedMemoId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, canvasNodeId, memoCanvasEntry, selectedMemoId]);

  const accountDialogOpen = accountDialog !== null;
  useAccountProfileRefresh({
    accessToken,
    open: accountDialogOpen,
    setProfile,
    setRefreshing: setAccountProfileRefreshing,
    toast,
  });
  const leaveCanvasSafely = useCallback(async (): Promise<boolean> => {
    const controls = canvasControlsRef.current;
    if (controls === null) return true;
    const result = await controls.flush();
    if (!result.persisted) {
      toast({
        title: "画布尚未安全保存",
        description: "本地恢复与服务器同步都未完成，已留在当前画布。",
        variant: "error",
      });
      return false;
    }
    if (!result.synced) {
      toast({
        title: "画布已保存在本地",
        description: "网络恢复后会继续同步。",
        variant: "info",
      });
    }
    return true;
  }, [toast]);

  function handleSelectMemo(memoId: string) {
    void (async () => {
      if (!(await leaveCanvasSafely())) return;
      clearCanvasReturn();
      setFocusMemoClientKey(null);
      if (activeView !== "note" && routeMemoId === memoId && canvasNodeId === null) {
        transitionContent(() => setActiveView("note"));
        rememberRecentNode(memoId);
        return;
      }
      setActiveView("note");
      rememberRecentNode(memoId);
      // 从文件树切到已有 Canvas 是普通对象切换: 把当前布局作为"保持现状"的依据,
      // 在导航发生的这一刻捕获，而不是等新会话去猜上一个空间留下了什么。
      const target = findNode(useMemoTreeStore.getState().nodes, resolveMemoId(memoId));
      if (resolveCanvasNodeId(target) !== null) {
        const canvasSession = useCanvasWorkspaceStore.getState();
        const paperChrome = useWorkspaceChromeStore.getState();
        const onCanvas = canvasSession.canvasId !== null;
        rememberCanvasEntry({
          canvasId: memoId,
          inherited: {
            assistantOpen: onCanvas
              ? canvasSession.assistantOpen
              : paperChrome.assistantOpen,
            libraryOpen: onCanvas
              ? canvasSession.libraryOpen
              : paperChrome.libraryOpen,
          },
          intent: "tree",
        });
      }
      // 普通笔记切换只动正文；整页快照会把常驻文件树也交叉淡换。
      navigate(`/app/notes/${encodeURIComponent(memoId)}`, { viewTransition: canvasNodeId !== null || resolveCanvasNodeId(target) !== null });
    })();
  }

  function handleSelectAuxView(view: SidebarView) {
    void (async () => {
      if (!(await leaveCanvasSafely())) return;
      if (canvasNodeId !== null) {
        setActiveView(view);
        navigate("/app", { viewTransition: true });
      } else transitionContent(() => setActiveView(view));
    })();
  }

  function handleOpenAccountDialog(section: AccountSection) {
    setAccountProfileRefreshing(true);
    setAccountDialog(section);
  }
  async function handleSignOut() {
    resetMemoTree();
    await signOutAuthenticatedUser();
    navigate("/", { replace: true, viewTransition: true });
  }

  const handleCreateMemo = useOptimisticMemoCreation({
    accessToken,
    lastMemoStorageKey: lastMemoStorageKey(profile.id),
    navigate,
    onCreatedMemo: setFocusMemoClientKey,
    onSelectMemo: handleSelectMemo,
    onTitleDraftReset: () => setViewTitleDraft(null),
    routeMemoId,
    toast,
  });

  async function handleMoveNode(nodeId: string, input: MemoMovePlan) {
    try {
      await moveNode(accessToken, nodeId, input);
      return true;
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "移动保存失败",
        variant: "error",
      });
      return false;
    }
  }

  async function handleRenameNode(nodeId: string, title: string) {
    try {
      await renameNode(accessToken, nodeId, title);
    } catch (error) {
      // 唯一约束是并发下的最终真相: 预检查放过的名字仍可能在这里被驳回,
      // 此时要说清"重名"而不是笼统的"保存失败"。
      const conflict = isMemoTitleConflictError(error);
      toast({
        description: conflict || !(error instanceof Error) ? undefined : error.message,
        title: conflict ? "同一位置已存在同名对象" : "重命名保存失败",
        variant: "error",
      });
    }
  }

  async function handleRestoreTrashNode(nodeId: string) {
    await restoreNode(accessToken, nodeId);
  }

  async function handleSaveMemo(
    memoId: string,
    {
      content,
      contentChanged,
      title,
      titleChanged,
    }: MemoDraftSnapshot,
    options?: MemoSaveOptions,
  ) {
    const resolvedMemoId = resolveMemoId(memoId);

    if (!isMemo(findNode(useMemoTreeStore.getState().nodes, resolvedMemoId))) {
      throw new Error("当前没有可保存的备忘录。");
    }

    const targetMemoId = await waitForMemoId(memoId);
    if (contentChanged) {
      useMemoDocumentStore.getState().updateContentLocal(targetMemoId, content);
    }
    const updated = await saveMemoDocument(
      accessToken,
      targetMemoId,
      {
        ...(contentChanged ? { content_mdx: content } : {}),
        ...(titleChanged ? { title } : {}),
      },
      options,
    );
    mergeMemoDetail(updated);
    return updated;
  }

  async function handleCreateFolder(title: string) {
    if (memoDialog === null) {
      return;
    }

    setTreeMutating(true);

    try {
      await createFolder(accessToken, {
        parent_id: memoDialog.parentId,
        title,
      });
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "创建失败，已撤销临时文件夹",
        variant: "error",
      });
      throw error;
    } finally {
      setTreeMutating(false);
    }
  }

  const currentMemoTitle = isMemo(selectedMemo) &&
    viewTitleDraft?.memoId === selectedMemo.id
    ? viewTitleDraft.title
    : selectedMemo?.title ?? "备忘录";
  const organizePresentation: WorkspaceOrganizePresentation | null =
    buildWorkspaceOrganizePresentation({
      memoTree,
      presentation: memoOrganize.presentationRun,
      selectedMemoId: selectedMemo?.id ?? null,
    });
  const memoDialogDescription = memoDialog === null
    ? ""
    : memoDialog.parentId === null
      ? "在根目录中创建文件夹。"
      : `在「${findNode(memoTree, memoDialog.parentId)?.title ?? "当前文件夹"}」中创建子文件夹。`;
  const closeActiveLibrary = canvasNodeId === null
    ? closeLibrary
    : () => useCanvasWorkspaceStore.getState()
      .setCanvasChrome({ libraryOpen: false });
  // Palette 定位文件夹要先让文件库可见; 具体是 Paper 还是 Canvas 的那一个,
  // 由当前空间决定, 两个 Chrome 状态源仍然各自独立。
  const openActiveLibrary = canvasNodeId === null
    ? openPaperLibrary
    : () => useCanvasWorkspaceStore.getState()
      .setCanvasChrome(clampCanvasChrome(
        { assistantOpen: false, libraryOpen: true },
        window.innerWidth,
      ));
  /*
   * 定位永远指向 canonical memo: 用户点「归档于〈目录〉」想去的是那篇笔记,
   * 而不是那个容器。reveal 会连带展开它的祖先, 于是代表自然回到 memo 本身。
   */
  const locateArchive = () => {
    if (organizePresentation === null) return;
    openActiveLibrary();
    setRevealTarget((current) => ({
      nodeId: organizePresentation.memoId,
      seq: (current?.seq ?? 0) + 1,
    }));
  };
  const closeActiveAssistant = canvasNodeId === null
    ? closeAssistant
    : () => useCanvasWorkspaceStore.getState()
      .setCanvasChrome({ assistantOpen: false });
  const paperViewport = useOverlayPanels(assistantOpen, libraryOpen);
  return {
    activeView,
    memoTree,
    treeMutating,
    canvasCreation,
    organizePresentation,
    handleCreateMemo,
    closeActiveLibrary,
    handleMoveNode,
    handleSelectAuxView,
    preloadMemo,
    accessToken,
    handleOpenAccountDialog,
    openCommandPalette,
    handleRenameNode,
    memoDeletion,
    setMemoDialog,
    handleSelectMemo,
    handleSignOut,
    profile,
    revealTarget,
    revealInitialTreeContent,
    routeMemoId,
    resolveMemoId,
    treeSkeletonVisible,
    renderedTreeStatus,
    setSidebarWidth,
    sidebarWidth,
    canvasReturn,
    selectedMemoDocument,
    currentMemoTitle,
    documentView,
    editingMode,
    memoCanvasEntry,
    setDocumentView,
    setEditingMode,
    selectedMemoId,
    memoOrganize,
    locateArchive,
    paperView,
    focusMemoClientKey,
    getMemoClientKey,
    treeStatus,
    selectedMemo,
    handleSaveMemo,
    updateMemoTitleLocal,
    setViewTitleDraft,
    notesWorkspaceRef,
    documentSkeletonVisible,
    selectedMemoDocumentStatus,
    documentLoading,
    handleRestoreTrashNode,
    trashRevision,
    setAgentWidth,
    agentWidth,
    closeActiveAssistant,
    canvasNodeId,
    assistantOpen,
    paperViewport,
    libraryOpen,
    closeAssistant,
    closeLibrary,
    toggleAssistant,
    toggleLibrary,
    workspaceStyle,
    handleCanvasSessionReady,
    activeLibraryOpen,
    activeAssistantOpen,
    accountDialog,
    accountProfileRefreshing,
    memoDialog,
    memoDialogDescription,
    setAccountProfileRefreshing,
    setAccountDialog,
    handleCreateFolder,
    setProfile,
    openActiveLibrary,
    setRevealTarget,
  };
}
