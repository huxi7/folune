/**
 * [INPUT]: 依赖 React effect/ref/state，依赖 react-router-dom 导航，依赖 shared/supabase 的 PKCE code 换取会话能力，依赖本地 design-system
 * [OUTPUT]: 提供 OAuth 回调、已验证账号的冲突选择与绑定回执；成功进入工作区，失败显示统一文案
 * [POS]: app/src/pages 的 Google/GitHub 共用 OAuth 回调边界，视觉共用 auth.css 与 APP 控件语义，交换会话仍沿 shared/supabase
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CircleNotchIcon, WarningCircleIcon } from "../shared/design-system/icons";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../shared/design-system/components";
import {
  completeOAuthSignIn,
  getAuthErrorMessage,
  clearGitHubLinkIntent,
  getGitHubLinkIntent,
  isOAuthAccountConflict,
  verifyGitHubLinkResult,
} from "../shared/supabase/auth";
import { GitHubAccountChoice } from "./GitHubAccountChoice";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const exchangeStartedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [choice, setChoice] = useState<"login" | "confirm" | null>(null);

  useEffect(() => {
    if (exchangeStartedRef.current) {
      return;
    }

    exchangeStartedRef.current = true;
    const searchParams = new URLSearchParams(window.location.search);
    const providerError = searchParams.get("error");
    const code = searchParams.get("code");

    if (providerError) {
      clearGitHubLinkIntent();
      if (isOAuthAccountConflict(searchParams)) {
        setChoice("login");
        return;
      }
      setErrorMessage(getAuthErrorMessage({
        code: searchParams.get("error_code") ?? providerError,
      }));
      return;
    }

    if (!code) {
      setErrorMessage("OAuth 回调缺少授权码，请重新登录。");
      return;
    }

    void completeOAuthSignIn(code)
      .then(async () => {
        const intent = getGitHubLinkIntent();
        if (intent?.phase === "select") { setChoice("confirm"); return; }
        if (intent?.phase === "link") await verifyGitHubLinkResult(intent.userId!);
        navigate("/app", { replace: true });
      })
      .catch((error: unknown) => {
        clearGitHubLinkIntent();
        setErrorMessage(getAuthErrorMessage(error));
      });
  }, [navigate]);

  if (choice) return <GitHubAccountChoice authenticated={choice === "confirm"}
    onCancel={() => navigate("/login", { replace: true })} />;

  return (
    <main className="auth-callback-page">
      <section aria-labelledby="auth-callback-title" className="auth-card auth-callback-card">
        {errorMessage ? (
          <>
            <WarningCircleIcon
              aria-hidden="true"
              className="auth-callback-icon"
              data-tone="error"
              size={24}
            />
            <h1 className="auth-verification-title" id="auth-callback-title">
              未能完成登录
            </h1>
            <p className="auth-status-message" role="alert">{errorMessage}</p>
            <Button
              onClick={() => navigate("/login", { replace: true })}
              variant="primary"
            >
              返回登录
            </Button>
          </>
        ) : (
          <>
            <CircleNotchIcon
              aria-hidden="true"
              className="auth-callback-icon motion-safe:animate-spin motion-reduce:animate-none"
              data-tone="pending"
              size={24}
            />
            <h1 className="auth-verification-title" id="auth-callback-title">
              正在建立安全会话
            </h1>
            <p className="auth-status-message" role="status">
              授权已返回，正在进入 Folune。
            </p>
          </>
        )}
      </section>
    </main>
  );
}
