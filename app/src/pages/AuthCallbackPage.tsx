/**
 * [INPUT]: 依赖 React effect/ref/state，依赖 react-router-dom 导航，依赖 shared/supabase 的 PKCE code 换取会话能力，依赖本地 design-system
 * [OUTPUT]: 对外提供 /auth/callback OAuth 回调页面，成功后直接进入 /app，失败时展示可恢复入口，并让会话 Spinner 尊重 reduced-motion
 * [POS]: app/src/pages 的 Google OAuth 回调边界，被 app/router 引用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CircleNotchIcon, WarningCircleIcon } from "../shared/design-system/icons";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button, Card } from "../shared/design-system/components";
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
    <main className="ds-page flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-5 text-center">
        {errorMessage ? (
          <>
            <WarningCircleIcon
              aria-hidden="true"
              className="mx-auto text-destructive"
              size={24}
            />
            <h1 className="mt-4 text-xl font-semibold leading-tight text-foreground">
              未能完成 Google 登录
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{errorMessage}</p>
            <Button
              className="mt-5"
              onClick={() => navigate("/?auth=login", { replace: true })}
              variant="primary"
            >
              返回登录
            </Button>
          </>
        ) : (
          <>
            <CircleNotchIcon
              aria-hidden="true"
              className="mx-auto text-primary motion-safe:animate-spin motion-reduce:animate-none"
              size={24}
            />
            <h1 className="mt-4 text-xl font-semibold leading-tight text-foreground">
              正在建立安全会话
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Google 授权已返回，正在进入 SuperNote。
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
