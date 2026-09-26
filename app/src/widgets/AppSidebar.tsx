/**
 * [INPUT]: 依赖 MemoTreeBranch/Skeleton、SidebarCreateMenu、memoLibrary 拖拽/祖先计划、memoTitleRules 的重名与可改名判据、持久化展开偏好、archiveCordPolicy 的代表解析、useTreeReorder 的结构重排与通过 Portal 锚定视口的 MotionSurface、Profile 与上层事务命令；结构键按不可变树引用复用
 * [OUTPUT]: 对外提供文件库 Header、搜索入口、复用上一布局原位插入笔记与即时选中、仅在定位目标本身变化（换目标/被搬走/树就绪）且离屏时才平滑定位、可聚焦真实文件树、正文意图预热、树内重排/跨视图笔记拖拽、底部导航、节点回收站命令，以及树内唯一的归档可见代表标记
 * [POS]: app/src/widgets 的按需文件库内容层；它是 expandedFolders 的所有者，因此也是「当前谁代表那篇被整理的笔记」唯一有资格回答的一层；结构键只在树形关系变化时递归计算，标题/摘要更新不触发整树 FLIP 判据；事务与路由切换由 Dashboard 编排
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  FileTextIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PaletteIcon,
  PencilSimpleIcon,
  SidebarSimpleIcon,
  TrashIcon,
} from "../shared/design-system/icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import type { MemoTreeNode } from "../shared/api/memo";
import type { Profile } from "../shared/api/profile";
import {
  BrandMark,
  Button,
  SidebarButton,
  UserMenu,
} from "../shared/design-system/components";
import { memoNodeTitleTaken } from "../shared/store/memoTitleRules";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";
import { useTreeReorder } from "./useTreeReorder";
import { AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { MotionSurface } from "../shared/design-system/components/PresenceSurface";
import {
  resolveArchiveRepresentative,
  type ArchiveRepresentative,
} from "./archiveCordPolicy";

import {
  createMemoMovePlan,
  getAncestorFolderIds,
  getFolderIds,
  findMemoNode,
  serializeMemoCanvasDrag,
  treeStructureKey,
  FOLUNE_MEMO_DRAG_MIME,
  type MemoDropTarget,
  type MemoMovePlan,
} from "./memoLibrary";
import { MemoTreeBranch } from "./MemoTreeBranch";
import { MemoTreeSkeleton } from "./MemoTreeSkeleton";
import { SidebarCreateMenu } from "./SidebarCreateMenu";
import { useMemoTreeExpansion } from "./useMemoTreeExpansion";

export type SidebarView =
  | "note"
  | "trash"
  | "subscription"
  | "design-system";

type AppSidebarProps = {
  activeView: SidebarView;
  /**
   * 归档展示的 canonical 事实：哪一篇 memo、由哪次 run 证明、是刚发生还是本来就为真。
   * 目录 ID 不在其中 —— 屏幕上由谁代表它，是这一层按 expandedFolders 推导出来的结果，
   * 不是上层能替它决定的输入。origin 只用来决定要不要「带用户过去」：fresh 展开祖先并
   * 滚动定位，restored 一律尊重用户持久化的展开状态。
   */
  archiveTarget: {
    memoId: string;
    origin: "fresh" | "restored";
    runId: string;
  } | null;
  memoTree: MemoTreeNode[];
  mutating: boolean;
  onCreateMemo: (parentId: string | null) => void;
  onCreateCanvas: (parentId: string | null) => void;
  onClose: () => void;
  onMoveNode: (nodeId: string, input: MemoMovePlan) => Promise<boolean>;
  onPrefetchMemo: (memoId: string) => void;
  onOpenDesignSystem: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenSubscription: () => void;
  onRenameNode: (nodeId: string, title: string) => Promise<void>;
  onSoftDeleteNode: (nodeId: string) => Promise<void>;
  onRequestCreateFolder: (parentId: string | null) => void;
  onSelectMemo: (memoId: string) => void;
  onSelectView: (view: SidebarView) => void;
  onSignOut: () => Promise<void>;
  profile: Profile;
  /** Command Palette 打开文件夹时在树里定位它；seq 让同一目标可以反复定位 */
  reveal: { nodeId: string; seq: number } | null;
  revealContent: boolean;
  selectedMemoId: string | null;
  skeletonVisible: boolean;
  treeStatus: "error" | "loading" | "ready";
};

