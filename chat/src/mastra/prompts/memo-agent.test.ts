/**
 * [INPUT]: 依赖 memo-agent 导出的系统提示词文本
 * [OUTPUT]: 锁定 XML 行为分层、协作优先双模式、独立工具并行（多篇删除同轮批发不退化为逐条串行）与禁止泄漏 schema/SQL 实现细节的回归测试
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
    expect(memoAgentPrompt).toContain("目标清楚就直接使用 edit_node 或 edit_memo");
    expect(memoAgentPrompt).toContain("你不能代替审批");
    expect(memoAgentPrompt).toContain("最新 revision");
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

  test("独立操作同轮并行，只有结果或版本依赖才串行", () => {
    expect(memoAgentPrompt).toContain("互不依赖的工具在同一轮一起调用");
    expect(memoAgentPrompt).toContain("只有后续动作依赖前一步结果时才等待");
    expect(memoAgentPrompt).toContain("同一节点的连续修改");
    expect(memoAgentPrompt).not.toContain("每次工具调用只做一个原子动作，并等待真实结果后再继续");
  });

  test("多篇不同笔记的删除必须同轮批发，不逐条串行", () => {
    // 回归防线：删除曾因数据库死锁被迫逐条执行，锁顺序修好后不得再把删除
    // 归入"相互影响需等待"一类，否则模型会重新退化成删一篇等一篇。
    expect(memoAgentPrompt).toContain("移入回收站");
    expect(memoAgentPrompt).not.toContain("相互影响的移动/排序/删除");
    expect(memoAgentPrompt).toMatch(/不同笔记.*移入回收站互不影响/su);
  });
});
