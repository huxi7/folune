/**
 * [INPUT]: 依赖 useAiThreads、常驻 AgentConversation、共用延迟加载构图 AgentConversationSkeleton、AgentPanelHeader、DS 历史视图与调用方外壳尺寸/状态回调
 * [OUTPUT]: 对外提供 AgentPanel，协调历史与新对话导航，将真实会话/整理状态交给胶囊外壳
 * [POS]: AgentPanel 的轻量组合根；会话执行归 AgentConversation，窗口形变归 Dashboard 宿主，切换尺寸与空间不重建会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useState } from "react";
import { Button, PersistentView, useToast } from "../../shared/design-system/components";
import { useLocale } from "../../shared/locale";
import type { AiRun } from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import type { AssistantSize } from "../../shared/store/workspaceChromeStore";
import { AgentConversation } from "./AgentConversation";
import { AgentConversationSkeleton } from "./AgentConversationSkeleton";
import { AgentPanelHeader } from "./AgentPanelHeader";
import type { AgentPresence } from "./activityState";
import { ThreadHistory } from "./ThreadHistory";
import { useAiThreads } from "./useAiThreads";
type AgentPanelProps = {
  onPresenceChange?: (presence: AgentPresence) => void;
  assistantSize?: AssistantSize;
  onToggleSize?: () => void;
  accessToken: string;
  currentMemo: MemoTreeNode | null;
  memoTree: MemoTreeNode[];
  onApplyOrganize: () => Promise<void>;
  onClose: () => void;
  onPrepareMutation: () => Promise<void>;
  onRejectOrganize: () => Promise<void>;
  onSelectedThreadChange: (threadId: string | null) => void;
  organizeBusy: boolean;
  organizeRun: AiRun | null;
  userId: string;
};
export function AgentPanel(props: AgentPanelProps) {
  const { t } = useLocale();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { toast } = useToast();
  const [chatBusy, setChatBusy] = useState(false);
  const [chatPresence, setChatPresence] = useState<AgentPresence>("idle");
  const threads = useAiThreads({ accessToken: props.accessToken, userId: props.userId });
  const actionBusy = props.organizeBusy
    || chatBusy
    || threads.mutating
    || props.organizeRun?.status === "planning"
    || props.organizeRun?.status === "applying";
  const thread = threads.selectedThread;
  const visibleOrganizeRun = props.organizeRun?.memo_id === props.currentMemo?.id
    ? props.organizeRun
    : null;
  const { onSelectedThreadChange } = props;
  const { onPresenceChange } = props;
  const presence = visibleOrganizeRun?.status === "awaiting_confirmation" ? "approval"
    : actionBusy ? "working" : chatPresence;
  useEffect(() => { onPresenceChange?.(presence); }, [onPresenceChange, presence]);


  useEffect(() => {
    onSelectedThreadChange(thread?.id ?? null);
  }, [onSelectedThreadChange, thread?.id]);

  const selectConversation = (threadId: string) => {
    setHistoryOpen(false);
    return threads.selectThread(threadId).catch((error) => {
      toast({ title: t("会话加载失败", "Unable to load this conversation"), description: t(error instanceof Error ? error.message : "请稍后重试。", "Please try again shortly."), variant: "error" });
    });
  };

  const createConversation = () => {
    if (actionBusy) return;
    threads.startDraft();
    setHistoryOpen(false);
  };

  return (
    <aside aria-label={t("备忘录助手", "Note assistant")} className="agent-panel">
      <AgentPanelHeader
        historyOpen={historyOpen}
        title={thread?.title ?? t("新对话", "New chat")}
        historyDisabled={chatBusy}
        createDisabled={actionBusy}
        onToggleHistory={() => setHistoryOpen((open) => !open)}
        onCreate={createConversation}
        onClose={props.onClose}
        assistantSize={props.assistantSize}
        onToggleSize={props.onToggleSize}
      />
      <div className="agent-panel-view-stack">
      <PersistentView active={historyOpen} motion="from-left" fill className="agent-panel-view-switch">
        <ThreadHistory busy={actionBusy} onDelete={threads.removeThread} onPrefetch={threads.preloadThread} onRename={(id, title) => threads.patchThread(id, { title })} onSelect={selectConversation} selectedId={thread?.id ?? null} threads={threads.threads} />
      </PersistentView>
      <PersistentView active={!historyOpen} fill className="agent-panel-view-switch">
      {threads.loading && thread === null ? (
        <AgentConversationSkeleton label={t("正在恢复会话", "Restoring your conversations")} />
      ) : threads.selectedLoading ? (
        <AgentConversationSkeleton label={`${t("正在载入会话", "Loading conversation")} ${thread?.title ?? t("新对话", "New chat")}`} />
      ) : threads.selectedLoadError !== null ? (
        <div className="agent-panel-loading" role="alert">
          <span>{t("这个会话暂时没有加载出来。", "This conversation could not be loaded.")}</span>
          <Button onClick={() => { if (thread) void selectConversation(thread.id); }} variant="ghost">{t("重试", "Try again")}</Button>
        </div>
      ) : (
        <AgentConversation onPresenceChange={setChatPresence} accessToken={props.accessToken} currentMemo={props.currentMemo} initialMessages={threads.messages} key={threads.conversationKey} conversationKey={threads.conversationKey} onEnsureThread={threads.ensureThread} pinnedIds={threads.pinnedMemoIds} memoTree={props.memoTree} onApplyOrganize={props.onApplyOrganize} onBusyChange={setChatBusy} onPrepareMutation={props.onPrepareMutation} onReferencesChange={threads.replaceReferences} onRejectOrganize={props.onRejectOrganize} onThreadUpdated={(localMessages) => localMessages === undefined ? threads.refreshSelected() : threads.commitLocalMessages(localMessages)} organizeReviewBusy={actionBusy} organizeRun={visibleOrganizeRun} thread={thread} userId={props.userId} />
      )}
      </PersistentView>
      </div>
    </aside>
  );
}
