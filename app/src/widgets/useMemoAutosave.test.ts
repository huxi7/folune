/**
 * [INPUT]: 依赖 Bun test、happy-dom、Testing Library renderHook 与 useMemoAutosave 的纯字符计数、服务端初值接纳判定、失败重试工具
 * [OUTPUT]: 覆盖迟到服务端正文防覆盖、等长替换计数、32 字阈值、400/800/1600ms 有界退避，以及标题冲突只挂起 title 而正文继续成功保存
 * [POS]: app/src/widgets 的自动保存状态机测试边界；纯参数用纯函数锁定，冲突不连坐正文这条必须驱动真实 Hook 才算证明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

import type { MemoTreeNode } from "../shared/api/memo";
import { ApiError } from "../shared/api/client";

const browserWindow = new Window({ url: "http://localhost:10000/app" });

Object.assign(globalThis, {
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
  document: browserWindow.document,
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  MutationObserver: browserWindow.MutationObserver,
  navigator: browserWindow.navigator,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  window: browserWindow,
});

const { act, cleanup, renderHook, waitFor } =
  await import("@testing-library/react/pure");
const {
  AUTOSAVE_CHAR_THRESHOLD,
  countChangedCharacters,
  saveWithRetry,
  shouldAdoptInitialMemo,
  useMemoAutosave,
} = await import("./useMemoAutosave");
type MemoDraftSnapshot = import("./useMemoAutosave").MemoDraftSnapshot;

const TIME = "2026-08-29T00:00:00.000Z";
const treeNode = (title: string): MemoTreeNode => ({
  children: [],
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id: "memo-1",
  memo: null,
  metadata: {},
  node_type: "memo",
  parent_id: null,
  revision: 2,
  sort_order: "1000",
  title,
  updated_at: TIME,
  user_id: "user-1",
});

afterEach(() => {
  cleanup();
});

describe("memo autosave", () => {
  test("加载期只让无本地草稿的会话接纳迟到服务端正文", () => {
    expect(shouldAdoptInitialMemo({
      initialContent: "服务端正文",
      initialTitle: "服务端标题",
      lastSavedContent: "",
      lastSavedTitle: "",
      latestContent: "",
      latestTitle: "",
    })).toBe(true);
    expect(shouldAdoptInitialMemo({
      initialContent: "服务端正文",
      initialTitle: "服务端标题",
      lastSavedContent: "",
      lastSavedTitle: "",
      latestContent: "本地草稿",
      latestTitle: "",
    })).toBe(false);
  });

  test("counts insertion, deletion, and equal-length replacement", () => {
    expect(countChangedCharacters("abc", "abcdef")).toBe(3);
    expect(countChangedCharacters("abcdef", "ab")).toBe(4);
    expect(countChangedCharacters("abc", "abd")).toBe(1);
    expect(countChangedCharacters("", "x".repeat(32))).toBe(
      AUTOSAVE_CHAR_THRESHOLD,
    );
  });

  test("retries three times with bounded exponential backoff", async () => {
    const waits: number[] = [];
    let attempts = 0;
    const result = await saveWithRetry(
      async () => {
        attempts += 1;

        if (attempts < 4) {
          throw new Error("offline");
        }

        return "saved";
      },
      async (delayMs) => {
        waits.push(delayMs);
      },
    );

    expect(result).toBe("saved");
    expect(attempts).toBe(4);
    expect(waits).toEqual([400, 800, 1_600]);
  });

  test("surfaces the final error after retries are exhausted", async () => {
    let attempts = 0;

    await expect(saveWithRetry(
      async () => {
        attempts += 1;
        throw new Error("still offline");
      },
      async () => undefined,
    )).rejects.toThrow("still offline");
    expect(attempts).toBe(4);
  });

  test("确定性拒绝不进入退避：shouldRetry 说不重试就只试一次", async () => {
    let attempts = 0;

    await expect(saveWithRetry(
      async () => {
        attempts += 1;
        throw new ApiError(409, "MEMO_TITLE_CONFLICT", "taken");
      },
      async () => undefined,
      (error) => !(error instanceof ApiError),
    )).rejects.toThrow("taken");
    expect(attempts).toBe(1);
  });
});

describe("标题冲突不连坐正文", () => {
  type Saved = { draft: MemoDraftSnapshot };

  const mountSession = (
    hasTitleConflict: (title: string) => boolean,
    onSave: (draft: MemoDraftSnapshot) => Promise<MemoTreeNode>,
  ) => {
    const saves: Saved[] = [];
    const failures: unknown[] = [];
    const result = renderHook(() => useMemoAutosave({
      hasTitleConflict,
      initialContent: "原正文",
      initialTitle: "草稿",
      memoId: "memo-1",
      onFailure: (error) => failures.push(error),
      onSave: async (_memoId, draft) => {
        saves.push({ draft });
        return await onSave(draft);
      },
    }));

    return { failures, result, saves };
  };

  test("本地预检查发现重名：只提交正文，标题挂起并原位提示", async () => {
    const { failures, result, saves } = mountSession(
      (title) => title === "熵与妄作",
      async (draft) => treeNode(draft.titleChanged ? draft.title : "草稿"),
    );

    await act(async () => {
      result.result.current.updateTitle("熵与妄作");
      result.result.current.updateContent("冲突期间写下的正文");
    });
    await act(async () => {
      await result.result.current.flush();
    });

    expect(result.result.current.titleConflict).toBe(true);
    expect(saves).toHaveLength(1);
    // 注定失败的标题请求根本没发出去，正文照常落库
    expect(saves[0]!.draft.titleChanged).toBe(false);
    expect(saves[0]!.draft.contentChanged).toBe(true);
    expect(saves[0]!.draft.content).toBe("冲突期间写下的正文");
    expect(failures).toEqual([]);
  });

  test("输入恢复合法后提示立即消失，标题重新可提交", async () => {
    const { result, saves } = mountSession(
      (title) => title === "熵与妄作",
      async (draft) => treeNode(draft.titleChanged ? draft.title : "草稿"),
    );

    await act(async () => {
      result.result.current.updateTitle("熵与妄作");
    });
    expect(result.result.current.titleConflict).toBe(true);

    await act(async () => {
      result.result.current.updateTitle("熵与妄作 2");
    });
    expect(result.result.current.titleConflict).toBe(false);

    await act(async () => {
      await result.result.current.flush();
    });
    expect(saves.at(-1)!.draft.titleChanged).toBe(true);
    expect(saves.at(-1)!.draft.title).toBe("熵与妄作 2");
  });

  test("服务端唯一约束驳回：不弹失败 Toast，改为挂起标题并把正文补发出去", async () => {
    const { failures, result, saves } = mountSession(
      () => false,
      async (draft) => {
        if (draft.titleChanged) {
          throw new ApiError(409, "MEMO_TITLE_CONFLICT", "taken");
        }
        return treeNode("草稿");
      },
    );

    await act(async () => {
      result.result.current.updateTitle("被别人抢走的名字");
      result.result.current.updateContent("冲突期间写下的正文");
    });
    await act(async () => {
      await result.result.current.flush();
    });

    await waitFor(() => {
      expect(saves.filter((save) => !save.draft.titleChanged)).toHaveLength(1);
    });

    expect(result.result.current.titleConflict).toBe(true);
    // 第一次带标题被驳回，随后自动补发一次只带正文的提交
    expect(saves[0]!.draft.titleChanged).toBe(true);
    expect(saves.at(-1)!.draft.contentChanged).toBe(true);
    expect(saves.at(-1)!.draft.content).toBe("冲突期间写下的正文");
    // 冲突不是"自动保存失败"，它由标题区的原位提示承担
    expect(failures).toEqual([]);
    // 用户输入必须留在原地，不被静默回滚
    expect(result.result.current.title).toBe("被别人抢走的名字");
  });
});
