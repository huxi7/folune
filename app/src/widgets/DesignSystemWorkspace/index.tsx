/**
 * [INPUT]: 依赖真实组件 catalog 与 ComponentTile 统一陈列单元
 * [OUTPUT]: 对外提供以同构卡片矩阵呈现全部生产组件的 DEV-only V1 Design System
 * [POS]: app/src/widgets/DesignSystemWorkspace 的入口，被 AppDashboard 在开发环境懒加载并保持最小展示边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { ComponentTile } from "./ComponentTile";
import { designSystemSamples } from "./componentCatalog";

export function DesignSystemWorkspace() {
  return (
    <main className="ui-page ds-workspace-page">
      <div className="ui-page-inner ds-workspace-inner">
        <header className="design-system-header">
          <div>
            <p className="design-system-kicker">Development only</p>
            <h1 className="design-system-title">Design System</h1>
          </div>
          <p className="design-system-intro">
            只陈列生产界面正在使用的 <code>shared/design-system</code> 组件。
            AI 消息的用户气泡、无卡片流式正文、ThinkingMark 与工具调用均在此归档。
          </p>
        </header>

        <section aria-label="V1 组件目录" className="design-system-matrix">
          {designSystemSamples.map((sample) => (
            <ComponentTile key={sample.id} sample={sample} />
          ))}
        </section>
      </div>
    </main>
  );
}
