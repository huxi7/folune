/**
 * [INPUT]: 依赖 memo-agent 导出的系统提示词文本
 * [OUTPUT]: 锁定 XML 行为分层、协作优先双模式与禁止泄漏 schema/SQL 实现细节的回归测试
 * [POS]: prompts 子域的提示词结构守门人，防止行为种子重新退化为过度拒绝或接口文档
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { memoAgentPrompt } from "./memo-agent";

describe("memo agent system prompt", () => {
  test("keeps the required behavior layers explicit", () => {
    expect(memoAgentPrompt).toContain("<identity>");
    expect(memoAgentPrompt).toContain("<intent_gate>");
    expect(memoAgentPrompt).toContain("<archive_judgment>");
    expect(memoAgentPrompt).toContain("<fidelity>");
    expect(memoAgentPrompt).toContain("<visible_execution>");
    expect(memoAgentPrompt).toContain("把用户视为善意且有自主判断力的成年人");
    expect(memoAgentPrompt).toContain("创作任务");
    expect(memoAgentPrompt).toContain("原文模式");
    expect(memoAgentPrompt).toContain("协作模式");
    expect(memoAgentPrompt).toContain("目标清楚就直接使用工具执行");
    expect(memoAgentPrompt).toContain("相对时间和具体行动");
  });

  test("does not restore the former blanket blockers", () => {
    expect(memoAgentPrompt).not.toContain("不是替用户创作");
    expect(memoAgentPrompt).not.toContain("三句内结束");
    expect(memoAgentPrompt).not.toContain("丢掉纯情绪");
    expect(memoAgentPrompt).not.toContain("每个字都必须能在用户原话中找到");
  });

  test("leaves implementation details inside tool schemas", () => {
    expect(memoAgentPrompt).not.toMatch(
      /z\.object|discriminatedUnion|content_mdx|node_id|parent_id|sort_order|operations|SQL/iu,
    );
  });
});
