/**
 * [INPUT]: 依赖 Router 导航、AuthForm、MarketingAnnouncement、BlueprintFrame、LoginBackdrop 与 public/auth 的本地视频和首帧
 * [OUTPUT]: 对外提供 /login 的 01A 极慢散墨背景、左表单右插画布局；视频作为无控件的 3:4 静音循环背景
 * [POS]: pages 的公开认证入口，公告单独复用首页轨道骨架，正文后景独立于认证步骤；成功后仍由 /app 的 Profile loader 判定准入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useNavigate } from "react-router-dom";
import { AuthForm } from "../widgets/AuthForm";
import { MarketingAnnouncement } from "../widgets/MarketingAnnouncement";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { LoginBackdrop } from "../widgets/LandingMotion/LoginBackdrop";

export function LoginPage() {
  const navigate = useNavigate();

  return (
    <>
      <BlueprintFrame className="auth-announcement-frame" fullBleed>
        <MarketingAnnouncement />
      </BlueprintFrame>
      <main className="auth-page" id="main-content">
        <LoginBackdrop />
        <div className="auth-composition">
          <div className="auth-panel">
            <div className="auth-intro" data-marketing-reveal>
              <h1 tabIndex={-1}>把此刻的想法<br />写下来</h1>
              <p>随手记录，让想法自然生长</p>
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
