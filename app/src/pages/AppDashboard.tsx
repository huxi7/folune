/**
 * [INPUT]: 依赖 React Router Profile/token、轻量 tree/按需正文/WorkspaceChrome Store、memoTitleRules 重名判据、useMemoNodeDeletion 删除编排、AI Run、PaperWorkspaceShell/CanvasWorkspace 与业务工作区
 * [OUTPUT]: 对外提供互斥的 Paper First 写作舞台/全屏知识画布、路由类型未决时的中性全屏等待、目录轻载/单篇正文路由、草稿 flush 后删除/AI/整理/探索分流、标题重名即时判据下传及账户/视图编排
 * [POS]: app/src/pages 的 /app 编排层；目录、正文、编辑器、Run、浮动工具与 Trash 的跨域生命周期只在此建立一次等待边界，并依据路由节点类型在 Paper 与 Canvas 两种空间壳之间切换；深链刷新时先确认节点类型再挂载空间壳，避免画布前闪出 Paper/Panel
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useState } from "react";
import {
  useLoaderData,
  useMatch,
  useNavigate,
} from "react-router-dom";

import type { MemoTreeNode } from "../shared/api/memo";
import type { Profile } from "../shared/api/profile";
import { useDelayedSkeleton, useToast } from "../shared/design-system/components";
import { findNode } from "../shared/store/memoTree";
import { useMemoDocumentStore } from "../shared/store/memoDocumentStore";
import { isMemoTitleConflictError, memoNodeTitleTaken } from "../shared/store/memoTitleRules";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { useWorkspaceChromeStore } from "../shared/store/workspaceChromeStore";
import { useCanvasChromeStore } from "../shared/store/canvasChromeStore";
import { clampCanvasChrome } from "../shared/store/canvasChromePolicy";
import { useCommandPaletteStore } from "../shared/store/commandPaletteStore";
import { useRecentNodesStore } from "../shared/store/recentNodesStore";
import { useCanvasWorkspaceStore } from "../shared/store/canvasWorkspaceStore";
import { useCanvasReturnStore } from "../shared/store/canvasReturnStore";
import { signOutAuthenticatedUser } from "../shared/supabase/auth";
import type { AccountSection } from "../widgets/AccountDialog";
import { AgentPanel } from "../widgets/AgentPanel";
import { AppSidebar, type SidebarView } from "../widgets/AppSidebar";
import { AppMainToolbar } from "../widgets/AppMainToolbar";
import {
  getMemoFolderPath,
  type MemoMovePlan,
} from "../widgets/memoLibrary";
import type {
  DocumentView,
  EditingMode,
} from "../widgets/markdownViewTypes";
import {
  NotesWorkspace,
  type MemoDraftSnapshot,
  type MemoSaveOptions,
  type NotesWorkspaceHandle,
} from "../widgets/NotesWorkspace";
import { PanelResizeHandle } from "../widgets/PanelResizeHandle";
import { PaperWorkspaceShell } from "../widgets/PaperWorkspaceShell";
import type { WorkspaceOrganizePresentation } from "../widgets/archiveCordPolicy";
import { WorkspaceAuxViews, type WorkspaceAuxView } from "../widgets/WorkspaceAuxViews";
import { WorkspaceCommandPalette } from "../widgets/WorkspaceCommandPalette";
import {
  getMemoDeletionImpact,
  getPostDeletionDestination,
} from "./memoDeletion";
import { resolveCanvasNodeId } from "./canvasPresentation";
import { CanvasRouteCoordinator } from "./CanvasRouteCoordinator";
import { DashboardDialogs } from "./DashboardDialogs";
import { buildWorkspaceOrganizePresentation } from "./organizePresentation";
import { useOptimisticMemoCreation } from "./useOptimisticMemoCreation";
import { useMemoDocumentLoad } from "./useMemoDocumentLoad";
import { useMemoCanvasEntry } from "./useMemoCanvasEntry";
import { useMemoNodeDeletion } from "./useMemoNodeDeletion";
import { useStandaloneCanvasCreation } from "./useStandaloneCanvasCreation";
import { useAccountProfileRefresh } from "./useAccountProfileRefresh";
import { useMemoOrganize } from "./useMemoOrganize";
import type { AccountDialogState, MemoDialogState, TreeStatus, ViewTitleDraft, WorkspaceLoaderData } from "./appDashboardTypes";
import {
  AGENT_MAX_WIDTH,
  AGENT_MIN_WIDTH,
  AGENT_WIDTH_KEY,
  DEFAULT_AGENT_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_KEY,
  type WorkspaceStyle,
  usePersistedPanelWidth,
} from "./workspaceLayout";

const LAST_MEMO_KEY_PREFIX = "supernote:last-memo:";
const DEFAULT_MEMO_TITLE = "未命名备忘录";
const lastMemoStorageKey = (userId: string): string =>
  `${LAST_MEMO_KEY_PREFIX}${userId}`;
const isMemo = (node: MemoTreeNode | null): node is MemoTreeNode =>
  node?.node_type === "memo" && node.memo !== null;

export function AppDashboard() {
  const { accessToken, profile: initialProfile } =
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
  const hydrateRecentNodes = useRecentNodesStore((state) => state.hydrate);
  const rememberRecentNode = useRecentNodesStore((state) => state.remember);
  const openCommandPalette = useCommandPaletteStore((state) => state.openPalette);
  const rememberCanvasEntry = useCanvasChromeStore((state) => state.rememberEntry);
  const toggleAssistant = useWorkspaceChromeStore((state) => state.toggleAssistant);
  const toggleLibrary = useWorkspaceChromeStore((state) => state.toggleLibrary);
  const memoTree = useMemoTreeStore((state) => state.nodes);
  const fetchTree = useMemoTreeStore((state) => state.fetchTree);
  const createFolder = useMemoTreeStore((state) => state.createFolder);
  const createMemo = useMemoTreeStore((state) => state.createMemo);
  const moveNode = useMemoTreeStore((state) => state.moveNode);
  const renameNode = useMemoTreeStore((state) => state.renameNode);
  const softDeleteNode = useMemoTreeStore((state) => state.softDeleteNode);
  const restoreNode = useMemoTreeStore((state) => state.restoreNode);
  const getMemoClientKey = useMemoTreeStore(
    (state) => state.getMemoClientKey,
  );
  const resolveMemoId = useMemoTreeStore((state) => state.resolveMemoId);
  const updateMemoTitleLocal = useMemoTreeStore(
    (state) => state.updateMemoTitleLocal,
  );
  const mergeMemoDetail = useMemoTreeStore((state) => state.mergeMemoDetail);
  const mergeServerNode = useMemoTreeStore((state) => state.mergeServerNode);
  const waitForMemoId = useMemoTreeStore((state) => state.waitForMemoId);
  const resetMemoTree = useMemoTreeStore((state) => state.reset);
  const memoDocuments = useMemoDocumentStore((state) => state.documents);
  const memoDocumentStatuses = useMemoDocumentStore((state) => state.statuses);
  const updateMemoContentLocal = useMemoDocumentStore((state) => state.updateContentLocal);
  const saveMemoDocument = useMemoDocumentStore((state) => state.saveMemoDraft);
  const removeMemoDocuments = useMemoDocumentStore((state) => state.removeMemos);
  const [profile, setProfile] = useState(initialProfile);
  const [activeView, setActiveView] = useState<SidebarView>("note");
  const [documentView, setDocumentView] = useState<DocumentView>("editing");
  const [editingMode, setEditingMode] = useState<EditingMode>("live");
  const [viewTitleDraft, setViewTitleDraft] = useState<ViewTitleDraft>(null);
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
  const selectedMemo = routeMemoId === null
    ? null
    : findNode(memoTree, resolveMemoId(routeMemoId));
  const selectedMemoId = isMemo(selectedMemo) ? selectedMemo.id : null;
  const selectedMemoDocument = selectedMemoId === null
    ? null
    : memoDocuments[selectedMemoId] ?? null;
  const selectedMemoDocumentStatus = selectedMemoId === null
    ? "idle"
    : memoDocumentStatuses[selectedMemoId] ?? "idle";
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
  const memoCanvasEntry = useMemoCanvasEntry({
    accessToken,
    mergeServerNode,
    navigate,
    prepare: async () => {
      await notesWorkspaceRef.current?.flushCurrentDraft();
    },
    toast,
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
    const controller = new AbortController();
    initialTreeHandledRef.current = null;
    resetMemoTree();
    setTreeStatus("loading");

    void fetchTree(accessToken, controller.signal)
      .then(() => setTreeStatus("ready"))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setTreeStatus("error");
        toast({
          description: error instanceof Error ? error.message : undefined,
          title: "备忘录列表加载失败",
          variant: "error",
        });
      });

    return () => controller.abort();
  }, [accessToken, fetchTree, initialProfile.id, resetMemoTree, toast]);

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
      return;
    }

    const lastMemoId = window.localStorage.getItem(storageKey);

    if (lastMemoId !== null && isMemo(findNode(memoTree, lastMemoId))) {
      navigate(`/app/notes/${encodeURIComponent(lastMemoId)}`, {
        replace: true,
      });
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
        })
        .finally(() => setTreeMutating(false));
    }
  }, [
    accessToken,
    createMemo,
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
  function handleSelectMemo(memoId: string) {
    clearCanvasReturn();
    setFocusMemoClientKey(null);
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
    navigate(`/app/notes/${encodeURIComponent(memoId)}`);
  }

  function handleOpenAccountDialog(section: AccountSection) {
    setAccountProfileRefreshing(true);
    setAccountDialog(section);
  }
  async function handleSignOut() {
    resetMemoTree();
    await signOutAuthenticatedUser();
    navigate("/", { replace: true });
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
      toast({ title: "名称已更新", variant: "success" });
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
      toast({ title: "文件夹已创建", variant: "success" });
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
  const toolbarTitle = activeView === "note"
    ? isMemo(selectedMemo)
      ? `${getMemoFolderPath(memoTree, selectedMemo.id)} / ${currentMemoTitle}`
      : currentMemoTitle
    : {
        "design-system": "Design System",
        subscription: "订阅",
        trash: "回收站",
      }[activeView];
  const organizePresentation: WorkspaceOrganizePresentation | null =
    buildWorkspaceOrganizePresentation({
      resolveMemoPath: (memoId) => getMemoFolderPath(memoTree, memoId),
      run: memoOrganize.presentationRun,
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
  const closeActiveAssistant = canvasNodeId === null
    ? closeAssistant
    : () => useCanvasWorkspaceStore.getState()
      .setCanvasChrome({ assistantOpen: false });
  const library = (
    <>
        <AppSidebar
          activeView={activeView}
          memoTree={memoTree}
          mutating={treeMutating || canvasCreation.creatingCanvas}
          organizeTarget={organizePresentation === null ? null : {
            folderId: organizePresentation.targetFolderId,
            memoId: organizePresentation.memoId,
            runId: organizePresentation.runId,
          }}
          onCreateMemo={handleCreateMemo}
          onCreateCanvas={canvasCreation.createCanvas}
          onClose={closeActiveLibrary}
          onMoveNode={handleMoveNode}
          onOpenDesignSystem={() => setActiveView("design-system")}
          onOpenProfile={() => handleOpenAccountDialog("account")}
          onOpenSearch={openCommandPalette}
          onOpenSettings={() => handleOpenAccountDialog("appearance")}
          onOpenSubscription={() => setActiveView("subscription")}
          onRenameNode={handleRenameNode}
          onSoftDeleteNode={async (nodeId) => {
            await memoDeletion.deleteNode(nodeId);
          }}
          onRequestCreateFolder={(parentId) => setMemoDialog({ parentId })}
          onSelectMemo={handleSelectMemo}
          onSelectView={setActiveView}
          onSignOut={handleSignOut}
          profile={profile}
          reveal={revealTarget}
          revealContent={revealInitialTreeContent}
          selectedMemoId={routeMemoId === null
            ? null
            : resolveMemoId(routeMemoId)}
          skeletonVisible={treeSkeletonVisible}
          treeStatus={renderedTreeStatus}
        />
        <PanelResizeHandle
          ariaLabel="调整文件侧边栏宽度"
          direction={1}
          max={SIDEBAR_MAX_WIDTH}
          min={SIDEBAR_MIN_WIDTH}
          onReset={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
          onResize={setSidebarWidth}
          side="right"
          size={sidebarWidth}
        />
    </>
  );

  const paper = (
    <>
        <AppMainToolbar
          canvasReturnTitle={canvasReturn?.title}
          currentMemo={activeView === "note" ? selectedMemoDocument : null}
          currentMemoTitle={currentMemoTitle}
          documentView={documentView}
          editingMode={editingMode}
          enteringCanvas={memoCanvasEntry.enteringCanvas}
          onDocumentViewChange={setDocumentView}
          onEditingModeChange={setEditingMode}
          onEnterCanvas={() => void memoCanvasEntry.enterCanvas(selectedMemoId)}
          onReturnCanvas={canvasReturn === null ? undefined : () => {
            void (async () => {
              await notesWorkspaceRef.current?.flushCurrentDraft();
              navigate(`/app/notes/${encodeURIComponent(canvasReturn.canvasId)}`);
            })();
          }}
          onOrganize={memoOrganize.organize}
          organizing={memoOrganize.organizing}
          toolbarTitle={toolbarTitle}
        />

        <div className="app-main-content">
          <div className="h-full" hidden={paperView !== "note"}>
            <NotesWorkspace
              autoFocus={routeMemoId !== null &&
                focusMemoClientKey === getMemoClientKey(resolveMemoId(routeMemoId))}
              documentView={documentView}
              editingMode={editingMode}
              emptyTree={treeStatus === "ready" && memoTree.length === 0}
              key={routeMemoId === null
                ? "empty"
                : getMemoClientKey(resolveMemoId(routeMemoId))}
              memoClientKey={routeMemoId === null
                ? "empty"
                : getMemoClientKey(resolveMemoId(routeMemoId))}
              hasTitleConflict={(title) =>
                memoNodeTitleTaken(memoTree, selectedMemo, title)}
              memo={selectedMemoDocument}
              onContentChange={(content) => {
                if (routeMemoId !== null) {
                  updateMemoContentLocal(resolveMemoId(routeMemoId), content);
                }
              }}
              onSave={handleSaveMemo}
              onTitleChange={(nextTitle) => {
                if (!isMemo(selectedMemo)) {
                  return;
                }
                updateMemoTitleLocal(selectedMemo.id, nextTitle);
                setViewTitleDraft((currentDraft) =>
                  currentDraft?.memoId === selectedMemo.id &&
                    currentDraft.title === nextTitle
                    ? currentDraft
                    : { memoId: selectedMemo.id, title: nextTitle });
              }}
              revealContent={revealInitialTreeContent}
              ref={notesWorkspaceRef}
              skeletonVisible={documentSkeletonVisible}
              treeStatus={treeStatus === "error" || selectedMemoDocumentStatus === "error"
                ? "error"
                : treeStatus === "loading" || documentLoading
                  ? "loading"
                  : "ready"}
            />
          </div>
          <WorkspaceAuxViews
            accessToken={accessToken}
            activeView={paperView}
            onRestoreTrashNode={handleRestoreTrashNode}
            trashRevision={trashRevision}
          />
        </div>
    </>
  );

  const assistant = (
    <>
        <PanelResizeHandle
          ariaLabel="调整聊天区域宽度"
          direction={-1}
          max={AGENT_MAX_WIDTH}
          min={AGENT_MIN_WIDTH}
          onReset={() => setAgentWidth(DEFAULT_AGENT_WIDTH)}
          onResize={setAgentWidth}
          side="left"
          size={agentWidth}
        />
        <AgentPanel
          accessToken={accessToken}
          currentMemo={isMemo(selectedMemo) ? selectedMemo : null}
          memoTree={memoTree}
          onApplyOrganize={memoOrganize.apply}
          onClose={closeActiveAssistant}
          onPrepareMutation={async () => {
            await notesWorkspaceRef.current?.flushCurrentDraft();
          }}
          onRejectOrganize={memoOrganize.reject}
          onSelectedThreadChange={memoOrganize.setThreadId}
          organizeBusy={memoOrganize.organizing}
          organizeRun={memoOrganize.run}
          userId={profile.id}
        />
    </>
  );

  const routeKindPending = routeMemoId !== null && treeStatus === "loading";
  return (
    <>
      {routeKindPending ? (
        <main
          aria-label="正在打开内容"
          className="canvas-workspace"
        >
          <div className="canvas-workspace-loading" role="status">
            正在打开内容…
          </div>
        </main>
      ) : canvasNodeId === null ? (
        <PaperWorkspaceShell
          assistant={assistant}
          assistantOpen={assistantOpen}
          library={library}
          libraryOpen={libraryOpen}
          onCloseAssistant={closeAssistant}
          onCloseLibrary={closeLibrary}
          onToggleAssistant={toggleAssistant}
          onToggleLibrary={toggleLibrary}
          organizing={memoOrganize.organizing}
          paper={paper}
          paperIdentity={activeView === "note" && routeMemoId !== null
            ? getMemoClientKey(resolveMemoId(routeMemoId))
            : activeView}
          presentation={organizePresentation}
          style={workspaceStyle}
        />
      ) : (
        <CanvasRouteCoordinator
          accessToken={accessToken}
          assistant={assistant}
          canvasId={canvasNodeId}
          key={canvasNodeId}
          library={library}
          onRename={handleRenameNode}
          style={workspaceStyle}
          title={selectedMemo?.title ?? "知识画布"}
          userId={profile.id}
        />
      )}

      <DashboardDialogs
        accountDialog={accountDialog}
        accountProfileRefreshing={accountProfileRefreshing}
        memoDialog={memoDialog}
        memoDialogDescription={memoDialogDescription}
        onAccountClose={() => {
          setAccountProfileRefreshing(false);
          setAccountDialog(null);
        }}
        onAccountSectionChange={setAccountDialog}
        onCreateFolder={handleCreateFolder}
        onMemoDialogClose={() => setMemoDialog(null)}
        onProfileChange={setProfile}
        profile={profile}
      />
      <WorkspaceCommandPalette
        accessToken={accessToken}
        onOpenCanvas={(memoId) => void memoCanvasEntry.enterCanvas(memoId)}
        onOpenNode={(nodeId) => {
          const target = findNode(useMemoTreeStore.getState().nodes, nodeId);
          // 文件夹不是路由对象: 打开文件库并在树里定位它
          if (target?.node_type === "folder") {
            openActiveLibrary();
            setRevealTarget((current) => ({
              nodeId,
              seq: (current?.seq ?? 0) + 1,
            }));
            return;
          }
          handleSelectMemo(nodeId);
        }}
      />
    </>
  );
}
