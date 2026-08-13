/**
 * [INPUT]: 接收主线程发来的工具 command、已校验 input 与 Zustand active tree 结构化克隆快照
 * [OUTPUT]: 向主线程返回纯读结果或可交给现有乐观 Store/API Command 的类型化单步计划
 * [POS]: AgentPanel 专用 Web Worker 入口，把胖工具规划移出 UI 线程；不持有 token、不访问 API/DOM/Zustand
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { MemoTreeNode } from "../../shared/api/memo";
import {
  planMemoTool,
  type MemoToolCommand,
  type MemoToolPlan,
} from "./memoToolPlanner";

export type MemoToolWorkerRequest = {
  command: MemoToolCommand;
  input: unknown;
  nodes: MemoTreeNode[];
  requestId: string;
};

export type MemoToolWorkerResponse =
  | { ok: true; plan: MemoToolPlan; requestId: string }
  | { error: string; ok: false; requestId: string };

type MemoToolWorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<MemoToolWorkerRequest>) => void,
  ): void;
  postMessage(message: MemoToolWorkerResponse): void;
};

const workerScope = self as unknown as MemoToolWorkerScope;

workerScope.addEventListener(
  "message",
  (event: MessageEvent<MemoToolWorkerRequest>) => {
    const { command, input, nodes, requestId } = event.data;

    try {
      workerScope.postMessage({
        ok: true,
        plan: planMemoTool(command, input, nodes),
        requestId,
      } satisfies MemoToolWorkerResponse);
    } catch (error) {
      workerScope.postMessage({
        error: error instanceof Error ? error.message : "工具规划失败。",
        ok: false,
        requestId,
      } satisfies MemoToolWorkerResponse);
    }
  },
);
