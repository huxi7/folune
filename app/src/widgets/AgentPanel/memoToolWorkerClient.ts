/**
 * [INPUT]: 依赖 memoTool.worker 模块 URL、MemoTree Store 当前快照与 requestId 消息协议
 * [OUTPUT]: 对外提供 MemoToolWorkerClient 与 requestMemoToolPlan，复用并发请求、转发计划并在 Worker 异常时统一失败
 * [POS]: AgentPanel 主线程到 Worker 的并发安全 RPC 桥；只搬运快照和关联 ID，不执行审批、Store 投影或业务写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useMemoTreeStore } from "../../shared/store/memoTreeStore";
import type { MemoToolCommand, MemoToolPlan } from "./memoToolPlanner";
import type {
  MemoToolWorkerRequest,
  MemoToolWorkerResponse,
} from "./memoTool.worker";

type PendingRequest = {
  promise: Promise<MemoToolPlan>;
  reject: (error: Error) => void;
  resolve: (plan: MemoToolPlan) => void;
};

export type MemoToolWorkerLike = {
  addEventListener(
    type: "message" | "error",
    listener: EventListenerOrEventListenerObject,
  ): void;
  postMessage(message: MemoToolWorkerRequest): void;
  terminate(): void;
};

export class MemoToolWorkerClient {
  private worker: MemoToolWorkerLike | null = null;
  private readonly pending = new Map<string, PendingRequest>();

  constructor(private readonly createWorker: () => MemoToolWorkerLike) {}

  request(request: MemoToolWorkerRequest): Promise<MemoToolPlan> {
    const duplicate = this.pending.get(request.requestId);
    if (duplicate !== undefined) return duplicate.promise;

    let resolve!: PendingRequest["resolve"];
    let reject!: PendingRequest["reject"];
    const promise = new Promise<MemoToolPlan>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    this.pending.set(request.requestId, { promise, reject, resolve });

    try {
      this.getWorker().postMessage(request);
    } catch (error) {
      this.pending.delete(request.requestId);
      reject(error instanceof Error ? error : new Error("无法启动备忘录工具 Worker。"));
    }
    return promise;
  }

  private getWorker(): MemoToolWorkerLike {
    if (this.worker !== null) return this.worker;
    const worker = this.createWorker();
    worker.addEventListener("message", ((event: MessageEvent<MemoToolWorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (pending === undefined) return;
      this.pending.delete(response.requestId);
      if (response.ok) pending.resolve(response.plan);
      else pending.reject(new Error(response.error));
    }) as EventListener);
    worker.addEventListener("error", (() => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("备忘录工具 Worker 异常退出，请重试。"));
      }
      this.pending.clear();
      worker.terminate();
      this.worker = null;
    }) as EventListener);
    this.worker = worker;
    return worker;
  }
}

const memoToolWorkerClient = new MemoToolWorkerClient(
  () => new Worker(new URL("./memoTool.worker.ts", import.meta.url), {
    name: "supernote-memo-tools",
    type: "module",
  }),
);

export function requestMemoToolPlan(
  command: MemoToolCommand,
  input: unknown,
  requestId: string = crypto.randomUUID(),
): Promise<MemoToolPlan> {
  return memoToolWorkerClient.request({
    command,
    input,
    nodes: useMemoTreeStore.getState().nodes,
    requestId,
  });
}
