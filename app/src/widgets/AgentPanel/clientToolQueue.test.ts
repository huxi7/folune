/**
 * [INPUT]: 依赖 Bun test、可控任务与 clientToolQueue
 * [OUTPUT]: 验证百项背压、失败释放执行槽及停止后只收取在途结果
 * [POS]: 客户端批量工具调度回归门禁，不访问真实笔记
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { createClientToolQueue, CLIENT_TOOL_CONCURRENCY } from "./clientToolQueue";

test("98 项任务始终最多四项在途，每项只执行一次且失败不阻塞后续", async () => {
  const queue = createClientToolQueue();
  let active = 0;
  let peak = 0;
  const started: number[] = [];
  const results = await Promise.allSettled(Array.from({ length: 98 }, (_, index) => queue.run(async () => {
    active++;
    peak = Math.max(peak, active);
    started.push(index);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    if (index === 30) throw new Error("失败");
    return index;
  })));
  expect(peak).toBe(CLIENT_TOOL_CONCURRENCY);
  expect(new Set(started).size).toBe(98);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(97);
  expect(results[30]?.status).toBe("rejected");
});

test("停止取消排队任务，已经开始的命令保留实际结果，队列之后仍可使用", async () => {
  const queue = createClientToolQueue(1);
  let finish!: (value: string) => void;
  let started = 0;
  const first = queue.run(() => new Promise<string>((resolve) => { finish = resolve; }));
  const pending = queue.run(async () => { started++; return "不应开始"; });
  const result = Promise.allSettled([first, pending]);
  queue.cancelPending();
  finish("已完成");
  expect(await result).toMatchObject([{ status: "fulfilled", value: "已完成" }, { status: "rejected" }]);
  expect(started).toBe(0);
  expect(await queue.run(async () => "新任务")).toBe("新任务");
});
