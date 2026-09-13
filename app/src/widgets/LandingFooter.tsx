/**
 * [INPUT]: 依赖 Figma 页脚的原始字标与页面局部 Footer 样式
 * [OUTPUT]: 对外提供参考链接列、宽幅低对比字标与蓝色页脚
 * [POS]: widgets 的营销页收尾；链接保持原稿内容，第二阶段按产品真实入口重写
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { referenceAssets as assets } from "./landingReferenceData";
const columns={Product:["Download","Pricing","Business","Releases","Extensions","Roadmap","Docs","Compare","GitHub ↗","Status ↗"],Resources:["FAQ","CLA","Community","Support","Discussions ↗","Privacy","Subscribe","Theme Builder","Yearly Recaps"],Company:["Blog","About","Values","Team","Jobs","Press","Brand","Merch ↗"],Social:["Twitter ↗","Bluesky ↗","Instagram ↗","YouTube ↗","Discord ↗","Reddit ↗"]};
export function LandingFooter(){return <footer className="landing-footer"><div className="landing-footer-inner"><div className="landing-footer-columns"><div className="landing-footer-brand"><p>Zed Industries © 2026</p><div><a href="https://zed.dev/sign_up">Sign Up</a> · Have an account? <a href="https://zed.dev/sign_in">Sign In</a></div><p>Terms of Service · Attributions</p><a href="https://zed.dev/privacy">Manage Site Cookies</a></div>{Object.entries(columns).map(([name,items])=><nav aria-label={name} key={name}><h2>{name}</h2>{items.map(t=><a key={t} href={`https://zed.dev/${t.toLowerCase().replaceAll(' ','-').replace('↗','')}`}>{t}</a>)}</nav>)}</div><div className="landing-footer-wordmark"><img src={assets["19-4390/imgFrame"]} alt="Zed" width="856" height="232" loading="lazy" /></div></div></footer>;}
