/**
 * [INPUT]: 依赖 React 局部选择状态、本地 Button/Card 与 Phosphor 图标展示产品宪法中定义的三档订阅
 * [OUTPUT]: 对外提供纯白画布、三档可选方案、权益清单与选中反馈组成的 SubscriptionWorkspace
 * [POS]: app/src/widgets 的订阅入口工作区，被 AppDashboard 从 UserMenu 命令切换显示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CheckIcon, ShieldCheckIcon, SparkleIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { Button, Card } from "../shared/design-system/components";

const plans = [
  {
    description: "适合轻量记录，把每天的碎片先安静地收纳整齐。",
    features: ["基础 AI 归档", "个人文件树", "月度整理报告"],
    name: "Starter",
    price: "$5",
    summary: "从不再手动整理开始",
  },
  {
    description: "适合高频记录和长期知识沉淀，让文件树跟着内容一起生长。",
    features: ["高级主题识别", "自动创建新节点", "跨文件夹检索建议", "优先 AI 整理队列"],
    name: "Pro",
    price: "$20",
    recommended: true,
    summary: "把完整的整理工作交给 AI",
  },
  {
    description: "适合团队、研究室和内容工作室，共同维护可审计的知识结构。",
    features: ["团队知识空间", "归档策略审计", "优先 AI 配额", "优先产品支持"],
    name: "Studio",
    price: "$100",
    summary: "为一组人维护同一棵知识树",
  },
];

export function SubscriptionWorkspace() {
  const [selectedPlan, setSelectedPlan] = useState("Pro");

  return (
    <main className="ui-page subscription-workspace">
      <div className="subscription-inner">
        <header className="subscription-header motion-safe:animate-blueprint-rise motion-reduce:animate-none">
          <div className="subscription-kicker">
            <SparkleIcon aria-hidden="true" size={14} weight="fill" />
            Upgrade SuperNote
          </div>
          <h1>为你的记录速度，选一个刚好的方案。</h1>
          <p>
            所有方案都保留你对文件树的最终控制权。AI 只在保存之后工作，不打断写作。
          </p>
          <div className="subscription-billing-note">
            <span>按月订阅</span>
            <span>随时可调整</span>
          </div>
        </header>

        <section className="subscription-grid" aria-label="订阅方案">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.name;

            return (
              <Card
                className="subscription-plan"
                data-recommended={plan.recommended || undefined}
                data-selected={isSelected}
                key={plan.name}
                tone={plan.recommended ? "accent" : "default"}
              >
                <div className="subscription-plan-topline">
                  <span>{plan.name}</span>
                </div>
                <p className="subscription-plan-summary">{plan.summary}</p>
                <div className="subscription-price">
                  <strong>{plan.price}</strong>
                  <span>USD / month</span>
                </div>
                <p className="subscription-plan-description">{plan.description}</p>
                <div className="subscription-plan-divider" />
                <div className="subscription-features">
                  {plan.features.map((feature) => (
                    <p key={feature}>
                      <CheckIcon aria-hidden="true" size={14} weight="bold" />
                      {feature}
                    </p>
                  ))}
                </div>
                <Button
                  className="mt-auto w-full"
                  onClick={() => setSelectedPlan(plan.name)}
                  variant={plan.recommended || isSelected ? "primary" : "secondary"}
                >
                  {isSelected ? `已选择 ${plan.name}` : `选择 ${plan.name}`}
                </Button>
              </Card>
            );
          })}
        </section>

        <footer className="subscription-footer" aria-live="polite">
          <div>
            <ShieldCheckIcon aria-hidden="true" size={17} weight="fill" />
            <span>已选择 {selectedPlan}，支付能力接入后可在此继续。</span>
          </div>
          <span>账户数据与归档结果不会因切换方案丢失。</span>
        </footer>
      </div>
    </main>
  );
}