type ContextMenuState = {
  node: MemoTreeNode | null;
  parentId: string | null;
  x: number;
  y: number;
};

type ContextMenuStyle = CSSProperties & {
  "--memo-context-x": string;
  "--memo-context-y": string;
};

const CONTEXT_MENU_WIDTH = 196;
const CONTEXT_MENU_HEIGHT = 172;
const CONTEXT_MENU_VIEWPORT_GAP = 8;
const ROOT_END_TARGET: MemoDropTarget = {
  nodeId: null,
  parentId: null,
  placement: "root-end",
};

const dropTargetsMatch = (
  left: MemoDropTarget | null,
  right: MemoDropTarget,
): boolean =>
  left?.nodeId === right.nodeId &&
  left.parentId === right.parentId &&
  left.placement === right.placement;

// Zustand 的不可变更新只会替换变更路径。结构键 (treeStructureKey) 已随 memoLibrary
// 抽出为纯函数并按节点/子数组引用缓存；此处仅在渲染层消费。

const setMemoDragImage = (
  event: DragEvent<HTMLElement>,
  node: MemoTreeNode,
) => {
  const icon = event.currentTarget.querySelector<SVGSVGElement>(
    ".ds-sidebar-button-leading svg",
  );

  if (icon === null) {
    return;
  }

  const preview = document.createElement("span");
  const previewIcon = icon.cloneNode(true) as SVGSVGElement;
  preview.className = "memo-tree-drag-preview";
  preview.dataset["nodeType"] = node.node_type;
  preview.setAttribute("aria-hidden", "true");
  preview.append(previewIcon);

  if (node.node_type === "folder") {
    const label = document.createElement("span");
    label.className = "memo-tree-drag-preview-label";
    label.textContent = node.title;
    preview.append(label);
  }

  document.body.append(preview);

  const bounds = preview.getBoundingClientRect();
  const iconBounds = previewIcon.getBoundingClientRect();
  event.dataTransfer.setDragImage(
    preview,
    Math.round(iconBounds.left - bounds.left + iconBounds.width / 2),
    Math.round(iconBounds.top - bounds.top + iconBounds.height / 2),
  );
  window.setTimeout(() => preview.remove(), 0);
};

function ContextMenuPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

