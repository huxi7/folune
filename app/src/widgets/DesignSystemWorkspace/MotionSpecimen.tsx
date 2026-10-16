/**
 * [INPUT]: 依赖生产 Button/Select/UserMenu/Dialog/Collapse/PersistentView/PresenceSurface 与 motion token
 * [OUTPUT]: 对外提供动效参数表与交互样板；面板挂载 WorkspacePanelLayer，动作只改变本地状态
 * [POS]: Design System 的动效验收入口；以参数和交互表达规则，亦被 DEV MotionLabPage 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import { AnimatePresence, MotionConfig, useReducedMotion } from "motion/react";
import { Button, Collapse, Dialog, Input, PersistentView, SegmentedControl, Select, UserMenu, useToast } from "../../shared/design-system/components";
import { motionDuration, surfaceMotionCatalog } from "../../shared/design-system/motion";
import { PanelMotionSpecimen } from "./PanelMotionSpecimen";
import { SidebarCreateMenu } from "../SidebarCreateMenu";
import { WorkspacePanelLayer } from "../WorkspacePanelLayer";

export function MotionSpecimen() {
  const [dialog, setDialog] = useState(false);
  const [nested, setNested] = useState(false);
  const [tree, setTree] = useState(false);
  const [child, setChild] = useState(false);
  const [panel, setPanel] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [view, setView] = useState("write");
  const [draft, setDraft] = useState("同一份草稿，在阅读与编辑间连续切换。");
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const receipt = () => toast({ title: "操作完成", variant: "success" });
  return <MotionConfig reducedMotion="user">
    <div className="motion-specimen">
      <p className="motion-specimen-note">{reduced ? "减少动态 · 90ms 淡换" : "标准动效"}</p>
      <div className="motion-specimen-tokens" aria-label="动效时长">
        {([['Press', 'press'], ['Compact menu', 'compactMenuEnter'], ['Menu', 'menuEnter'], ['Tree', 'tree'], ['Panel', 'panelEnter'], ['Modal', 'modalEnter']] as const).map(([label, token]) => <span key={token}>{label} <strong>{(reduced ? token === "tree" ? 0 : motionDuration.press : motionDuration[token]) * 1000}ms</strong></span>)}
      </div>
      <section className="motion-specimen-section" aria-label="动效参数">
        <h3>时长与曲线</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", textAlign: "left", fontSize: 12, borderSpacing: "0 8px" }}>
            <thead><tr><th scope="col">组件</th><th scope="col">进入 / 退出</th><th scope="col">曲线</th><th scope="col">缩放 / 位移</th><th scope="col">用途</th></tr></thead>
            <tbody>{surfaceMotionCatalog.map((recipe) => <tr key={recipe.kind} data-motion-recipe={recipe.kind}>
              <th scope="row">{recipe.label}</th>
              <td>{(reduced ? 0.09 : recipe.enter) * 1000} / {(reduced ? 0.09 : recipe.exit) * 1000}ms</td>
              <td>({recipe.ease.join(", ")}){"exitEase" in recipe ? <> / ({recipe.exitEase.join(", ")})</> : null}</td>
              <td>{reduced ? "100% / 0px" : `${recipe.scale * 100}% / ${recipe.offset}`}</td>
              <td>{recipe.use}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
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
          <UserMenu email="motion@example.test" name="Motion 示例" theme={theme} onThemeChange={setTheme} onOpenProfile={() => setDialog(true)} onOpenSettings={() => setDialog(true)} onOpenSubscription={receipt} onSignOut={async () => { receipt(); }} />
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
              <Collapse open={child}><p>文件夹中的笔记</p><Input aria-label="子树内的输入" placeholder="笔记标题" /></Collapse>
              <p>同级笔记</p>
            </Collapse>
            <p>阅读摘记</p>
          </div>
          <WorkspacePanelLayer side="assistant" open={panel} style={{ position: "absolute", inset: "12px 12px 12px auto", width: "48%", padding: 12 }}>
            <strong>辅助面板</strong>
            <Input aria-label="面板内的输入" placeholder="写下想法" />
          </WorkspacePanelLayer>
        </div>
      </section>
      <section className="motion-specimen-section">
        <h3>视图连续性</h3>
        <SegmentedControl ariaLabel="样板视图" value={view} onValueChange={setView} options={[{ label: "编辑", value: "write" }, { label: "阅读", value: "read" }]} />
        <div className="motion-specimen-view">
          <PersistentView active={view === "write"}><textarea aria-label="保留实例的草稿" className="ds-input" onChange={(event) => setDraft(event.target.value)} value={draft} /></PersistentView>
          <PersistentView active={view === "read"}><p>{draft}</p></PersistentView>
        </div>
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
