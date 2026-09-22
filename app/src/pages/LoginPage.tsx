/**
 * [INPUT]: 依赖 Router 导航、AuthForm、MarketingAnnouncement 与 public/auth 的本地视频和首帧
 * [OUTPUT]: 对外提供 /login 的左表单右插画布局；无末尾标点的标题与卡片共轴，视频作为无控件的 3:4 静音循环背景
 * [POS]: pages 的公开认证入口，复用 MarketingLayout 顶栏和标题浮现；认证步骤归 AuthForm，成功后仍由 /app 的 Profile loader 判定准入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useNavigate } from "react-router-dom";
import { AuthForm } from "../widgets/AuthForm";
import { MarketingAnnouncement } from "../widgets/MarketingAnnouncement";

export function LoginPage() {
  const navigate = useNavigate();

  return (
    <>
      <MarketingAnnouncement />
      <main className="auth-page" id="main-content">
        <div className="auth-composition">
          <div className="auth-panel">
            <div className="auth-intro" data-marketing-reveal>
              <h1 tabIndex={-1}>把此刻的想法<br />写下来</h1>
              <p>随手记录，让想法自然生长。</p>
            </div>
            <AuthForm onAuthenticated={() => navigate("/app", { replace: true })} />
          </div>
          <figure aria-hidden="true" className="auth-artwork">
            <video
              autoPlay
              className="auth-video"
              height={960}
              loop
              muted
              playsInline
              poster="/auth/study-garden-poster.jpg"
              preload="metadata"
              src="/auth/study-garden.mp4"
              width={720}
            />
          </figure>
        </div>
      </main>
    </>
  );
}
