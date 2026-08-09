/**
 * [INPUT]: 依赖 memoTool.worker 模块 URL、MemoTree Store 当前快照与 Worker 消息协议
 * [OUTPUT]: 对外提供 requestMemoToolPlan，把每次工具输入和最新 active tree 快照交给专用 Worker 并等待对应计划
 * [POS]: AgentPanel 主线程到 Worker 的并发安全 RPC 桥；只搬运快照和关联 requestId，不执行业务写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import type { MemoToolCommand, MemoToolPlan } from "./memoToolPlanner";
import type {
  MemoToolWorkerRequest,
  MemoToolWorkerResponse,
} from "./memoTool.worker";

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (plan: MemoToolPlan) => void;
};

let memoToolWorker: Worker | null = null;
const pendingRequests = new Map<string, PendingRequest>();

const rejectAll = (message: string) => {
  for (const pending of pendingRequests.values()) {
    pending.reject(new Error(message));
  }
  pendingRequests.clear();
};

const getMemoToolWorker = (): Worker => {
  if (memoToolWorker !== null) {
    return memoToolWorker;
  }

  const worker = new Worker(new URL("./memoTool.worker.ts", import.meta.url), {
    name: "supernote-memo-tools",
    type: "module",
  });

  worker.addEventListener(
    "message",
    (event: MessageEvent<MemoToolWorkerResponse>) => {
      const response = event.data;
      const pending = pendingRequests.get(response.requestId);

      if (pending === undefined) {
        return;
      }

      pendingRequests.delete(response.requestId);

      if (response.ok) {
        pending.resolve(response.plan);
      } else {
        pending.reject(new Error(response.error));
      }
    },
  );
  worker.addEventListener("error", () => {
    rejectAll("备忘录工具 Worker 异常退出，请重试。");
    worker.terminate();
    memoToolWorker = null;
  });
  memoToolWorker = worker;

  return worker;
};

export function requestMemoToolPlan(
  command: MemoToolCommand,
  input: unknown,
): Promise<MemoToolPlan> {
  const requestId = crypto.randomUUID();
  const request: MemoToolWorkerRequest = {
    command,
    input,
    nodes: useMemoTreeStore.getState().nodes,
    requestId,
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { reject, resolve });

    try {
      getMemoToolWorker().postMessage(request);
    } catch (error) {
      pendingRequests.delete(requestId);
      reject(error instanceof Error ? error : new Error("无法启动备忘录工具 Worker。"));
    }
  });
}

