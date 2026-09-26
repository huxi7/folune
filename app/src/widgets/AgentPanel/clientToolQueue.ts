/**
 * [INPUT]: 依赖调用方提供的惰性工具任务，不读取 Store 或网络
 * [OUTPUT]: 对外提供有界并发队列；停止只取消尚未开始的任务，已提交命令继续收取真实结果
 * [POS]: AgentConversation 的背压边界，规划和乐观投影都在取得执行槽后发生
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const CLIENT_TOOL_CONCURRENCY = 4;

type Job = { start: () => Promise<void>; cancel: () => void };

export function createClientToolQueue(limit = CLIENT_TOOL_CONCURRENCY) {
  const pending: Job[] = [];
  let running = 0;
  const drain = () => {
    while (running < limit && pending.length > 0) {
      const job = pending.shift()!;
      running++;
      void job.start().finally(() => { running--; drain(); });
    }
  };
  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        pending.push({
          start: async () => { try { resolve(await work()); } catch (error) { reject(error); } },
          cancel: () => reject(new Error("操作已停止，尚未执行。")),
        });
        drain();
      });
    },
    cancelPending() {
      for (const job of pending.splice(0)) job.cancel();
    },
  };
}
