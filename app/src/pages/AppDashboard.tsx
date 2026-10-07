/**
 * [INPUT]: 依赖共享AgentConversationSkeleton加载构图、统一SignOutConfirmationDialog、双语 locale、useAppDashboardController、Paper/Canvas 内容壳、三态助手宿主、持久文件库与统一 Dialog、独立 SubscriptionPage，积分购买弹窗，以及菜单打开时刷新的用户级 BillingProvider 快照
 * [OUTPUT]: 向现有助手传递当前画布和发送前同步门禁； 对外提供菜单/设置共用的退出确认、/app稳定空间装配与/app/subscription独立页，文件树消费即时选择、正文消费已提交路由；订阅打开时隐藏并保留工作区/左右工具实例，积分弹窗按来路保留工作区或订阅背景，键盘边界阻止常驻工作区快捷键
 * [POS]: pages 的 Workspace 视觉组合根；按 profile.id 持有唯一计费快照，菜单/设置/订阅同源，路由返回由受限来路解析；业务/flush 归 controller，动画不重挂载根
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLocale } from "../shared/locale";
import { lazy, Suspense, useState } from "react";
import { useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { BillingProvider, useBilling } from "../shared/api/useBilling";
import type { WorkspaceLoaderData } from "./appDashboardTypes";
import { CREDITS_PATH, SUBSCRIPTION_PATH, isCreditsPath, isSubscriptionPath, subscriptionReturnPath } from "./subscriptionNavigation";
import { useSubscriptionKeyboardBoundary } from "./useSubscriptionKeyboardBoundary";
import { memoNodeTitleTaken } from "../shared/store/memoTitleRules";
import { findNode } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { AppMainToolbar } from "../widgets/AppMainToolbar";
import { AppSidebar } from "../widgets/AppSidebar";
import { ArchiveCordOverlay } from "../widgets/ArchiveCord";
import { AgentConversationSkeleton } from "../widgets/AgentPanel/AgentConversationSkeleton";
import { CanvasStageLoading } from "../widgets/CanvasStageLoading";
import {
  NotesWorkspace
} from "../widgets/NotesWorkspace";
import { PanelResizeHandle } from "../widgets/PanelResizeHandle";
import { PaperWorkspaceShell } from "../widgets/PaperWorkspaceShell";
import { WorkspaceAuxViews } from "../widgets/WorkspaceAuxViews";
import { WorkspaceCommandPalette } from "../widgets/WorkspaceCommandPalette";
import { WorkspaceAssistantLayer } from "../widgets/WorkspaceAssistantLayer";
import type { AgentPresence } from "../widgets/AgentPanel/activityState";
import { WorkspacePanelLayer } from "../widgets/WorkspacePanelLayer";
import { peekCanvasEntryBootstrap } from "./canvasEntryBootstrap";
import { CanvasRouteCoordinator } from "./CanvasRouteCoordinator";
import { SignOutConfirmationDialog } from "../widgets/SignOutConfirmationDialog";
import { DashboardDialogs } from "./DashboardDialogs";
import { isMemo, loadAgentPanel, useAppDashboardController } from "./useAppDashboardController";
import {
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH
} from "./workspaceLayout";
const AgentPanel = lazy(() => loadAgentPanel().then((module) => ({
  default: module.AgentPanel,
})));
const SubscriptionPage = lazy(() => import("./SubscriptionPage").then(module => ({ default: module.SubscriptionPage })));
const CreditsPage = lazy(() => import("./CreditsPage").then(module => ({ default: module.CreditsPage })));
export function AppDashboard() {
  const { profile } = useLoaderData() as WorkspaceLoaderData;
  return <BillingProvider key={profile.id}><DashboardContent /></BillingProvider>;
}
function DashboardContent() {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const subscriptionOpen = isSubscriptionPath(location.pathname);
  const creditsOpen = isCreditsPath(location.pathname);
  const workspaceBehindCredits = creditsOpen && location.state?.creditsFrom === "workspace";
  const workspaceHidden = subscriptionOpen && !workspaceBehindCredits;
  useSubscriptionKeyboardBoundary(subscriptionOpen);
  const billing = useBilling();
  const openSubscription = () => {
    void billing.refresh();
    void navigate(SUBSCRIPTION_PATH, { state: { workspacePath: location.pathname } });
  };
  const {
    activeView,
    sidebarSelectedMemoId,
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
    openActiveAssistant,
    assistantSize,
    setAssistantSize,
    assistantFrame,
    setAssistantFrame,
    toggleLibrary,
    workspaceStyle,
    handleCanvasSessionReady,
    prepareCanvasChat,
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
  } = useAppDashboardController();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const requestSignOut = async () => { setSignOutOpen(true); };
  const [assistantPresence, setAssistantPresence] = useState<AgentPresence>("idle");
  const library = (
    <>
      <AppSidebar
        activeView={activeView}
        memoTree={memoTree}
        mutating={treeMutating || canvasCreation.creatingCanvas}
        archiveTarget={organizePresentation === null ? null : {
          memoId: organizePresentation.memoId,
          origin: organizePresentation.origin,
          runId: organizePresentation.runId,
        }}
        onCreateMemo={handleCreateMemo}
        onCreateCanvas={canvasCreation.createCanvas}
        onClose={closeActiveLibrary}
        onMoveNode={handleMoveNode}
        onOpenDesignSystem={() => handleSelectAuxView("design-system")}
        onPrefetchMemo={(memoId) => {
          void preloadMemo(accessToken, memoId).catch(() => undefined);
        }}
        onOpenUserMenu={() => { void billing.refresh(); }}
        onOpenProfile={() => handleOpenAccountDialog("profile")}
        onOpenSearch={openCommandPalette}
        onOpenSettings={() => handleOpenAccountDialog("appearance")}
        onOpenSubscription={openSubscription}
        onOpenCredits={() => void navigate(CREDITS_PATH, { state: { workspacePath: location.pathname, creditsFrom: "workspace" } })}
        onOpenUsage={() => { void billing.refresh(); handleOpenAccountDialog("usage"); }}
        onOpenBilling={() => { void billing.refresh(); handleOpenAccountDialog("billing"); }}
        planName={billing.catalog?.plans.find(plan => plan.id === billing.overview?.subscription.plan_id)?.name ?? "—"}
        remainingCredits={billing.overview?.credits.balance ?? null}
        onRenameNode={handleRenameNode}
        onSoftDeleteNode={async (nodeId) => {
          await memoDeletion.deleteNode(nodeId);
        }}
        onRequestCreateFolder={(parentId) => setMemoDialog({ parentId })}
        onSelectMemo={handleSelectMemo}
        onSelectView={handleSelectAuxView}
        onSignOut={requestSignOut}
        profile={profile}
        reveal={revealTarget}
        revealContent={revealInitialTreeContent}
        selectedMemoId={sidebarSelectedMemoId}
        skeletonVisible={treeSkeletonVisible}
        treeStatus={renderedTreeStatus}
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
          void memoCanvasEntry.returnCanvas(canvasReturn.canvasId, selectedMemoId);
        }}
        onOrganize={memoOrganize.organize}
        onLocateArchive={locateArchive}
        organizePresentation={organizePresentation}
        organizing={memoOrganize.organizing}
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
      <Suspense
        fallback={<AgentConversationSkeleton />}
      >
        <AgentPanel
          currentCanvas={canvasNodeId ? { id: canvasNodeId, title: selectedMemo?.title ?? "Canvas" } : null}
          onPrepareCanvas={prepareCanvasChat}
          accessToken={accessToken}
          currentMemo={isMemo(selectedMemo) ? selectedMemo : null}
          memoTree={memoTree}
          onApplyOrganize={memoOrganize.apply}
          onClose={closeActiveAssistant}
          assistantSize={assistantSize}
          onToggleSize={() => setAssistantSize(assistantSize === "compact" ? "expanded" : "compact")}
          onPresenceChange={setAssistantPresence}
          onPrepareMutation={async () => {
            await notesWorkspaceRef.current?.flushCurrentDraft();
          }}
          onRejectOrganize={memoOrganize.reject}
          onSelectedThreadChange={memoOrganize.setThreadId}
          organizeBusy={memoOrganize.organizing}
          organizeRun={memoOrganize.run}
          userId={profile.id}
        />
      </Suspense>
    </>
  );

  const routeKindPending = routeMemoId !== null && treeStatus === "loading";
  return (
    <>
      <div hidden={workspaceHidden} inert={subscriptionOpen} style={{ display: workspaceHidden ? "none" : "contents" }}>
      {routeKindPending ? (
        <main
          aria-label={t("正在打开内容", "Opening your content")}
          className="canvas-workspace"
        >
          <CanvasStageLoading label="正在打开内容" visible />
        </main>
      ) : canvasNodeId === null ? (
        <PaperWorkspaceShell
          assistantOpen={assistantOpen}
          compactViewport={paperViewport.compact}
          libraryOpen={libraryOpen}
          onCloseAssistant={closeAssistant}
          onCloseLibrary={closeLibrary}
          onToggleLibrary={toggleLibrary}
          organizing={memoOrganize.organizing}
          overlayPanels={paperViewport.overlayPanels}
          paper={paper}
          paperIdentity={activeView === "note" && routeMemoId !== null
            ? getMemoClientKey(resolveMemoId(routeMemoId))
            : activeView}
          paperTransitionIdentity={activeView === "note" ? selectedMemoId : null}
          style={workspaceStyle}
        />
      ) : (
        <CanvasRouteCoordinator
          accessToken={accessToken}
          bootstrap={peekCanvasEntryBootstrap(canvasNodeId, profile.id)}
          canvasId={canvasNodeId}
          key={canvasNodeId}
          onRename={handleRenameNode}
          onSessionReady={handleCanvasSessionReady}
          style={workspaceStyle}
          title={selectedMemo?.title ?? "知识画布"}
          userId={profile.id}
        />
      )}

      <WorkspacePanelLayer
        open={activeLibraryOpen}
        style={workspaceStyle}
        resizeHandle={
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
        }
      >
        {library}
      </WorkspacePanelLayer>
      <WorkspaceAssistantLayer
        open={activeAssistantOpen}
        size={assistantSize}
        panelWidth={agentWidth}
        presence={assistantPresence}
        onOpen={() => {
          if (assistantPresence === "complete") setAssistantPresence("idle");
          openActiveAssistant();
        }}
        frame={assistantFrame}
        onResize={(rect) => {
          setAgentWidth(rect.width);
          setAssistantFrame({ height: rect.height, right: window.innerWidth - rect.left - rect.width, bottom: window.innerHeight - rect.top - rect.height });
        }}
      >
        {assistant}
      </WorkspaceAssistantLayer>
      <ArchiveCordOverlay
        libraryOpen={canvasNodeId === null && libraryOpen}
        onLocate={locateArchive}
        overlayPanels={paperViewport.overlayPanels}
        presentation={canvasNodeId === null && activeView === "note" ? organizePresentation : null}
      />

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
        onSignOut={requestSignOut}
        onViewPlans={() => {
          setAccountProfileRefreshing(false);
          setAccountDialog(null);
          openSubscription();
        }}
        profile={profile}
      />
      <SignOutConfirmationDialog open={signOutOpen} onOpenChange={setSignOutOpen} onConfirm={handleSignOut} />
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
      </div>
      {subscriptionOpen ? (
        <Suspense fallback={<main className="fixed inset-0 bg-background" role="status" aria-busy="true" aria-label={t("正在打开订阅计划", "Opening plans")} />}>
          {!workspaceBehindCredits ? <div inert={creditsOpen} aria-hidden={creditsOpen || undefined}>
            <SubscriptionPage
              profile={profile}
              onBack={() => void navigate(subscriptionReturnPath(location.state), { replace: true })}
              onBuyCredits={() => void navigate(CREDITS_PATH, { state: { workspacePath: subscriptionReturnPath(location.state) } })}
            />
          </div> : null}
          {creditsOpen ? <CreditsPage
            onBack={() => void navigate(location.state?.creditsFrom === "workspace" ? subscriptionReturnPath(location.state) : SUBSCRIPTION_PATH, { replace: true, state: location.state })}
            onUpgrade={() => void navigate(SUBSCRIPTION_PATH, { replace: true, state: { workspacePath: subscriptionReturnPath(location.state) } })}
          /> : null}
        </Suspense>
      ) : null}
    </>
  );
}
