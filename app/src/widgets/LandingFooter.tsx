/**
 * [INPUT]: 依赖 BlueprintFrame/Divider、Figma 页脚原始字标与局部 Footer 样式
 * [OUTPUT]: 对外提供六列网格中的品牌区/四组导航、分层字体与原始比例字标；导轨继续共用正文坐标
 * [POS]: widgets 的营销页收尾；链接保持原稿内容，第二阶段按产品真实入口重写
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { referenceAssets as assets } from "./landingReferenceData";
import { BlueprintDivider } from "./BlueprintDivider";
import { BlueprintFrame } from "./BlueprintFrame";
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
            <p className="landing-footer-title">Zed Industries © 2026</p>
            <hr aria-hidden="true" className="landing-footer-brand-rule" />
            <div>
              <a href="https://zed.dev/sign_up">Sign Up</a> · Have an account?{" "}
              <a href="https://zed.dev/sign_in">Sign In</a>
            </div>
            <p className="landing-footer-legal"><span>Terms of Service</span> · <span>Attributions</span></p>
            <a href="https://zed.dev/privacy">Manage Site Cookies</a>
          </div>
          {Object.entries(columns).map(([name, items]) => (
            <nav aria-label={name} key={name}>
              <h2>{name}</h2>
              <ul className="landing-footer-links">
                {items.map((label) => (
                  <li key={label}>
                    <a href={`https://zed.dev/${label.toLowerCase().replaceAll(" ", "-").replace("↗", "")}`}>
                      <span>{label.replace(" ↗", "")}</span>
                      {label.endsWith("↗") ? <span aria-hidden="true" className="landing-footer-arrow">↗</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="landing-footer-wordmark">
          <img src={assets["19-4390/imgFrame"]} alt="Zed" width="824" height="258" loading="lazy" />
        </div>
      </BlueprintFrame>
    </footer>
  );
}
