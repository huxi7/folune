/**
 * [INPUT]: 依赖 React Router 认证入口、BlueprintFrame/Divider 与局部 Footer 样式
 * [OUTPUT]: 对外提供品牌区、四组 Folune 导航与居中描边字标；待接通入口无跳转行为
 * [POS]: widgets 的营销页收尾；沿用正文导轨与 DS 墨蓝，认证复用首页弹窗，其余入口仅预留展示
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Link } from "react-router-dom";
import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";

const columns = [
  { name: "产品", items: ["产品特性", "订阅方案"] },
  { name: "资源", items: ["使用指南", "更新日志", "常见问题", "意见反馈"] },
  { name: "关于", items: ["关于 Folune", "创作者的信", "联系作者"] },
  { name: "连接", items: ["Discord", "小红书", "推特"], social: true },
];

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <BlueprintDivider flush fullBleed />
      <BlueprintFrame className="landing-footer-inner" fullBleed>
        <div className="landing-footer-columns">
          <div className="landing-footer-brand">
            <p className="landing-footer-title">Folune</p>
            <p className="landing-footer-tagline">随手记下，自然有序。</p>
            <div className="landing-footer-auth">
              <Link to="?auth=login" replace>打开网页版</Link>
            </div>
            <div className="landing-footer-colophon">
              <p>为值得留下的想法而做。</p>
              <p>由 huxi 用心打磨 · © 2026 Folune</p>
              <p className="landing-footer-note">更多内容与社交主页，陆续开放。</p>
            </div>
          </div>
          {columns.map(({ name, items, social }) => (
            <nav aria-label={name} key={name}>
              <h2>{name}</h2>
              <ul className="landing-footer-links">
                {items.map((label) => (
                  <li key={label}>
                    <span className="landing-footer-placeholder" role="link" aria-disabled="true" title="即将开放">
                      <span>{label}</span>
                      {social ? <span aria-hidden="true" className="landing-footer-arrow">↗</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="landing-footer-wordmark">
          <svg viewBox="0 0 824 258" role="img" aria-label="Folune"><text x="412" y="218" textAnchor="middle">Folune</text></svg>
        </div>
      </BlueprintFrame>
    </footer>
  );
}
