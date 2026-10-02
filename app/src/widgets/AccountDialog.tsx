/**
 * [INPUT]: 依赖后端缓存 Profile、纯 Auth 注册时间读取、共享 locale 文案与 Dialog/SidebarButton/PersistentView、五个账户面板和上层栏目/退出/订阅命令
 * [OUTPUT]: 对外提供资料、通用、账单、用量、账户共用的设置模态框与 AccountSection；后台刷新保留既有资料和未提交草稿
 * [POS]: app/src/widgets 的账户中心装配层；轻色文字导航与嵌套卡片共用 account-center.css，真实数据仍由 Profile 与共享 billing 边界拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useState } from "react";
import { useLocale } from "../shared/locale";
import { getAuthenticatedCreatedAt } from "../shared/supabase/auth";
import { XIcon } from "../shared/design-system/icons";
import { Button, Dialog, SidebarButton, PersistentView } from "../shared/design-system/components";
import type { Profile } from "../shared/api/profile";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import { AccountBillingPanel } from "./AccountBillingPanel";
import { AccountUsagePanel } from "./AccountUsagePanel";
import { AccountSecurityPanel } from "./AccountSecurityPanel";
import "../styles/account-center.css";

export type AccountSection = "profile" | "appearance" | "billing" | "usage" | "account";

type AccountDialogProps = {
  createdAt?: string;
  onOpenChange: (open: boolean) => void;
  onProfileChange: (profile: Profile) => void;
  onSectionChange: (section: AccountSection) => void;
  onSignOut: () => Promise<void>;
  onViewPlans: () => void;
  open: boolean;
  profile: Profile;
  refreshing: boolean;
  section: AccountSection;
};

export function AccountDialog({
  createdAt, onOpenChange, onProfileChange, onSectionChange, onSignOut,
  onViewPlans, open, profile, refreshing, section,
}: AccountDialogProps) {
  const { t } = useLocale();
  const settingsSections = [
    { id: "profile", label: t("个人资料", "Profile") },
    { id: "appearance", label: t("通用", "General") },
    { id: "billing", label: t("账单", "Billing") },
    { id: "usage", label: t("用量", "Usage") },
    { id: "account", label: t("账户", "Account") },
  ] satisfies Array<{ id: AccountSection; label: string }>;
  const activeSection = settingsSections.find((item) => item.id === section);
  const [joinedAt, setJoinedAt] = useState<{ userId: string; value: string } | null>(null);
  useEffect(() => {
    if (!open || createdAt !== undefined) return;
    let cancelled = false;
    void getAuthenticatedCreatedAt().then((value) => {
      if (!cancelled && value) setJoinedAt({ userId: profile.id, value });
    }).catch(() => {
      // 注册时间不是准入条件；读取失败继续展示已有账户身份，不伪造日期。
    });
    return () => { cancelled = true; };
  }, [createdAt, open, profile.id]);
  const visibleCreatedAt = createdAt ?? (joinedAt?.userId === profile.id ? joinedAt.value : undefined);

  return (
    <Dialog density="compact" headerMode="embedded" onOpenChange={onOpenChange} open={open} title={t("设置", "Settings")} width="account">
      <div className="account-center-layout">
        {refreshing ? <span aria-live="polite" className="sr-only" role="status">{t("正在后台刷新账户资料", "Refreshing your profile in the background")}</span> : null}
        <aside className="account-center-sidebar">
          <div className="account-center-sidebar-heading" aria-hidden="true">{t("设置", "Settings")}</div>
          <nav aria-label={t("设置栏目", "Settings sections")} className="account-center-sidebar-nav">
            {settingsSections.map((item) => (
              <SidebarButton
                active={section === item.id}
                aria-current={section === item.id ? "page" : undefined}
                key={item.id}
                label={item.label}
                onClick={() => onSectionChange(item.id)}
              />
            ))}
          </nav>
        </aside>
        <div className="account-center-main">
          <header className="account-center-main-header">
            <h3 id="account-dialog-section-title">{activeSection?.label ?? t("个人资料", "Profile")}</h3>
            <Button aria-label={t("关闭设置", "Close settings")} className="account-center-close" icon={XIcon} onClick={() => onOpenChange(false)} size="square" title={t("关闭", "Close")} variant="ghost" />
          </header>
          <div className="account-center-content">
            <PersistentView active={section === "profile"} aria-label={t("个人资料", "Profile")} className="account-center-panel" fill>
              <AccountProfilePanel onProfileChange={onProfileChange} profile={profile} />
            </PersistentView>
            <PersistentView active={section === "appearance"} aria-label={t("通用", "General")} className="account-center-panel" fill>
              <AccountSettingsPanel />
            </PersistentView>
            <PersistentView active={section === "billing"} aria-label={t("账单", "Billing")} className="account-center-panel" fill>
              <AccountBillingPanel onViewPlans={onViewPlans} />
            </PersistentView>
            <PersistentView active={section === "usage"} aria-label={t("用量", "Usage")} className="account-center-panel" fill>
              <AccountUsagePanel onViewPlans={onViewPlans} />
            </PersistentView>
            <PersistentView active={section === "account"} aria-label={t("账户", "Account")} className="account-center-panel" fill>
              <AccountSecurityPanel createdAt={visibleCreatedAt} onSignOut={onSignOut} profile={profile} />
            </PersistentView>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
