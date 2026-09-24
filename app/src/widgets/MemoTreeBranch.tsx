/**
 * [INPUT]: 依赖 TreeDisclosure 连续层级开合、后端 MemoTreeNode、memoLibrary 落点、紧凑 SidebarButton、archiveCordPolicy 的 ArchiveRepresentative、上层展开/拖拽/原地重命名命令与把临时/真实 id 折叠成稳定身份的 resolveClientKey
 * [OUTPUT]: 对外提供递归树、folder/memo 落点、笔记正文意图预热、client-key 稳定 tree row（乐观新建落库换 id 不重挂不闪灭高亮）、至多一个 data-archive-representative 标记、拖拽状态、原地重命名与重名提示
 * [POS]: app/src/widgets 的纯树交互渲染器；只表达可见层级、HTML5 DnD 几何与真实目标 DOM，不解析代表、不拥有树数据、连线生命周期或 API。React key 与选中判定走 resolveClientKey，data-memo-tree-row-id 仍留真实 id 供 FLIP/归档在真实 id 空间取矩形
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { TreeDisclosure } from "./TreeDisclosure";
import {
  CanvasIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
} from "../shared/design-system/icons";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import type { MemoTreeNode } from "../shared/api/memo";
import { SidebarButton } from "../shared/design-system/components";
import type { ArchiveRepresentative } from "./archiveCordPolicy";
import type { MemoDropTarget } from "./memoLibrary";

type TreeRowStyle = CSSProperties & {
  "--memo-tree-depth": number;
};

type MemoTreeBranchProps = {
  /**
   * 当前展开状态下代表 canonical memo 的那个对象，由 AppSidebar 解析。
   * 树只负责在对应的真实行上落一个标记 —— 它不知道 canonical 目标是谁，
   * 也不再同时点亮 memo 与 folder 两个高亮。
   */
  archiveRepresentative: ArchiveRepresentative | null;
  depth: number;
  draggedNodeId: string | null;
  dropTarget: MemoDropTarget | null;
  expandedFolders: ReadonlySet<string>;
  mutating: boolean;
  nodes: readonly MemoTreeNode[];
  notesActive: boolean;
  parentId: string | null;
  renameConflict: boolean;
  renamingNodeId: string | null;
  renameValue: string;
  onBeginRename: (node: MemoTreeNode) => void;
  onCancelRename: () => void;
  onCommitRename: () => void;
  /**
   * 把节点当前 id 折叠回它出生时的稳定客户端 key。
   * 乐观新建的临时 id 落库后会被换成真实 id；若 React key 或选中判定
   * 直接读 node.id，这一次替换就让整行卸载重挂 + 高亮闪灭。交给它统一
   * 换算后，临时/真实两个 id 归一到同一身份，替换是纯属性更新而非重挂。
   */
  resolveClientKey: (nodeId: string) => string;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    node: MemoTreeNode,
  ) => void;
  onDragEnd: () => void;
  onDragOverTarget: (
    event: DragEvent<HTMLElement>,
    target: MemoDropTarget,
  ) => void;
  onDragStart: (event: DragEvent<HTMLElement>, node: MemoTreeNode) => void;
  onDropTarget: (
    event: DragEvent<HTMLElement>,
    target: MemoDropTarget,
  ) => void;
  onRenameValueChange: (value: string) => void;
  onPrefetchMemo: (memoId: string) => void;
  onSelectMemo: (memoId: string) => void;
  onToggleFolder: (folderId: string) => void;
  selectedMemoId: string | null;
};

function dropTargetForNode(
  event: DragEvent<HTMLElement>,
  node: MemoTreeNode,
  beforeTarget: MemoDropTarget,
  afterTarget: MemoDropTarget,
): MemoDropTarget {
  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientY - bounds.top) / bounds.height;

  if (node.node_type === "folder") {
    if (ratio < 0.24) {
      return beforeTarget;
    }

    if (ratio > 0.76) {
      return afterTarget;
    }

    return {
      nodeId: node.id,
      parentId: node.parent_id,
      placement: "inside",
    };
  }

  return ratio < 0.5 ? beforeTarget : afterTarget;
}

