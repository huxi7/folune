/**
 * [INPUT]: 依赖 Motion for React 图标微动、共享 Lucide ArrowRightIcon 与 Landing Blueprint 公告栏样式
 * [OUTPUT]: 对外提供紧贴粘性导航下方、约为 Header 2/3 高、无 hover 填色且无关闭按钮的随页产品公告栏，箭头以 Spring 微动提示可达性
 * [POS]: app/src/widgets 的营销公告组件，被 LandingPage 放入全宽背景、主轨与正文对齐且带视口外轨的独立 RailLayer
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { ArrowRightIcon } from "../shared/design-system/icons";
import { motion } from "motion/react";

export function MarketingAnnouncement() {
  return (
    <a
      className="group blueprint-section marketing-announcement"
      href="#workflow"
    >
      <span className="marketing-announcement-label">New</span>
      <span className="marketing-announcement-copy">
        智能归档进入内测：先写完，再让结构出现。
      </span>
      <motion.span initial="rest" whileHover="hover" variants={{ rest: { x: 0 }, hover: { x: 3, transition: { type: "spring", stiffness: 400, damping: 30 } } }}>
        <ArrowRightIcon aria-hidden="true" size={14} />
      </motion.span>
    </a>
  );
}