export function AppSidebar({
  activeView,
  archiveTarget,
  memoTree,
  mutating,
  onCreateMemo,
  onCreateCanvas,
  onClose,
  onMoveNode,
  onPrefetchMemo,
  onOpenDesignSystem,
  onOpenProfile,
  onOpenSettings,
  onOpenSearch,
  onOpenSubscription,
  onRenameNode,
  onSoftDeleteNode,
  onRequestCreateFolder,
  onSelectMemo,
  onSelectView,
  onSignOut,
  profile,
  reveal,
  revealContent,
  selectedMemoId,
  skeletonVisible,
  treeStatus,
}: AppSidebarProps) {
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<MemoDropTarget | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // 进入重命名时的原始标题, 用于提交时判定「标题未变」
  const renameOriginalRef = useRef("");
  const renamingNode = renamingNodeId === null
    ? null
    : findMemoNode(memoTree, renamingNodeId);
  const renameConflict = memoNodeTitleTaken(
    memoTree,
    renamingNode,
    renameValue,
  );
  // 乐观新建的临时 id 落库后会被换成真实 id；用它把两者折叠回同一稳定身份，
  // React key、选中判定、结构键与定位 effect 都据此不把一次 id 替换看成
  // "换了一个对象"——否则每新建一篇都闪一下、卡一下，选中还会重放一次。
  const resolveClientKey = useCallback(
    (nodeId: string) => useMemoTreeStore.getState().getMemoClientKey(nodeId),
    [],
  );
  const layoutKey = useMemo(
    () => treeStructureKey(memoTree, resolveClientKey),
    [memoTree, resolveClientKey],
  );
  const captureFlipPositions = useTreeReorder(treeRef, layoutKey);
  function handleCreateMemo(parentId: string | null) {
    onCreateMemo(parentId);
  }
  const folderIds = useMemo(() => getFolderIds(memoTree), [memoTree]);
  const { expandedFolders, setExpandedFolders } = useMemoTreeExpansion({
    folderIds,
    ready: treeStatus === "ready",
    userId: profile.id,
  });
  /*
   * 代表解析在这一层, 因为 expandedFolders 只住在这一层。让 Overlay 隔着 DOM 再猜一次
   * 父级, 就会出现两个都自称正确的答案 —— 折叠的那一刻它们必然分叉。
   */
  const archiveRepresentative: ArchiveRepresentative | null = archiveTarget === null
    ? null
    : resolveArchiveRepresentative({
      expandedFolders,
      memoId: archiveTarget.memoId,
      tree: memoTree,
      treeReady: treeStatus === "ready",
    });
  // 只有刚发生的整理才把用户带过去; 恢复的事实不许撑开他自己收起的目录
  const freshArchiveMemoId = archiveTarget?.origin === "fresh"
    ? archiveTarget.memoId
    : null;
  const focusNodeId = reveal?.nodeId
    ?? freshArchiveMemoId
    ?? selectedMemoId;
  const selectedNode = selectedMemoId === null
    ? null
    : findMemoNode(memoTree, selectedMemoId);
  const createParentId = selectedNode?.node_type === "folder"
    ? selectedNode.id
    : selectedNode?.parent_id ?? null;
  // 定位 effect 的触发身份也走 client key：optimistic→real 只是同一篇笔记换了 id，
  // 不该被当成"选中移到了新目标"而把展开/滚动重放一次。effect 内部仍按当前真实
  // id 查行（data-memo-tree-row-id 是真实 id），这里只让"要不要重跑"变稳。
  const focusClientKey = focusNodeId === null ? null : resolveClientKey(focusNodeId);
  const focusSource = reveal !== null
    ? `reveal:${reveal.seq}`
    : freshArchiveMemoId !== null ? `run:${archiveTarget?.runId}` : "selection";
  const focusAncestorIds = useMemo(
    () => focusNodeId === null ? [] : getAncestorFolderIds(memoTree, focusNodeId),
    [focusNodeId, memoTree],
  );
  const focusPlacementKey = focusAncestorIds.map(resolveClientKey).join("/");
  const treeReady = treeStatus === "ready";

  /*
   * 定位只回答「目标变了没有」：换了目标（选中/reveal/新一次整理）、目标被搬进
   * 别的文件夹、或树首次就绪。别处的增删改只是树变了、目标没变——此前触发键混入
   * 整树 layoutKey，于是在文件夹里删一篇别的笔记也会把用户手动收起的目录撑回来、
   * 把滚动拽回树顶那篇选中笔记。三个键都按 client key 折叠，乐观新建落库那一帧的
   * id 替换不会让"选中刚移过去"重放一次。展开的只有目标 memo 的祖先。
   */
  // oxlint-disable react-hooks/exhaustive-deps -- 触发身份只认 focusSource/focusClientKey/focusPlacementKey/treeReady（已折叠 client key），effect 内按当前真实 focusNodeId 查行
  useEffect(() => {
    if (focusNodeId === null || focusAncestorIds.length === 0) {
      return;
    }

    setExpandedFolders((currentFolders) => focusAncestorIds.every((id) => currentFolders.has(id))
      ? currentFolders
      : new Set([...currentFolders, ...focusAncestorIds]));
  }, [focusSource, focusClientKey, focusPlacementKey, treeReady]);

  useEffect(() => {
    if (focusNodeId === null || treeRef.current === null) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const tree = treeRef.current;
      const resolvedId = useMemoTreeStore.getState().resolveMemoId(focusNodeId);
      const row = tree?.querySelector<HTMLElement>(
        `[data-memo-tree-row-id="${CSS.escape(resolvedId)}"]`,
      );
      if (!tree || !row) return;
      const bounds = tree.getBoundingClientRect();
      const target = row.getBoundingClientRect();
      // 已可见的新行只播放插入动画，不同时滚动整棵树；离屏定位保留原有平滑效果。
      if (target.top < bounds.top || target.bottom > bounds.bottom) {
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusSource, focusClientKey, focusPlacementKey, treeReady]);
  // oxlint-enable react-hooks/exhaustive-deps

  useEffect(() => {
    if (contextMenu === null) {
      return;
    }

    function dismissContextMenu(event: PointerEvent) {
      if (
        contextMenuRef.current !== null &&
        event.target instanceof Node &&
        contextMenuRef.current.contains(event.target)
      ) {
        return;
      }

      setContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setContextMenu(null);
      }
    }

    const dismissForViewportChange = () => setContextMenu(null);
    window.addEventListener("pointerdown", dismissContextMenu);
    /*
     * keydown 必须挂在 document 而不是 window: PaperWorkspaceShell 的壳层守卫也在
     * window 上, 同一目标同一阶段只按注册顺序触发, 而它注册得更早 —— 于是一次 Escape
     * 会先关掉文件库, 再关掉这个菜单, 用户按一下丢两层。document 在冒泡链上先于
     * window, preventDefault 因此赶在壳层之前生效; 这正是 useDismissable 那半边协议。
     */
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", dismissForViewportChange);
    window.addEventListener("scroll", dismissForViewportChange, true);

    return () => {
      window.removeEventListener("pointerdown", dismissContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", dismissForViewportChange);
      window.removeEventListener("scroll", dismissForViewportChange, true);
    };
  }, [contextMenu]);

  function toggleFolder(folderId: string) {
    setExpandedFolders((currentFolders) => {
      const nextFolders = new Set(currentFolders);

      if (nextFolders.has(folderId)) {
        nextFolders.delete(folderId);
      } else {
        nextFolders.add(folderId);
      }

      return nextFolders;
    });
  }

  function beginRename(node: MemoTreeNode) {
    setContextMenu(null);

    setRenamingNodeId(node.id);
    setRenameValue(node.title);
    renameOriginalRef.current = node.title;
  }

  function cancelRename() {
    setRenamingNodeId(null);
    setRenameValue("");
  }

  function commitRename() {
    if (renamingNodeId === null) {
      return;
    }

    /*
     * 撞名时不提交、不收起、不清空: 用户的输入必须留在原地等他改, 而不是
     * 先发一次注定被唯一约束驳回的 PATCH 再静默回滚。提示由行内 data-conflict
     * 承担, 想放弃就按 Escape。
     */
    if (renameConflict) {
      return;
    }

    const nodeId = renamingNodeId;
    const title = renameValue.trim();
    const original = renameOriginalRef.current;
    cancelRename();

    // 标题未变则不发请求: 双击进入重命名后点别处 blur 是常见动作 (像在
    // 文件管理器里双击打开), 无短路会产生一次多余 PATCH 和一条「名称已
    // 更新」的虚假成功 Toast —— 用户从未重命名任何东西。
    if (title.length > 0 && title !== original) {
      void onRenameNode(nodeId, title);
    }
  }

  function openContextMenu(
    event: MouseEvent<HTMLElement>,
    node: MemoTreeNode | null,
  ) {
    event.preventDefault();
    event.stopPropagation();
    cancelRename();
    const x = Math.min(
      event.clientX,
      window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_VIEWPORT_GAP,
    );
    const y = Math.min(
      event.clientY,
      window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_VIEWPORT_GAP,
    );

    setContextMenu({
      node,
      parentId: node?.node_type === "folder"
        ? node.id
        : node?.parent_id ?? null,
      x: Math.max(CONTEXT_MENU_VIEWPORT_GAP, x),
      y: Math.max(CONTEXT_MENU_VIEWPORT_GAP, y),
    });
  }

  function handleDragStart(
    event: DragEvent<HTMLElement>,
    node: MemoTreeNode,
  ) {
    cancelRename();
    setDraggedNodeId(node.id);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = node.node_type === "memo" ? "copyMove" : "move";
    event.dataTransfer.setData("text/plain", node.id);
    const canvasPayload = serializeMemoCanvasDrag(node);
    if (canvasPayload !== null) {
      event.dataTransfer.setData(FOLUNE_MEMO_DRAG_MIME, canvasPayload);
    }
    setMemoDragImage(event, node);
  }

  function handleDragEnd() {
    setDraggedNodeId(null);
    setDropTarget(null);
  }

  function handleDragOverTarget(
    event: DragEvent<HTMLElement>,
    target: MemoDropTarget,
  ) {
    event.stopPropagation();
    const sourceNodeId =
      draggedNodeId ?? event.dataTransfer.getData("text/plain");
    const plan = sourceNodeId.length === 0
      ? null
      : createMemoMovePlan(memoTree, sourceNodeId, target);

    if (plan === null) {
      event.dataTransfer.dropEffect = "none";
      setDropTarget(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget((current) => dropTargetsMatch(current, target) ? current : target);
  }

  function handleDropTarget(
    event: DragEvent<HTMLElement>,
    target: MemoDropTarget,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const sourceNodeId =
      draggedNodeId ?? event.dataTransfer.getData("text/plain");
    const plan = sourceNodeId.length === 0
      ? null
      : createMemoMovePlan(memoTree, sourceNodeId, target);
    handleDragEnd();

    if (plan === null) {
      return;
    }

    captureFlipPositions();

    if (plan.parent_id !== null) {
      setExpandedFolders((currentFolders) =>
        new Set([...currentFolders, plan.parent_id as string]),
      );
    }

    void onMoveNode(sourceNodeId, plan);
  }

  const contextMenuStyle: ContextMenuStyle | undefined = contextMenu === null
    ? undefined
    : {
        "--memo-context-x": `${contextMenu.x}px`,
        "--memo-context-y": `${contextMenu.y}px`,
      };
  const contextMenuNode = contextMenu?.node ?? null;

  return (
    <aside aria-label="文件浏览器" className="app-sidebar">
      <div className="app-sidebar-header">
        <div className="app-sidebar-heading">
          <BrandMark />
          <Button
            aria-label="收起文件库"
            className="sidebar-collapse-button"
            icon={SidebarSimpleIcon}
            onClick={onClose}
            size="square"
            title="收起文件库"
            variant="ghost"
          />
        </div>
        {/* 固定操作行: 搜索占弹性槽只负责打开全局 Command Palette, 新建是 split */}
        <div className="sidebar-primary-actions">
          <SidebarButton
            aria-keyshortcuts="Meta+K Control+K"
            aria-label="搜索笔记、画布与文件夹"
            className="sidebar-search-trigger"
            label="搜索"
            leading={<MagnifyingGlassIcon size={16} />}
            onClick={onOpenSearch}
            title="搜索（⌘/Ctrl + K）"
          />
          <SidebarCreateMenu
            disabled={mutating || treeStatus !== "ready"}
            onCreateCanvas={() => onCreateCanvas(createParentId)}
            onCreateFolder={() => onRequestCreateFolder(createParentId)}
            onCreateMemo={() => handleCreateMemo(createParentId)}
          />
        </div>
      </div>

      <div
        aria-label="备忘录文件树"
          aria-busy={treeStatus === "loading"}
          className={[
            "app-sidebar-tree memo-tree-scroll-area",
            revealContent ? "loading-content-reveal" : "",
          ].join(" ")}
          onContextMenu={(event) => {
            if (treeStatus === "ready") {
              openContextMenu(event, null);
            } else {
              event.preventDefault();
            }
          }}
          ref={treeRef}
          role="tree"
          tabIndex={0}
        >
          <p className="sidebar-section-label">备忘录</p>
          {treeStatus === "loading" ? (
            <MemoTreeSkeleton visible={skeletonVisible} />
          ) : treeStatus === "error" ? (
            <div className="sidebar-tree-empty">暂时无法读取文件树。</div>
          ) : memoTree.length === 0 ? (
            <div className="sidebar-tree-empty">右键空白处，创建第一个备忘录或文件夹。</div>
          ) : (
            <MemoTreeBranch
              archiveRepresentative={archiveRepresentative}
              depth={0}
              draggedNodeId={draggedNodeId}
              dropTarget={dropTarget}
              expandedFolders={expandedFolders}
              mutating={mutating}
              nodes={memoTree}
              notesActive={activeView === "note"}
              onBeginRename={beginRename}
              onCancelRename={cancelRename}
              onCommitRename={commitRename}
              onContextMenu={(event, node) => openContextMenu(event, node)}
              onDragEnd={handleDragEnd}
              onDragOverTarget={handleDragOverTarget}
              onDragStart={handleDragStart}
              onDropTarget={handleDropTarget}
              onRenameValueChange={setRenameValue}
              onPrefetchMemo={onPrefetchMemo}
              onSelectMemo={onSelectMemo}
              onToggleFolder={toggleFolder}
              parentId={null}
              renameConflict={renameConflict}
              renameValue={renameValue}
              renamingNodeId={renamingNodeId}
              resolveClientKey={resolveClientKey}
              selectedMemoId={selectedMemoId}
            />
          )}
          {treeStatus === "ready" ? (
            <div
              aria-hidden="true"
              className="memo-tree-root-drop-area"
              data-active={dropTargetsMatch(dropTarget, ROOT_END_TARGET)}
              data-dragging={draggedNodeId !== null}
              onDragOver={(event) => handleDragOverTarget(event, ROOT_END_TARGET)}
              onDrop={(event) => handleDropTarget(event, ROOT_END_TARGET)}
            />
          ) : null}
      </div>

      <div className="app-sidebar-footer">
        <nav aria-label="辅助导航" className="sidebar-utility-list">
          {import.meta.env.DEV ? (
            <SidebarButton
              active={activeView === "design-system"}
              aria-current={activeView === "design-system" ? "page" : undefined}
              aria-label="打开 Design System"
              className="sidebar-utility-button"
              label="Design System"
              leading={<PaletteIcon size={16} />}
              onClick={onOpenDesignSystem}
              title="Design System"
            />
          ) : null}
          <SidebarButton
            active={activeView === "trash"}
            aria-current={activeView === "trash" ? "page" : undefined}
            aria-label="打开回收站"
            className="sidebar-utility-button"
            label="回收站"
            leading={<TrashIcon size={16} />}
            onClick={() => onSelectView("trash")}
            title="回收站"
          />
        </nav>
        <UserMenu
          avatarUrl={profile.avatarUrl ?? undefined}
          email={profile.email ?? "未提供邮箱"}
          name={profile.username}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onOpenSubscription={onOpenSubscription}
          onSignOut={onSignOut}
        />
      </div>

      <AnimatePresence>
      {contextMenu ? (
        <ContextMenuPortal key="context">
        <MotionSurface
          aria-label="备忘录操作"
          className="memo-context-menu"
          ref={contextMenuRef}
          role="menu"
          style={contextMenuStyle}
        >
          <button
            disabled={mutating}
            onClick={() => {
              const parentId = contextMenu.parentId;
              setContextMenu(null);
              handleCreateMemo(parentId);
            }}
            role="menuitem"
            type="button"
          >
            <FileTextIcon size={14} />
            新建备忘录
          </button>
          <button
            disabled={mutating}
            onClick={() => {
              const parentId = contextMenu.parentId;
              setContextMenu(null);
              onRequestCreateFolder(parentId);
            }}
            role="menuitem"
            type="button"
          >
            <FolderIcon size={14} />
            新建文件夹
          </button>
          {contextMenuNode ? (
            <>
              <span className="memo-context-menu-separator" />
              <button
                disabled={mutating}
                onClick={() => beginRename(contextMenuNode)}
                role="menuitem"
                type="button"
              >
                <PencilSimpleIcon size={14} />
                <span className="memo-context-menu-label">重命名</span>
                <kbd className="memo-context-menu-shortcut">F2</kbd>
              </button>
              <button
                className="memo-context-menu-danger"
                disabled={mutating}
                onClick={() => {
                  const nodeId = contextMenuNode.id;
                  setContextMenu(null);
                  void onSoftDeleteNode(nodeId);
                }}
                role="menuitem"
                type="button"
              >
                <TrashIcon size={14} />
                <span className="memo-context-menu-label">移至回收站</span>
              </button>
            </>
          ) : null}
        </MotionSurface>
        </ContextMenuPortal>
      ) : null}
      </AnimatePresence>
    </aside>
  );
}