function targetsMatch(
  left: MemoDropTarget | null,
  right: MemoDropTarget,
): boolean {
  return left?.nodeId === right.nodeId &&
    left.parentId === right.parentId &&
    left.placement === right.placement;
}

type MemoTreeDropZoneProps = {
  depth: number;
  draggedNodeId: string | null;
  dropTarget: MemoDropTarget | null;
  onDragOverTarget: MemoTreeBranchProps["onDragOverTarget"];
  onDropTarget: MemoTreeBranchProps["onDropTarget"];
  target: MemoDropTarget;
};

function MemoTreeDropZone({
  depth,
  draggedNodeId,
  dropTarget,
  onDragOverTarget,
  onDropTarget,
  target,
}: MemoTreeDropZoneProps) {
  const style: TreeRowStyle = { "--memo-tree-depth": depth };

  return (
    <div
      aria-hidden="true"
      className="memo-tree-drop-zone"
      data-active={targetsMatch(dropTarget, target)}
      data-dragging={draggedNodeId !== null}
      onDragOver={(event) => onDragOverTarget(event, target)}
      onDrop={(event) => onDropTarget(event, target)}
      style={style}
    />
  );
}

const renameConflictId = (nodeId: string): string =>
  `memo-tree-rename-conflict-${nodeId}`;

type InlineRenameProps = {
  /** 同级已有同名对象：提交被挂起，编辑态与用户输入一律保留 */
  conflict: boolean;
  icon: ReactNode;
  nodeId: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  style: TreeRowStyle;
  value: string;
};

function InlineRename({
  conflict,
  icon,
  nodeId,
  onCancel,
  onChange,
  onCommit,
  style,
  value,
}: InlineRenameProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      className="ds-sidebar-button sidebar-tree-row memo-tree-rename-row"
      data-conflict={conflict ? "" : undefined}
      data-memo-tree-row-id={nodeId}
      data-size="default"
      style={style}
    >
      <span aria-hidden="true" className="ds-sidebar-button-leading">
        {icon}
      </span>
      <input
        aria-describedby={conflict ? renameConflictId(nodeId) : undefined}
        aria-invalid={conflict ? true : undefined}
        aria-label="重命名节点"
        className="memo-tree-rename-input"
        maxLength={500}
        onBlur={() => {
          if (!cancelledRef.current) {
            onCommit();
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            cancelledRef.current = true;
            onCancel();
          }
        }}
        ref={inputRef}
        value={value}
      />
      {conflict ? (
        <span
          className="memo-tree-rename-conflict"
          id={renameConflictId(nodeId)}
          role="alert"
        >
          已存在同名
        </span>
      ) : null}
    </div>
  );
}

