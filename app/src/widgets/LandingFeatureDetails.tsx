/**
 * [INPUT]: 依赖细节与文章同源数据、Router 查询/历史状态、MarketingLink、DS CSS 动效 token、语义图标和 ShowcaseBackdrop；完整章节首次入场，手风琴独占展开动画
 * [OUTPUT]: 对外提供固定展示区域内单项展开的功能细节、对应实景图、文章入口与紧凑四格摘要；展开项不提供收起动作
 * [POS]: widgets 的第 11 个 Landing 区块；query 保存当前项，切换清除已消费的定位锚点并替换历史，避免 Router 再次滚动；博客沿既有 fromBlog 协议返回
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLocation, useNavigate } from "react-router-dom";
import { MarketingLink as Link } from "./LandingMotion/MarketingLink";
import { ArrowRightIcon, PlusIcon } from "../shared/design-system/icons";
import { BlueprintDivider } from "./BlueprintDivider";
import { ShowcaseBackdrop } from "./LandingMotion/ShowcaseBackdrop";
import { detailStories } from "./landingDetailData";

export function LandingFeatureDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const active = detailStories.find(item => item.id === params.get("detail")) ?? detailStories[0]!;

  function selectDetail(id: string) {
    if (id === active.id) return;
    const next = new URLSearchParams(params);
    next.set("detail", id);
    // ---- 锚点只负责首次定位；Router 会先处理 hash，再检查 preventScrollReset ----
    void navigate({ pathname: location.pathname, search: next.toString(), hash: "" }, {
      replace: true, preventScrollReset: true, state: location.state,
    });
  }

  return <section data-marketing-reveal="section" id="feature-details" className="landing-feature-details" aria-labelledby="landing-details-title">
    <header className="landing-section-heading">
      <div><h2 id="landing-details-title">小细节，让记录更踏实</h2><p>知道笔记去了哪里，带着哪些内容思考。<br />从整理到回看，每一步都清楚，也由你掌握。</p></div>
      <Link className="ds-button ds-button-secondary ds-button-size-default" to={`/blog/${active.post.slug}`} state={{ fromBlog: true }} aria-label={`了解更多：${active.title}`}>
        <span className="ds-button-content">了解更多 <ArrowRightIcon size={16} /></span>
      </Link>
    </header>
    <div className="landing-details-showcase">
      <div className="landing-details-accordion">
        {detailStories.map(item => {
          const selected = item.id === active.id;
          return <div key={item.id} className="landing-details-item" data-active={selected}>
            <h3><button type="button" id={`detail-${item.id}`} aria-expanded={selected} aria-controls={`detail-panel-${item.id}`} aria-disabled={selected} onClick={() => selectDetail(item.id)}>
              {item.title}{!selected && <PlusIcon size={16} />}
            </button></h3>
            <div className="landing-details-panel" id={`detail-panel-${item.id}`} role="region" aria-labelledby={`detail-${item.id}`} aria-hidden={!selected} inert={!selected}>
              <div className="landing-details-panel-clip">
                <div className="landing-details-body"><p>{item.description}</p><Link to={`/blog/${item.post.slug}`} state={{ fromBlog: true }}>了解更多 <ArrowRightIcon size={16} /></Link></div>
              </div>
            </div>
          </div>;
        })}
      </div>
      <figure className="landing-details-media">
        <ShowcaseBackdrop />
        <div className="landing-details-image">
          <img key={active.id} src={active.figure.src} alt={active.figure.alt} width={active.figure.width} height={active.figure.height} loading="lazy" decoding="async" />
        </div>
      </figure>
    </div>
    <BlueprintDivider compact />
    <div className="landing-details-summary">
      {detailStories.map(item => <article key={item.id}>
        <h3>{item.title}</h3><p>{item.takeaway}</p>
      </article>)}
    </div>
  </section>;
}
