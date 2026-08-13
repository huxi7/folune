/**
 * [INPUT]: 依赖当前 toolbar 标题、memo/view 状态、AI 整理命令与 AgentPanel 开关
 * [OUTPUT]: 对外提供中央 48px Toolbar、整理/阅读模式命令和助手显隐按钮
 * [POS]: app/src/widgets 的主编辑区命令条纯视图，缩减 Dashboard JSX 并保持 32/16 控件节奏
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ChatCircleDotsIcon, MagicWandIcon } from "@phosphor-icons/react";

import type { MemoTreeNode } from "../shared/api/memo";
import { Button } from "../shared/design-system/components";
import { MarkdownViewMenu } from "./MarkdownViewMenu";
import type { DocumentView, EditingMode } from "./markdownViewTypes";

type AppMainToolbarProps = {
  agentPanelOpen: boolean;
  currentMemo: MemoTreeNode | null;
  currentMemoTitle: string;
  documentView: DocumentView;
  editingMode: EditingMode;
  onDocumentViewChange: (view: DocumentView) => void;
  onEditingModeChange: (mode: EditingMode) => void;
  onOrganize: () => Promise<void>;
  onToggleAgent: () => void;
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
        {props.currentMemo?.memo !== null && props.currentMemo !== null ? <>
          <Button aria-keyshortcuts="Meta+Enter Control+Enter" aria-label="AI 整理当前备忘录" className="note-organize-button" icon={MagicWandIcon} loading={props.organizing} onClick={() => void props.onOrganize()} title="AI 整理（⌘/Ctrl + Enter）" variant="secondary">整理</Button>
          <MarkdownViewMenu content={props.currentMemo.memo.content_mdx} documentView={props.documentView} editingMode={props.editingMode} onDocumentViewChange={props.onDocumentViewChange} onEditingModeChange={props.onEditingModeChange} title={props.currentMemoTitle} />
        </> : null}
        <Button aria-expanded={props.agentPanelOpen} aria-label={props.agentPanelOpen ? "关闭备忘录助手" : "打开备忘录助手"} className="note-view-icon-button" icon={ChatCircleDotsIcon} onClick={props.onToggleAgent} size="square" variant={props.agentPanelOpen ? "secondary" : "ghost"} />
      </div>
    </header>
  );
}
