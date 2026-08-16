/**
 * [INPUT]: 依赖 React ref、本地 Button/Card/BrandMark/BlueprintDivider、共享 Lucide 图标、CountUp/轻量 reveal 与 React Router 导航
 * [OUTPUT]: 对外提供由唯一 Divider 分隔、无装饰 hover 填色/磁吸/聚光/浮动的指标、问题、流程、场景、定价、FAQ 与大图标/短标题/小按钮组成的无末端节点预页脚
 * [POS]: app/src/widgets 的 Landing 扩展模块，被 LandingPage 懒加载并保持工程骨架静止、内容独立入场，让正文竖轨无节点直达 Footer
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  PlusIcon,
} from "../shared/design-system/icons";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";

import { BrandMark, Button, Card } from "../shared/design-system/components";
import { BlueprintDivider } from "./BlueprintDivider";
import { CountUp } from "./LandingMotion/CountUp";
import { useLandingReveal } from "./LandingMotion/useLandingReveal";

const behaviorMetrics = [
  { label: "保存前必选分类", suffix: "", value: 0 },
  { label: "统一记录入口", suffix: "", value: 1 },
  { label: "归档判断步骤", suffix: "", value: 3 },
  { label: "结构控制权", suffix: "%", value: 100 },
];

const problemItems = [
  {
    body: "当记录之前还要挑文件夹和标签，念头已经被界面打断。",
    title: "分类发生得太早",
  },
  {
    body: "临时标题和缺失标签让内容越积越多，也越来越难重新找到。",
    title: "内容留下了，路径丢失了",
  },
  {
    body: "为昨天设计的目录，未必接得住明天突然出现的新主题。",
    title: "结构很快变成维护工作",
  },
];

const workflowSteps = [
  { body: "像使用最简单的备忘录一样，把当下最重要的内容留下。", label: "01", title: "捕捉" },
  { body: "保存之后，AI 再读取主题、语义和当前文件树的上下文。", label: "02", title: "理解" },
  { body: "优先复用已有位置；只有真正需要时，才创建新的结构分支。", label: "03", title: "归位" },
];

const useCases = [
  "会议里来不及整理的决定",
  "阅读时值得留下的句子",
  "一闪而过的产品与创作想法",
  "需要长期追踪的项目线索",
];

const pricingPlans = [
  {
    body: "给日常记录一个持续整洁的起点。",
    name: "Starter",
    points: ["基础 AI 归档", "个人文件树", "月度整理报告"],
    price: "$5",
  },
  {
    body: "给高频记录和长期知识沉淀更多空间。",
    highlighted: true,
    name: "Pro",
    points: ["高级主题识别", "自动新建文件夹", "跨文件夹检索建议"],
    price: "$20",
  },
  {
    body: "让一组人维护同一套清晰、可审计的知识结构。",
    name: "Studio",
    points: ["团队空间", "归档策略审计", "优先 AI 配额"],
    price: "$100",
  },
];

const faqItems = [
  {
    answer: "AI 会优先匹配现有文件夹，只有主题明显不适配时才创建新节点；每一次调整都可以查看和修改。",
    question: "AI 会不会乱建文件夹？",
  },
  {
    answer: "可以。SuperNote 负责初步整理，你始终拥有最终结构的控制权。",
    question: "我还能手动调整分类吗？",
  },
  {
    answer: "归档发生在保存之后，不会阻塞输入；处理结果会安静地回到当前文件树。",
    question: "AI 会打断我写笔记吗？",
  },
];

function SectionHeading({
  body,
  eyebrow,
  title,
}: {
  body: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="landing-section-heading">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      <span>{body}</span>
    </div>
  );
}

export function LandingSections() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingReveal(rootRef);

  return (
    <div className="landing-sections" ref={rootRef}>
      <section
        aria-label="产品行为指标"
        className="blueprint-section landing-metrics-section"
      >
        <div
          className="landing-metrics-grid"
          data-landing-reveal
          data-reveal-stagger
        >
          {behaviorMetrics.map((metric) => (
            <div data-reveal-item key={metric.label}>
              <strong>
                <CountUp suffix={metric.suffix} value={metric.value} />
              </strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </section>

      <BlueprintDivider />

      <section className="blueprint-section landing-content-section">
        <div
          className="landing-section-content landing-split-section"
          data-landing-reveal
        >
          <div className="landing-sticky-copy">
            <p>The friction</p>
            <h2>你不应该在每次记录前，都先设计一个系统。</h2>
            <span>
              文件夹、标签和链接本身没有错。问题在于，大多数笔记工具要求你在想法最脆弱的时候，同时完成记录与整理。
            </span>
          </div>
          <div className="landing-index-list" data-reveal-stagger>
            {problemItems.map((item, index) => (
              <article data-reveal-item key={item.title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <BlueprintDivider />

      <section
        className="blueprint-section landing-content-section"
        id="workflow"
      >
        <div className="landing-section-content" data-landing-reveal>
          <SectionHeading
            body="整个过程发生在保存之后：不弹出分类选择，也不要求你停下来整理。"
            eyebrow="How it works"
            title="记录是一条直线。整理在后台完成。"
          />
          <ol className="landing-workflow-grid" data-reveal-stagger>
            {workflowSteps.map((step) => (
              <li data-reveal-item key={step.label}>
                <span>{step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <BlueprintDivider />

      <section className="blueprint-section landing-content-section">
        <div
          className="landing-section-content landing-use-cases"
          data-landing-reveal
        >
          <div>
            <p>For real notes</p>
            <h2>重要的信息先被留下，结构可以晚一点出现。</h2>
            <span>会议结论、阅读摘录、产品想法和长期项目，都从同一个简单入口开始。</span>
          </div>
          <div className="landing-use-case-list" data-reveal-stagger>
            {useCases.map((item) => (
              <div data-reveal-item key={item}>
                <CheckCircleIcon aria-hidden="true" size={16} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <BlueprintDivider />

      <section
        className="blueprint-section landing-content-section"
        id="pricing"
      >
        <div className="landing-section-content" data-landing-reveal>
          <SectionHeading
            body="每个方案都包含保存后自动归档；差别只在整理额度、协作方式与高级能力。"
            eyebrow="Plans"
            title="从个人记录，到一组人的知识结构。"
          />
          <div className="landing-pricing-grid" data-reveal-stagger>
            {pricingPlans.map((plan) => (
              <Card
                className="landing-pricing-card"
                data-featured={plan.highlighted || undefined}
                data-reveal-item
                key={plan.name}
                tone={plan.highlighted ? "accent" : "default"}
              >
                <div className="landing-plan-heading">
                  <p>{plan.name}</p>
                  {plan.highlighted ? <span>Recommended</span> : null}
                </div>
                <div className="landing-plan-price">
                  <strong>{plan.price}</strong>
                  <span>/ month</span>
                </div>
                <p className="landing-plan-body">{plan.body}</p>
                <div className="landing-plan-points">
                  {plan.points.map((point) => (
                    <p key={point}>
                      <CheckIcon aria-hidden="true" size={14} />
                      {point}
                    </p>
                  ))}
                </div>
                <Button
                  className="mt-auto w-full"
                  onClick={() => navigate("/app")}
                  variant={plan.highlighted ? "primary" : "secondary"}
                >
                  选择 {plan.name}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <BlueprintDivider />

      <section
        className="blueprint-section landing-content-section"
        id="faq"
      >
        <div className="landing-section-content" data-landing-reveal>
          <SectionHeading
            body="控制权、创建文件夹的边界，以及记录过程会不会被打断。"
            eyebrow="FAQ"
            title="把整理交给 AI，不等于交出控制权。"
          />
          <div className="landing-faq-list">
            {faqItems.map((item) => (
              <details className="group" key={item.question}>
                <summary>
                  <span>{item.question}</span>
                  <PlusIcon
                    aria-hidden="true"
                    className="transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
                    size={17}
                  />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <BlueprintDivider />

      <section className="blueprint-section landing-prefooter">
        <div className="landing-prefooter-content" data-landing-reveal>
          <div className="landing-product-icon">
            <BrandMark iconOnly />
          </div>
          <h2>
            <span>立即使用</span>{" "}
            <span>SuperNote</span>
          </h2>
          <Button
            icon={ArrowRightIcon}
            onClick={() => navigate("/app")}
            variant="primary"
          >
            开始
          </Button>
        </div>
      </section>
    </div>
  );
}
