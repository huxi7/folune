/**
 * [INPUT]: 依赖 Zustand；路由 loader 与首屏内容只报告已完成的真实加载节点
 * [OUTPUT]: 对外提供可取消、按入口编号隔离的工作区加载进度与一次性完成状态
 * [POS]: shared/store 的短期 UI 状态，不保存业务数据；并行节点按权重累加，旧请求不能推进新入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { create } from "zustand";

export const WORKSPACE_ENTRY_STEPS = [
  { key: "session", weight: 20, label: "连接云端" },
  { key: "profile", weight: 18, label: "确认账户" },
  { key: "tree", weight: 24, label: "读取文件目录" },
  { key: "module", weight: 16, label: "准备工作空间" },
  { key: "content", weight: 14, label: "打开你的内容" },
] as const;
export type WorkspaceEntryStep = typeof WORKSPACE_ENTRY_STEPS[number]["key"];
export type WorkspaceEntryPhase = "idle" | "loading" | "complete";

type WorkspaceEntryState = {
  id: number;
  phase: WorkspaceEntryPhase;
  completed: readonly WorkspaceEntryStep[];
  begin(): number;
  finishStep(id: number, step: WorkspaceEntryStep): void;
  dismiss(id: number): void;
};

export function getWorkspaceEntryProgress(completed: readonly WorkspaceEntryStep[]) {
  const progress = 8 + WORKSPACE_ENTRY_STEPS.reduce(
    (total, step) => total + (completed.includes(step.key) ? step.weight : 0), 0,
  );
  const label = WORKSPACE_ENTRY_STEPS.find((step) => !completed.includes(step.key))?.label
    ?? "一切就绪";
  return { progress, label };
}

export const useWorkspaceEntryStore = create<WorkspaceEntryState>((set, get) => ({
  id: 0,
  phase: "idle",
  completed: [],
  begin() {
    const id = get().id + 1;
    set({ id, phase: "loading", completed: [] });
    return id;
  },
  finishStep(id, step) {
    const state = get();
    if (state.id !== id || state.phase !== "loading" || state.completed.includes(step)) return;
    const completed = [...state.completed, step];
    set({ completed, phase: completed.length === WORKSPACE_ENTRY_STEPS.length ? "complete" : "loading" });
  },
  dismiss(id) {
    if (get().id === id) set({ phase: "idle", completed: [] });
  },
}));
