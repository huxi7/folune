/**
 * [INPUT]: 依赖 Bun test 与真实 workspaceEntryStore
 * [OUTPUT]: 验证并行乱序、首屏门禁、重复通知、取消与旧请求隔离，不用计时器伪造加载
 * [POS]: shared/store 的入口状态回归门禁
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { beforeEach, expect, test } from "bun:test";
import { getWorkspaceEntryProgress, useWorkspaceEntryStore } from "./workspaceEntryStore";
const store = useWorkspaceEntryStore;
beforeEach(() => store.getState().dismiss(store.getState().id));

test("并行加载乱序完成只累加真实权重，首屏尚未提交不能到 100%", () => {
  const id = store.getState().begin();
  for (const step of ["module", "tree", "session", "profile"] as const) {
    store.getState().finishStep(id, step);
  }
  expect(getWorkspaceEntryProgress(store.getState().completed)).toEqual({ progress: 86, label: "打开你的内容" });
  expect(store.getState().phase).toBe("loading");
  store.getState().finishStep(id, "content");
  expect(getWorkspaceEntryProgress(store.getState().completed).progress).toBe(100);
  expect(store.getState().phase).toBe("complete");
});

test("StrictMode 或重复就绪通知不重复累加", () => {
  const id = store.getState().begin();
  store.getState().finishStep(id, "session");
  store.getState().finishStep(id, "session");
  expect(getWorkspaceEntryProgress(store.getState().completed).progress).toBe(28);
});

test("失败或离开后，迟到响应和旧动画不能推进或关闭新入口", () => {
  const oldId = store.getState().begin();
  store.getState().dismiss(oldId);
  store.getState().finishStep(oldId, "content");
  expect(store.getState().phase).toBe("idle");
  const newId = store.getState().begin();
  store.getState().finishStep(oldId, "tree");
  store.getState().dismiss(oldId);
  expect(store.getState().id).toBe(newId);
  expect(store.getState().phase).toBe("loading");
  expect(store.getState().completed).toEqual([]);
});
