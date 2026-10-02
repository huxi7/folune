/**
 * [INPUT]: 依赖 AccountDialog/MemoNodeDialog、Profile、Dashboard 的栏目/退出/订阅命令与 AnimatePresence 退出宿主
 * [OUTPUT]: 对外提供 DashboardDialogs，组合五栏设置与新建文件夹覆盖层，透传独立订阅入口及退出命令，文件夹落点仍交给弹窗做同级重名判定
 * [POS]: pages 的纯覆盖层组合；AppDashboard 只保留业务状态与命令，不展开重复 Dialog 生命周期标记
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { AnimatePresence } from "motion/react";
import type { Profile } from "../shared/api/profile";
import { AccountDialog } from "../widgets/AccountDialog";
import { MemoNodeDialog } from "../widgets/MemoNodeDialog";
import type {
  AccountDialogState,
  MemoDialogState,
} from "./appDashboardTypes";

type DashboardDialogsProps = {
  accountDialog: AccountDialogState;
  accountProfileRefreshing: boolean;
  memoDialog: MemoDialogState;
  memoDialogDescription: string;
  onAccountClose: () => void;
  onAccountSectionChange: (state: AccountDialogState) => void;
  onCreateFolder: (title: string) => Promise<void>;
  onMemoDialogClose: () => void;
  onProfileChange: (profile: Profile) => void;
  onSignOut: () => Promise<void>;
  onViewPlans: () => void;
  profile: Profile;
};

export function DashboardDialogs({
  accountDialog,
  accountProfileRefreshing,
  memoDialog,
  memoDialogDescription,
  onAccountClose,
  onAccountSectionChange,
  onCreateFolder,
  onMemoDialogClose,
  onProfileChange,
  onSignOut,
  onViewPlans,
  profile,
}: DashboardDialogsProps) {
  return (
    <AnimatePresence>
      {accountDialog === null ? null : (
        <AccountDialog
          key="account"
          refreshing={accountProfileRefreshing}
          onOpenChange={(open) => {
            if (!open) onAccountClose();
          }}
          onProfileChange={onProfileChange}
          onSignOut={onSignOut}
          onSectionChange={onAccountSectionChange}
          onViewPlans={onViewPlans}
          open
          profile={profile}
          section={accountDialog}
        />
      )}

      {memoDialog === null ? null : (
        <MemoNodeDialog
          description={memoDialogDescription}
          key={`folder:${memoDialog.parentId ?? "root"}`}
          onOpenChange={(open) => {
            if (!open) onMemoDialogClose();
          }}
          onSubmit={onCreateFolder}
          open
          parentId={memoDialog.parentId}
        />
      )}
    </AnimatePresence>
  );
}
