/**
 * [INPUT]: 依赖 Mastra createTool 与 zod 的输入/输出契约能力
 * [OUTPUT]: 对外提供仅声明不在服务端执行的 celebrationTool，由浏览器播放庆祝动画并回传结果
 * [POS]: tools 子域的浏览器能力契约；Agent 负责选择调用，前端拥有 DOM 动画执行权
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const celebrationTool = createTool({
  id: "celebration",
  description:
    "庆祝工具。当用户明确要求庆祝、祝贺，或希望用礼花庆祝某件事时调用一次。该工具由浏览器执行全屏礼花动画；必须等待前端返回真实结果后，才能告诉用户庆祝完成。",
  inputSchema: z.object({
    reason: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe("本次庆祝的简短原因，只陈述用户已经提供的事实"),
  }),
  outputSchema: z.object({
    durationMs: z.number().int().nonnegative(),
    particleCount: z.number().int().nonnegative(),
    reducedMotion: z.boolean(),
    success: z.literal(true),
  }),
});
