/**
 * [INPUT]: 依赖统一 AiThread 列表、Design System Button/Input 与会话 CRUD 回调
 * [OUTPUT]: 对外提供 Panel 内历史会话列表、选择、重命名及普通删除确认
 * [POS]: AgentPanel 历史纯视图；不持有消息或调用 API，流式期间由 disabled 统一冻结危险切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  CheckIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from "../../shared/design-system/icons";
import { useState } from "react";

import type { AiThread } from "../../shared/api/ai";
import { Button, Dialog, Input } from "../../shared/design-system/components";

type ThreadHistoryProps = {
  busy: boolean;
  onClose: () => void;
  onDelete: (threadId: string) => Promise<void>;
  onRename: (threadId: string, title: string) => Promise<void>;
  onSelect: (threadId: string) => Promise<unknown>;
  selectedId: string | null;
  threads: readonly AiThread[];
};

export function ThreadHistory(props: ThreadHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AiThread | null>(null);

  const commitRename = (threadId: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    void props.onRename(threadId, nextTitle).then(() => setEditingId(null));
  };

  const renderThread = (thread: AiThread) => (
    <div className="agent-thread-row" data-active={props.selectedId === thread.id} key={thread.id}>
      {editingId === thread.id ? (
        <Input
          autoFocus
          className="agent-thread-rename"
          maxLength={500}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditingId(null);
            if (event.key === "Enter") commitRename(thread.id);
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
        <Button
          aria-label={editingId === thread.id ? "保存会话名" : "重命名会话"}
          disabled={props.busy || (editingId === thread.id && !title.trim())}
          icon={editingId === thread.id ? CheckIcon : PencilSimpleIcon}
          onClick={() => {
            if (editingId === thread.id) {
              commitRename(thread.id);
              return;
            }
            setTitle(thread.title);
            setEditingId(thread.id);
          }}
          size="square"
          variant="ghost"
        />
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
      <div className="agent-thread-list">
        {props.threads.length === 0 ? <span className="agent-history-empty">暂无历史会话</span> : props.threads.map(renderThread)}
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
