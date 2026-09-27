/**
 * [INPUT]: 依赖 React 上下文、Zustand 定点订阅与工具执行器发布的真实生命周期，不推断 SDK 参数状态
 * [OUTPUT]: 提供会话隔离的执行状态上下文；等待/执行/结果分离，批量快照供 UI 与持久化共用
 * [POS]: AgentPanel 执行事实到界面的桥梁，不拥有工具调度或网络，不复制聊天消息
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createContext, useContext } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import type { AiCommand } from "../../shared/api/ai";
import type { MemoToolPlan } from "./memoToolPlanner";

export type ExecutionState = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type BatchItem = {
  id: string;
  title: string;
  state: ExecutionState;
  plan: MemoToolPlan;
  output?: AiCommand;
  error?: string;
};
export type BatchSnapshot = { kind: "memo-batch"; items: BatchItem[] };
export type ExecutionSnapshot = { state: ExecutionState; batch?: BatchSnapshot };

export function createToolExecutionStore() {
  const store = createStore<{ states: ReadonlyMap<string, ExecutionSnapshot> }>(() => ({ states: new Map() }));
  return {
    store,
    get: (id: string) => store.getState().states.get(id),
    set(id: string, state: ExecutionSnapshot) {
      store.setState(({ states }) => ({ states: new Map(states).set(id, state) }));
    },
  };
}
export const ToolExecutionContext = createContext<ReturnType<typeof createToolExecutionStore> | null>(null);
const emptyStore = createToolExecutionStore();
export function useToolExecution(id: string) {
  const source = useContext(ToolExecutionContext) ?? emptyStore;
  return useStore(source.store, (state) => state.states.get(id));
}
export function readBatchSnapshot(value: unknown): BatchSnapshot | undefined {
  if (!value || typeof value !== "object") return;
  const batch = value as BatchSnapshot;
  if (batch.kind === "memo-batch" && Array.isArray(batch.items)) return batch;
}
export function readToolCommands(value: unknown): AiCommand[] {
  const batch = readBatchSnapshot(value);
  if (batch) return batch.items.flatMap((item) => item.output ? [item.output] : []);
  if (value && typeof value === "object" && "id" in value && "operation" in value && "status" in value) return [value as AiCommand];
  return [];
}
