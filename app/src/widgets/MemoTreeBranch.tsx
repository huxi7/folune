/**
 * [INPUT]: 依赖后端 MemoTreeNode、memoLibrary 统一落点、紧凑 SidebarButton 与上层文件夹展开/拖拽/原地重命名命令
 * [OUTPUT]: 对外提供无限递归树渲染、folder 24/52/24 三段落点、memo 前后落点、圆点横线/inside/拖拽源弱化状态和双击/F2 原地输入框
 * [POS]: app/src/widgets 的纯树交互渲染器；只表达可见层级与 HTML5 DnD 几何，并把完整节点身份交给预览生成器，不拥有树数据或调用 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";
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
import type { MemoDropTarget } from "./memoLibrary";

type TreeRowStyle = CSSProperties & {
  "--memo-tree-depth": number;
};

type MemoTreeBranchProps = {
  depth: number;
  draggedNodeId: string | null;
  dropTarget: MemoDropTarget | null;
  expandedFolders: ReadonlySet<string>;
  mutating: boolean;
  nodes: readonly MemoTreeNode[];
  notesActive: boolean;
  parentId: string | null;
  renamingNodeId: string | null;
  renameValue: string;
  onBeginRename: (node: MemoTreeNode) => void;
  onCancelRename: () => void;
  onCommitRename: () => void;
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

type InlineRenameProps = {
  icon: ReactNode;
  nodeId: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  style: TreeRowStyle;
  value: string;
};

function InlineRename({
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
      data-memo-tree-row-id={nodeId}
      data-size="default"
      style={style}
    >
      <span aria-hidden="true" className="ds-sidebar-button-leading">
        {icon}
      </span>
      <input
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
    </div>
  );
}

export function MemoTreeBranch(props: MemoTreeBranchProps) {
  const {
    depth,
    draggedNodeId,
    dropTarget,
    expandedFolders,
    mutating,
    nodes,
    notesActive,
    parentId,
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
    onSelectMemo,
    onToggleFolder,
    selectedMemoId,
  } = props;
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
        const isActive = !isFolder && notesActive && selectedMemoId === node.id;
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
        const icon = isFolder ? (
          <FolderComponent size={15} weight="fill" />
        ) : (
          <FileTextIcon
            size={14}
            weight={isActive ? "fill" : "regular"}
          />
        );

        return (
          <div
            aria-expanded={isFolder ? isExpanded : undefined}
            aria-level={depth + 1}
            aria-posinset={index + 1}
            aria-setsize={nodes.length}
            className="memo-tree-item"
            key={node.id}
            role="treeitem"
          >
            {renamingNodeId === node.id ? (
              <InlineRename
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
            {isFolder && isExpanded ? (
              <MemoTreeBranch
                {...props}
                depth={depth + 1}
                nodes={node.children}
                parentId={node.id}
              />
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
