/**
 * [INPUT]: 依赖本地 Button、共享 Lucide 图标、Motion for React 轻量变体、NotebookPreview 与 React Router 导航
 * [OUTPUT]: 对外提供冷调工程蓝图 Hero、由 Motion 独占的 统一非线性 入场、无磁吸 CTA、带错开入场的能力条与真实产品预览
 * [POS]: app/src/widgets 的 Landing 首屏，被 LandingPage 消费并定义全页 Blueprint 视觉基准
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  ArrowRightIcon,
  NotePencilIcon,
  SparkleIcon,
  TreeStructureIcon,
} from "../shared/design-system/icons";
import { motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";

import { revealVariants, staggerVariants } from "../shared/design-system/motion";
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

  const reduced = Boolean(useReducedMotion());
  const fadeInUp = revealVariants(reduced);
  const staggerItem = fadeInUp;
  const staggerContainer = staggerVariants(reduced);
  return (
    <section className="blueprint-section landing-main" id="product">
      <div className="landing-hero">
        <motion.div
          className="landing-hero-copy"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          <div className="landing-eyebrow">
            <NotePencilIcon aria-hidden="true" size={14} />
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
        </motion.div>

        <NotebookPreview />

        <motion.div
          className="landing-feature-strip"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {featureItems.map((item) => {
            const IconComponent = item.icon;

            return (
              <motion.div className="landing-feature-item" key={item.title} variants={staggerItem}>
                <span>
                  <IconComponent
                    aria-hidden="true"
                    className="shrink-0 text-primary"
                    size={16}
                  />
                </span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
