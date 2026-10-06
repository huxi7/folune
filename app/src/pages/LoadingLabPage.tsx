/**
 * [INPUT]: 依赖生产笔记/文件树/会话/订阅/积分骨架与共享主题 token，不连接业务 API
 * [OUTPUT]: DEV /loading-lab 的浅暗主题、窄屏与加载交接验收页
 * [POS]: 页面层的加载品质验收入口；复用正式构图，临时主题离场恢复且不保存偏好或改动用户数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { Button, SkeletonGroup, Skeleton, useDelayedSkeleton } from "../shared/design-system/components";
import { NotesWorkspaceSkeleton } from "../widgets/NotesWorkspace";
import { MemoTreeSkeleton } from "../widgets/MemoTreeSkeleton";
import { AgentConversationSkeleton } from "../widgets/AgentPanel/AgentConversationSkeleton";
import { SubscriptionPlanSkeleton } from "../widgets/SubscriptionWorkspace";
import { CreditPacksSkeleton } from "../widgets/CreditsPurchaseDialog";
import "../styles/subscription.css";
import "../styles/loading-lab.css";

export function LoadingLabPage() {
  const [dark, setDark] = useState(false);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousContext = root.dataset.visualContext;
    const previousDark = root.classList.contains("dark");
    root.dataset.visualContext = "app";
    root.classList.toggle("dark", dark);
    return () => {
      if (previousContext === undefined) delete root.dataset.visualContext;
      else root.dataset.visualContext = previousContext;
      root.classList.toggle("dark", previousDark);
    };
  }, [dark]);
  const [pending, setPending] = useState(true);
  const [run, setRun] = useState(0);
  const visible = useDelayedSkeleton(pending);
  useEffect(() => {
    if (run === 0) return;
    setPending(true);
    const timeout = window.setTimeout(() => setPending(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [run]);
  return <main className={`loading-lab${dark ? " dark" : ""}`}>
    <div className="loading-lab-inner">
      <header className="loading-lab-header">
        <div><p className="loading-lab-eyebrow">FOLUNE · LOADING STUDIES</p><h1>等待，也有秩序。</h1><p>同一套生产组件。更轻的明暗，更安静的交接。</p></div>
        <div className="loading-lab-controls"><Button onClick={() => setDark(v => !v)} variant="secondary">{dark ? "浅色" : "深色"}</Button><Button onClick={() => setRun(v => v + 1)} variant="secondary">播放交接</Button></div>
      </header>
      <section aria-label="工作区加载构图" className="loading-lab-workspace">
        <aside className="loading-lab-library"><div className="loading-lab-panel-heading">文件库<span>01</span></div><MemoTreeSkeleton visible /></aside>
        <div className="loading-lab-paper"><div className="loading-lab-paper-toolbar"><span>笔记</span><span>02</span></div><NotesWorkspaceSkeleton visible /></div>
        <aside className="loading-lab-assistant"><div className="loading-lab-panel-heading">助手<span>03</span></div><AgentConversationSkeleton /></aside>
      </section>
      <section className="loading-lab-detail-grid">
        <div className="loading-lab-study"><div className="loading-lab-section-heading"><h2>积分卡片</h2><span>结构先于信息</span></div><div className="loading-lab-credits"><CreditPacksSkeleton visible /></div></div>
        <div className="loading-lab-study"><div className="loading-lab-section-heading"><h2>内容交接</h2><span>数据就绪，立即呈现</span></div><div className="loading-lab-handoff">
          {pending ? <SkeletonGroup visible={visible} label="正在准备示例"><Skeleton className="loading-lab-handoff-title" shape="text" /><Skeleton shape="text" /><Skeleton shape="text" /></SkeletonGroup> : <div className="loading-content-reveal"><h3>把想法留给下一次灵感。</h3><p>记录不必完整。留下一句话，下一次回来时，思路就有了起点。</p></div>}
        </div></div>
      </section>
      <section className="loading-lab-study loading-lab-plans"><div className="loading-lab-section-heading"><h2>订阅方案</h2><span>保持卡片与操作的位置</span></div><SubscriptionPlanSkeleton visible /></section>
    </div>
  </main>;
}
