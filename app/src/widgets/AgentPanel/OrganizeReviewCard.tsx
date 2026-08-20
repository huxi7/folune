/**
 * [INPUT]: 依赖 awaiting_confirmation AiRun、共享 ApprovalDock、Design System Button 与 apply/reject 回调
 * [OUTPUT]: 对外提供仅待确认时可见的 AI 整理 ApprovalDock；其他状态不在 AgentPanel 重复展示
 * [POS]: AgentPanel 的 AI 整理审批语义适配层；与普通工具审批同构，成功结果不在 AgentPanel 或 Paper 下方重复展示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiRun } from "../../shared/api/ai";
import { Button } from "../../shared/design-system/components";
import { ApprovalDock } from "./ApprovalDock";

type OrganizeReviewCardProps = {
  busy: boolean;
  onApply: () => Promise<void>;
  onReject: () => Promise<void>;
  run: AiRun | null;
};

const planDescription = (run: AiRun): string => {
  if (run.plan === null) return "确认后将更新标题与归档位置。";
  const destination = run.plan.destination.kind === "keep_current"
    ? "保留当前位置"
    : run.plan.destination.kind === "new_folder"
      ? `新建「${run.plan.destination.folder_title}」并归档`
      : "移动到建议目录";
  return `标题改为「${run.plan.suggested_title}」，${destination}。`;
};

export function OrganizeReviewCard({ busy, onApply, onReject, run }: OrganizeReviewCardProps) {
  if (run?.status !== "awaiting_confirmation") return null;

  return (
    <ApprovalDock
      actions={<>
        <Button disabled={busy} onClick={() => void onReject()} variant="ghost">取消</Button>
        <Button disabled={busy} loading={busy} onClick={() => void onApply()} variant="primary">确认整理</Button>
      </>}
      ariaLabel="AI 整理确认"
      description={planDescription(run)}
      status={run.status}
      title="确认整理方案"
    />
  );
}
