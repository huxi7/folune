/**
 * [INPUT]: 依赖 AuthForm 验证既有账号，依赖认证服务验证身份并发起 GitHub 绑定，依赖共享 Button
 * [OUTPUT]: 提供多账号冲突后的登录选择与明确绑定确认；不读取匿名候选列表，不合并业务数据
 * [POS]: pages 的 OAuth 冲突恢复视图，由 AuthCallbackPage 承载；Supabase 裁决真实绑定结果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { AuthForm } from "../widgets/AuthForm";
import { Button } from "../shared/design-system/components";
import {
  beginGitHubAccountSelection, clearGitHubLinkIntent, getAuthErrorMessage,
  getGitHubLinkAccount, linkGitHubIdentity,
} from "../shared/supabase/auth";

export function GitHubAccountChoice({ authenticated = false, onCancel }: {
  authenticated?: boolean; onCancel: () => void;
}) {
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getGitHubLinkAccount>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linking = useRef(false);

  async function loadAccount() {
    setError(null);
    try { setAccount(await getGitHubLinkAccount()); }
    catch (failure) { setError(getAuthErrorMessage(failure)); }
  }

  useEffect(() => {
    if (!authenticated) { beginGitHubAccountSelection(); return; }
    let active = true;
    void getGitHubLinkAccount().then(value => { if (active) setAccount(value); })
      .catch(failure => { if (active) setError(getAuthErrorMessage(failure)); });
    return () => { active = false; };
  }, [authenticated]);

  async function confirm() {
    if (!account || linking.current) return;
    linking.current = true;
    setBusy(true);
    setError(null);
    try { await linkGitHubIdentity(account.id); }
    catch (failure) {
      setError(getAuthErrorMessage(failure));
      linking.current = false;
      setBusy(false);
    }
  }

  return <main className="auth-callback-page">
    <div>
      <section className="auth-card auth-callback-card" aria-labelledby="github-choice-title">
        <h1 id="github-choice-title" className="auth-verification-title">
          {account ? "确认 GitHub 登录账号" : "选择要使用的账号"}
        </h1>
        <p className="auth-status-message">
          {account
            ? `GitHub 将用于登录 ${account.email}，继续使用这个账号的笔记和权益。`
            : "GitHub 的邮箱匹配到了多个 Folune 账号。请用邮箱或 Google 登录你要继续使用的账号，再绑定 GitHub。"}
        </p>
        <p className="auth-status-message">其他账号、笔记和权益不会合并。</p>
        {error && <p role="alert" className="auth-status-message" data-tone="error">{error}</p>}
        {account && <Button loading={busy} disabled={busy} onClick={confirm} variant="primary">
          绑定 GitHub 并继续
        </Button>}
        {authenticated && !account && error && <Button onClick={loadAccount} variant="secondary">重试</Button>}
        <Button disabled={busy} variant="ghost" onClick={() => {
          clearGitHubLinkIntent(); onCancel();
        }}>返回登录</Button>
      </section>
      {!account && !authenticated && <AuthForm selectExistingAccount onAuthenticated={() => { void loadAccount(); }} />}
    </div>
  </main>;
}
