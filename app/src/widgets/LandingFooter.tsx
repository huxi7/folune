/**
 * [INPUT]: 依赖 BlueprintFrame/Divider、局部 Folune 描边字标与局部 Footer 样式
 * [OUTPUT]: 对外提供六列网格中的品牌区/四组导航、分层字体与居中 Folune 描边字标；导轨继续共用正文坐标
 * [POS]: widgets 的营销页收尾；中文导航保留参考资源地址并标明来源，登录复用首页认证，下载仅为占位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Link } from "react-router-dom";
import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";
const labels: Record<string, string> = { Product:"产品参考", Resources:"资源参考", Company:"团队参考", Social:"社交平台", Download:"下载", Pricing:"定价", Business:"企业", Releases:"版本更新", Extensions:"扩展", Roadmap:"路线图", Docs:"文档", Compare:"对比", Status:"服务状态", FAQ:"常见问题", CLA:"贡献协议", Community:"社区", Support:"支持", Discussions:"讨论", Privacy:"隐私", Subscribe:"订阅", "Theme Builder":"主题工具", "Yearly Recaps":"年度回顾", Blog:"博客", About:"关于", Values:"价值观", Team:"团队", Jobs:"加入团队", Press:"媒体", Brand:"品牌", Merch:"周边" };
const columns = {
  Product: ["Download", "Pricing", "Business", "Releases", "Extensions", "Roadmap", "Docs", "Compare", "GitHub ↗", "Status ↗"],
  Resources: ["FAQ", "CLA", "Community", "Support", "Discussions ↗", "Privacy", "Subscribe", "Theme Builder", "Yearly Recaps"],
  Company: ["Blog", "About", "Values", "Team", "Jobs", "Press", "Brand", "Merch ↗"],
  Social: ["Twitter ↗", "Bluesky ↗", "Instagram ↗", "YouTube ↗", "Discord ↗", "Reddit ↗"],
};

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <BlueprintDivider flush fullBleed />
      <BlueprintFrame className="landing-footer-inner" fullBleed>
        <div className="landing-footer-columns">
          <div className="landing-footer-brand">
            <p className="landing-footer-title">Folune © 2026</p>
            <hr aria-hidden="true" className="landing-footer-brand-rule" />
            <div>
              <Link to="?auth=login" replace>登录网页版</Link> · 开始记录
            </div>
            <p className="landing-footer-legal"><span>服务条款</span> · <span>署名与致谢</span></p>
            <a href="https://zed.dev/privacy">管理网站 Cookie</a>
          <p className="landing-footer-reference">下列资源链接暂指向 Zed 参考网站。</p>
          </div>
          {Object.entries(columns).map(([name, items]) => (
            <nav aria-label={labels[name]} key={name}>
              <h2>{labels[name]}</h2>
              <ul className="landing-footer-links">
                {items.map((label) => (
                  <li key={label}>
                    {label === "Download" ? <span className="landing-footer-download" aria-disabled="true">下载 · 即将推出</span> : <a href={`https://zed.dev/${label.toLowerCase().replaceAll(" ", "-").replace("↗", "")}`}>
                      <span>{labels[label.replace(" ↗", "")] ?? label.replace(" ↗", "")}</span>
                      {label.endsWith("↗") ? <span aria-hidden="true" className="landing-footer-arrow">↗</span> : null}
                    </a>}
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
