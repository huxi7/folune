/**
 * [INPUT]: 依赖 React 布局/消息 effect、Motion presence 与消息列表 DOM
 * [OUTPUT]: 对外提供消息列表 ref、内容增长回调
 * [POS]: AgentConversation 的滚动边界；首次在绘制前定位，退出保持即时位置，隐藏历史不自动追尾
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export function useConversationScroll(messages: unknown, status: string, reduced: boolean, present: boolean) {
  const messageListRef = useRef<HTMLDivElement>(null);
  const previous = useRef({ messages, status });
  useLayoutEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    // instant 也取消尚未结束的原生 smooth scroll，不把它带进退出帧。
    list.scrollTo({ top: present ? list.scrollHeight : list.scrollTop, behavior: "instant" });
  }, [present]);
  const scrollToLatest = useCallback((behavior: ScrollBehavior) => {
    const list = messageListRef.current;
    if (!present || !list || list.closest('[inert]')) return;
    list.scrollTo({ behavior, top: list.scrollHeight });
  }, [present]);
  useEffect(() => {
    const changed = previous.current.messages !== messages || previous.current.status !== status;
    previous.current = { messages, status };
    if (changed) scrollToLatest(reduced || status === "streaming" ? "instant" : "smooth");
  }, [messages, reduced, scrollToLatest, status]);
  const scrollToLatestAuto = useCallback(() => scrollToLatest("instant"), [scrollToLatest]);
  return { messageListRef, scrollToLatestAuto };
}