export function MemoTreeBranch(props: MemoTreeBranchProps) {
  const {
    archiveRepresentative,
    depth,
    draggedNodeId,
    dropTarget,
    expandedFolders,
    mutating,
    nodes,
    notesActive,
    parentId,
    renameConflict,
    renamingNodeId,
    renameValue,
    onBeginRename,
    onCancelRename,
    onCommitRename,
    onContextMenu,
    onDragEnd,
    onDragOverTarget,
    onDragStart,
    onDropTarget,
    onRenameValueChange,
    onPrefetchMemo,
    onSelectMemo,
    onToggleFolder,
    resolveClientKey,
    selectedMemoId,
  } = props;
  const selectedClientKey = selectedMemoId === null
    ? null
    : resolveClientKey(selectedMemoId);
  const levelStartTarget: MemoDropTarget = {
    nodeId: null,
    parentId,
    placement: "before",
  };

  return (
    <div
      className="memo-tree-level"
      data-empty={nodes.length === 0}
      role={depth > 0 ? "group" : undefined}
    >
      <MemoTreeDropZone
        depth={depth}
        draggedNodeId={draggedNodeId}
        dropTarget={dropTarget}
        onDragOverTarget={onDragOverTarget}
        onDropTarget={onDropTarget}
        target={levelStartTarget}
      />
      {nodes.map((node, index) => {
        const isFolder = node.node_type === "folder";
        const isExpanded = isFolder && expandedFolders.has(node.id);
        // 身份用稳定 client key 判定：临时 id 换成真实 id 的那一帧里，
        // 路由还停在临时 id，直接比 node.id 会让高亮闪灭一下。
        const clientKey = resolveClientKey(node.id);
        const isActive = !isFolder && notesActive && selectedClientKey === clientKey;
        const FolderComponent = isExpanded ? FolderOpenIcon : FolderIcon;
        const rowStyle: TreeRowStyle = { "--memo-tree-depth": depth };
        const beforeTarget: MemoDropTarget = {
          nodeId: node.id,
          parentId,
          placement: "before",
        };
        const afterTarget: MemoDropTarget = {
          nodeId: node.id,
          parentId,
          placement: "after",
        };
        // 画布与笔记只靠图标区分，文件名里永不出现扩展名
        const LeafComponent = node.node_type === "canvas"
          ? CanvasIcon
          : FileTextIcon;
        const icon = isFolder ? (
          <FolderComponent size={14} />
        ) : (
          <LeafComponent size={14} />
        );

        return (
          <div
            aria-expanded={isFolder ? isExpanded : undefined}
            aria-level={depth + 1}
            aria-posinset={index + 1}
            aria-setsize={nodes.length}
            className="memo-tree-item"
            key={clientKey}
            role="treeitem"
          >
            {renamingNodeId === node.id ? (
              <InlineRename
                conflict={renameConflict}
                icon={icon}
                nodeId={node.id}
                onCancel={onCancelRename}
                onChange={onRenameValueChange}
                onCommit={onCommitRename}
                style={rowStyle}
                value={renameValue}
              />
            ) : (
              <SidebarButton
                active={isActive}
                aria-current={!isFolder && isActive ? "page" : undefined}
                aria-keyshortcuts="F2"
                className={[
                  "sidebar-tree-row",
                  isFolder ? "sidebar-folder-row" : "sidebar-document-row",
                ].join(" ")}
                data-drop-placement={
                  dropTarget?.nodeId === node.id &&
                  dropTarget.placement === "inside"
                    ? "inside"
                    : undefined
                }
                data-drag-source={draggedNodeId === node.id}
                data-memo-tree-row-id={node.id}
                data-archive-representative={
                  archiveRepresentative?.nodeId === node.id
                    ? archiveRepresentative.kind
                    : undefined
                }
                draggable={!mutating}
                label={node.title}
                leading={icon}
                onClick={(event) => {
                  if (event.detail > 1) {
                    return;
                  }

                  if (isFolder) {
                    onToggleFolder(node.id);
                    return;
                  }

                  onSelectMemo(node.id);
                }}
                onContextMenu={(event) => onContextMenu(event, node)}
                onDoubleClick={(event) => {
                  if (!mutating) {
                    event.preventDefault();
                    event.stopPropagation();
                    onBeginRename(node);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "F2" && !mutating) {
                    event.preventDefault();
                    event.stopPropagation();
                    onBeginRename(node);
                  }
                }}
                onFocus={() => {
                  if (node.node_type === "memo") onPrefetchMemo(node.id);
                }}
                onPointerEnter={() => {
                  if (node.node_type === "memo") onPrefetchMemo(node.id);
                }}
                onDragEnd={onDragEnd}
                onDragOver={(event) =>
                  onDragOverTarget(
                    event,
                    dropTargetForNode(
                      event,
                      node,
                      beforeTarget,
                      afterTarget,
                    ),
                  )}
                onDragStart={(event) => onDragStart(event, node)}
                onDrop={(event) =>
                  onDropTarget(
                    event,
                    dropTargetForNode(
                      event,
                      node,
                      beforeTarget,
                      afterTarget,
                    ),
                  )}
                style={rowStyle}
              />
            )}
            {isFolder ? (
              <TreeDisclosure open={isExpanded}>
              <MemoTreeBranch
                {...props}
                depth={depth + 1}
                nodes={node.children}
                parentId={node.id}
              />
              </TreeDisclosure>
            ) : null}
            <MemoTreeDropZone
              depth={depth}
              draggedNodeId={draggedNodeId}
              dropTarget={dropTarget}
              onDragOverTarget={onDragOverTarget}
              onDropTarget={onDropTarget}
              target={afterTarget}
            />
          </div>
        );
      })}
    </div>
  );
}
