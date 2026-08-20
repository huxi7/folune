/**
 * [INPUT]: 依赖 Bun test、React 静态渲染、AiRun 与 OrganizeReviewCard
 * [OUTPUT]: 验证 AI 整理待确认复用普通 ApprovalDock，完成态不在 AgentPanel 重复制造结果卡
 * [POS]: AgentPanel 整理审批 DOM 同构回归测试，防止独立 organize card 视觉重新出现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { AiRun } from "../../shared/api/ai";
import { OrganizeReviewCard } from "./OrganizeReviewCard";

const run = (status: AiRun["status"]): AiRun => ({
  applied_at: status === "succeeded" ? "2026-08-20T10:00:00.000Z" : null,
  created_at: "2026-08-20T09:59:00.000Z",
  error_code: null,
  id: "run-1",
  idempotency_key: "organize-1",
  memo_id: "memo-1",
  plan: {
    confidence: 0.92,
    destination: { folder_id: "folder-1", kind: "existing_folder" },
    reason: "内容属于生活记录。",
    suggested_title: "今天天气记录",
  },
  result: status === "succeeded" ? {
    created_folder: null,
    memo: {
      color: null,
      created_at: "2026-08-20T09:00:00.000Z",
      deleted_at: null,
      deleted_root_id: null,
      icon: null,
      id: "memo-1",
      metadata: {},
      node_type: "memo",
      parent_id: "folder-1",
      revision: 2,
      sort_order: "1000",
      title: "今天天气记录",
      updated_at: "2026-08-20T10:00:00.000Z",
      user_id: "user-1",
    },
    result_revision: 2,
    target_path: "/文章/生活记录",
  } : null,
  source_revision: 1,
  status,
  thread_id: "thread-1",
  undone_at: null,
  updated_at: "2026-08-20T10:00:00.000Z",
  user_id: "user-1",
});

describe("OrganizeReviewCard", () => {
  test("待确认整理与普通审批使用同一 Composer Dock", () => {
    const html = renderToStaticMarkup(
      <OrganizeReviewCard
        busy={false}
        onApply={async () => undefined}
        onReject={async () => undefined}
        run={run("awaiting_confirmation")}
      />,
    );

    expect(html).toContain('class="agent-approval-dock"');
    expect(html).toContain('aria-label="AI 整理确认"');
    expect(html).toContain("标题改为「今天天气记录」，移动到建议目录。");
    expect(html).toContain("取消");
    expect(html).toContain("确认整理");
    expect(html).not.toContain("organize-review-card");
  });

  test("整理完成不在 AgentPanel 重复显示结果卡", () => {
    const html = renderToStaticMarkup(
      <OrganizeReviewCard
        busy={false}
        onApply={async () => undefined}
        onReject={async () => undefined}
        run={run("succeeded")}
      />,
    );

    expect(html).toBe("");
  });
});
