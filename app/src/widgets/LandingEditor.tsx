/**
 * [INPUT]: 依赖共享 BrandMark 与 Figma 主编辑器的文本/素材与独立局部样式
 * [OUTPUT]: 对外提供中文说明、保留英文代码和技术标识的三栏参考编辑器画面
 * [POS]: Landing 主展示插槽；第二阶段在同一插槽换入正式 APP 组件与隔离演示状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { referenceCodeRows } from "./landingReferenceData";
import { BrandMark } from "../shared/design-system/components";
const projects = [
  { name: "zed", threads: ["为 GPUI 元素添加 AccessKit 支持", "修复大量粘贴时的缓冲区异常", "添加 Vim 成对包围操作", "修复单标签页时关闭按钮隐藏", "GPUI 文本排版性能回归", "修复 LSP 提示超出屏幕", "重构项目面板树对比", "搜索替换支持多光标"] },
  { name: "cloud", threads: ["迁移账单接口路由", "添加团队设置查询键", "修复成员变更时的过期缓存", "协作会话的 Rust SDK 分页", "工作台表格排序"] },
  { name: "zed.dev", threads: ["将页面区块拆分为组件", "修复博客布局水合差异", "重构邮件提交接口", "为博客添加分享图片", "迁移全局样式到 Tailwind v4", "修复不稳定的 MDX 加载测试"] },
];
const ages = ["4m", "12m", "48m", "2h", "5h", "1d", "2d", "4d"];
export function LandingEditor() {
  return <div className="reference-editor">
    <aside className="reference-projects"><div className="reference-windowbar"><span className="reference-traffic" aria-hidden="true"><i /><i /><i /></span><span className="reference-search">⌕ 搜索…</span></div>
      <div className="reference-thread-list">{projects.map(p => <div key={p.name}><h3>⌄ {p.name === "zed" ? "Folune" : p.name}</h3>{p.threads.map((t,i) => <div className="reference-thread" data-selected={p.name === "zed" && i === 0} key={t}><div>{t}</div><small>{i % 3 === 0 ? "⑂ " + ["gpui-accesskit", "rope-panic-fix", "first-pass"][i % 3] : ""}<span>• {ages[i]}</span></small></div>)}</div>)}</div>
      <div className="reference-windowbar reference-bottom">⌘ ⌄ <span>⊞</span></div>
    </aside>
    <div className="reference-working"><div className="reference-windowbar">⌄ Folune　⑂ main / main <span>♧</span></div>
      <div className="reference-working-body">
        <div className="reference-agent"><div className="reference-tabbar">为 GPUI 元素添加 AccessKit 支持</div><div className="reference-agent-messages"><p className="reference-user-message">我想为 GPUI 添加 AccessKit 支持，让屏幕阅读器能遍历元素树。请先了解应该在哪里构建无障碍树，以及元素如何暴露各自的角色。</p><div className="reference-tool">⌕ Read crates/gpui/src/element.rs</div><div className="reference-tool">⌕ Search "accessibility" in crates/gpui/</div><div className="reference-tool">⌕ List crates/gpui/src/platform/</div><p>我会先查看 GPUI 的元素接口和窗口绘制周期，找到接入树结构的位置，再检查已有的无障碍支持。</p></div><div className="reference-composer"><p>向 AI 提问，输入 @ 引用上下文</p><div>写入 ⌄ <span>Claude Opus 4.6 ⌄</span></div></div></div>
        <div className="reference-code-panel"><div className="reference-tabbar">‹ ›　scheduler.tsx　 catware.rs　 未提交的更改</div><div className="reference-breadcrumb">src/components/scheduler.tsx</div><div className="reference-code-scroll"><div className="reference-code-lines">{referenceCodeRows.map((row, i) => <div className="reference-code-line" key={i}>{row.map((part, index) => <span key={index} style={{marginLeft:part.gap, width:part.width}}>{part.segments.map((segment,n) => <span key={n} style={{color:segment.color}}>{segment.text}</span>)}</span>)}</div>)}</div></div><div className="reference-terminal"><div className="reference-tabbar">zed.dev — zsh</div><div className="reference-terminal-content"><BrandMark className="reference-terminal-brand" iconOnly /><div><p><span>编辑器：</span> Folune</p><p><span>平台：</span> macOS</p><div className="reference-palette">{["#079eb5","#2b9535","#546022","#a30598","#a433c4","#1259bb","#d24739","#101010","#555555"].map(c=><i key={c} style={{background:c}} />)}</div></div></div></div></div>
      </div><div className="reference-windowbar reference-bottom">⌕　♧　0　▲ 0 <span>Rust　⑂　⌘　☷　⊞</span></div>
    </div><span className="reference-demo-label">参考编辑器演示</span>
  </div>;
}
