/**
 * [INPUT]: 依赖本地 Card 与 Phosphor 图标展示确定性的产品结构
 * [OUTPUT]: 对外提供含工具轨、文件树、文档纸面与 Agent 归档面板的 /app 工作台预览
 * [POS]: app/src/widgets 的首屏产品视觉，被 LandingHero 消费并作为实际产品信号
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  CheckCircleIcon,
  DotsThreeIcon,
  FileTextIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  PaperPlaneRightIcon,
  PlusIcon,
  SparkleIcon,
} from "@phosphor-icons/react";

import { Card } from "../shared/design-system/components";

const folders = [
  { count: 12, name: "工作", open: true },
  { count: 8, name: "生活", open: false },
  { count: 21, name: "灵感", open: false },
];

const filingSteps = [
  "识别记录主题",
  "匹配已有文件夹",
  "完成归档并保留路径",
];

export function NotebookPreview() {
  return (
    <Card
      className="notebook-preview motion-safe:animate-blueprint-preview motion-reduce:animate-none"
      data-landing-preview
    >
      <header className="notebook-window-bar">
        <div className="notebook-window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="notebook-window-title">
          <SparkleIcon aria-hidden="true" size={13} weight="fill" />
          SuperNote / 价格页
        </div>
      </header>

      <div className="notebook-preview-grid">
        <div aria-hidden="true" className="notebook-preview-rail">
          <span className="preview-rail-action">
            <PlusIcon aria-hidden="true" size={15} weight="bold" />
          </span>
          <span className="preview-rail-action" data-active="true">
            <FileTextIcon aria-hidden="true" size={15} weight="fill" />
          </span>
          <span className="preview-rail-action">
            <MagnifyingGlassIcon aria-hidden="true" size={15} />
          </span>
          <span className="preview-rail-avatar">林</span>
        </div>

        <aside className="notebook-preview-sidebar">
          <div className="preview-sidebar-heading">
            <span>备忘录</span>
            <DotsThreeIcon aria-hidden="true" size={15} weight="bold" />
          </div>
          <div className="preview-folder-list">
            {folders.map((folder) => (
              <div key={folder.name}>
                <div className="preview-folder-row" data-open={folder.open}>
                  <FolderOpenIcon aria-hidden="true" size={14} weight={folder.open ? "fill" : "regular"} />
                  <span>{folder.name}</span>
                  <span>{folder.count}</span>
                </div>
                {folder.open ? (
                  <div className="preview-document-row" data-active="true">
                    <FileTextIcon aria-hidden="true" size={13} weight="fill" />
                    <span>会员价格页</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="preview-sidebar-footnote">3 条记录刚刚完成整理</div>
        </aside>

        <article className="notebook-preview-document">
          <div className="preview-document-meta">
            <span>工作 / 商业模式</span>
            <span>今天 10:24</span>
          </div>
          <h2>给订阅页补一个 20 美金档位说明</h2>
          <div className="preview-document-copy">
            <p># 价格页</p>
            <p>
              5 美金：个人轻量整理<br />
              20 美金：高频记录与长期沉淀<br />
              100 美金：团队和工作室
            </p>
            <p>下一步：把订阅权益写得更清楚。</p>
          </div>
          <div className="preview-filing-event">
            <SparkleIcon aria-hidden="true" size={14} weight="fill" />
            <span>AI 已归档至「工作 / 商业模式」</span>
          </div>
        </article>

        <aside className="notebook-preview-agent">
          <div className="preview-agent-heading">
            <div>
              <p>Agent</p>
              <span>智能归档</span>
            </div>
            <SparkleIcon aria-hidden="true" size={16} weight="fill" />
          </div>
          <div className="preview-agent-message">
            我正在检查这条记录与当前文件树的关系。
          </div>
          <ol className="preview-agent-steps">
            {filingSteps.map((step) => (
              <li key={step}>
                <CheckCircleIcon aria-hidden="true" size={14} weight="fill" />
                {step}
              </li>
            ))}
          </ol>
          <div className="preview-agent-composer">
            <span>问它会怎么归档…</span>
            <PaperPlaneRightIcon aria-hidden="true" size={14} weight="fill" />
          </div>
        </aside>
      </div>
    </Card>
  );
}
