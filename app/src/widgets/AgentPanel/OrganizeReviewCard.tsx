/**
 * [INPUT]: 依赖 AiRun 状态/计划/结果、Design System Button 与 apply/reject/undo 回调
 * [OUTPUT]: 对外提供 awaiting_confirmation、succeeded、stale、failed、rejected、undone 的紧凑整理卡片和显式操作入口
 * [POS]: AgentPanel 整理状态纯视图；只提交 runId 对应命令，不接受或回传客户端 plan
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { ArrowCounterClockwiseIcon, CheckIcon, XIcon } from "../../shared/design-system/icons";

import type { AiRun } from "../../shared/api/ai";
import { Button } from "../../shared/design-system/components";

type OrganizeReviewCardProps = {
  busy: boolean;
  onApply: () => Promise<void>;
  onReject: () => Promise<void>;
  onUndo: () => Promise<void>;
  run: AiRun | null;
};

const statusCopy = (run: AiRun): { title: string; description: string } => {
  switch (run.status) {
    case "awaiting_confirmation": return { title: "确认整理方案", description: run.plan?.reason ?? "这个方案需要你确认后才会执行。" };
    case "succeeded": return { title: "整理完成", description: run.result?.target_path ?? "标题和归档位置已更新。" };
    case "stale": return { title: "笔记已变化", description: "规划后正文或目录发生变化，请重新整理。" };
    case "failed": return { title: "整理失败", description: "没有修改笔记，请稍后重试。" };
    case "rejected": return { title: "已取消整理", description: "方案未执行。" };
    case "undone": return { title: "已撤销整理", description: "标题和归档位置已恢复。" };
    default: return { title: "正在整理", description: "正在生成并验证标题与归档方案。" };
  }
};

export function OrganizeReviewCard({ busy, onApply, onReject, onUndo, run }: OrganizeReviewCardProps) {
  if (run === null) return null;
  const copy = statusCopy(run);
  return (
    <section className="organize-review-card" data-status={run.status}>
      <div className="organize-review-copy">
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
      </div>
      {run.plan ? (
        <dl className="organize-review-plan">
          <div><dt>标题</dt><dd>{run.plan.suggested_title}</dd></div>
          <div><dt>位置</dt><dd>{run.plan.destination.kind === "keep_current" ? "保持当前位置" : run.plan.destination.kind === "new_folder" ? `新建「${run.plan.destination.folder_title}」` : "移动到建议目录"}</dd></div>
        </dl>
      ) : null}
      <div className="organize-review-actions">
        {run.status === "awaiting_confirmation" ? <>
          <Button disabled={busy} icon={XIcon} onClick={() => void onReject()} variant="ghost">取消</Button>
          <Button disabled={busy} icon={CheckIcon} onClick={() => void onApply()} variant="primary">确认执行</Button>
        </> : null}
        {run.status === "succeeded" ? (
          <Button disabled={busy} icon={ArrowCounterClockwiseIcon} onClick={() => void onUndo()} variant="secondary">撤销</Button>
        ) : null}
      </div>
    </section>
  );
}
