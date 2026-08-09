/**
 * [INPUT]: 依赖 MemoTreeBranch、统一 Skeleton、memoLibrary 拖拽计划、按用户持久化展开偏好的 useMemoTreeExpansion、后端 Profile、设计系统 Button/SidebarButton/UserMenu 与上层 Store 命令
 * [OUTPUT]: 对外提供真实文件树、搜索/重命名/拖拽、扁平底部当前位置导航，以及复用 destructive 语义的节点“移至回收站”右键命令
 * [POS]: app/src/widgets 的常驻文件导航 Panel；只收集用户意图，软删草稿边界、Store 事务与路由切换由 Dashboard 编排
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  FileTextIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PaletteIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
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
  Input,
  Skeleton,
  SkeletonGroup,
  SidebarButton,
  UserMenu,
} from "../shared/design-system/components";
import {
  createMemoMovePlan,
  getAncestorFolderIds,
  getFolderIds,
  searchMemoTree,
  type MemoDropTarget,
  type MemoMovePlan,
} from "./memoLibrary";
import { MemoTreeBranch } from "./MemoTreeBranch";
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
  onCreateMemo: (parentId: string | null) => Promise<void>;
  onMoveNode: (nodeId: string, input: MemoMovePlan) => Promise<boolean>;
  onOpenDesignSystem: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenSubscription: () => void;
  onRenameNode: (nodeId: string, title: string) => Promise<void>;
  onSoftDeleteNode: (nodeId: string) => Promise<void>;
  onRequestCreateFolder: (parentId: string | null) => void;
  onSelectMemo: (memoId: string) => void;
  onSelectView: (view: SidebarView) => void;
  onSignOut: () => Promise<void>;
  profile: Profile;
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

function MemoTreeSkeleton({ visible }: { visible: boolean }) {
  return (
    <SkeletonGroup
      className="sidebar-tree-skeleton"
      label="正在加载备忘录文件树"
      visible={visible}
    >
      <div className="sidebar-tree-skeleton-row">
        <Skeleton className="sidebar-tree-skeleton-icon" />
        <Skeleton className="sidebar-tree-skeleton-label sidebar-tree-skeleton-label-wide" shape="text" />
      </div>
      <div className="sidebar-tree-skeleton-row sidebar-tree-skeleton-row-nested">
        <Skeleton className="sidebar-tree-skeleton-icon" />
        <Skeleton className="sidebar-tree-skeleton-label" shape="text" />
      </div>
      <div className="sidebar-tree-skeleton-row sidebar-tree-skeleton-row-nested">
        <Skeleton className="sidebar-tree-skeleton-icon" />
        <Skeleton className="sidebar-tree-skeleton-label sidebar-tree-skeleton-label-short" shape="text" />
      </div>
      <div className="sidebar-tree-skeleton-row">
        <Skeleton className="sidebar-tree-skeleton-icon" />
        <Skeleton className="sidebar-tree-skeleton-label" shape="text" />
      </div>
      <div className="sidebar-tree-skeleton-row sidebar-tree-skeleton-row-nested">
        <Skeleton className="sidebar-tree-skeleton-icon" />
        <Skeleton className="sidebar-tree-skeleton-label sidebar-tree-skeleton-label-wide" shape="text" />
      </div>
    </SkeletonGroup>
  );
}

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
  onCreateMemo,
  onMoveNode,
  onOpenDesignSystem,
  onOpenProfile,
  onOpenSettings,
  onOpenSubscription,
  onRenameNode,
  onSoftDeleteNode,
  onRequestCreateFolder,
  onSelectMemo,
  onSelectView,
  onSignOut,
  profile,
  revealContent,
  selectedMemoId,
  skeletonVisible,
  treeStatus,
}: AppSidebarProps) {
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const flipSnapshotRef = useRef<Map<string, DOMRect> | null>(null);
  const previousLayoutRef = useRef<Map<string, DOMRect> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<MemoDropTarget | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const layoutKey = useMemo(() => treeStructureKey(memoTree), [memoTree]);
  const folderIds = useMemo(() => getFolderIds(memoTree), [layoutKey]);
  const { expandedFolders, setExpandedFolders } = useMemoTreeExpansion({
    folderIds,
    ready: treeStatus === "ready",
    userId: profile.id,
  });
  const searchResults = searchMemoTree(memoTree, searchQuery);

  useEffect(() => {
    if (selectedMemoId === null) {
      return;
    }

    const ancestorIds = getAncestorFolderIds(memoTree, selectedMemoId);

    if (ancestorIds.length > 0) {
      setExpandedFolders((currentFolders) =>
        new Set([...currentFolders, ...ancestorIds]),
      );
    }
  }, [layoutKey, selectedMemoId]);

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

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  function beginRename(node: MemoTreeNode) {
    setContextMenu(null);
    setRenamingNodeId(node.id);
    setRenameValue(node.title);
  }

  function cancelRename() {
    setRenamingNodeId(null);
    setRenameValue("");
  }

  function commitRename() {
    if (renamingNodeId === null) {
      return;
    }

    const nodeId = renamingNodeId;
    const title = renameValue.trim();
    cancelRename();

    if (title.length > 0) {
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
          <div className="sidebar-header-actions">
            <Button
              aria-label="新建备忘录"
              className="sidebar-create-memo-button"
              disabled={mutating || treeStatus !== "ready"}
              icon={NotePencilIcon}
              onClick={() => void onCreateMemo(null)}
              size="square"
              title="新建备忘录"
              variant="primary"
            />
          </div>
        </div>
        <SidebarButton
          active={searchOpen}
          aria-label={searchOpen ? "关闭搜索" : "搜索备忘录"}
          className="sidebar-nav-button"
          label="搜索"
          leading={<MagnifyingGlassIcon size={16} />}
          onClick={() => {
            if (searchOpen) {
              closeSearch();
            } else {
              setSearchOpen(true);
            }
          }}
          title={searchOpen ? "关闭搜索" : "搜索备忘录"}
        />
        {searchOpen ? (
          <div className="sidebar-search-controls">
            <Input
              aria-label="搜索备忘录"
              autoFocus
              className="sidebar-search-input"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  closeSearch();
                }
              }}
              placeholder="搜索标题、正文或路径"
              value={searchQuery}
            />
            <button className="sidebar-search-cancel" onClick={closeSearch} type="button">
              取消
            </button>
          </div>
        ) : null}
      </div>

      {searchOpen ? (
        <div
          aria-label="备忘录搜索结果"
          aria-live="polite"
          className="app-sidebar-tree sidebar-search-results"
        >
          <p className="sidebar-section-label">搜索结果</p>
          {!searchQuery.trim() ? (
            <div className="sidebar-search-empty">输入关键词，搜索标题、正文内容或文件夹路径。</div>
          ) : null}
          {searchQuery.trim() && searchResults.length === 0 ? (
            <div className="sidebar-search-empty">没有找到与“{searchQuery.trim()}”相关的备忘录。</div>
          ) : null}
          {searchResults.map((memo) => {
            const isActive = activeView === "note" && selectedMemoId === memo.id;

            return (
              <SidebarButton
                active={isActive}
                aria-current={isActive ? "page" : undefined}
                className="sidebar-search-result"
                key={memo.id}
                label={<span className="sidebar-search-result-copy"><strong>{memo.title}</strong><small>{memo.path}</small></span>}
                leading={<FileTextIcon size={15} weight={isActive ? "fill" : "regular"} />}
                onClick={() => {
                  onSelectMemo(memo.id);
                  closeSearch();
                }}
              />
            );
          })}
        </div>
      ) : (
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
      )}

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
            <FileTextIcon size={15} />
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
            <FolderIcon size={15} />
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
                <PencilSimpleIcon size={15} />
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
                <TrashIcon size={15} />
                <span className="memo-context-menu-label">移至回收站</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
