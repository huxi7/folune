/**
 * [INPUT]: 依赖 AI SDK UI stream、可注入模型流/审批/持久化函数与请求取消信号
 * [OUTPUT]: 对外提供 createChatResponseStream；正文即时透传，余额不足文案跨包装保留，静默超时/流内错误/无 finish 均进入失败终态
 * [POS]: 聊天流生命周期边界；等待落库保证切换一致性，审批最多四项并发且逐项计时，工具续写只在审批与本轮落库完成后开放
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import { modelErrorMessage, MODEL_ERROR_MESSAGE } from "../lib/model-error";
import { persistWithOneRetry, responseStartChunk } from "./chat-persistence";

const APPROVAL_CONCURRENCY = 4;
const GENERATION_IDLE_MS = 30_000;
const GENERATION_ERROR = MODEL_ERROR_MESSAGE;
const GENERATION_TIMEOUT = "AI 长时间没有响应，请重试。";

type Options = {
  messages: UIMessage[];
  messageId: string;
  signal: AbortSignal;
  createStream: (signal: AbortSignal) => Promise<ReadableStream<UIMessageChunk>>;
  approveTool: (chunk: Extract<UIMessageChunk, { type: "tool-input-available" }>) => Promise<UIMessageChunk | null>;
  persist: (message: UIMessage, status: "complete" | "error" | "aborted") => Promise<unknown>;
  onPersistenceError: () => void;
  onGenerationError?: (detail: { phase: string; chunks: number; timedOut: boolean }) => void;
  onUsage?: (totalTokens: number) => void;
  idleMs?: number;
};

// finish 时经 messageMetadata 注入的本轮真实 token（输入+输出总和）；缺失或非正数视为 0。
const readUsageTokens = (message: UIMessage): number => {
  const meta = message.metadata as { folune_total_tokens?: unknown } | undefined;
  const value = meta?.folune_total_tokens;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
};

export function createChatResponseStream(options: Options) {
  const generation = new AbortController();
  const signal = AbortSignal.any([options.signal, generation.signal]);
  let failed = false;
  let timeout = false;
  let phase = "startup";
  let chunks = 0;
  let failureMessage = GENERATION_ERROR;
  const errorText = () => timeout ? GENERATION_TIMEOUT : failureMessage;

  // 等待的是有效模型事件，而非总生成时长；持续输出的长回复不会被截断。
  const waitForProgress = async <T>(work: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => undefined;
    try {
      signal.throwIfAborted();
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          onAbort = () => reject(signal.reason);
          signal.addEventListener("abort", onAbort, { once: true });
          timer = setTimeout(() => {
            timeout = true;
            generation.abort(new Error(GENERATION_TIMEOUT));
          }, options.idleMs ?? GENERATION_IDLE_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  };

  return createUIMessageStream<UIMessage>({
    originalMessages: options.messages,
    generateId: () => options.messageId,
    execute: async ({ writer }) => {
      let reader: ReadableStreamDefaultReader<UIMessageChunk> | undefined;
      const approvals: Promise<void>[] = [];
      const approvalSlots = Array.from({ length: APPROVAL_CONCURRENCY }, () => Promise.resolve());
      try {
        writer.write(responseStartChunk(options.messageId));
        const upstream = options.createStream(signal);
        // 超时后才返回的流也必须释放，不能留下无人消费的模型连接。
        void upstream.then((stream) => {
          if (signal.aborted) void stream.cancel().catch(() => undefined);
        }, () => undefined);
        reader = (await waitForProgress(upstream)).getReader();
        phase = "stream";
        const seenCalls = new Set<string>();
        let hasOutput = false;
        let finish: Extract<UIMessageChunk, { type: "finish" }> | undefined;
        while (!finish) {
          const { value: chunk, done } = await waitForProgress(reader.read());
          if (done) throw new Error(GENERATION_ERROR);
          chunks++;
          if (chunk.type === "error") {
            failureMessage = modelErrorMessage(chunk.errorText);
            throw new Error(failureMessage);
          }
          if (chunk.type === "finish" && chunk.finishReason === "error") {
            throw new Error(GENERATION_ERROR);
          }
          if (chunk.type === "abort") {
            writer.write(chunk);
            return;
          }
          if (chunk.type === "finish") {
            // 只有 reasoning 或空流不是一条成功回复；旧工具结果不能再次触发自动续写。
            if (!hasOutput) throw new Error(GENERATION_ERROR);
            finish = chunk;
            break;
          }
          if ((chunk.type === "text-delta" && chunk.delta.trim().length > 0)
            || chunk.type === "tool-input-available") hasOutput = true;
          writer.write(chunk);
          if (chunk.type === "tool-input-available" && !seenCalls.has(chunk.toolCallId)) {
            seenCalls.add(chunk.toolCallId);
            const slot = approvals.length % APPROVAL_CONCURRENCY;
            const approval = approvalSlots[slot]!.then(async () => {
              signal.throwIfAborted();
              const result = await waitForProgress(options.approveTool(chunk));
              if (result && !signal.aborted) writer.write(result);
            });
            approvalSlots[slot] = approval;
            // 审批与模型并行；立即接管 rejection，结束时统一等待。
            void approval.catch(() => undefined);
            approvals.push(approval);
          }
        }
        phase = "approval";
        // 每项审批取得执行槽后单独计时；正常推进的大批量不受总计 30 秒误杀。
        await Promise.all(approvals);
        writer.write(finish);
      } catch (error) {
        if (options.signal.aborted) writer.write({ type: "abort" });
        else {
          failed = true;
          failureMessage = modelErrorMessage(error);
          options.onGenerationError?.({ phase, chunks, timedOut: timeout });
          writer.write({ type: "error", errorText: errorText() });
        }
        generation.abort(error);
      } finally {
        // finish 已是协议终点；不能再等上游 socket 的 EOF 才允许工具续写。
        if (reader) void reader.cancel().catch(() => undefined);
      }
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      const usageTokens = readUsageTokens(responseMessage);
      if (usageTokens > 0) options.onUsage?.(usageTokens);
      const saved = await persistWithOneRetry(() => options.persist(
        responseMessage,
        isAborted || options.signal.aborted ? "aborted" : failed ? "error" : "complete",
      ));
      if (!saved) {
        options.onPersistenceError();
        throw new Error("回复保存失败，请稍后重试。");
      }
    },
    onError: () => {
      failed = true;
      return errorText();
    },
  });
}
