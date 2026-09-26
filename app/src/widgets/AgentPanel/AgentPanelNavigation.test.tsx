/**
 * [INPUT]: 依赖 happy-dom、Testing Library、ToastProvider 与延迟完成的 useAiThreads 测试替身
 * [OUTPUT]: 验证会话内容请求未完成时，历史列表已退出、目标标题与目标加载壳已立即接管
 * [POS]: AgentPanel 会话切换交互回归门禁，锁定“先导航、后取数”而非在历史页等待
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { useState } from "react";

import type { AiThread, AiThreadDetail } from "../../shared/api/ai";

const browserWindow = new Window();
browserWindow.matchMedia = () => ({
  addEventListener: () => undefined,
  addListener: () => undefined,
  dispatchEvent: () => true,
  matches: true,
  media: "(prefers-reduced-motion: reduce)",
  onchange: null,
  removeEventListener: () => undefined,
  removeListener: () => undefined,
}) as unknown as ReturnType<typeof browserWindow.matchMedia>;
Object.assign(globalThis, {
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  window: browserWindow,
});

const current = {
  created_at: "2026-09-09T00:00:00.000Z",
  id: "thread-a",
  last_message_at: "2026-09-09T00:00:00.000Z",
  updated_at: "2026-09-09T00:00:00.000Z",
  user_id: "user-a",
  title: "当前会话",
  references: [],
} satisfies AiThreadDetail;
const target = {
  ...current,
  id: "thread-b",
  title: "目标会话",
} satisfies AiThread;
let releaseSelection: (() => void) | undefined;

mock.module("./useAiThreads", () => ({
  useAiThreads: () => {
    const [selectedThread, setSelectedThread] = useState(current);
    const [selectedLoading, setSelectedLoading] = useState(true);
    return {
      commitLocalMessages: async () => undefined,
      startDraft: () => undefined,
      conversationKey: selectedThread.id,
      ensureThread: async () => selectedThread.id,
      pinnedMemoIds: [],
      loading: false,
      messages: [],
      mutating: false,
      patchSelected: async () => undefined,
      patchThread: async () => undefined,
      preloadThread: async () => undefined,
      refreshSelected: async () => undefined,
      removeThread: async () => undefined,
      replaceReferences: async () => undefined,
      selectedLoadError: null,
      selectedLoading,
      selectedThread,
      selectThread: (threadId: string) => {
        setSelectedThread({ ...target, id: threadId, references: [] });
        setSelectedLoading(true);
        return new Promise<void>((resolve) => {
          releaseSelection = resolve;
        });
      },
      threads: [current, target],
    };
  },
}));

const { fireEvent, cleanup, render } = await import("@testing-library/react");
const { ToastProvider } = await import("../../shared/design-system/components");
const { AgentPanel } = await import("./AgentPanel");

afterEach(() => {
  releaseSelection?.();
  releaseSelection = undefined;
  cleanup();
});

test("点击历史项后不等待内容请求，立即进入目标会话加载壳", () => {
  const view = render(
    <ToastProvider>
      <AgentPanel
        accessToken="token"
        currentMemo={null}
        memoTree={[]}
        onApplyOrganize={async () => undefined}
        onClose={() => undefined}
        onPrepareMutation={async () => undefined}
        onRejectOrganize={async () => undefined}
        onSelectedThreadChange={() => undefined}
        organizeBusy={false}
        organizeRun={null}
        userId="user-a"
      />
    </ToastProvider>,
  );

  fireEvent.click(view.getByRole("button", { name: "会话历史" }));
  fireEvent.click(view.getByRole("button", { name: /目标会话/u }));

  const activeView = view.container.querySelector('[data-persistent-view][data-active="true"]');
  expect(activeView?.querySelector(".agent-history")).toBeNull();
  expect(activeView?.querySelector(".agent-conversation-loading")).not.toBeNull();
  expect(view.container.querySelector(".agent-panel-title")?.textContent).toBe("目标会话");
});
