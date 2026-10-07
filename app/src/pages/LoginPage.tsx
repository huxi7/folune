/**
 * [INPUT]: 依赖 Router query 与导航、认证意图清理、AuthForm/GitHubAccountChoice、营销公告、散墨背景与本地插画视频
 * [OUTPUT]: 提供原登录页布局；GitHub 账号选择与确认只替换卡片内容，保持标题、背景和插画
 * [POS]: pages 的公开认证入口，公告单独复用首页轨道骨架，正文后景独立于认证步骤；成功后仍由 /app 的 Profile loader 判定准入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { clearGitHubLinkIntent } from "../shared/supabase/auth";
import { AuthForm } from "../widgets/AuthForm";
import { MarketingAnnouncement } from "../widgets/MarketingAnnouncement";
import { BlueprintFrame } from "../widgets/BlueprintFrame";
import { LoginBackdrop } from "../widgets/LandingMotion/LoginBackdrop";
import { GitHubAccountChoice } from "./GitHubAccountChoice";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const githubStep = searchParams.get("github");
  const choosingAccount = githubStep === "choose" || githubStep === "confirm";
  useEffect(() => { if (!choosingAccount) clearGitHubLinkIntent(); }, [choosingAccount]);
  const desktop = import.meta.env.VITE_DESKTOP === "true" || Boolean(window.foluneDesktop);

  const content = (
    <>
      {!desktop && <BlueprintFrame className="auth-announcement-frame" fullBleed>
        <MarketingAnnouncement />
      </BlueprintFrame>}
      <main className="auth-page" id="main-content" style={desktop ? { minHeight: "100svh" } : undefined}>
        <LoginBackdrop />
        <div className="auth-composition">
          <div className="auth-panel">
            <div className="auth-intro" data-marketing-reveal>
              <h1 tabIndex={-1}>把此刻的想法<br />写下来</h1>
              <p>随手记录，让想法自然生长</p>
            </div>
            {choosingAccount
              ? <GitHubAccountChoice authenticated={githubStep === "confirm"}
                onCancel={() => navigate("/login", { replace: true })} />
              : <AuthForm onAuthenticated={() => navigate("/app", { replace: true })} />}
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
  return desktop
    ? <div className="ds-page landing-blueprint landing-reference marketing-auth-layout" lang="zh-CN">{content}</div>
    : content;
}
