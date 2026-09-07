/**
 * [INPUT]: 依赖生产 Button/Select/UserMenu/Dialog/Collapse/PersistentView/PresenceSurface 与 motion token
 * [OUTPUT]: 对外提供可反复交互的完整 Motion 样板；所有动作只改 fixture 本地状态
 * [POS]: Design System 的动效验收入口，亦被 DEV MotionLabPage 消费，不读取账户或业务数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import { AnimatePresence, MotionConfig, useReducedMotion } from "motion/react";
import { Button, Card, Collapse, Dialog, Input, PersistentView, PresenceSurface, SegmentedControl, Select, UserMenu, useToast } from "../../shared/design-system/components";
import { motionDuration } from "../../shared/design-system/motion";
import { PanelMotionSpecimen } from "./PanelMotionSpecimen";
import { SidebarCreateMenu } from "../SidebarCreateMenu";

export function MotionSpecimen() {
  const [dialog, setDialog] = useState(false);
  const [nested, setNested] = useState(false);
  const [tree, setTree] = useState(false);
  const [child, setChild] = useState(false);
  const [panel, setPanel] = useState(false);
  const [view, setView] = useState("write");
  const [draft, setDraft] = useState("同一份草稿，在阅读与编辑间连续切换。");
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const receipt = () => toast({ title: "操作完成", description: "此样板只更新本地状态。", variant: "success" });
  return <MotionConfig reducedMotion="user">
    <div className="motion-specimen">
      <p className="motion-specimen-note">{reduced ? "减少动态效果 · 90ms 淡换" : "标准动效 · 原位反馈、短距离进退"}</p>
      <div className="motion-specimen-tokens" aria-label="生产动效时长">
        {([['Press', 'press'], ['Menu', 'microEnter'], ['Tree', 'tree'], ['Panel', 'panelEnter'], ['Modal', 'modalEnter']] as const).map(([label, token]) => <span key={token}>{label} <strong>{(reduced ? token === "tree" ? 0 : motionDuration.press : motionDuration[token]) * 1000}ms</strong></span>)}
      </div>
      <section className="motion-specimen-section">
        <h3>操作与浮层</h3>
        <div className="motion-specimen-actions">
          <Button onClick={receipt}>完成操作</Button>
          <Button onClick={() => setDialog(true)} variant="secondary">打开模态框</Button>
          <Button disabled>不可用</Button>
          <Button loading>处理中</Button>
          <SidebarCreateMenu disabled={false} onCreateCanvas={receipt} onCreateFolder={receipt} onCreateMemo={receipt} />
        </div>
        <div className="motion-specimen-controls">
          <Select ariaLabel="向下选择" options={[{ label: "默认视图", value: "default" }, { label: "紧凑视图", value: "compact" }]} />
          <Select ariaLabel="向上选择" placement="top" options={[{ label: "向上展开", value: "up" }, { label: "另一项", value: "other" }]} />
          <UserMenu email="motion@example.test" name="Motion 示例" onOpenProfile={() => setDialog(true)} onOpenSettings={() => setDialog(true)} onOpenSubscription={receipt} onSignOut={async () => { receipt(); }} />
        </div>
      </section>
      <section className="motion-specimen-section">
        <h3>层级与面板</h3>
        <div className="motion-specimen-actions">
          <Button aria-expanded={tree} onClick={() => setTree(!tree)} variant="ghost">展开文件夹</Button>
          <Button aria-expanded={panel} onClick={() => setPanel(!panel)} variant="ghost">切换面板</Button>
        </div>
        <div className="motion-specimen-space">
          <div className="motion-specimen-tree">
            <Collapse open={tree}>
              <Button aria-expanded={child} onClick={() => setChild(!child)} variant="ghost">嵌套文件夹</Button>
              <Collapse open={child}><p>文件夹中的笔记</p><Input aria-label="子树内的输入" placeholder="收起后不应收到焦点" /></Collapse>
              <p>同级笔记</p>
            </Collapse>
            <p>固定同级落点</p>
          </div>
          <PresenceSurface className="motion-specimen-panel" kind="panel-right" open={panel}>
            <strong>辅助面板</strong><p>文字保持原尺寸，面板向右侧边缘回收。</p>
            <Input aria-label="面板内的输入" placeholder="关闭后退出键盘顺序" />
          </PresenceSurface>
        </div>
      </section>
      <section className="motion-specimen-section">
        <h3>视图连续性</h3>
        <SegmentedControl ariaLabel="样板视图" value={view} onValueChange={setView} options={[{ label: "编辑", value: "write" }, { label: "阅读", value: "read" }]} />
        <div className="motion-specimen-view">
          <PersistentView active={view === "write"}><textarea aria-label="保留实例的草稿" className="ds-input" onChange={(event) => setDraft(event.target.value)} value={draft} /></PersistentView>
          <PersistentView active={view === "read"}><p>{draft}</p></PersistentView>
        </div>
        <Card motion="lift" className="motion-specimen-card">卡片表面 · hover 4px 提升，阴影持续存在</Card>
      </section>
      <PanelMotionSpecimen />
      <AnimatePresence>
        {dialog ? <Dialog key="conditional-dialog" title="统一模态框" open onOpenChange={setDialog}>
          <div className="motion-specimen-dialog-content">
            <Input aria-label="模态框输入" data-dialog-autofocus placeholder="焦点留在弹窗内" />
            <Select ariaLabel="弹窗内选择" options={[{ label: "选项一", value: "one" }, { label: "选项二", value: "two" }]} />
            <Button onClick={() => setNested(true)} variant="secondary">打开第二层模态框</Button>
            <Dialog open={nested} onOpenChange={setNested} title="第二层模态框"><p>Escape 只关闭最上面这一层。</p></Dialog>
          </div>
        </Dialog> : null}
      </AnimatePresence>
    </div>
  </MotionConfig>;
}
