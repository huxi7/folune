/**
 * [INPUT]: 依赖真实批量编排/队列、可控结果与纯树快照
 * [OUTPUT]: 验证八项全局并发、空槽补位、部分失败、停止、检查点恢复及协议同构
 * [POS]: AgentPanel 批量执行契约测试，不访问真实业务数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import type { AiCommand } from "../../shared/api/ai";
import type { MemoTreeNode } from "../../shared/api/memo";
import { executeBatch, prepareBatch } from "./batchToolExecution";
import { createClientToolQueue } from "./clientToolQueue";
import { editNodesInputSchema } from "./memoToolSchemas";
import type { BatchSnapshot } from "./toolExecutionState";
import { deriveAgentMessagePresentation } from "./messagePresentation";

const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const input = (count: number) => ({ op: "delete", targets: Array.from({ length: count }, (_, i) => ({ node_id: id(i), expected_revision: 1 })) });
const tree = (count: number) => Array.from({ length: count }, (_, i) => ({ id: id(i), title: `备忘录 ${i}`, node_type: "memo", revision: 1, children: [], parent_id: null }) as unknown as MemoTreeNode);
const success = (id: string) => ({ id, operation: "trash_node", status: "succeeded", tool_call_id: id }) as AiCommand;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("批量协议双端一致，重复目标和缺失改名/移动参数拒绝", async () => {
  const server = await Bun.file(new URL("../../../../chat/src/mastra/tools/memo.ts", import.meta.url)).text();
  const client = await Bun.file(new URL("./memoToolSchemas.ts", import.meta.url)).text();
  const schema = (source: string) => source.slice(source.indexOf("export const editNodesInputSchema"), source.indexOf("\n});", source.indexOf("export const editNodesInputSchema")) + 4);
  expect(schema(client)).toBe(schema(server));
  expect(editNodesInputSchema.safeParse({ ...input(2), targets: [input(1).targets[0], input(1).targets[0]] }).success).toBeFalse();
  expect(editNodesInputSchema.safeParse({ ...input(2), op: "move" }).success).toBeFalse();
  expect(editNodesInputSchema.safeParse({ ...input(2), op: "rename" }).success).toBeFalse();
  await expect(prepareBatch(input(2), "x", [{ ...tree(2)[0]!, node_type: "folder" }, tree(2)[1]!])).rejects.toThrow("只处理备忘录");
});

test("100 项批量共享八槽，任一完成立即补位，最终结果与撤销不丢项", async () => {
  const snapshot = await prepareBatch(input(100), "batch", tree(100));
  const pending: Array<{ id: string; resolve: (command: AiCommand) => void }> = [];
  let latest = snapshot;
  const saved: BatchSnapshot[] = [];
  const run = executeBatch({ snapshot, queue: createClientToolQueue(), stopped: () => false,
    execute: (_plan, id) => new Promise((resolve) => pending.push({ id, resolve })),
    publish: (batch) => { latest = batch; }, checkpoint: async (batch) => { saved.push(batch); },
  });
  await tick();
  expect(pending).toHaveLength(8);
  expect(latest.items.filter((item) => item.state === "running")).toHaveLength(8);
  pending[3]!.resolve(success(pending[3]!.id));
  await tick();
  expect(pending).toHaveLength(9);
  expect(latest.items[3]!.state).toBe("succeeded");
  for (let i = 0; i < 100; i++) {
    if (i === 3) continue;
    while (!pending[i]) await tick();
    pending[i]!.resolve(success(pending[i]!.id));
  }
  const result = await run;
  expect(result.items.every((item) => item.state === "succeeded")).toBeTrue();
  expect(saved[0]!.items.every((item) => item.state === "queued")).toBeTrue();
  expect(saved.at(-1)).toBe(result);
  const presentation = deriveAgentMessagePresentation({ id: "a", role: "assistant", parts: [{ type: "dynamic-tool", toolName: "edit_nodes", toolCallId: "batch", input: input(100), state: "output-available", output: result }] });
  expect(presentation.undoCommands).toHaveLength(100);
});

test("失败停止本批未开始项；已执行项结果保留；停止同样不启动排队项", async () => {
  for (const stop of [false, true]) {
    const snapshot = await prepareBatch(input(30), "failure", tree(30));
    const pending: Array<(command: AiCommand) => void> = [];
    let stopped = false;
    const queue = createClientToolQueue();
    const run = executeBatch({ snapshot, queue, stopped: () => stopped,
      execute: () => new Promise((resolve) => pending.push(resolve)), publish: () => undefined, checkpoint: async () => undefined,
    });
    await tick();
    if (stop) { stopped = true; queue.cancelPending(); }
    pending.forEach((resolve, i) => resolve(i === 0 && !stop ? { ...success(String(i)), status: "stale" } : success(String(i))));
    const result = await run;
    expect(pending).toHaveLength(8);
    expect(result.items.filter((item) => item.state === "cancelled")).toHaveLength(22);
    expect(result.items.filter((item) => item.state === "succeeded")).toHaveLength(stop ? 8 : 7);
  }
});

test("检查点恢复不重跑成功项，在途项复用幂等键，初始落库失败零写入", async () => {
  const snapshot = await prepareBatch(input(12), "restore", tree(12));
  snapshot.items[0] = { ...snapshot.items[0]!, state: "succeeded", output: success("first") };
  snapshot.items[1] = { ...snapshot.items[1]!, state: "running" };
  const calls: string[] = [];
  const result = await executeBatch({ snapshot, queue: createClientToolQueue(), stopped: () => false,
    execute: async (_plan, id) => { calls.push(id); return success(id); }, publish: () => undefined, checkpoint: async () => undefined,
  });
  expect(calls).toHaveLength(11);
  expect(calls).toContain(snapshot.items[1]!.id);
  expect(result.items[0]!.output?.id).toBe("first");
  await expect(executeBatch({ snapshot, queue: createClientToolQueue(), stopped: () => false,
    execute: async () => { throw new Error("不应执行"); }, publish: () => undefined, checkpoint: async () => { throw new Error("保存失败"); },
  })).rejects.toThrow("保存失败");
});

test("慢检查点只保留在途和最新进度，不把百项完成变成保存长队列", async () => {
  const snapshot = await prepareBatch(input(100), "slow-checkpoint", tree(100));
  const checkpoints: BatchSnapshot[] = [];
  let release!: () => void;
  const result = executeBatch({ snapshot, queue: createClientToolQueue(), stopped: () => false,
    execute: async (_plan, id) => success(id), publish: () => undefined,
    checkpoint: async (batch) => {
      checkpoints.push(batch);
      if (checkpoints.length === 2) await new Promise<void>((resolve) => { release = resolve; });
    },
  });
  await tick();
  expect(checkpoints).toHaveLength(2);
  release();
  expect((await result).items.every((item) => item.state === "succeeded")).toBeTrue();
  expect(checkpoints.length).toBeLessThanOrEqual(4);
});

test("恢复含失败检查点仍补取之前在途命令的幂等结果，不启动未开始项", async () => {
  const snapshot = await prepareBatch(input(12), "part-failed", tree(12));
  snapshot.items[0] = { ...snapshot.items[0]!, state: "failed" };
  snapshot.items[1] = { ...snapshot.items[1]!, state: "running" };
  const calls: string[] = [];
  const result = await executeBatch({ snapshot, queue: createClientToolQueue(), stopped: () => false,
    execute: async (_plan, id) => { calls.push(id); return success(id); }, publish: () => undefined, checkpoint: async () => undefined,
  });
  expect(calls).toEqual([snapshot.items[1]!.id]);
  expect(result.items[1]!.state).toBe("succeeded");
  expect(result.items.filter((item) => item.state === "cancelled")).toHaveLength(10);
});
