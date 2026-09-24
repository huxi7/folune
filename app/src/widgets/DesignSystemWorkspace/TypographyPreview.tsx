/**
 * [INPUT]: 依赖 app-typography.css 的 data-text-role 与生产 Button/Input，读取样本 DOM 的计算样式
 * [OUTPUT]: TypographyPreview，展示字族、角色、实际字号/行高/字重与控件配对
 * [POS]: Design System 排版检视器；元数据只说明职责，不复制 CSS 数值，缩放/字体载入后重新测量
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLayoutEffect, useRef, useState } from "react";
import { Button, Input } from "../../shared/design-system/components";

const roles = [
  { key: "display", name: "展示", usage: "品牌展示标题", sample: "思想先被写下" },
  { key: "title", name: "衬线标题", usage: "Paper 与文章标题", sample: "让内容成为主角" },
  { key: "editor", name: "主正文", usage: "写作、阅读与自由文字", sample: "界面退后，让笔记与智能自然浮现。" },
  { key: "conversation", name: "聊天正文", usage: "用户消息 / AI 回复；示例为 AI 行距", sample: "从散步到写作，让思路自然连接。" },
  { key: "navigation", name: "紧凑导航", usage: "文件树 / 菜单动作", sample: "产品规划 · 用户访谈" },
  { key: "input", name: "输入文字", usage: "表单 / Select；AI 输入沿用自己的行距", sample: "写下你现在的想法" },
  { key: "action", name: "标准动作", usage: "标准按钮与操作", sample: "保存 · 文件库 · 整理" },
  { key: "label", name: "紧凑动作", usage: "新建 / 字段标签", sample: "新建备忘录" },
  { key: "section", name: "区块标题", usage: "面板 / 设置分组", sample: "让零散想法连起来" },
  { key: "caption", name: "辅助说明", usage: "时间 / 状态 / 补充信息", sample: "最后保存于 14:32" },
  { key: "reference", name: "笔记引用", usage: "固定笔记 / @引用名称", sample: "把周末留给一条小路" },
  { key: "mono", name: "等宽信息", usage: "Token / 路径 / 技术标识", sample: "--primary · memo_2026_09" },
] as const;

type Role = typeof roles[number];
function RoleRow({ role }: { role: Role }) {
  const sample = useRef<HTMLParagraphElement>(null);
  const [metrics, setMetrics] = useState({ size: "—", leading: "—", weight: "—" });
  useLayoutEffect(() => {
    const node = sample.current;
    if (!node) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const css = getComputedStyle(node);
      const next = { size: css.fontSize, leading: css.lineHeight, weight: css.fontWeight };
      setMetrics(previous => previous.size === next.size && previous.leading === next.leading && previous.weight === next.weight ? previous : next);
    };
    const resize = new ResizeObserver(measure);
    const theme = new MutationObserver(measure);
    resize.observe(node);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-visual-context"] });
    void document.fonts.ready.then(measure);
    measure();
    return () => { active = false; resize.disconnect(); theme.disconnect(); };
  }, []);
  return <div className="ds-type-scale-row" role="row">
    <div><strong>{role.name}</strong><code>data-text-role="{role.key}"</code></div>
    <p data-text-role={role.key} ref={sample}>{role.sample}</p>
    <code>{metrics.size} / {metrics.leading}</code>
    <code>{metrics.weight}</code>
    <small>{role.usage}</small>
  </div>;
}

export function TypographyPreview() {
  return <div className="ds-type-system-preview">
    <section aria-label="字体家族" className="ds-type-family-grid">
      <article className="ds-type-family" data-family="interface">
        <div><strong>Interface / 界面</strong><code>--font-sans</code></div>
        <p>Folune 文件库</p><small>Avenir Next × PingFang SC · Noto Sans SC fallback</small>
      </article>
      <article className="ds-type-family" data-family="editorial">
        <div><strong>Editorial / 阅读</strong><code>--font-serif</code></div>
        <p>让内容成为主角</p><small>Iowan Old Style × Songti SC · Noto Serif SC fallback</small>
      </article>
      <article className="ds-type-family" data-family="mono">
        <div><strong>Mono / 系统</strong><code>--font-mono</code></div>
        <p>memo_2026_09</p><small>SF Mono × Cascadia Code · Menlo fallback</small>
      </article>
    </section>
    <p data-text-role="caption">常规字重：Regular 400 · Medium 500 · Semibold 600。下表数值读取实际 CSS；内容加粗另用 700。</p>
    <section aria-label="字号、行高与字重角色" className="ds-type-scale">
      <div className="ds-type-scale-header" role="row"><span>角色 / 消费入口</span><span>中文样本</span><span>字号 / 行高</span><span>字重</span><span>职责</span></div>
      {roles.map(role => <RoleRow key={role.key} role={role} />)}
    </section>
    <section aria-label="控件字体配对" className="ds-type-control-pairing">
      <article><div className="ds-type-pairing-heading"><strong>Button</strong><code>action</code></div><div className="ds-type-pairing-demo"><Button variant="primary">保存</Button><small>操作明确、层级克制</small></div></article>
      <article><div className="ds-type-pairing-heading"><strong>Input</strong><code>input</code></div><div className="ds-type-pairing-demo"><Input aria-label="输入示例" placeholder="输入标题" /><small>输入文字保持可辨认</small></div></article>
      <article><div className="ds-type-pairing-heading"><strong>Paper Body</strong><code>editor</code></div><div className="ds-type-pairing-demo"><p data-text-role="editor">正文保持清楚、自然。</p><small>阅读优先，不追求紧凑</small></div></article>
    </section>
  </div>;
}
