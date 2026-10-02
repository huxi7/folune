/**
 * [INPUT]: 依赖真实 Profile、Auth 注册时间、locale 文案/日期数字格式、上层退出命令与共享 Button/Toast
 * [OUTPUT]: 对外提供账户基本信息及32px 紧凑退出操作及 pending/失败反馈
 * [POS]: app/src/widgets 的账户生命周期视图，仅组合已有身份与退出能力；不伪造注册时间或未开放的删除账户接口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import { Button, useToast } from "../shared/design-system/components";
import { SignOutIcon } from "../shared/design-system/icons";
import type { Profile } from "../shared/api/profile";
import { useLocale } from "../shared/locale";

type AccountSecurityPanelProps = {
  createdAt?: string;
  onSignOut: () => Promise<void>;
  profile: Profile;
};

export function AccountSecurityPanel({ createdAt, onSignOut, profile }: AccountSecurityPanelProps) {
  const { t, formatDate, formatNumber } = useLocale();
  const [signingOut, setSigningOut] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const { toast } = useToast();
  const joinedAt = createdAt ? new Date(createdAt) : null;
  const hasJoinedDate = joinedAt !== null && Number.isFinite(joinedAt.getTime());
  const daysJoined = hasJoinedDate ? Math.max(0, Math.floor((openedAt - joinedAt.getTime()) / 86_400_000)) : null;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (error) {
      toast({ title: t("退出失败", "Couldn't sign out"), description: error instanceof Error ? t(error.message, "Please try again shortly.") : t("请稍后重试。", "Please try again shortly."), variant: "error" });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="settings-dialog-body">
      <section aria-labelledby="account-security-title" className="account-dialog-section">
        <header className="account-dialog-section-header">
          <h4 className="account-dialog-section-title" id="account-security-title">{t("基本信息", "Basic information")}</h4>
          <p className="account-dialog-section-description">{t("账户的常规信息。", "General information about your account.")}</p>
        </header>
        <div className="account-dialog-rows">
          {hasJoinedDate ? (
            <div className="account-dialog-row">
              <div className="account-dialog-row-copy">
                <p className="account-dialog-label">{t("加入时间", "Joined")}</p>
                <p className="account-dialog-section-description">{daysJoined === 0 ? t("今天", "Today") : t(`${formatNumber(daysJoined!)} 天前`, `${formatNumber(daysJoined!)} ${daysJoined === 1 ? "day" : "days"} ago`)}</p>
              </div>
              <time className="account-dialog-value" dateTime={createdAt}>{formatDate(joinedAt)}</time>
            </div>
          ) : (
            <div className="account-dialog-row">
              <p className="account-dialog-label">{t("账户邮箱", "Account email")}</p>
              <span className="account-dialog-value">{profile.email ?? t("未绑定邮箱", "No email connected")}</span>
            </div>
          )}
          <div className="account-dialog-row">
            <div className="account-dialog-row-copy">
              <p className="account-dialog-label">{t("退出", "Sign out")}</p>
              <p className="account-dialog-section-description">{t("退出当前账户并返回首页。", "Sign out of your account and return to the home page.")}</p>
            </div>
            <div className="account-dialog-row-actions">
              <Button className="account-signout-button" icon={SignOutIcon} loading={signingOut} onClick={() => void handleSignOut()}>{t("退出", "Sign out")}</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
