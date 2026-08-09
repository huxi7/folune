/**
 * [INPUT]: 依赖后端缓存 Profile、共享 Dialog/Button/SidebarButton、账户/外观面板与 React 受控 refreshing/section
 * [OUTPUT]: 对外提供账户和外观共用的 4:3 设置模态框、保留旧资料的后台刷新语义、按“通用”归类的双入口侧边导航与 AccountSection 类型
 * [POS]: app/src/widgets 的设置总入口，由 AppDashboard 持有唯一 section 与 stale-while-revalidate Profile；刷新期间保持完整可见布局，不以 Skeleton 清空已揭示内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  PaletteIcon,
  UserCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

import {
  Button,
  Dialog,
  SidebarButton,
} from "../shared/design-system/components";
import type { Profile } from "../shared/api/profile";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";

export type AccountSection = "account" | "appearance";

type AccountDialogProps = {
  onOpenChange: (open: boolean) => void;
  onProfileChange: (profile: Profile) => void;
  onSectionChange: (section: AccountSection) => void;
  open: boolean;
  profile: Profile;
  refreshing: boolean;
  section: AccountSection;
};

const accountSections = [
  {
    icon: UserCircleIcon,
    id: "account",
    label: "账户",
  },
  {
    icon: PaletteIcon,
    id: "appearance",
    label: "外观",
  },
] as const;

export function AccountDialog({
  onOpenChange,
  onProfileChange,
  onSectionChange,
  open,
  profile,
  refreshing,
  section,
}: AccountDialogProps) {
  const activeSection = accountSections.find((item) => item.id === section);

  return (
    <Dialog
      density="compact"
      headerMode="embedded"
      onOpenChange={onOpenChange}
      open={open}
      title="设置"
      width="account"
    >
      <div aria-busy={refreshing} className="account-center-layout">
        {refreshing ? (
          <span aria-live="polite" className="sr-only" role="status">
            正在后台刷新账户资料
          </span>
        ) : null}
        <aside className="account-center-sidebar">
          <nav aria-label="设置栏目" className="account-center-sidebar-nav">
            <section
              aria-labelledby="account-general-settings"
              className="account-center-sidebar-group"
            >
              <h2
                className="account-center-sidebar-group-title"
                id="account-general-settings"
              >
                通用
              </h2>
              {accountSections.map((item) => {
                const IconComponent = item.icon;
                const active = section === item.id;

                return (
                  <SidebarButton
                    active={active}
                    aria-current={active ? "page" : undefined}
                    key={item.id}
                    label={item.label}
                    leading={(
                      <IconComponent
                        size={17}
                        weight={active ? "fill" : "regular"}
                      />
                    )}
                    onClick={() => onSectionChange(item.id)}
                  />
                );
              })}
            </section>
          </nav>
        </aside>

        <div className="account-center-main">
          <header className="account-center-main-header">
            <h3 id="account-dialog-section-title">
              {activeSection?.label ?? "账户"}
            </h3>
            <Button
              aria-label="关闭弹窗"
              className="account-center-close"
              icon={XIcon}
              onClick={() => onOpenChange(false)}
              size="square"
              title="关闭"
              variant="ghost"
            />
          </header>
          <div className="account-center-content">
            <section
              aria-labelledby="account-dialog-section-title"
              className="account-center-panel"
              hidden={section !== "account"}
            >
              <AccountProfilePanel
                onProfileChange={onProfileChange}
                profile={profile}
              />
            </section>
            <section
              aria-labelledby="account-dialog-section-title"
              className="account-center-panel"
              hidden={section !== "appearance"}
            >
              <AccountSettingsPanel />
            </section>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
