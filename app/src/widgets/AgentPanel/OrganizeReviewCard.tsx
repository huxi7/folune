/**
 * [INPUT]: 依赖 awaiting_confirmation AiRun、locale 文案、共享 ApprovalDock/Button 与 apply/reject 回调
 * [OUTPUT]: 对外提供仅待确认时可见的 AI 整理 ApprovalDock；其他状态不在 AgentPanel 重复展示
 * [POS]: AgentPanel 的 AI 整理审批语义适配层；与普通工具审批同构，成功结果不在 AgentPanel 或 Paper 下方重复展示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { AiRun } from "../../shared/api/ai";
import { Button } from "../../shared/design-system/components";
import { useLocale } from "../../shared/locale";
import { ApprovalDock } from "./ApprovalDock";

type OrganizeReviewCardProps = {
  busy: boolean;
  onApply: () => Promise<void>;
  onReject: () => Promise<void>;
  run: AiRun | null;
};

const planDescription = (run: AiRun, t: (chinese: string, english: string) => string): string => {
  if (run.plan === null) return t("确认后将更新标题与归档位置。", "Approval updates the title and filing location.");
  const destination = run.plan.destination.kind === "keep_current"
    ? t("保留当前位置", "keep its current location")
    : run.plan.destination.kind === "new_folder"
      ? t(`新建「${run.plan.destination.folder_title}」并归档`, `create “${run.plan.destination.folder_title}” and file it there`)
      : t("移动到建议目录", "move it to the suggested folder");
  return t(`标题改为「${run.plan.suggested_title}」，${destination}。`, `Rename to “${run.plan.suggested_title}” and ${destination}.`);
};

export function OrganizeReviewCard({ busy, onApply, onReject, run }: OrganizeReviewCardProps) {
  const { t } = useLocale();
  if (run?.status !== "awaiting_confirmation") return null;

  return (
    <ApprovalDock
      actions={<>
        <Button disabled={busy} onClick={() => void onReject()} variant="ghost">{t("取消", "Cancel")}</Button>
        <Button disabled={busy} loading={busy} onClick={() => void onApply()} variant="primary">{t("确认整理", "Apply organization")}</Button>
      </>}
      ariaLabel={t("AI 整理确认", "Confirm AI organization")}
      description={planDescription(run, t)}
      status={run.status}
      title={t("确认整理方案", "Review organization plan")}
    />
  );
}
