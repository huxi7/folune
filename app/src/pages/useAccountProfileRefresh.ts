/**
 * [INPUT]: 依赖 React effect、profile API、账户 Dialog 打开状态与 Toast/状态回调
 * [OUTPUT]: 对外提供 useAccountProfileRefresh，每次打开只后台刷新一次并保留旧资料
 * [POS]: pages 的账户资料生命周期协调器；从 AppDashboard 移出独立网络副作用，栏目切换不重复请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect } from "react";

import {
  getProfile,
  type Profile,
} from "../shared/api/profile";
import type { ToastInput } from "../shared/design-system/components";

export function useAccountProfileRefresh(input: {
  accessToken: string;
  open: boolean;
  setProfile: (profile: Profile) => void;
  setRefreshing: (refreshing: boolean) => void;
  toast: (input: ToastInput) => void;
}) {
  const {
    accessToken,
    open,
    setProfile,
    setRefreshing,
    toast,
  } = input;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void getProfile(accessToken)
      .then((profile) => {
        if (!cancelled) setProfile(profile);
      })
      .catch((error) => {
        if (!cancelled) {
          toast({
            description: error instanceof Error ? error.message : undefined,
            title: "账户资料刷新失败",
            variant: "error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, open, setProfile, setRefreshing, toast]);
}
