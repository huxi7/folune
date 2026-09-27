/**
 * [INPUT]: 依赖明确批量 schema、纯 Planner、共享队列、执行/停止/检查点回调与可信树快照
 * [OUTPUT]: 提供整批预检与逐项执行；最多八项全局在途，失败停止本批排队，已提交项收取结果
 * [POS]: AgentPanel 批量编排边界；每项复用原子 command 和稳定幂等键，检查点合并在途更新并保留计划供刷新恢复
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { AiCommand } from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import { findNode } from "../../shared/store/memoTree";
import { createClientToolQueue, CLIENT_TOOL_CONCURRENCY } from "./clientToolQueue";
import { editNodesInputSchema } from "./memoToolSchemas";
import { planMemoTool, type MemoToolPlan } from "./memoToolPlanner";
import type { BatchSnapshot } from "./toolExecutionState";

export async function prepareBatch(input: unknown, callId: string, nodes: readonly MemoTreeNode[]): Promise<BatchSnapshot> {
  const parsed = editNodesInputSchema.parse(input);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(callId));
  const prefix = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { kind: "memo-batch", items: parsed.targets.map((target, index) => {
    const node = findNode(nodes, target.node_id);
    if (node?.node_type !== "memo") throw new Error("批量工具只处理备忘录；目标不存在或类型已变化，请重新读取。");
    return {
      id: `batch-${prefix}-${index}`, title: node.title, state: "queued",
      plan: planMemoTool("edit_node", { ...target, op: parsed.op, ...(parsed.op === "move" ? { parent_id: parsed.parent_id } : {}) }, nodes),
    };
  }) };
}

export async function executeBatch(options: {
  snapshot: BatchSnapshot;
  queue: ReturnType<typeof createClientToolQueue>;
  stopped: () => boolean;
  execute: (plan: MemoToolPlan, id: string) => Promise<AiCommand>;
  publish: (snapshot: BatchSnapshot) => void;
  checkpoint: (snapshot: BatchSnapshot) => Promise<void>;
}): Promise<BatchSnapshot> {
  const recovering = new Set(options.snapshot.items.filter((item) => item.state === "running").map((item) => item.id));
  let snapshot: BatchSnapshot = { ...options.snapshot, items: options.snapshot.items.map((item) => ({ ...item, state: item.state === "running" ? "queued" : item.state })) };
  let failed = snapshot.items.some((item) => item.state === "failed");
  let settled = 0;
  let saving: Promise<void> | undefined;
  let latestCheckpoint: BatchSnapshot | undefined;
  const scheduleCheckpoint = (batch: BatchSnapshot) => {
    latestCheckpoint = batch;
    if (saving) return;
    saving = (async () => {
      while (latestCheckpoint) {
        const latest = latestCheckpoint;
        latestCheckpoint = undefined;
        try { await options.checkpoint(latest); } catch { failed = true; }
      }
    })().finally(() => { saving = undefined; });
  };
  const update = (index: number, patch: Partial<BatchSnapshot["items"][number]>) => {
    snapshot = { ...snapshot, items: snapshot.items.map((item, i) => i === index ? { ...item, ...patch } : item) };
    options.publish(snapshot);
  };
  options.publish(snapshot);
  // 先保存完整计划，再开始写入；刷新后用同一幂等键补取结果，不重新猜测目标。
  await options.checkpoint(snapshot);
  await Promise.all(snapshot.items.map(async (item, index) => {
    if (item.state !== "queued") return;
    try {
      await options.queue.run(async () => {
        if (options.stopped() || (failed && !recovering.has(item.id))) { update(index, { state: "cancelled" }); return; }
        update(index, { state: "running" });
        try {
          const output = await options.execute(item.plan, item.id);
          if (output.status !== "succeeded") failed = true;
          update(index, { output, state: output.status === "succeeded" ? "succeeded" : "failed", error: output.status === "succeeded" ? undefined : "操作未完成，请核对后重试。" });
        } catch (error) {
          failed = true;
          update(index, { state: "failed", error: error instanceof Error ? error.message : "操作未完成" });
        }
      });
    } catch { update(index, { state: "cancelled" }); }
    settled++;
    if (settled % CLIENT_TOOL_CONCURRENCY === 0) scheduleCheckpoint(snapshot);
  }));
  await saving;
  await options.checkpoint(snapshot).catch(() => undefined);
  return snapshot;
}
