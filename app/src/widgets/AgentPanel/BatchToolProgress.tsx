/**
 * [INPUT]: 依赖 locale 状态文案、明确批量快照、真实执行状态、DS 时长与工具胶囊，不猜测归属
 * [OUTPUT]: 提供八槽执行视图和一次展开的虚拟完成记录；少于十项直接保留每项，新结果短暂反馈且失败计数始终可见
 * [POS]: AgentPanel 单批次的展示边界，不调度任务、不改写推理，展开状态由用户控制
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { motionDuration } from "../../shared/design-system/motion";
import { CheckCircleIcon, XCircleIcon } from "../../shared/design-system/icons";
import { ToolCallBubble } from "../../shared/design-system/components";
import { englishToolStateLabels, getAgentToolPresentation } from "./toolPresentation";
import type { BatchItem, BatchSnapshot } from "./toolExecutionState";
import { useLocale } from "../../shared/locale";

const COLLAPSE_THRESHOLD = 10;
const RECORD_HEIGHT = 40;
const WINDOW_ROWS = 10;
const OVERSCAN = 3;
const completed = (item: BatchItem) => item.state !== "running" && item.state !== "queued";

function BatchItemBubble({ item, live }: { item: BatchItem; live: boolean }) {
  const { locale } = useLocale();
  const state = item.state === "succeeded" ? "output-available" : item.state === "failed" ? "output-error" : item.state === "cancelled" ? "output-denied" : item.state;
  const plan = item.plan;
  const presentation = getAgentToolPresentation("edit_node", {
    input: { op: "op" in plan ? plan.op : undefined }, output: item.output, state,
    errorText: item.error,
  }, item.title, locale);
  return <ToolCallBubble {...presentation} labels={locale === "en" ? englishToolStateLabels : undefined} state={state} live={live} />;
}

function CompletedRecords({ items }: { items: BatchItem[] }) {
  const { t } = useLocale();
  const [scrollTop, setScrollTop] = useState(0);
  const start = Math.max(0, Math.min(Math.floor(scrollTop / RECORD_HEIGHT) - OVERSCAN, items.length - WINDOW_ROWS));
  // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 独立滚动记录必须能由键盘聚焦与滚动
  return <div className="agent-batch-records" role="region" aria-label={t("全部操作记录", "All operation records")} tabIndex={0}
    style={{ maxHeight: RECORD_HEIGHT * WINDOW_ROWS }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <div style={{ height: items.length * RECORD_HEIGHT, position: "relative" }}>
      {items.slice(start, start + WINDOW_ROWS + OVERSCAN * 2).map((item, index) => <div className="agent-batch-record" key={item.id}
        style={{ position: "absolute", top: (start + index) * RECORD_HEIGHT, height: RECORD_HEIGHT, width: "100%" }}>
        <span data-result={item.state === "succeeded" ? "success" : "failure"}>{item.state === "succeeded" ? <CheckCircleIcon size={16} /> : <XCircleIcon size={16} />}</span>
        <span title={item.error ? `${item.title}：${item.error}` : item.title}>{item.title}</span>
        <span>{item.state === "succeeded" ? t("已完成", "Done") : item.state === "cancelled" ? t("未执行", "Not run") : t("未完成", "Failed")}</span>
      </div>)}
    </div>
  </div>;
}

export function BatchToolProgress({ batch, live }: { batch: BatchSnapshot; live: boolean }) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [failuresOnly, setFailuresOnly] = useState(false);
  const items = batch.items;
  const previousItems = useRef(items);
  const [recentResult, setRecentResult] = useState<BatchItem | null>(null);
  useEffect(() => {
    const previous = previousItems.current;
    previousItems.current = items;
    if (!live || items.length < COLLAPSE_THRESHOLD) return;
    const recent = items.findLast((item, index) => (item.state === "succeeded" || item.state === "failed") && previous[index]?.state === "running");
    if (recent) setRecentResult(recent);
  }, [items, live]);
  useEffect(() => {
    if (!recentResult) return;
    const timer = setTimeout(() => setRecentResult(null), motionDuration.quiet * 1000);
    return () => clearTimeout(timer);
  }, [recentResult]);
  if (items.length < COLLAPSE_THRESHOLD) return <>{items.map((item) => <div className="agent-tool-stack" key={item.id}><BatchItemBubble item={item} live={live} /></div>)}</>;
  const running = items.filter((item) => item.state === "running");
  const done = items.filter(completed);
  const failed = done.filter((item) => item.state === "failed");
  const cancelled = done.filter((item) => item.state === "cancelled");
  const waiting = items.filter((item) => item.state === "queued").length;
  const first = items[0]?.plan;
  const action = first?.kind === "delete_node" ? t("删除", "Delete") : first?.kind === "move_node" ? t("移动", "Move") : t("重命名", "Rename");
  return <div className="agent-batch-progress">
    <div className="agent-tool-progress" role="status">{t(`${action} ${items.length} 篇备忘录 · 已完成`, `${action} ${items.length} notes · Completed`)} {done.length - failed.length - cancelled.length} / {items.length}
      {failed.length > 0 ? t(` · ${failed.length} 篇未完成`, ` · ${failed.length} failed`) : ""}{cancelled.length > 0 ? t(` · ${cancelled.length} 篇未执行`, ` · ${cancelled.length} not run`) : ""}</div>
    {running.map((item) => <div className="agent-tool-stack" key={item.id}><BatchItemBubble item={item} live={live} /></div>)}
    {recentResult && live ? <div className="agent-batch-recent" aria-label={t("刚刚完成的操作", "Recently completed operation")}><BatchItemBubble item={recentResult} live={false} /></div> : null}
    {waiting > 0 ? <div className="agent-tool-progress">{live ? t(`还有 ${waiting} 篇等待处理`, `${waiting} notes waiting`) : t(`${waiting} 篇尚未执行`, `${waiting} notes not run`)}</div> : null}
    {done.length > 0 ? <button className="agent-tool-more" type="button" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); setFailuresOnly(false); }}>
      {expanded ? t("收起操作记录", "Hide operation records") : t(`查看全部 ${done.length} 条记录`, `View all ${done.length} records`)}
    </button> : null}
    {failed.length > 0 ? <button className="agent-tool-more" type="button" onClick={() => { setExpanded(true); setFailuresOnly(true); }}>{t("查看未完成项", "View failed items")}</button> : null}
    {expanded ? <CompletedRecords key={failuresOnly ? "failures" : "all"} items={failuresOnly ? failed : done} /> : null}
  </div>;
}
