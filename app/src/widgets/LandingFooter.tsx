/**
 * [INPUT]: 依赖 React Router Link、本地 BrandMark 与 Landing 深蓝 Fat Footer 样式
 * [OUTPUT]: 对外提供仅显示 SuperNote 主名称且不带品牌副标题、无位移 hover 的全宽深蓝页脚、上层分栏导航与下层同源分栏线 1.5px 描边/3% 浅蓝填充的 SVG 幽灵字舞台
 * [POS]: app/src/widgets 的独立营销页脚，被 LandingPage 放在工程导轨容器之外并承接全宽页面结尾
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Link } from "react-router-dom";

import { BrandMark } from "../shared/design-system/components";

const footerGroups = [
  {
    items: [
      { href: "#product", label: "智能归档" },
      { href: "#workflow", label: "工作方式" },
      { href: "#pricing", label: "订阅方案" },
      { href: "/app", label: "立即使用", route: true },
    ],
    title: "产品",
  },
  {
    items: [
      { href: "#workflow", label: "使用指南" },
      { href: "#faq", label: "常见问题" },
      { href: "#product", label: "产品预览" },
      { href: "#pricing", label: "方案对比" },
    ],
    title: "资源",
  },
  {
    items: [
      { href: "#product", label: "产品理念" },
      { href: "#faq", label: "数据控制" },
      { href: "#workflow", label: "设计原则" },
      { href: "#product", label: "2026 Beta" },
    ],
    title: "关于",
  },
];

export function LandingFooter() {
  return (
    <footer className="landing-fat-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand">
            <BrandMark />
            <span>
              一个让记录保持自由、让结构在后台持续生长的智能笔记工具。
            </span>
            <div className="landing-footer-brand-meta">
              <span>© 2026 SuperNote</span>
              <span>Built for notes that outlive the moment.</span>
              <span className="landing-footer-status">
                <i aria-hidden="true" />
                Beta system online
              </span>
            </div>
          </div>

          {footerGroups.map((group) => (
            <nav aria-label={`${group.title}导航`} key={group.title}>
              <p>{group.title}</p>
              {group.items.map((item) =>
                item.route ? (
                  <Link
                    className="landing-footer-link"
                    key={item.label}
                    to={item.href}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    className="landing-footer-link"
                    href={item.href}
                    key={item.label}
                  >
                    {item.label}
                  </a>
                ),
              )}
            </nav>
          ))}

          <div className="landing-footer-social">
            <p>社交</p>
            <span>GitHub <small>即将开放</small></span>
            <span>X / Twitter <small>即将开放</small></span>
            <span>即刻 <small>即将开放</small></span>
          </div>
        </div>
      </div>
      <div className="landing-footer-signature-stage">
        <svg
          aria-hidden="true"
          className="landing-footer-signature select-none"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
          viewBox="0 0 1200 280"
        >
          <text
            strokeLinejoin="round"
            textAnchor="middle"
            vectorEffect="non-scaling-stroke"
            x="600"
            y="232"
          >
            SuperNote
          </text>
        </svg>
      </div>
    </footer>
  );
}
