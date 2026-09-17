/**
 * [INPUT]: 依赖受控树、选择/展开回调与生产树行、Header、用户身份原语
 * [OUTPUT]: 对外提供只在内存中展开与选择的文件库；其他入口仅保留产品外观
 * [POS]: Demo 的 Sidebar 装配层，不实例化带持久化展开偏好的 AppSidebar
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { MemoTreeNode } from "../../shared/api/memo";
import { BrandMark, Button, SidebarButton, UserButton } from "../../shared/design-system/components";
import { MagnifyingGlassIcon, SidebarSimpleIcon } from "../../shared/design-system/icons";
import { MemoTreeBranch } from "../MemoTreeBranch";
import { SidebarCreateMenu } from "../SidebarCreateMenu";
import { resolveArchiveRepresentative, type WorkspaceOrganizePresentation } from "../archiveCordPolicy";

const noop = () => {};
export function DemoSidebar({ tree, selected, expanded, onExpanded, onSelect, onClose, onHint, presentation }: {
  tree: MemoTreeNode[]; selected: string; expanded: Set<string>; onExpanded: (next: Set<string>) => void;
  onSelect: (id: string) => void; onClose: () => void; onHint: () => void;
  presentation: WorkspaceOrganizePresentation | null;
}) {
  return <aside aria-label="文件浏览器" className="app-sidebar">
    <div className="app-sidebar-header"><div className="app-sidebar-heading"><BrandMark />
      <Button aria-label="收起文件库" className="sidebar-collapse-button" icon={SidebarSimpleIcon} onClick={onClose} size="square" variant="ghost" />
    </div><div className="sidebar-primary-actions">
      <SidebarButton className="sidebar-search-trigger" label="搜索" leading={<MagnifyingGlassIcon size={16} />} disabled />
      <SidebarCreateMenu disabled={false} onCreateCanvas={onHint} onCreateFolder={onHint} onCreateMemo={onHint} />
    </div></div>
    <div aria-label="备忘录文件树" className="app-sidebar-tree memo-tree-scroll-area" role="tree">
      <MemoTreeBranch archiveRepresentative={presentation ? resolveArchiveRepresentative({ tree, memoId: presentation.memoId, expandedFolders: expanded, treeReady: true }) : null}
        depth={0} draggedNodeId={null} dropTarget={null} expandedFolders={expanded}
        mutating={false} nodes={tree} notesActive parentId={null}
        renameConflict={false} renamingNodeId={null} renameValue="" onBeginRename={onHint}
        onCancelRename={noop} onCommitRename={noop} onContextMenu={e => e.preventDefault()}
        onDragEnd={noop} onDragOverTarget={noop} onDragStart={e => e.preventDefault()} onDropTarget={noop}
        onRenameValueChange={noop} onPrefetchMemo={noop} onSelectMemo={onSelect}
        onToggleFolder={id => { const next = new Set(expanded); if (next.has(id)) next.delete(id); else next.add(id); onExpanded(next); }} selectedMemoId={selected} />
    </div>
    <div className="app-sidebar-footer"><UserButton name="林间" email="把日常写成自己的故事" onClick={onHint} /></div>
  </aside>;
}
