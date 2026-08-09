/**
 * [INPUT]: 依赖 Mastra createTool 与 zod 的输入/输出契约能力
 * [OUTPUT]: 对外提供带用户指定 count 的 celebrationTool，由浏览器批量播放庆祝动画并回传真实次数
 * [POS]: tools 子域的浏览器能力契约；Agent 负责选择调用，前端拥有 DOM 动画执行权
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const celebrationTool = createTool({
  id: "celebration",
  description:
    "庆祝工具。当用户要求庆祝或祝贺时调用。count 必须忠实等于用户要求的次数，例如‘庆祝10次’必须传 10，不能擅自缩减为 1。浏览器会在一个工具回环中批量播放对应次数的礼花，并返回真实结果。",
  inputSchema: z.object({
    count: z
      .number()
      .int()
      .positive()
      .default(1)
      .describe("用户要求的庆祝次数；未指定次数时为 1"),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .describe("本次庆祝的简短原因，只陈述用户已经提供的事实"),
  }),
  outputSchema: z.object({
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .describe("礼花动画实际持续时间，单位毫秒"),
    particleCount: z
      .number()
      .int()
      .nonnegative()
      .describe("浏览器实际发射的粒子数量"),
    reducedMotion: z.boolean().describe("是否因系统减少动态效果偏好而跳过动画"),
    renderedWaves: z
      .number()
      .int()
      .nonnegative()
      .describe("浏览器实际渲染的视觉波次数量"),
    requestedCount: z
      .number()
      .int()
      .positive()
      .describe("忠实接收的用户庆祝次数"),
    success: z.literal(true).describe("浏览器已完成本次庆祝工具执行"),
  }),
});
