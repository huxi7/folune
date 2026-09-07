/**
 * [INPUT]: 依赖 happy-dom、Testing Library 与生产滚动 Hook
 * [OUTPUT]: 验证初次定位不平滑、退出冻结且拒绝迟到的追尾回调
 * [POS]: AgentPanel 滚动生命周期回归门禁，不模拟视觉动画
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
const browserWindow = new Window();
Object.assign(globalThis, { window: browserWindow, document: browserWindow.document, HTMLElement: browserWindow.HTMLElement });
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { useConversationScroll } = await import("./useConversationScroll");
const calls: ScrollToOptions[] = [];
browserWindow.HTMLElement.prototype.scrollTo = function(options: unknown) {
  const value = options as ScrollToOptions;
  calls.push(value);
  this.scrollTop = value.top ?? 0;
};
const messages: readonly unknown[] = [];
function Harness({ present = true }: { present?: boolean }) {
  const { messageListRef, scrollToLatestAuto } = useConversationScroll(messages, "ready", false, present);
  return <><div data-testid="list" ref={messageListRef} /><button onClick={scrollToLatestAuto}>内容增长</button></>;
}
afterEach(() => { cleanup(); calls.length = 0; });
test("初次打开在布局阶段直接定位，不播放滚动动画", () => {
  render(<Harness />);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.behavior).toBe("instant");
});
test("退出冻结阅读位置，后续内容回调不能滚到底部", () => {
  const view = render(<Harness />);
  const list = view.getByTestId("list");
  list.scrollTop = 123;
  // 模拟滚动事件尚未派发的最后一帧：退出必须读取即时位置，不能回退到缓存。
  calls.length = 0;
  view.rerender(<Harness present={false} />);
  expect(calls).toEqual([{ top: 123, behavior: "instant" }]);
  fireEvent.click(view.getByText("内容增长"));
  expect(calls).toHaveLength(1);
  expect(list.scrollTop).toBe(123);
});
