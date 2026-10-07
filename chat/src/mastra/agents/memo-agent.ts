/**
 * [INPUT]: 依赖基础 prompt、动态 memo context prompt、MemoAgentContext、config/models 唯一模型与输出预算
 * [OUTPUT]: 画布问答使用独立只读指令，不继承普通收纳规则； 对外提供无静态工具、无 Mastra Memory、按请求冻结笔记上下文生成 instructions 的 memoAgent
 * [POS]: agents 子域的对话推理能力，正文只经非序列化上下文盒进入动态 prompt，服务端工具由 chat 路由按请求注入且审批权不在本 Agent
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Agent } from "@mastra/core/agent";

import { env } from "@/config/env";
import { toMastraModelConfig } from "@/config/models";
import { CanvasPromptContext } from "@/lib/canvas-chat-session";
import { canvasChatPrompt } from "@/mastra/prompts/canvas-chat";
import { memoAgentPrompt } from "@/mastra/prompts/memo-agent";
import { buildMemoContextPrompt } from "@/mastra/prompts/memo-context";
import { MemoAgentContext } from "@/lib/memo-agent-context";

export const memoAgent = new Agent({
  id: "memo-agent",
  name: "Folune 备忘录助手",
  instructions: ({ requestContext }) => {
    const canvas = requestContext.get("canvasChatPrompt");
    if (canvas instanceof CanvasPromptContext) return `${canvasChatPrompt}\n<untrusted_canvas_data>${canvas.read()}</untrusted_canvas_data>`;
    const context = requestContext.get("memoAgentContext");
    return context instanceof MemoAgentContext
      ? `${memoAgentPrompt}\n\n${buildMemoContextPrompt(context.read())}`
      : memoAgentPrompt;
  },
  model: toMastraModelConfig(env.DEFAULT_MODEL),
  defaultOptions: {
    modelSettings: {
      maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    },
  },
});
