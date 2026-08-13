/**
 * [INPUT]: 依赖 active/archive AiThread、Design System Button/Input 与会话 CRUD 回调
 * [OUTPUT]: 对外提供 Panel 内最近/已归档会话列表、选择、重命名、归档、恢复及普通删除确认
 * [POS]: AgentPanel 历史纯视图；不持有消息或调用 API，流式期间由 disabled 统一冻结危险切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  ArchiveIcon,
  ArrowUUpLeftIcon,
  CheckIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import type { AiThread } from "../../shared/api/ai";
import { Button, Dialog, Input } from "../../shared/design-system/components";

type ThreadHistoryProps = {
  active: readonly AiThread[];
  archived: readonly AiThread[];
  busy: boolean;
  onArchive: (threadId: string) => Promise<void>;
  onClose: () => void;
  onDelete: (threadId: string) => Promise<void>;
  onRename: (threadId: string, title: string) => Promise<void>;
  onRestore: (threadId: string) => Promise<void>;
  onSelect: (threadId: string) => Promise<unknown>;
  selectedId: string | null;
};

export function ThreadHistory(props: ThreadHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AiThread | null>(null);

  const renderThread = (thread: AiThread, archived: boolean) => (
    <div className="agent-thread-row" data-active={props.selectedId === thread.id} key={thread.id}>
      {editingId === thread.id ? (
        <Input
          autoFocus
          className="agent-thread-rename"
          maxLength={500}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditingId(null);
            if (event.key === "Enter" && title.trim()) {
              void props.onRename(thread.id, title.trim()).then(() => setEditingId(null));
            }
          }}
          value={title}
        />
      ) : (
        <button
          className="agent-thread-select"
          disabled={props.busy}
          onClick={() => void props.onSelect(thread.id)}
          type="button"
        >
          <strong>{thread.title}</strong>
          <span>{new Date(thread.last_message_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </button>
      )}
      <div className="agent-thread-actions">
        {!archived ? (
          <Button
            aria-label="重命名会话"
            disabled={props.busy}
            icon={editingId === thread.id ? CheckIcon : PencilSimpleIcon}
            onClick={() => {
              setTitle(thread.title);
              setEditingId(editingId === thread.id ? null : thread.id);
            }}
            size="square"
            variant="ghost"
          />
        ) : null}
        {archived ? (
          <Button aria-label="恢复会话" disabled={props.busy} icon={ArrowUUpLeftIcon} onClick={() => void props.onRestore(thread.id)} size="square" variant="ghost" />
        ) : (
          <Button aria-label="归档会话" disabled={props.busy} icon={ArchiveIcon} onClick={() => void props.onArchive(thread.id)} size="square" variant="ghost" />
        )}
        <Button aria-label="删除会话" disabled={props.busy} icon={TrashIcon} onClick={() => setDeleteTarget(thread)} size="square" variant="ghost" />
      </div>
    </div>
  );

  return (
    <div className="agent-history">
      <div className="agent-history-heading">
        <strong>历史会话</strong>
        <Button aria-label="返回对话" icon={XIcon} onClick={props.onClose} size="square" variant="ghost" />
      </div>
      <p className="agent-history-label">最近</p>
      <div className="agent-thread-list">{props.active.map((thread) => renderThread(thread, false))}</div>
      <p className="agent-history-label">已归档</p>
      <div className="agent-thread-list">
        {props.archived.length === 0 ? <span className="agent-history-empty">暂无已归档会话</span> : props.archived.map((thread) => renderThread(thread, true))}
      </div>
      <Dialog density="compact" description="这会永久删除该会话及全部消息，无法撤销。" onOpenChange={(open) => !open && setDeleteTarget(null)} open={deleteTarget !== null} title="删除会话？">
        <div className="agent-dialog-actions">
          <Button onClick={() => setDeleteTarget(null)} variant="ghost">取消</Button>
          <Button data-dialog-autofocus onClick={() => {
            if (deleteTarget) void props.onDelete(deleteTarget.id).then(() => setDeleteTarget(null));
          }} variant="danger">确认删除</Button>
        </div>
      </Dialog>
    </div>
  );
}
