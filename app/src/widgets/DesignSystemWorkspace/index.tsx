/**
 * [INPUT]: 依赖五层 designSystemSections/真实组件 catalog、全局 ThemeProvider、ComponentTile 统一陈列单元与本入口独占导入的 styles/design-system-workspace.css
 * [OUTPUT]: 对外提供可切换真实 light/dark 主题的 Foundations、Primitives、Navigation & Overlays、Editorial、AI & Organize DEV-only Design System
 * [POS]: app/src/widgets/DesignSystemWorkspace 的入口，被 AppDashboard 懒加载并表达 Token 到 Signature Pattern 的依赖方向
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { ComponentTile } from "./ComponentTile";
import { SegmentedControl, type SegmentedControlOption } from "../../shared/design-system/components";
import { useTheme, type Theme } from "../../shared/theme/ThemeProvider";
import {
  designSystemSamples,
  designSystemSections,
} from "./componentCatalog";

import "../../styles/design-system-workspace.css";

const themeOptions: SegmentedControlOption<Theme>[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

export function DesignSystemWorkspace() {
  const { setTheme, theme } = useTheme();

  return (
    <main className="ui-page ds-workspace-page">
      <div className="ui-page-inner ds-workspace-inner">
        <header className="design-system-header">
          <div>
            <p className="design-system-kicker">Development only</p>
            <h1 className="design-system-title">Design System</h1>
          </div>
          <div className="design-system-intro">
            <p>
              Quiet Editorial Instrument 先定义生产 Foundations，再陈列正在使用的
              <code> shared/design-system</code> 组件。这里没有仅供展示的第二套视觉值。
            </p>
            <SegmentedControl
              ariaLabel="Design System 真实主题"
              onValueChange={setTheme}
              options={themeOptions}
              value={theme}
            />
            <small>Hover / Focus / Active 直接交互；reduced-motion 跟随系统。</small>
          </div>
        </header>

        {designSystemSections.map((section, index) => (
          <section className="design-system-section" key={section}>
            <header className="design-system-section-header">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{section}</h2>
            </header>
            <div className="design-system-matrix">
              {designSystemSamples
                .filter((sample) => sample.category === section)
                .map((sample) => (
                  <ComponentTile key={sample.id} sample={sample} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
