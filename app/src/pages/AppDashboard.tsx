/**
 * [INPUT]: 依赖 React Router Profile/token、memo/WorkspaceChrome Store、AI Run、Skeleton、PaperWorkspaceShell、NotesWorkspace、AccountDialog 与可调宽浮层
 * [OUTPUT]: 对外提供 Paper First 舞台、乐观备忘录路由、草稿 flush 后删除/AI 对话/整理分流、归档定位与账户/视图编排
 * [POS]: app/src/pages 的 /app 编排层；编辑器、Run、Store、浮动工具、路由与 Trash 的跨域生命周期只在此建立一次等待边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  useLoaderData,
  useMatch,
  useNavigate,
} from "react-router-dom";

import type { MemoTreeNode } from "../shared/api/memo";
import { getProfile, type Profile } from "../shared/api/profile";
import { useDelayedSkeleton, useToast } from "../shared/design-system/components";
import { findNode } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { useWorkspaceChromeStore } from "../shared/store/workspaceChromeStore";
import { signOutAuthenticatedUser } from "../shared/supabase/auth";
import {
  AccountDialog,
  type AccountSection,
} from "../widgets/AccountDialog";
import { AgentPanel } from "../widgets/AgentPanel";
import { AppSidebar, type SidebarView } from "../widgets/AppSidebar";
import { AppMainToolbar } from "../widgets/AppMainToolbar";
import { MemoNodeDialog } from "../widgets/MemoNodeDialog";
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
import {
  PaperWorkspaceShell,
} from "../widgets/PaperWorkspaceShell";
import type { WorkspaceOrganizePresentation } from "../widgets/archiveCordPolicy";
import { SubscriptionWorkspace } from "../widgets/SubscriptionWorkspace";
import { TrashWorkspace } from "../widgets/TrashWorkspace";
import {
  getMemoDeletionImpact,
  getPostDeletionDestination,
} from "./memoDeletion";
import { buildWorkspaceOrganizePresentation } from "./organizePresentation";
import { useOptimisticMemoCreation } from "./useOptimisticMemoCreation";
import { useMemoOrganize } from "./useMemoOrganize";
import type {
  AccountDialogState,
  MemoDialogState,
  TreeStatus,
  ViewTitleDraft,
  WorkspaceLoaderData,
} from "./appDashboardTypes";
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

const DesignSystemWorkspace = import.meta.env.DEV
  ? lazy(() =>
      import("../widgets/DesignSystemWorkspace").then((module) => ({
        default: module.DesignSystemWorkspace,
      })),
    )
  : null;

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
  const closeLibrary = useWorkspaceChromeStore((state) => state.closeLibrary);
  const hydrateWorkspaceChrome = useWorkspaceChromeStore((state) => state.hydrate);
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
  const updateMemoContentLocal = useMemoTreeStore(
    (state) => state.updateMemoContentLocal,
  );
  const updateMemoTitleLocal = useMemoTreeStore(
    (state) => state.updateMemoTitleLocal,
  );
  const saveMemoDraft = useMemoTreeStore((state) => state.saveMemoDraft);
  const resetMemoTree = useMemoTreeStore((state) => state.reset);
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
  const notesWorkspaceRef = useRef<NotesWorkspaceHandle>(null);
  const initialTreeHandledRef = useRef<string | null>(null);
  const treePlaceholderWasActiveRef = useRef(false);
  const [revealInitialTreeContent, setRevealInitialTreeContent] = useState(false);
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
  const workspaceStyle: WorkspaceStyle = {
    "--workspace-agent-track": `${agentWidth}px`,
    "--workspace-sidebar-track": `${sidebarWidth}px`,
  };
  const treeSkeletonVisible = useDelayedSkeleton(treeStatus === "loading");
  const treePlaceholderActive = treeStatus === "loading" || treeSkeletonVisible;
  const renderedTreeStatus: TreeStatus = treePlaceholderActive
    ? "loading"
    : treeStatus;
  const memoOrganize = useMemoOrganize({
    accessToken,
    active: activeView === "note",
    currentMemo: isMemo(selectedMemo) ? selectedMemo : null,
    onCommittedTitle: () => setViewTitleDraft(null),
    userId: profile.id,
    workspaceRef: notesWorkspaceRef,
  });

  useEffect(() => {
    hydrateWorkspaceChrome(profile.id);
  }, [hydrateWorkspaceChrome, profile.id]);

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

      if (isMemo(findNode(memoTree, resolvedRouteMemoId))) {
        window.localStorage.setItem(storageKey, resolvedRouteMemoId);
      } else {
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

  const accountDialogOpen = accountDialog !== null;

  useEffect(() => {
    if (!accountDialogOpen) {
      return;
    }

    let cancelled = false;
    void getProfile(accessToken)
      .then((refreshedProfile) => {
        if (!cancelled) {
          setProfile(refreshedProfile);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast({
            description: error instanceof Error ? error.message : undefined,
            title: "账户资料刷新失败",
            variant: "error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAccountProfileRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, accountDialogOpen, toast]);

  function handleSelectMemo(memoId: string) {
    setFocusMemoClientKey(null);
    setActiveView("note");
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
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "重命名保存失败",
        variant: "error",
      });
    }
  }

  async function handleSoftDeleteNode(nodeId: string): Promise<boolean> {
    if (treeMutating) {
      return false;
    }

    const treeBeforeDelete = useMemoTreeStore.getState().nodes;
    const impact = getMemoDeletionImpact(
      treeBeforeDelete,
      nodeId,
      routeMemoId,
    );

    if (impact === null) {
      toast({ title: "要删除的项目不存在", variant: "error" });
      return false;
    }

    let autosavePaused = false;
    setTreeMutating(true);

    try {
      if (impact.affectsCurrentMemo) {
        const autosaveBoundary = notesWorkspaceRef.current;

        if (autosaveBoundary === null) {
          throw new Error("编辑会话尚未准备好，请稍后重试。");
        }

        await autosaveBoundary.prepareForDelete();
        autosavePaused = true;
      }

      await softDeleteNode(accessToken, nodeId);
      const storageKey = lastMemoStorageKey(profile.id);
      const storedMemoId = window.localStorage.getItem(storageKey);

      if (
        storedMemoId !== null &&
        impact.affectedMemoIds.has(storedMemoId)
      ) {
        window.localStorage.removeItem(storageKey);
      }

      setTrashRevision((revision) => revision + 1);

      if (impact.affectsCurrentMemo) {
        const destination = getPostDeletionDestination(
          useMemoTreeStore.getState().nodes,
        );
        setViewTitleDraft(null);
        setActiveView("note");

        if (destination.memoId === null) {
          navigate(destination.path, { replace: true });
        } else {
          window.localStorage.setItem(storageKey, destination.memoId);
          navigate(destination.path, {
            replace: true,
          });
        }
      }

      toast({ title: "已移至回收站", variant: "success" });
      return true;
    } catch (error) {
      if (autosavePaused) {
        notesWorkspaceRef.current?.resumeAfterDeleteFailure();
      }

      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "移至回收站失败",
        variant: "error",
      });
      return false;
    } finally {
      setTreeMutating(false);
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

    await saveMemoDraft(
      accessToken,
      memoId,
      {
        ...(contentChanged ? { content_mdx: content } : {}),
        ...(titleChanged ? { title } : {}),
      },
      options,
    );
    const current = findNode(
      useMemoTreeStore.getState().nodes,
      resolveMemoId(memoId),
    );

    if (!isMemo(current)) {
      throw new Error("保存后的备忘录不存在。");
    }

    return current;
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

  const library = (
    <>
        <AppSidebar
          activeView={activeView}
          memoTree={memoTree}
          mutating={treeMutating}
          organizeTarget={organizePresentation === null ? null : {
            folderId: organizePresentation.targetFolderId,
            memoId: organizePresentation.memoId,
            runId: organizePresentation.runId,
          }}
          onCreateMemo={handleCreateMemo}
          onClose={closeLibrary}
          onMoveNode={handleMoveNode}
          onOpenDesignSystem={() => setActiveView("design-system")}
          onOpenProfile={() => handleOpenAccountDialog("account")}
          onOpenSettings={() => handleOpenAccountDialog("appearance")}
          onOpenSubscription={() => setActiveView("subscription")}
          onRenameNode={handleRenameNode}
          onSoftDeleteNode={async (nodeId) => {
            await handleSoftDeleteNode(nodeId);
          }}
          onRequestCreateFolder={(parentId) => setMemoDialog({ parentId })}
          onSelectMemo={handleSelectMemo}
          onSelectView={setActiveView}
          onSignOut={handleSignOut}
          profile={profile}
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
          currentMemo={activeView === "note" && isMemo(selectedMemo) ? selectedMemo : null}
          currentMemoTitle={currentMemoTitle}
          documentView={documentView}
          editingMode={editingMode}
          onDocumentViewChange={setDocumentView}
          onEditingModeChange={setEditingMode}
          onOrganize={memoOrganize.organize}
          organizing={memoOrganize.organizing}
          toolbarTitle={toolbarTitle}
        />

        <div className="app-main-content">
          <div className="h-full" hidden={activeView !== "note"}>
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
              memo={isMemo(selectedMemo) ? selectedMemo : null}
              onContentChange={(content) => {
                if (routeMemoId !== null) {
                  updateMemoContentLocal(routeMemoId, content);
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
              skeletonVisible={treeSkeletonVisible}
              treeStatus={renderedTreeStatus}
            />
          </div>
          {activeView === "trash" ? (
            <TrashWorkspace
              accessToken={accessToken}
              onRestore={handleRestoreTrashNode}
              refreshKey={trashRevision}
            />
          ) : null}
          {activeView === "subscription" ? <SubscriptionWorkspace /> : null}
          {activeView === "design-system" && DesignSystemWorkspace ? (
            <Suspense fallback={<div className="h-full bg-background" />}>
              <DesignSystemWorkspace />
            </Suspense>
          ) : null}
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
          onClose={closeAssistant}
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

  return (
    <>
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

      {accountDialog ? (
        <AccountDialog
          refreshing={accountProfileRefreshing}
          onProfileChange={setProfile}
          onOpenChange={(open) => {
            if (!open) {
              setAccountProfileRefreshing(false);
              setAccountDialog(null);
            }
          }}
          onSectionChange={setAccountDialog}
          open
          profile={profile}
          section={accountDialog}
        />
      ) : null}

      {memoDialog ? (
        <MemoNodeDialog
          description={memoDialogDescription}
          key={`folder:${memoDialog.parentId ?? "root"}`}
          onOpenChange={(open) => {
            if (!open) {
              setMemoDialog(null);
            }
          }}
          onSubmit={handleCreateFolder}
          open
        />
      ) : null}
    </>
  );
}
