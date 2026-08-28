/**
 * [INPUT]: 依赖 happy-dom、Testing Library、真实 WorkspaceCommandPalette/Dialog、memoTreeStore/recentNodesStore 与被替身接管的 /memo-search 响应
 * [OUTPUT]: 覆盖 ⌘K 双向开合、焦点稳定在输入框、查询变化后首项选中、方向键/Enter/Esc、IME 合成期 Enter 不跳转、Canvas 语境 ⌘Enter 连续加入、正文结果补入时 active 稳定与五种状态
 * [POS]: widgets 的全局搜索键盘状态机门禁；只驱动真实组件与真实 Store，不绕过组件去单测排序（排序归 commandResults.test）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";

import type { MemoTreeNode } from "../shared/api/memo";

const browserWindow = new Window({ url: "http://localhost:10000/app" });

Object.assign(globalThis, {
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
  CSS: { escape: (value: string) => value.replaceAll(/([^\w-])/gu, "\\$1") },
  document: browserWindow.document,
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  HTMLInputElement: browserWindow.HTMLInputElement,
  HTMLTextAreaElement: browserWindow.HTMLTextAreaElement,
  KeyboardEvent: browserWindow.KeyboardEvent,
  MouseEvent: browserWindow.MouseEvent,
  MutationObserver: browserWindow.MutationObserver,
  navigator: browserWindow.navigator,
  PointerEvent: browserWindow.PointerEvent,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  ResizeObserver: browserWindow.ResizeObserver,
  window: browserWindow,
});

const searchCalls: string[] = [];
let searchBehaviour: "empty" | "error" | "hit" = "hit";

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  if (url.includes("/memo-search")) {
    searchCalls.push(url);
    if (searchBehaviour === "error") {
      return new Response(JSON.stringify({ code: "boom", message: "boom" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }
    return new Response(
      JSON.stringify({
        code: "ok",
        data: searchBehaviour === "hit"
          ? [{ excerpt: null, node_id: "memo-body" }]
          : [],
        message: "OK",
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  }
  return await realFetch(input as RequestInfo, init);
}) as typeof fetch;

const { cleanup, fireEvent, render, waitFor } =
  await import("@testing-library/react/pure");
const { useMemoTreeStore } = await import("../shared/store/memoTreeStore");
const { useRecentNodesStore } = await import("../shared/store/recentNodesStore");
const { useCommandPaletteStore } = await import(
  "../shared/store/commandPaletteStore"
);
const { WorkspaceCommandPalette } = await import("./WorkspaceCommandPalette");

const TIME = "2026-08-28T00:00:00.000Z";
const node = (
  id: string,
  title: string,
  type: "canvas" | "folder" | "memo",
  extra: Partial<MemoTreeNode> = {},
): MemoTreeNode => ({
  children: [],
  color: null,
  created_at: TIME,
  deleted_at: null,
  deleted_root_id: null,
  icon: null,
  id,
  memo: type === "memo"
    ? {
      created_at: TIME,
      excerpt: null,
      metadata: {},
      node_id: id,
      updated_at: TIME,
      user_id: "user-1",
      word_count: 1,
    }
    : null,
  metadata: {},
  node_type: type,
  parent_id: null,
  revision: 3,
  sort_order: "1000",
  title,
  updated_at: TIME,
  user_id: "user-1",
  ...extra,
});

const tree: MemoTreeNode[] = [
  node("memo-a", "少则得", "memo"),
  node("memo-b", "少则得多则惑", "memo"),
  node("memo-body", "熵与妄作", "memo"),
  node("canvas-standalone", "空间草稿", "canvas", {
    canvas: { kind: "standalone", origin_node_id: null },
  }),
  node("canvas-default", "少则得", "canvas", {
    canvas: { kind: "memo_default", origin_node_id: "memo-a" },
  }),
];

const opened: string[] = [];
const openedCanvas: string[] = [];
const added: string[] = [];

const renderPalette = () => render(
  <WorkspaceCommandPalette
    accessToken="test-token"
    onOpenCanvas={(memoId) => openedCanvas.push(memoId)}
    onOpenNode={(nodeId) => opened.push(nodeId)}
  />,
);

const input = (): HTMLInputElement => {
  const element = document.querySelector<HTMLInputElement>(
    ".command-palette-input",
  );
  expect(element).not.toBeNull();
  return element!;
};

const rowIds = (): string[] =>
  [...document.querySelectorAll("[role=option]")]
    .map((row) => row.id.replace("workspace-command-option-", ""));

const activeRowId = (): string | null =>
  document.querySelector('[role=option][data-active="true"]')
    ?.id.replace("workspace-command-option-", "") ?? null;

const openPalette = () => {
  // happy-dom 的 Window 与 lib.dom 的 Window 不是同一个类型，但运行时就是它
  fireEvent.keyDown(
    browserWindow as unknown as Parameters<typeof fireEvent.keyDown>[0],
    { key: "k", metaKey: true },
  );
};

beforeEach(() => {
  searchCalls.length = 0;
  opened.length = 0;
  openedCanvas.length = 0;
  added.length = 0;
  searchBehaviour = "hit";
  useMemoTreeStore.setState({ nodes: tree });
  useRecentNodesStore.setState({ hydratedUserId: "user-1", order: ["memo-body"] });
  useCommandPaletteStore.setState({ canvas: null, open: false });
});

afterEach(() => {
  cleanup();
  useCommandPaletteStore.setState({ canvas: null, open: false });
});

describe("Command Palette 键盘状态机", () => {
  test("⌘K 打开并聚焦输入框，再按一次关闭", async () => {
    renderPalette();
    openPalette();

    await waitFor(() => {
      expect(document.activeElement).toBe(input());
    });
    // 空查询列最近打开
    expect(rowIds()).toEqual(["memo-body"]);

    openPalette();
    await waitFor(() => {
      expect(document.querySelector(".command-palette-input")).toBeNull();
    });
  });

  test("查询变化后首项自动选中，方向键循环移动", async () => {
    renderPalette();
    openPalette();
    await waitFor(() => expect(input()).toBeTruthy());

    fireEvent.change(input(), { target: { value: "少则得" } });
    await waitFor(() => expect(activeRowId()).toBe("memo-a"));
    // 默认画布不作为独立结果出现
    expect(rowIds()).not.toContain("canvas-default");

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(activeRowId()).toBe("memo-b");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(activeRowId()).toBe("memo-a");
    // 输入框始终持有焦点
    expect(document.activeElement).toBe(input());
  });

  test("Enter 打开选中对象并关闭；IME 合成期的 Enter 不跳转", async () => {
    renderPalette();
    openPalette();
    await waitFor(() => expect(input()).toBeTruthy());
    fireEvent.change(input(), { target: { value: "少则得" } });
    await waitFor(() => expect(activeRowId()).toBe("memo-a"));

    fireEvent.compositionStart(input());
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(opened).toEqual([]);

    fireEvent.compositionEnd(input());
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(opened).toEqual(["memo-a"]);
    await waitFor(() => {
      expect(document.querySelector(".command-palette-input")).toBeNull();
    });
  });

  test("Esc 关闭，且没有结果时 Enter 无副作用", async () => {
    searchBehaviour = "empty";
    renderPalette();
    openPalette();
    await waitFor(() => expect(input()).toBeTruthy());

    fireEvent.change(input(), { target: { value: "不存在的词" } });
    await waitFor(() => expect(rowIds()).toEqual([]));
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(opened).toEqual([]);
    // loading 与 empty 是两种状态: 正文还在防抖时说"正在搜索", 落地后才说"没有匹配"
    expect(document.querySelector(".command-palette-status")?.textContent)
      .toContain("正在搜索");
    await waitFor(() => {
      expect(document.querySelector(".command-palette-status")?.textContent)
        .toContain("没有与");
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(document.querySelector(".command-palette-input")).toBeNull();
    });
  });

  test("正文命中在防抖后补入，且不把选中项挪走", async () => {
    renderPalette();
    openPalette();
    await waitFor(() => expect(input()).toBeTruthy());

    fireEvent.change(input(), { target: { value: "少则得" } });
    await waitFor(() => expect(activeRowId()).toBe("memo-a"));
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(activeRowId()).toBe("memo-b");

    // 正文命中把 memo-body 追加进列表；选中项必须仍是 memo-b
    await waitFor(() => expect(rowIds()).toContain("memo-body"));
    expect(activeRowId()).toBe("memo-b");
  });

  test("Canvas 语境：Enter 打开笔记，⌘Enter 加入且面板保持打开", async () => {
    useCommandPaletteStore.setState({
      canvas: {
        canvasId: "canvas-1",
        onAdd: async (target) => {
          added.push(target.id);
        },
      },
    });
    renderPalette();
    openPalette();
    await waitFor(() => expect(input()).toBeTruthy());
    fireEvent.change(input(), { target: { value: "少则得" } });
    await waitFor(() => expect(activeRowId()).toBe("memo-a"));

    fireEvent.keyDown(input(), { key: "Enter", metaKey: true });
    await waitFor(() => expect(added).toEqual(["memo-a"]));
    // 连续加入: 面板还开着, 查询已清空, 就地给回执
    expect(document.querySelector(".command-palette-input")).not.toBeNull();
    expect(input().value).toBe("");
    expect(document.querySelector(".command-palette-status")?.textContent)
      .toContain("已加入");
    expect(opened).toEqual([]);
  });

  test("Canvas 语境只允许加入笔记：画布与文件夹没有加入入口", async () => {
    useCommandPaletteStore.setState({
      canvas: {
        canvasId: "canvas-1",
        onAdd: async (target) => {
          added.push(target.id);
        },
      },
    });
    renderPalette();
    openPalette();
    await waitFor(() => expect(input()).toBeTruthy());
    fireEvent.change(input(), { target: { value: "空间草稿" } });
    await waitFor(() => expect(activeRowId()).toBe("canvas-standalone"));

    const row = document.querySelector(
      "#workspace-command-option-canvas-standalone",
    );
    expect([...row!.querySelectorAll("button")]
      .map((button) => button.getAttribute("aria-label"))
      .filter(Boolean)).toEqual([]);
    // ⌘Enter 对画布行无副作用, 面板也不会误报"已加入"
    fireEvent.keyDown(input(), { key: "Enter", metaKey: true });
    expect(added).toEqual([]);
  });

  test("正文搜索失败只报告状态，不关闭面板也不清空标题结果", async () => {
    searchBehaviour = "error";
    renderPalette();
    openPalette();
    await waitFor(() => expect(input()).toBeTruthy());
    fireEvent.change(input(), { target: { value: "少则得" } });

    await waitFor(() => {
      expect(document.querySelector(".command-palette-status")?.textContent)
        .toContain("正文搜索暂时不可用");
    });
    expect(rowIds()).toContain("memo-a");
    expect(document.querySelector(".command-palette-input")).not.toBeNull();
  });
});
