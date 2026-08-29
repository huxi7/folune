/**
 * [INPUT]: 依赖 MemoTreeBranch/Skeleton、SidebarCreateMenu、memoLibrary 拖拽/祖先计划、memoTitleRules 的重名与可改名判据、持久化展开偏好、整理定位意图、Profile 与上层事务命令
 * [OUTPUT]: 对外提供文件库 Header、搜索入口、笔记优先的分流新建入口、真实文件树、重命名（默认 Canvas 不开放，撞名挂起提交并保留编辑态）/拖拽、整理定位高亮、底部导航及节点回收站命令
 * [POS]: app/src/widgets 的按需文件库内容层；拥有文件库内部信息层级与关闭入口，只收集业务意图，事务与路由切换由 Dashboard 编排
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
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
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
import {
  createMemoMovePlan,
  getAncestorFolderIds,
  getFolderIds,
  findMemoNode,
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
  memoTree: MemoTreeNode[];
  mutating: boolean;
  organizeTarget: {
    folderId: string | null;
    memoId: string;
    runId: string;
  } | null;
  onCreateMemo: (parentId: string | null) => void;
  onCreateCanvas: (parentId: string | null) => void;
  onClose: () => void;
  onMoveNode: (nodeId: string, input: MemoMovePlan) => Promise<boolean>;
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
const FLIP_DURATION_MS = 210;
const FLIP_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
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

const treeStructureKey = (nodes: readonly MemoTreeNode[]): string =>
  nodes
    .map((node) => `${node.id}[${treeStructureKey(node.children)}]`)
    .join("|");

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

export function AppSidebar({
  activeView,
  memoTree,
  mutating,
  organizeTarget,
  onCreateMemo,
  onCreateCanvas,
  onClose,
  onMoveNode,
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
  const flipSnapshotRef = useRef<Map<string, DOMRect> | null>(null);
  const previousLayoutRef = useRef<Map<string, DOMRect> | null>(null);
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
  const layoutKey = useMemo(() => treeStructureKey(memoTree), [memoTree]);
  const folderIds = useMemo(() => getFolderIds(memoTree), [layoutKey]);
  const { expandedFolders, setExpandedFolders } = useMemoTreeExpansion({
    folderIds,
    ready: treeStatus === "ready",
    userId: profile.id,
  });
  const focusNodeId = reveal?.nodeId
    ?? organizeTarget?.folderId
    ?? organizeTarget?.memoId
    ?? selectedMemoId;
  const selectedNode = selectedMemoId === null
    ? null
    : findMemoNode(memoTree, selectedMemoId);
  const createParentId = selectedNode?.node_type === "folder"
    ? selectedNode.id
    : selectedNode?.parent_id ?? null;
  const focusKey = reveal === null
    ? organizeTarget?.runId ?? layoutKey
    : `reveal:${reveal.seq}`;

  useEffect(() => {
    if (focusNodeId === null) {
      return;
    }

    const ancestorIds = getAncestorFolderIds(memoTree, focusNodeId);
    const folderIdsToOpen = organizeTarget?.folderId === null || organizeTarget === null
      ? ancestorIds
      : [...ancestorIds, organizeTarget.folderId];

    if (folderIdsToOpen.length > 0) {
      setExpandedFolders((currentFolders) =>
        new Set([...currentFolders, ...folderIdsToOpen]),
      );
    }
  }, [focusKey, focusNodeId, layoutKey]);

  useEffect(() => {
    if (focusNodeId === null || treeRef.current === null) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const row = treeRef.current?.querySelector<HTMLElement>(
        `[data-memo-tree-row-id="${CSS.escape(focusNodeId)}"]`,
      );
      row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusKey, focusNodeId, layoutKey]);

  useLayoutEffect(() => {
    if (treeRef.current === null) {
      return;
    }

    const currentLayout = new Map<string, DOMRect>();
    const rows = treeRef.current.querySelectorAll<HTMLElement>(
      "[data-memo-tree-row-id]",
    );

    rows.forEach((row) => {
      const nodeId = row.dataset["memoTreeRowId"];

      if (nodeId !== undefined) {
        currentLayout.set(nodeId, row.getBoundingClientRect());
      }
    });

    const snapshot = flipSnapshotRef.current ?? previousLayoutRef.current;
    flipSnapshotRef.current = null;
    previousLayoutRef.current = currentLayout;

    if (
      snapshot === null ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    rows.forEach((row) => {
      const nodeId = row.dataset["memoTreeRowId"];
      const previous = nodeId === undefined ? undefined : snapshot.get(nodeId);

      if (previous === undefined) {
        return;
      }

      const current = nodeId === undefined ? undefined : currentLayout.get(nodeId);

      if (current === undefined) {
        return;
      }

      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
        return;
      }

      row.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: FLIP_DURATION_MS,
          easing: FLIP_EASING,
        },
      );
    });
  }, [layoutKey]);

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
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", dismissForViewportChange);
    window.addEventListener("scroll", dismissForViewportChange, true);

    return () => {
      window.removeEventListener("pointerdown", dismissContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", dismissForViewportChange);
      window.removeEventListener("scroll", dismissForViewportChange, true);
    };
  }, [contextMenu]);

  function captureFlipPositions() {
    if (treeRef.current === null) {
      return;
    }

    const snapshot = new Map<string, DOMRect>();
    treeRef.current
      .querySelectorAll<HTMLElement>("[data-memo-tree-row-id]")
      .forEach((row) => {
        const nodeId = row.dataset["memoTreeRowId"];

        if (nodeId !== undefined) {
          snapshot.set(nodeId, row.getBoundingClientRect());
        }
      });
    flipSnapshotRef.current = snapshot;
  }

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
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", node.id);
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
            onCreateMemo={() => onCreateMemo(createParentId)}
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
              depth={0}
              draggedNodeId={draggedNodeId}
              dropTarget={dropTarget}
              expandedFolders={expandedFolders}
              highlightedFolderId={organizeTarget?.folderId ?? null}
              highlightedMemoId={organizeTarget?.memoId ?? null}
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
              onSelectMemo={onSelectMemo}
              onToggleFolder={toggleFolder}
              parentId={null}
              renameConflict={renameConflict}
              renameValue={renameValue}
              renamingNodeId={renamingNodeId}
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

      {contextMenu ? (
        <div
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
              void onCreateMemo(parentId);
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
        </div>
      ) : null}
    </aside>
  );
}
