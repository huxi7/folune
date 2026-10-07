/**
 * [INPUT]: 依赖 AuthForm 验证账号、认证服务验证身份并绑定 GitHub、共享品牌图标和认证按钮
 * [OUTPUT]: 在原登录卡片内提供轻提示、邮箱确认与重新选择，不枚举匿名账号、不合并数据
 * [POS]: LoginPage 的认证步骤内容；布局始终归登录页，Supabase 裁决绑定结果
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { AuthForm } from "../widgets/AuthForm";
import { Button, GlowButton } from "../shared/design-system/components";
import { GitHubLogoIcon } from "../shared/design-system/icons";
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
  const [selecting, setSelecting] = useState(!authenticated);
  const linking = useRef(false);

  async function loadAccount() {
    setError(null);
    try { setAccount(await getGitHubLinkAccount()); setSelecting(false); }
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

  function cancel() { clearGitHubLinkIntent(); onCancel(); }

  if (selecting) return <AuthForm selectExistingAccount onCancelSelection={cancel} selectionError={error}
    onAuthenticated={() => { void loadAccount(); }} />;

  return <section className="auth-card" aria-labelledby="github-choice-title">
    <h2 id="github-choice-title" className="sr-only">确认 GitHub 登录账号</h2>
    <div className="auth-credentials-form">
      <p className="auth-selection-hint" role="status">
        <span>{account ? "GitHub 将用于登录此账号" : "正在确认账号…"}</span>
        <button disabled={busy} onClick={cancel} type="button">取消</button>
      </p>
      {account && <div className="auth-link-account">
        <GitHubLogoIcon aria-hidden="true" size={20} />
        <span>{account.email}</span>
      </div>}
      {error && <p role="alert" className="auth-status-message" data-tone="error">{error}</p>}
      {account && <GlowButton className="auth-submit-button w-full" loading={busy}
        disabled={busy} onClick={confirm}>确认并继续</GlowButton>}
      {!account && error && <Button className="auth-provider-button w-full"
        onClick={loadAccount} variant="secondary">重试</Button>}
      {account && <div className="auth-mode-switch">
        <button disabled={busy} type="button" onClick={() => {
          beginGitHubAccountSelection(); setAccount(null); setError(null); setSelecting(true);
        }}>换个账号</button>
      </div>}
    </div>
  </section>;
}
