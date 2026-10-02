/**
 * [INPUT]: 依赖 locale 状态文案、Collapse micro 披露、React 本地展开状态、ThinkingMark 与整轮 active 状态
 * [OUTPUT]: 对外提供处理期展开、正文开始仅自动收起一次、后续由用户控制回看的 AgentProcessDisclosure；手动开合只在原地铺开/收拢内容，绝不跟随滚动到底部
 * [POS]: 单条回复的披露生命周期；进入正文后不再因迟到工具/思考自动展开，新消息通过父层 key 重置。跟随滚动回调身份恒定、只按 manualToggleRef 短路——切换 onMotionEnd 引用会触发 Collapse 的 cleanup 补调，反而在点击那刻把视口甩到底部
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { CaretRightIcon } from "../../shared/design-system/icons";
import {
  type ReactNode,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";

import { ThinkingMark, Collapse } from "../../shared/design-system/components";
import { useLocale } from "../../shared/locale";

type AgentProcessDisclosureProps = {
  active: boolean;
  autoExpand?: boolean;
  activeLabel?: string;
  onProgress?: () => void;
  children: ReactNode;
};

export function AgentProcessDisclosure({
  active,
  autoExpand = true,
  activeLabel,
  onProgress,
  children,
}: AgentProcessDisclosureProps) {
  const { t } = useLocale();
  const resolvedActiveLabel = activeLabel ?? t("正在思考", "Thinking");
  const contentId = useId();
  const [mode, setMode] = useState<"auto" | "open" | "closed">(active && autoExpand ? "auto" : "closed");
  // 这次开合是不是用户手动触发的。手动展开/收起只在原地铺开或收拢内容，绝不跟随
  // 滚动到底部——那会把用户从正在读的位置甩到最新回复，也正是他看到的"闪一下"。
  // 只有跟随流式正文的自动收起才需要跟随滚动，而它一定发生在任何手动操作之前。
  const manualToggleRef = useRef(false);
  // 身份稳定的跟随回调：触发时读 ref 决定跟不跟，绝不靠切换 onMotionEnd 的引用来
  // 关闭跟随——Collapse 在 onMotionEnd 变化的 effect cleanup 里会补调一次旧回调，
  // 那恰好会在用户点击那一刻把视口甩到底部。所以引用恒定，只让行为按需短路。
  const followScroll = useCallback(() => {
    if (manualToggleRef.current) return;
    onProgress?.();
  }, [onProgress]);
  // 同次渲染完成交接；只允许 auto → closed，后续活动不能重新接管用户的阅读位置。
  if (mode === "auto" && (!active || !autoExpand)) setMode("closed");
  const automaticallyExpanded = mode === "auto" && active && autoExpand;
  const expanded = automaticallyExpanded || mode === "open";

  return (
    <div className="agent-process-disclosure" data-expanded={expanded}>
      {automaticallyExpanded ? (
        <div
          aria-label={resolvedActiveLabel}
          className="agent-process-status"
          role="status"
        >
          <ThinkingMark active aria-hidden="true" size={14} />
          <span>{resolvedActiveLabel}</span>
        </div>
      ) : (
        <button
          aria-controls={contentId}
          aria-expanded={expanded}
          className="agent-process-toggle"
          onClick={() => {
            manualToggleRef.current = true;
            setMode((value) => value === "open" ? "closed" : "open");
          }}
          type="button"
        >
          <ThinkingMark active={active} aria-hidden="true" size={14} />
          <span>{active ? resolvedActiveLabel : t("思考过程", "Thought process")}</span>
          <CaretRightIcon aria-hidden="true" size={14} />
        </button>
      )}
      <Collapse open={expanded} keepMounted motion="micro" onMotionEnd={followScroll} onMotionProgress={followScroll}>
      <div
        className="agent-process-content"
        id={contentId}
      >
        {children}
      </div>
      </Collapse>
    </div>
  );
}
