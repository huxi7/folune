/**
 * [INPUT]: 依赖 React effect/ref/state，依赖 react-router-dom 导航，依赖 shared/supabase 的 PKCE code 换取会话能力，依赖本地 design-system
 * [OUTPUT]: 对外提供 /auth/callback OAuth 回调页面，成功进入 /app、失败返回 /login；状态卡片复用认证页文字/中性表面与共享图标，会话图标在减少动态时静止
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
} from "../shared/supabase/auth";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const exchangeStartedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeStartedRef.current) {
      return;
    }

    exchangeStartedRef.current = true;
    const searchParams = new URLSearchParams(window.location.search);
    const providerError = searchParams.get("error_description");
    const code = searchParams.get("code");

    if (providerError) {
      setErrorMessage(providerError);
      return;
    }

    if (!code) {
      setErrorMessage("OAuth 回调缺少授权码，请重新登录。");
      return;
    }

    void completeOAuthSignIn(code)
      .then(() => navigate("/app", { replace: true }))
      .catch((error: unknown) => setErrorMessage(getAuthErrorMessage(error)));
  }, [navigate]);

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
