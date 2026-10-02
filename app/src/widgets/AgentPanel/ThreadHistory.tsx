/**
 * [INPUT]: 依赖统一 AiThread 列表、locale 文案/日期、Design System Button/Input 与会话预取/CRUD 回调
 * [OUTPUT]: 对外提供 Panel 内历史会话列表、指向预取、选择、重命名及普通删除确认
 * [POS]: AgentPanel 历史纯视图；指针或键盘意图只触发可失败预取，点击导航由上层立即完成，流式期间由 disabled 统一冻结危险切换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  CheckIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "../../shared/design-system/icons";
import { useState } from "react";

import type { AiThread } from "../../shared/api/ai";
import { Button, Dialog, Input } from "../../shared/design-system/components";
import { useLocale } from "../../shared/locale";

type ThreadHistoryProps = {
  busy: boolean;
  onDelete: (threadId: string) => Promise<void>;
  onPrefetch: (threadId: string) => Promise<void>;
  onRename: (threadId: string, title: string) => Promise<void>;
  onSelect: (threadId: string) => Promise<unknown>;
  selectedId: string | null;
  threads: readonly AiThread[];
};

export function ThreadHistory(props: ThreadHistoryProps) {
  const { t, formatDate } = useLocale();
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
          aria-label={t("会话名称", "Chat name")}
          autoFocus
          className="agent-thread-rename"
          maxLength={500}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditingId(null);
            }
            if (event.key === "Enter") commitRename(thread.id);
          }}
          value={title}
        />
      ) : (
        <button
          className="agent-thread-select"
          disabled={props.busy}
          onFocus={() => void props.onPrefetch(thread.id).catch(() => undefined)}
          onClick={() => void props.onSelect(thread.id)}
          onPointerEnter={() => void props.onPrefetch(thread.id).catch(() => undefined)}
          type="button"
        >
          <strong>{thread.title}</strong>
          <span>{formatDate(thread.last_message_at, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </button>
      )}
      <div className="agent-thread-actions">
        <Button
          aria-label={editingId === thread.id ? t("保存会话名", "Save chat name") : t("重命名会话", "Rename chat")}
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
        <Button aria-label={t("删除会话", "Delete chat")} disabled={props.busy} icon={TrashIcon} onClick={() => setDeleteTarget(thread)} size="square" variant="ghost" />
      </div>
    </div>
  );

  return (
    <div className="agent-history">
      <div className="agent-thread-list">
        {props.threads.length === 0 ? <span className="agent-history-empty">{t("暂无历史会话", "No conversations yet")}</span> : props.threads.map(renderThread)}
      </div>
      <Dialog closeLabel={t("关闭弹窗", "Close dialog")} density="compact" description={t("这会永久删除该会话及全部消息，无法撤销。", "This permanently deletes the conversation and all its messages. This cannot be undone.")} onOpenChange={(open) => !open && setDeleteTarget(null)} open={deleteTarget !== null} title={t("删除会话？", "Delete this conversation?")}>
        <div className="agent-dialog-actions">
          <Button onClick={() => setDeleteTarget(null)} variant="ghost">{t("取消", "Cancel")}</Button>
          <Button data-dialog-autofocus onClick={() => {
            if (deleteTarget) void props.onDelete(deleteTarget.id).then(() => setDeleteTarget(null));
          }} variant="danger">{t("确认删除", "Delete conversation")}</Button>
        </div>
      </Dialog>
    </div>
  );
}
