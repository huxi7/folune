/**
 * [INPUT]: 依赖本地 Button、Phosphor 图标、NotebookPreview 与 React Router 导航
 * [OUTPUT]: 对外提供冷调工程蓝图 Hero、轻微一次性淡入、无磁吸 CTA、静态能力条与真实产品预览
 * [POS]: app/src/widgets 的 Landing 首屏，被 LandingPage 消费并定义全页 Blueprint 视觉基准
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  ArrowRightIcon,
  NotePencilIcon,
  SparkleIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

import { Button } from "../shared/design-system/components";
import { NotebookPreview } from "./NotebookPreview";

const featureItems = [
  {
    body: "念头出现时，你只需要把它写下来。",
    icon: NotePencilIcon,
    title: "捕捉，不分类",
  },
  {
    body: "AI 在保存之后，再理解主题和上下文。",
    icon: SparkleIcon,
    title: "保存后再理解",
  },
  {
    body: "优先复用已有位置，必要时才长出新的分支。",
    icon: TreeStructureIcon,
    title: "结构自然生长",
  },
];

export function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="blueprint-section landing-main" id="product">
      <div className="landing-hero">
        <div className="landing-hero-copy motion-safe:animate-blueprint-rise motion-reduce:animate-none">
          <div className="landing-eyebrow">
            <NotePencilIcon aria-hidden="true" size={15} weight="fill" />
            SuperNote / Intelligent notes
          </div>
          <h1 className="landing-title">
            写下内容。
            <span>结构会在保存之后出现。</span>
          </h1>
          <p className="landing-lede">
            一款把“整理”从记录动作中移开的笔记工具。你只负责捕捉想法，SuperNote 在后台理解内容、复用已有位置，并在真正需要时让文件树自然生长。
          </p>
          <div className="landing-actions">
            <Button
              icon={ArrowRightIcon}
              onClick={() => navigate("/app")}
              variant="primary"
            >
              立即使用
            </Button>
            <Button
              onClick={() => document.querySelector("#workflow")?.scrollIntoView({ behavior: "smooth" })}
              variant="secondary"
            >
              查看工作方式
            </Button>
          </div>
        </div>

        <NotebookPreview />

        <div className="landing-feature-strip">
          {featureItems.map((item) => {
            const IconComponent = item.icon;

            return (
              <div className="landing-feature-item" key={item.title}>
                <IconComponent
                  aria-hidden="true"
                  className="shrink-0 text-primary"
                  size={17}
                  weight="bold"
                />
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
