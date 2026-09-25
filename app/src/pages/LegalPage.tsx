/**
 * [INPUT]: 依赖独立协议正文、legalSite、Router 来路信息、PublicArticle 和 usePublicPageMetadata
 * [OUTPUT]: 对外提供 /terms 与 /privacy 的无需登录阅读页、原来页返回、协议互链和邮件联系入口；pathname 切换复用博客两侧花纹局部外框先现/纹样后现
 * [POS]: pages 的法律文档装配层；复用博客阅读模板但不加入博客集合，不读取账号或调用业务服务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLocation, useNavigate } from "react-router-dom";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { MarketingLink as Link } from "../widgets/LandingMotion/MarketingLink";
import { supportsMarketingTransition } from "../widgets/LandingMotion/useMarketingMotion";
import { PublicArticle } from "../widgets/PublicArticle";
import { legalSite } from "./legalSite";
import { privacyContent } from "./privacyContent";
import { termsContent } from "./termsContent";
import { usePublicPageMetadata } from "./usePublicPageMetadata";

export function LegalPage({ document }: { document: "terms" | "privacy" }) {
  const content = document === "terms" ? termsContent : privacyContent;
  const location = useLocation();
  const navigate = useNavigate();
  usePublicPageMetadata(content.title, content.description);

  function goBack() {
    if (location.state?.fromLegalLink === true) navigate(-1);
    else navigate("/", { viewTransition: supportsMarketingTransition() });
  }

  const article = {
    ...content,
    sections: [...content.sections, {
      title: document === "terms" ? "十七、联系我们" : "十六、联系我们",
      paragraphs: [
        `运营者：${legalSite.operator}。网站：${legalSite.origin}。本版本更新及生效日期：${legalSite.updatedAt}。`,
        <>有关服务条款、隐私保护、访问或删除数据、账号注销及投诉，请发送邮件至 <a href={`mailto:${legalSite.email}`}>{legalSite.email}</a>。请尽量使用账号关联邮箱，说明请求范围；不要发送密码、验证码或与请求无关的敏感信息。</>,
      ],
    }],
  };

  return <BlueprintFrame key={location.pathname} className="landing-spine blog-spine" fullBleed>
    <main id="main-content">
      <PublicArticle
        article={article}
        mark={<span className="blog-eyebrow blog-journal-mark" data-marketing-reveal>FOLUNE LEGAL</span>}
        metadata={<><span className="blog-category">法律与隐私</span><time dateTime={legalSite.updatedAt}>更新及生效：{legalSite.updatedAt}</time><span>运营者：huxi</span></>}
        onBack={goBack}
      >
        <nav className="blog-related" aria-label="法律文档导航">
          <Link to={document === "terms" ? "/privacy" : "/terms"} replace state={location.state}>
            <span>{document === "terms" ? "隐私政策" : "服务条款"}</span><span aria-hidden="true">→</span>
          </Link>
          <a href={`mailto:${legalSite.email}`}><span>联系 huxi</span><span aria-hidden="true">↗</span></a>
          <Link to="/login">返回登录 <span aria-hidden="true">→</span></Link>
        </nav>
      </PublicArticle>
    </main>
  </BlueprintFrame>;
}
