/**
 * [INPUT]: 依赖 happy-dom、Testing Library、真实 AppSidebar 与可控的节点身份对账
 * [OUTPUT]: 验证主按钮/右键创建均即时插入，已有展开/折叠与 DOM 实例保留，连续新建及乱序落库不重挂；删除别处节点不把用户收起的目录撑回，定位目标被搬进收起目录才跟随展开
 * [POS]: 新建笔记的文件树交互门禁；服务端事务由 memoTreeStore.test 覆盖，此处只核对实际组件状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { useLayoutEffect, useState, type ComponentProps } from "react";
import type { MemoTreeNode } from "../shared/api/memo";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
  CSS: browserWindow.CSS,
});
window.matchMedia = ((query: string) => ({ matches: true, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
})) as typeof window.matchMedia;
const { act, cleanup, fireEvent, render } = await import("@testing-library/react/pure");
const { AppSidebar } = await import("./AppSidebar");
const { ToastProvider } = await import("../shared/design-system/components/Toast");
const { useMemoTreeStore } = await import("../shared/store/memoTreeStore");
const originalClientKey = useMemoTreeStore.getState().getMemoClientKey;
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  useMemoTreeStore.setState({ getMemoClientKey: originalClientKey });
});

const noop = () => undefined;
const node = (id: string, parent: string | null, children?: MemoTreeNode[]): MemoTreeNode => ({
  id, parent_id: parent, children: children ?? [], node_type: children ? "folder" : "memo",
  title: id, sort_order: "0", revision: 1, user_id: "test-user", metadata: {},
  memo: null, icon: null, color: null, deleted_at: null, deleted_root_id: null,
  created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z",
});
const baseProps: Omit<ComponentProps<typeof AppSidebar>, "memoTree" | "onCreateMemo" | "selectedMemoId"> = {
  activeView: "note", archiveTarget: null, mutating: false, onClose: noop,
  onCreateCanvas: noop, onMoveNode: async () => true, onPrefetchMemo: noop,
  onOpenDesignSystem: noop, onOpenProfile: noop, onOpenSettings: noop, onOpenSearch: noop,
  onOpenSubscription: noop, onRenameNode: async () => undefined, onSoftDeleteNode: async () => undefined,
  onRequestCreateFolder: noop, onSelectMemo: noop, onSelectView: noop, onSignOut: async () => undefined,
  profile: { id: "test-user", username: "Test", avatarUrl: null, bio: null, email: null },
  reveal: null, revealContent: false, skeletonVisible: false, treeStatus: "ready",
};

test("新建与乱序确认全过程保留目录开合及已有行实例", async () => {
  window.localStorage.setItem("folune:memo-tree-expanded:test-user", JSON.stringify({ version: 1, expanded: ["open"] }));
  let commit!: (id: string) => void;
  let fail!: (id: string) => void;
  let count = 0;
  const aliases = new Map<string, string>();
  useMemoTreeStore.setState({ getMemoClientKey: (id) => aliases.get(id) ?? id });
  function Harness() {
    const [tree, setTree] = useState([node("open", null, [node("existing", "open")]), node("closed", null, [node("hidden", "closed")])]);
    const [selected, setSelected] = useState("existing");
    useLayoutEffect(() => {
      commit = (id) => {
        aliases.set(`server-${id}`, id);
        setTree((current) => current.map((folder) => ({ ...folder, children: folder.children.map((child) => child.id === id ? { ...child, id: `server-${id}` } : child) })));
      };
      fail = (id) => setTree((current) => current.map((folder) => ({ ...folder, children: folder.children.filter((child) => child.id !== id) })));
    }, []);
    return <AppSidebar {...baseProps} memoTree={tree} selectedMemoId={selected} onCreateMemo={(parent) => {
      const id = `new-${++count}`;
      setTree((current) => current.map((folder) => folder.id === parent ? { ...folder, children: [node(id, parent), ...folder.children] } : folder));
      setSelected(id);
    }} />;
  }
  const view = render(<ToastProvider><Harness /></ToastProvider>);
  const treeElement = view.getByRole("tree");
  const row = view.getByRole("button", { name: "existing" });
  const open = view.getByRole("button", { name: "open" }).closest('[role="treeitem"]');
  const closed = view.getByRole("button", { name: "closed" }).closest('[role="treeitem"]');
  const body = open?.querySelector("[data-collapse]");
  const mutations: { attributeName: string | null }[] = [];
  const observer = new browserWindow.MutationObserver((records) => mutations.push(...records));
  observer.observe(open as unknown as InstanceType<typeof browserWindow.Node>, { attributes: true, attributeOldValue: true, subtree: true });
  treeElement.scrollTop = 120;
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  const first = view.getByRole("button", { name: "new-1" });
  fireEvent.contextMenu(row, { clientX: 20, clientY: 20 });
  fireEvent.click(view.getByRole("menuitem", { name: "新建备忘录" }));
  const second = view.getByRole("button", { name: "new-2" });
  await act(async () => commit("new-2"));
  await act(async () => commit("new-1"));
  expect(view.getByRole("button", { name: "new-1" })).toBe(first);
  expect(view.getByRole("button", { name: "new-2" })).toBe(second);
  expect(second.getAttribute("aria-current")).toBe("page");
  expect(view.getByRole("button", { name: "existing" })).toBe(row);
  expect(open?.querySelector("[data-collapse]")).toBe(body);
  expect(open?.getAttribute("aria-expanded")).toBe("true");
  expect(closed?.getAttribute("aria-expanded")).toBe("false");
  expect(view.queryByRole("button", { name: "hidden" })).toBeNull();
  expect(treeElement.scrollTop).toBe(120);
  mutations.push(...observer.takeRecords());
  expect(mutations.filter((record) => record.attributeName === "aria-expanded" || record.attributeName === "inert")).toHaveLength(0);
  observer.disconnect();
  // 请求失败只撤回自己的乐观行，不卸载旧树。
  fireEvent.click(view.getByRole("button", { name: "新建备忘录" }));
  await act(async () => fail("new-3"));
  expect(view.queryByRole("button", { name: "new-3" })).toBeNull();
  expect(view.getByRole("button", { name: "existing" })).toBe(row);
});

// 别处的增删只是树变了、定位目标没变：不得把用户亲手收起的目录撑回来
test("删除别处节点不重放定位，目标被搬走才跟过去", async () => {
  window.localStorage.setItem("folune:memo-tree-expanded:test-user", JSON.stringify({ version: 1, expanded: ["open"] }));
  let removeOther!: () => void;
  let moveSelected!: () => void;
  function Harness() {
    const [tree, setTree] = useState([
      node("open", null, [node("existing", "open")]),
      node("closed", null, [node("hidden", "closed")]),
      node("other", null),
    ]);
    useLayoutEffect(() => {
      removeOther = () => setTree((current) => current.filter((item) => item.id !== "other"));
      moveSelected = () => setTree((current) => current.map((folder) => folder.id === "open"
        ? { ...folder, children: [] }
        : folder.id === "closed" ? { ...folder, children: [...folder.children, node("existing", "closed")] } : folder));
    }, []);
    return <AppSidebar {...baseProps} memoTree={tree} selectedMemoId="existing" onCreateMemo={noop} />;
  }
  const view = render(<ToastProvider><Harness /></ToastProvider>);
  const folder = (name: string) => view.getByRole("button", { name }).closest('[role="treeitem"]');
  fireEvent.click(view.getByRole("button", { name: "open" }));
  expect(folder("open")?.getAttribute("aria-expanded")).toBe("false");

  await act(async () => removeOther());
  expect(folder("open")?.getAttribute("aria-expanded")).toBe("false");

  await act(async () => moveSelected());
  expect(folder("closed")?.getAttribute("aria-expanded")).toBe("true");
});
