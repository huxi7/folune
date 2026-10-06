/**
 * [INPUT]: 依赖 LabController、候选元数据与实际有效的参数范围
 * [OUTPUT]: 对外提供具有明确方案名称的 A/B 调参面板、多组本地收藏和配置交换
 * [POS]: Lab 操作层；每项控制直达背景参数，原版参照只开放共用高度与播放
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import { bounds, choiceName, defaults, isRedesigned, isVariant, references, variants } from "./presets";
import { SavedStudies } from "./SavedStudies";
import type { Parameters } from "./presets";
import type { LabController } from "./useLabState";

type SliderProps = { label: string; value: number; min: number; max: number; step: number; hint?: string; display?: string; onChange: (value: number) => void };
function Slider({ label, value, min, max, step, hint, display, onChange }: SliderProps) {
  return <label className="grain-lab-slider"><span><span>{label}</span><output>{display ?? value.toFixed(step >= 1 ? 0 : 2)}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
    {hint && <small>{hint}</small>}
  </label>;
}

export function Controls({ lab, close, showApp, setShowApp, actualHeight, status }: {
  lab: LabController; close: () => void; showApp: boolean; setShowApp: (value: boolean) => void; actualHeight: number; status: string;
}) {
  const [config, setConfig] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const { current, displayed, comparing } = lab;
  const variant = variants.find(item => item.id === displayed.choice);
  const original = !isVariant(displayed.choice);
  const localShader = displayed.choice === "ink" || displayed.choice === "mist" || displayed.choice === "ink-b";
  const redesigned = isRedesigned(displayed.choice);
  const edited = isVariant(current.choice) && JSON.stringify(current.params) !== JSON.stringify(defaults[current.choice]);
  function parameter(key: keyof Parameters, label: string, hint?: string) {
    const [min, max, step] = bounds[key];
    const value = displayed.params[key];
    const display = ["strength", "clear", "density", "disorder", "softness", "noise"].includes(key) ? `${Math.round(value * 100)}%` : key === "grain" ? `${value.toFixed(2)} px` : key === "rotation" ? `${value}°` : undefined;
    return <Slider key={key} label={label} value={value} min={min} max={max} step={step} display={display} hint={hint} onChange={n => lab.update(key, n)} />;
  }
  async function copyConfig() {
    const text = lab.exportConfig();
    setConfig(text);
    try { await navigator.clipboard.writeText(text); lab.setNotice("配置已复制，包含当前画面时间与高度。"); }
    catch { setConfigOpen(true); lab.setNotice("请从下方文本框手动复制配置。"); }
  }
  return <aside className="grain-lab-panel" id="grain-lab-panel" aria-label="首屏材质调节">
    <div className="grain-lab-panel-heading"><div><span className="grain-lab-eyebrow">FOLUNE / MATERIAL STUDIES</span><h2>首屏材质研究</h2></div><button type="button" onClick={close} aria-label="收起调节面板">收起</button></div>
    <div className="grain-lab-panel-scroll">
      <div className="grain-lab-choices" role="group" aria-label="01A 与 02A 方案">{variants.map(item => <button type="button" key={item.id} aria-label={`${item.code} ${item.name}`} aria-pressed={!comparing && current.choice === item.id} onClick={() => lab.select(item.id)}>
        <span className={`grain-lab-swatch grain-lab-swatch-${item.id}`} aria-hidden="true" />
        <span><small>{item.code}</small><strong>{item.name}</strong><em>{item.subtitle}</em></span>
      </button>)}</div>
      <div className="grain-lab-description"><span>{comparing ? "正在查看固定对照" : original ? "原始参数参照" : edited ? "你的调整 · 自动保存在本机" : "作者默认参数"}</span><p>{variant?.description ?? "保留上一轮 Shader 原始参数，使用统一首屏排版。用于观察材质与画幅的变化。"}</p></div>
      <section className="grain-lab-control-section" aria-label="画幅">
        <div className="grain-lab-section-title"><h3>画幅</h3><span>当前 {actualHeight || "—"} px</span></div>
        {comparing && !lab.lockHeight && <p className="grain-lab-help">正在预览收藏原高度 {displayed.height}svh；下方保留当前草稿的高度设置。</p>}
        <div className="grain-lab-height-presets">{[{ n: 60, label: "紧凑" }, { n: 68, label: "舒展" }, { n: 76, label: "沉浸" }].map(item => <button type="button" key={item.n} aria-pressed={current.height === item.n} onClick={() => lab.setHeight(item.n)}>{item.label}<small>{item.n}%</small></button>)}</div>
        <Slider label="Hero 高度" value={current.height} min={50} max={85} step={1} display={`${current.height} svh`} hint={current.height >= 76 ? "沉浸档允许产品展示落到下一屏。" : "矮屏会自动收一些留白，让三栏与产品起始部分有空间。"} onChange={lab.setHeight} />
        <label className="grain-lab-check"><input type="checkbox" checked={showApp} onChange={event => setShowApp(event.target.checked)} /><span>查看与 APP 展示区的衔接</span></label>
      </section>
      {!original && <fieldset className="grain-lab-control-section" disabled={comparing}><legend>材质与动态</legend>
        {comparing && <p className="grain-lab-help">先返回当前方案，再继续调节。</p>}
        {parameter("strength", "背景浓淡")}
        {displayed.choice !== "paper" ? parameter("grain", "颗粒粗细", "只改变微粒尺寸，不改变大范围构图。") : <p className="grain-lab-help">此版保留组件原生纸粒尺寸，使用下方“纹理起伏”调节纸感。</p>}
        {parameter("scale", "图案尺度", "数值越大，明暗结构越舒展。")}
        {parameter("speed", "动态速度")}
        {parameter("clear", "中央留白", "降低文字后方的背景存在感。")}
        {redesigned && parameter("softness", "边缘柔和度", "降低会显出墨面轮廓，提高会让边缘融入纸面。")}
        <details className="grain-lab-advanced"><summary>进一步调整</summary>
          {localShader && parameter("density", "着墨密度")}
          {displayed.choice !== "print" && parameter("disorder", localShader ? "形态自然度" : "纹理起伏")}
          {displayed.choice === "paper-b" && parameter("noise", "纸粒浓度", "控制着墨颗粒，与边缘柔和度分开。")}
          {parameter("x", "左右重心")}{parameter("y", "上下重心")}{parameter("rotation", "方向")}
          {localShader && parameter("seed", "构图种子", "固定种子可以复现画面；变化会重新组织颗粒。")}
        </details>
        <button type="button" className="grain-lab-text-button" onClick={lab.reset}>恢复此方案默认值</button>
      </fieldset>}
      <section className="grain-lab-control-section" aria-label="比较">
        <div className="grain-lab-section-title"><h3>停下来比较</h3><span>{lab.paused ? "已定格" : "连续播放"}</span></div>
        <div className="grain-lab-button-row"><button type="button" onClick={lab.togglePaused}>{lab.paused ? "继续播放" : "暂停动态"}</button><button type="button" onClick={lab.pin} disabled={comparing}>固定为对照</button></div>
        {lab.pinned && <button type="button" className="grain-lab-compare" aria-pressed={comparing} onClick={lab.compare}>{comparing ? "返回当前方案" : `对照：${choiceName(lab.pinned.choice)}`}</button>}
        <p className="grain-lab-help">快速对照会定格保存的时刻，每次只显示一幅完整首屏。</p>
      </section>
      <SavedStudies lab={lab} />
      <details className="grain-lab-advanced grain-lab-reference"><summary>早期 A / B / D 参照</summary><div className="grain-lab-button-row">{references.map(item => <button type="button" key={item.id} aria-pressed={current.choice === item.id} onClick={() => lab.select(item.id)}>{item.name}</button>)}</div><p className="grain-lab-help">早期参数保持不变；03、04 已退出本轮候选，旧收藏仍可恢复。</p></details>
      <section className="grain-lab-control-section" aria-label="保存配置">
        <div className="grain-lab-button-row"><button type="button" onClick={copyConfig}>复制配置</button><button type="button" onClick={() => setConfigOpen(value => !value)}>载入配置</button></div>
        {configOpen && <div className="grain-lab-config"><label htmlFor="grain-lab-config">粘贴配置，或复制下方文本</label><textarea id="grain-lab-config" value={config} onChange={event => setConfig(event.target.value)} spellCheck={false} /><button type="button" onClick={() => { if (lab.importConfig(config)) setConfigOpen(false); }}>应用配置</button></div>}
        <p className="grain-lab-notice" role="status">{lab.notice}</p>
        <p className="grain-lab-help">{status}<br />{variant?.source ?? "Paper Shaders · 原始参数"}</p>
        <a className="grain-lab-production" href="/" target="_blank" rel="noreferrer">查看正式 Landing ↗</a>
      </section>
    </div>
  </aside>;
}
