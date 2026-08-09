/**
 * [INPUT]: 依赖 memo-agent 导出的系统提示词文本
 * [OUTPUT]: 锁定 XML 行为分层、高浓度原则与禁止泄漏 schema/SQL 实现细节的回归测试
 * [POS]: prompts 子域的提示词结构守门人，不评价模型文风，只防止行为种子退化成接口文档
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
    expect(memoAgentPrompt).toContain("要不要我记下来？");
    expect(memoAgentPrompt).toContain("相对时间和具体行动");
    expect(memoAgentPrompt).toContain("即使你知道");
  });

  test("leaves implementation details inside tool schemas", () => {
    expect(memoAgentPrompt).not.toMatch(
      /z\.object|discriminatedUnion|content_mdx|node_id|parent_id|sort_order|operations|SQL/iu,
    );
  });
});
