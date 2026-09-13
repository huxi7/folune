/**
 * [INPUT]: 依赖 Figma 主编辑器的文本/素材与独立局部样式
 * [OUTPUT]: 对外提供可选择文本、结构化三栏的参考编辑器画面
 * [POS]: Landing 主展示插槽；第二阶段在同一插槽换入正式 APP 组件与隔离演示状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { referenceCodeRows, referenceTerminalRows } from "./landingReferenceData";
const projects = [
  { name: "zed", threads: ["Add AccessKit support to GPUI elements", "Fix panic in buffer rope on large paste", "Add vim motion for surround pairs", "Workspace close button hidden with single tab", "GPUI text shaping perf regression", "LSP hover tooltip positioning off-screen", "Refactor project panel tree diffing", "Add multicursor support in search replace"] },
  { name: "cloud", threads: ["Migrate billing endpoints to axum router", "Add TanStack query keys for team settings", "Fix stale cache on org membership change", "Rust SDK pagination for collab sessions", "Dashboard table sorting with TanStack"] },
  { name: "zed.dev", threads: ["Break out page sections into components", "Fix hydration mismatch in blog layout", "Refactor email submit API route", "Add OG image generation for blog posts", "Tailwind v4 migration for global.css tokens", "Fix flaky MDX content loader tests"] },
];
const ages = ["4m", "12m", "48m", "2h", "5h", "1d", "2d", "4d"];
export function LandingEditor() {
  return <div className="reference-editor">
    <aside className="reference-projects"><div className="reference-windowbar"><span className="reference-traffic" aria-hidden="true"><i /><i /><i /></span><span className="reference-search">⌕ Search…</span></div>
      <div className="reference-thread-list">{projects.map(p => <div key={p.name}><h3>⌄ {p.name}</h3>{p.threads.map((t,i) => <div className="reference-thread" data-selected={p.name === "zed" && i === 0} key={t}><div>{t}</div><small>{i % 3 === 0 ? "⑂ " + ["gpui-accesskit", "rope-panic-fix", "first-pass"][i % 3] : ""}<span>• {ages[i]}</span></small></div>)}</div>)}</div>
      <div className="reference-windowbar reference-bottom">⌘ ⌄ <span>⊞</span></div>
    </aside>
    <div className="reference-working"><div className="reference-windowbar">⌄ zed　⑂ main / main <span>♧</span></div>
      <div className="reference-working-body">
        <div className="reference-agent"><div className="reference-tabbar">Add AccessKit support to GPUI elements</div><div className="reference-agent-messages"><p className="reference-user-message">I want to add AccessKit support to GPUI so screen readers can traverse the element tree. Can you start by figuring out where the accessibility tree should be built and how elements currently expose their roles?</p><div className="reference-tool">⌕ Read crates/gpui/src/element.rs</div><div className="reference-tool">⌕ Search "accessibility" in crates/gpui/</div><div className="reference-tool">⌕ List crates/gpui/src/platform/</div><p>Let me look at the GPUI element trait and the window’s paint cycle to understand where we can hook into the tree. I’ll also check if there’s any existing accessibility scaffolding.</p></div><div className="reference-composer"><p>Message the Zed Agent — @ to include context</p><div>Write ⌄ <span>Claude Opus 4.6 ⌄</span></div></div></div>
        <div className="reference-code-panel"><div className="reference-tabbar">‹ ›　scheduler.tsx　 catware.rs　 Uncommitted Changes</div><div className="reference-breadcrumb">src/components/scheduler.tsx</div><div className="reference-code-scroll"><div className="reference-code-lines">{referenceCodeRows.map((row, i) => <div className="reference-code-line" key={i}>{row.map((part, index) => <span key={index} style={{marginLeft:part.gap, width:part.width}}>{part.segments.map((segment,n) => <span key={n} style={{color:segment.color}}>{segment.text}</span>)}</span>)}</div>)}</div></div><div className="reference-terminal"><div className="reference-tabbar">zed.dev — zsh</div><div className="reference-terminal-content"><pre className="reference-terminal-art" aria-label="Zed">{referenceTerminalRows.map(([line,color])=><span key={color} style={{color}}>{line}</span>)}</pre><div><p><span>Editor:</span> Zed</p><p><span>Platform:</span> macOS</p><div className="reference-palette">{["#079eb5","#2b9535","#546022","#a30598","#a433c4","#1259bb","#d24739","#101010","#555555"].map(c=><i key={c} style={{background:c}} />)}</div></div></div></div></div>
      </div><div className="reference-windowbar reference-bottom">⌕　♧　0　▲ 0 <span>Rust　⑂　⌘　☷　⊞</span></div>
    </div><span className="reference-demo-label">↖ Watch Demo</span>
  </div>;
}
