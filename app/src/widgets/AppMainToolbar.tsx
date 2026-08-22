/**
 * [INPUT]: 依赖当前低对比路径、memo/view 状态与显式 AI 整理命令
 * [OUTPUT]: 对外提供纸张顶部路径、图标型 AI 整理与阅读/编辑菜单
 * [POS]: app/src/widgets 的纸张内命令条纯视图；整理以 Secondary 图标区别于常规视图命令，全局文件库/AI 开关归画布控制层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { MagicWandIcon } from "../shared/design-system/icons";

import type { MemoDetailNode } from "../shared/api/memo";
import { Button } from "../shared/design-system/components";
import { MarkdownViewMenu } from "./MarkdownViewMenu";
import type { DocumentView, EditingMode } from "./markdownViewTypes";

type AppMainToolbarProps = {
  currentMemo: MemoDetailNode | null;
  currentMemoTitle: string;
  documentView: DocumentView;
  editingMode: EditingMode;
  onDocumentViewChange: (view: DocumentView) => void;
  onEditingModeChange: (mode: EditingMode) => void;
  onOrganize: () => Promise<void>;
  organizing: boolean;
  toolbarTitle: string;
};

export function AppMainToolbar(props: AppMainToolbarProps) {
  return (
    <header className="app-main-toolbar">
      <div className="app-main-toolbar-copy flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="text-xs text-border">/</span>
        <span className="truncate text-xs font-medium text-muted-foreground">{props.toolbarTitle}</span>
      </div>
      <div className="note-view-actions">
        {props.currentMemo !== null ? <>
          <Button aria-keyshortcuts="Meta+Enter Control+Enter" aria-label="AI 整理当前备忘录" className="note-organize-button" icon={MagicWandIcon} loading={props.organizing} onClick={() => void props.onOrganize()} size="square" title="AI 整理（⌘/Ctrl + Enter）" variant="secondary" />
          <MarkdownViewMenu content={props.currentMemo.memo.content_mdx} documentView={props.documentView} editingMode={props.editingMode} onDocumentViewChange={props.onDocumentViewChange} onEditingModeChange={props.onEditingModeChange} title={props.currentMemoTitle} />
        </> : null}
      </div>
    </header>
  );
}
