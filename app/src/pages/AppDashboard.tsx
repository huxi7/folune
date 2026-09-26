/**
 * [INPUT]: 依赖 useAppDashboardController 的状态/命令投影、Paper/Canvas 内容壳、持久文件库与统一 Dialog
 * [OUTPUT]: 对外提供 /app 的稳定空间装配，文件树消费即时选择、正文消费已提交路由，左右工具跨路由保留实例，拖拽边界独立于内容裁切插槽，Paper 与 Canvas 各自拥有内容生命周期
 * [POS]: pages 的 Workspace 视觉组合根；业务/路由/flush 编排归 controller，动画不能通过重挂载这个根来驱动
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lazy, Suspense } from "react";
import { memoNodeTitleTaken } from "../shared/store/memoTitleRules";
import { findNode } from "../shared/store/memoTree";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { AppMainToolbar } from "../widgets/AppMainToolbar";
import { AppSidebar } from "../widgets/AppSidebar";
import { ArchiveCordOverlay } from "../widgets/ArchiveCord";
import { CanvasStageLoading } from "../widgets/CanvasStageLoading";
import {
  NotesWorkspace
} from "../widgets/NotesWorkspace";
import { PanelResizeHandle } from "../widgets/PanelResizeHandle";
import { PaperWorkspaceShell } from "../widgets/PaperWorkspaceShell";
import { WorkspaceAuxViews } from "../widgets/WorkspaceAuxViews";
import { WorkspaceCommandPalette } from "../widgets/WorkspaceCommandPalette";
import { WorkspacePanelLayer } from "../widgets/WorkspacePanelLayer";
import { peekCanvasEntryBootstrap } from "./canvasEntryBootstrap";
import { CanvasRouteCoordinator } from "./CanvasRouteCoordinator";
import { DashboardDialogs } from "./DashboardDialogs";
import { isMemo, loadAgentPanel, useAppDashboardController } from "./useAppDashboardController";
import {
  AGENT_MAX_WIDTH,
  AGENT_MIN_WIDTH,
  DEFAULT_AGENT_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH
} from "./workspaceLayout";
const AgentPanel = lazy(() => loadAgentPanel().then((module) => ({
  default: module.AgentPanel,
})));
export function AppDashboard() {
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
  } = useAppDashboardController();
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
        onOpenProfile={() => handleOpenAccountDialog("account")}
        onOpenSearch={openCommandPalette}
        onOpenSettings={() => handleOpenAccountDialog("appearance")}
        onOpenSubscription={() => handleSelectAuxView("subscription")}
        onRenameNode={handleRenameNode}
        onSoftDeleteNode={async (nodeId) => {
          await memoDeletion.deleteNode(nodeId);
        }}
        onRequestCreateFolder={(parentId) => setMemoDialog({ parentId })}
        onSelectMemo={handleSelectMemo}
        onSelectView={handleSelectAuxView}
        onSignOut={handleSignOut}
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
        fallback={<div className="app-agent-loading" role="status">正在准备 AI</div>}
      >
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
      </Suspense>
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
          <CanvasStageLoading label="正在打开内容" visible />
        </main>
      ) : canvasNodeId === null ? (
        <PaperWorkspaceShell
          assistantOpen={assistantOpen}
          compactViewport={paperViewport.compact}
          libraryOpen={libraryOpen}
          onCloseAssistant={closeAssistant}
          onCloseLibrary={closeLibrary}
          onToggleAssistant={toggleAssistant}
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
      <WorkspacePanelLayer
        open={activeAssistantOpen}
        side="assistant"
        style={workspaceStyle}
        resizeHandle={
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
        }
      >
        {assistant}
      </WorkspacePanelLayer>
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
