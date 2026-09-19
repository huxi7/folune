/**
 * [INPUT]: 依赖统一 FirstScreen、参数控制器、Controls 与系统动态偏好
 * [OUTPUT]: 对外提供四套颗粒首屏及不改变预览宽度的浮动实验控件
 * [POS]: hero-lab.html 独立装配根；正式 Landing 没有反向依赖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { useMotionPreference } from "../../shared/design-system/useMotionPreference";
import { Controls } from "./Controls";
import { FirstScreen } from "./FirstScreen";
import { useLabState } from "./useLabState";
import { choiceName, isVariant, variants } from "./presets";
import type { ShaderStatus } from "./HeroArtwork";

export function HeroLab() {
  const lab = useLabState();
  const [panel, setPanel] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [height, setHeight] = useState(0);
  const [shaderStatus, setShaderStatus] = useState<ShaderStatus>("loading");
  const [running, setRunning] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const reduced = useMotionPreference();
  const status = shaderStatus === "unavailable" ? "背景未能启动 · 当前为纸色备用面" : shaderStatus === "loading" ? "正在加载背景…" : reduced ? "系统减少动态效果 · 静帧" : lab.paused ? "已暂停 · 参数仍可调节" : isVariant(lab.displayed.choice) && lab.displayed.params.speed === 0 ? "速度为零 · 静帧" : !running ? "离屏或后台 · 已暂停" : "动态预览";
  const close = () => { setPanel(false); toggle.current?.focus(); };
  useEffect(() => {
    if (!panel) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setPanel(false); toggle.current?.focus(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [panel]);
  return <div className="grain-lab">
    <FirstScreen snapshot={lab.displayed} paused={lab.paused || lab.comparing} artworkRef={lab.artwork} showApp={showApp} onStatus={setShaderStatus} onHeight={setHeight} onRunning={setRunning} />
    <footer className="grain-lab-footer"><span>FOLUNE / MATERIAL STUDIES</span><span>{choiceName(lab.displayed.choice)} · {height}px</span><span role="status">{status}</span></footer>
    <div className="grain-lab-dock" aria-label="首屏方案切换">
      <span className="grain-lab-dock-label">材质研究</span>
      <div role="group" aria-label="选择方案">{variants.map(item => <button type="button" key={item.id} aria-label={item.name} title={item.name} aria-pressed={!lab.comparing && lab.current.choice === item.id} onClick={() => lab.select(item.id)}>{item.code}</button>)}</div>
      <button type="button" className="grain-lab-dock-pause" aria-label={lab.paused ? "播放动态" : "暂停动态"} onClick={lab.togglePaused}>{lab.paused ? "播放" : "暂停"}</button>
      {lab.pinned && <button type="button" aria-pressed={lab.comparing} onClick={lab.compare}>{lab.comparing ? "返回" : "对照"}</button>}
      <button ref={toggle} type="button" className="grain-lab-dock-edit" aria-expanded={panel} aria-controls="grain-lab-panel" onClick={() => setPanel(value => !value)}>{panel ? "收起" : "调节"}</button>
    </div>
    {panel && <Controls lab={lab} close={close} showApp={showApp} setShowApp={setShowApp} actualHeight={height} status={status} />}
  </div>;
}
