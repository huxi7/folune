/**
 * [INPUT]: 依赖 zod 与 AI SDK 用户消息 metadata 的 context 约定
 * [OUTPUT]: 对外提供 readFrozenTurnContext 与 isAssistantContinuation，提取本轮 active/@refs 快照并区分首次生成/工具续写
 * [POS]: routes 的纯解析边界；页面当前状态只可作为 V1 回退，合法消息 metadata 一经发送便不再漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { z } from "zod";

const frozenTurnContextSchema = z.object({
  active_memo_id: z.uuid().nullable(),
  reference_memo_ids: z.array(z.uuid()).max(5),
  revisions: z.record(z.uuid(), z.number().int().positive()).optional().default({}),
}).strict();

type MessageWithMetadata = {
  metadata?: unknown;
  role: string;
};

export type FrozenTurnContext = z.infer<typeof frozenTurnContextSchema>;

export const isAssistantContinuation = (
  messages: readonly MessageWithMetadata[],
): boolean => messages.at(-1)?.role === "assistant";

export const readFrozenTurnContext = (
  messages: readonly MessageWithMetadata[],
  fallbackActiveMemoId: string | null,
): FrozenTurnContext => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    const metadata = message.metadata;
    if (metadata === null || typeof metadata !== "object") break;
    const context = (metadata as Record<string, unknown>).context;
    const parsed = frozenTurnContextSchema.safeParse(context);
    if (parsed.success) return parsed.data;
    break;
  }

  return {
    active_memo_id: fallbackActiveMemoId,
    reference_memo_ids: [],
    revisions: {},
  };
};
