/**
 * [INPUT]: 依赖共享 Skeleton/SkeletonGroup、180ms 延迟策略与 locale 加载文案
 * [OUTPUT]: 对外提供 AgentConversationSkeleton，复用消息、输入区与工具行真实槽位的会话占位
 * [POS]: AgentPanel 的纯加载构图；冷启动、切换会话与代码加载共用，不建立会话或持有正文，真实内容就绪即由调用方卸载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Skeleton,
  SkeletonGroup,
  useDelayedSkeleton,
} from "../../shared/design-system/components";
import { useLocale } from "../../shared/locale";

export function AgentConversationSkeleton({ label }: { label?: string }) {
  const { t } = useLocale();
  const visible = useDelayedSkeleton(true, { delayMs: 180, minimumVisibleMs: 0 });

  return (
    <SkeletonGroup
      className="agent-conversation-loading"
      label={label ?? t("正在载入会话", "Loading conversation")}
      visible={visible}
    >
      <div aria-hidden="true" className="agent-conversation-loading-list">
        <div className="agent-conversation-loading-user">
          <Skeleton className="agent-conversation-loading-user-line" shape="text" />
          <Skeleton className="agent-conversation-loading-user-line agent-conversation-loading-user-line-short" shape="text" />
        </div>
        <div className="agent-conversation-loading-answer">
          <Skeleton shape="text" />
          <Skeleton shape="text" />
          <Skeleton shape="text" />
        </div>
      </div>
      <div aria-hidden="true" className="agent-conversation-loading-composer">
        <div className="agent-conversation-loading-input">
          <Skeleton className="agent-conversation-loading-input-line" shape="text" />
          <Skeleton className="agent-conversation-loading-input-line agent-conversation-loading-input-line-short" shape="text" />
        </div>
        <div className="agent-conversation-loading-footer">
          <Skeleton className="agent-conversation-loading-tool" />
          <Skeleton className="agent-conversation-loading-send" shape="circle" />
        </div>
      </div>
    </SkeletonGroup>
  );
}
