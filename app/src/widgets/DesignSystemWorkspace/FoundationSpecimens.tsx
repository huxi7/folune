/**
 * [INPUT]: 依赖生产语义图标、颜色/曲率/空间 token 与 LiveTokenValue 的浏览器读数
 * [OUTPUT]: ColorPreview、SpatialRhythmPreview 与 ShapeMaterialPreview
 * [POS]: DesignSystemWorkspace 的基础样板层；用色块、标尺与表面展示规则，可见参数读取当前主题
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { NotePencilIcon } from "../../shared/design-system/icons";
import { LiveTokenValue } from "./LiveTokenValue";

const colorTokens = [
  ["Stage", "workspace-stage"], ["Paper", "paper-surface"],
  ["Card", "card"], ["Popover", "popover"],
  ["Ink", "foreground"], ["Muted", "muted-foreground"],
  ["Hairline", "border"], ["Hover", "interactive-hover"],
  ["Selected", "app-selected-surface"], ["Primary", "primary"],
  ["Primary Hover", "primary-hover"], ["Primary Pressed", "primary-active"],
  ["Neutral Accent", "accent"], ["Saving", "processing-surface"],
  ["Saving Ink", "processing-foreground"], ["AI Text", "app-assistant-foreground"],
  ["Message", "app-message-surface"], ["Focus", "ring"],
  ["Success", "success"], ["Warning", "warning"],
  ["Warning Surface", "warning-soft"], ["Danger", "destructive"],
  ["Danger Surface", "destructive-soft"], ["Overlay", "overlay"],
] as const;

const spatialSteps = ["1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "24"] as const;
const radiusTokens = [
  ["compact", "Compact"], ["control", "Control"], ["paper", "Paper"],
  ["menu", "Menu"], ["panel", "Panel"], ["dialog", "Dialog"],
] as const;

export function ColorPreview() {
  return (
    <div className="ds-color-system-preview">
      <div className="ds-color-system-note">
        <strong>Soft Ink · 柔和墨蓝</strong>
        <span>Primary <LiveTokenValue kind="color" token="primary" /></span>
      </div>
      <div className="ds-color-preview">
        {colorTokens.map(([label, token]) => (
          <span data-color={token} key={token}>
            <i aria-hidden="true" style={{ background: `var(--${token})` }} />
            <small>{label}</small>
            <code>--{token}</code>
            <LiveTokenValue kind="color" token={token} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function ShapeMaterialPreview() {
  return (
    <div className="ds-foundation-material-preview">
      <div className="ds-radius-preview">
        {radiusTokens.map(([token, label]) => (
          <span data-radius={token} key={token} style={{ borderRadius: `var(--radius-${token})` }}>
            <strong><LiveTokenValue token={`radius-${token}`} /></strong><small>{label}</small>
          </span>
        ))}
      </div>
      <p className="ds-spatial-rule">Control <LiveTokenValue token="radius-control" /> · Inner <LiveTokenValue token="radius-inner-control" /></p>
      <div className="ds-elevation-preview">
        <span data-elevation="paper">Paper</span>
        <span data-elevation="panel">Panel</span>
        <span data-elevation="popover">Popover</span>
      </div>
    </div>
  );
}

export function SpatialRhythmPreview() {
  return (
    <div className="ds-spatial-rhythm-preview">
      <section aria-label="空间标尺" className="ds-space-scale">
        <div className="ds-spatial-section-heading"><p>间距</p><span>基准 <LiveTokenValue token="spacing" /></span></div>
        <ul>
          {spatialSteps.map(step => (
            <li data-space={step} key={step}>
              <code>space-{step}</code>
              <span aria-hidden="true" className="ds-space-measure"><i style={{ width: `var(--space-${step})` }} /></span>
              <small><LiveTokenValue token={`space-${step}`} /></small>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="界面尺寸阶梯" className="ds-size-system">
        <div className="ds-spatial-section-heading">
          <p>控件尺寸</p>
          <span><LiveTokenValue token="control-height-compact" /> / <LiveTokenValue token="control-height-default" /> / <LiveTokenValue token="control-height-large" /></span>
        </div>
        <div aria-label="面板顶栏与紧凑命令" className="ds-panel-header-specimen" role="img">
          <div className="ds-panel-header-specimen-copy">
            <strong>Panel Header</strong>
            <span><LiveTokenValue token="panel-header-height" /> · <LiveTokenValue token="panel-header-padding-inline" /> inline</span>
          </div>
          <span className="ds-panel-header-specimen-control"><NotePencilIcon aria-hidden="true" size={16} /></span>
        </div>
        <div className="ds-control-size-row">
          <span data-control-size="compact"><i />Tree row <code><LiveTokenValue token="control-height-compact" /></code></span>
          <span data-control-size="button"><i />Button <code><LiveTokenValue token="button-height-default" /></code></span>
          <span data-control-size="default"><i />Input <code><LiveTokenValue token="control-height-default" /></code></span>
          <span data-control-size="header"><i />Header <code><LiveTokenValue token="panel-header-height" /></code></span>
        </div>
      </section>
    </div>
  );
}
