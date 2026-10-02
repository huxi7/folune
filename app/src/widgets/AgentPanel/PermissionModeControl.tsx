/**
 * [INPUT]: 依赖 locale 界面文案、PresenceSurface、权限 GET/PATCH 缓存、后端确认状态、Toast、当前用户/access token 与 busy
 * [OUTPUT]: 对外提供账号全局三档权限切换；首屏默认完全访问，加载/保存期间不可切换，失败保留显示并允许重试
 * [POS]: AgentPanel Composer 的权限视图；只接收当前账号当前请求，保存交由共享协调器跨卸载与凭据刷新完成
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { PresenceSurface } from "../../shared/design-system/components/PresenceSurface";
import { CaretDownIcon, CheckIcon, ShieldCheckIcon } from "../../shared/design-system/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDismissable } from "../../shared/design-system/useDismissable";

import type { AiPermissionMode } from "../../shared/api/ai";
import { Button, useToast } from "../../shared/design-system/components";
import { useAgentPanelStore } from "../../shared/store/agentPanelStore";
import { readAiSettings, saveAiSettings } from "./aiSettingsCache";
import { useLocale } from "../../shared/locale";

type PermissionModeControlProps = {
  accessToken: string;
  busy: boolean;
  compact?: boolean;
  userId: string;
};

export function PermissionModeControl({
  accessToken,
  busy,
  compact = false,
  userId,
}: PermissionModeControlProps) {
  const { t } = useLocale();
  const latestTranslate = useRef(t);
  latestTranslate.current = t;
  const labels: Record<AiPermissionMode, string> = {
    ask: t("每次询问", "Ask every time"),
    auto_approve: t("智能审批 · 实验", "Smart approval · Beta"),
    full_access: t("完全访问", "Full access"),
  };
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);
  const { toast } = useToast();
  const mode = useAgentPanelStore((state) => state.permissionUserId === userId ? state.permissionMode : "full_access");
  const permissionStatus = useAgentPanelStore((state) => state.permissionUserId === userId ? state.permissionStatus : "idle");
  const beginLoad = useAgentPanelStore((state) => state.beginPermissionLoad);
  const beginSave = useAgentPanelStore((state) => state.beginPermissionSave);
  const failPermission = useAgentPanelStore((state) => state.failPermission);
  const resolvePermission = useAgentPanelStore((state) => state.resolvePermission);
  const saving = permissionStatus === "saving";

  useEffect(() => {
    const sequence = ++requestSequence.current;
    beginLoad(userId);
    void readAiSettings(accessToken, userId)
      .then((settings) => {
        if (sequence === requestSequence.current) {
          resolvePermission(settings.permission_mode);
        }
      })
      .catch((error: unknown) => {
        if (sequence !== requestSequence.current) return;
        const translate = latestTranslate.current;
        const message = translate(error instanceof Error ? error.message : "无法读取审批设置。", "Unable to load approval settings.");
        failPermission(message);
        toast({
          description: `${message} ${translate("请重新选择审批模式，确认后再发送。", "Choose an approval mode again before sending.")}`,
          title: translate("审批设置加载失败", "Approval settings unavailable"),
          variant: "error",
        });
      });
    return () => {
      requestSequence.current += 1;
    };
  }, [accessToken, beginLoad, failPermission, resolvePermission, toast, userId]);

  const closeMenu = useCallback(() => setOpen(false), []);

  useDismissable({ onDismiss: closeMenu, open, shellRef });

  const changeMode = async (nextMode: AiPermissionMode) => {
    const current = useAgentPanelStore.getState();
    if (busy || current.permissionUserId !== userId || !["ready", "error"].includes(current.permissionStatus)) return;
    if (current.permissionStatus === "ready" && nextMode === mode) {
      setOpen(false);
      return;
    }
    const sequence = ++requestSequence.current;
    setOpen(false);
    beginSave();
    try {
      const settings = await saveAiSettings(accessToken, userId, nextMode);
      if (sequence !== requestSequence.current) return;
      resolvePermission(settings.permission_mode);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      const message = t(error instanceof Error ? error.message : "无法保存审批设置。", "Unable to save approval settings.");
      failPermission(message);
      toast({
        description: `${message} ${t("尚未确认切换，请重新选择后再发送。", "The change was not confirmed. Choose a mode again before sending.")}`,
        title: t("审批模式切换失败", "Approval mode not changed"),
        variant: "error",
      });
    }
  };

  return (
    <div className="agent-permission-control" data-compact={compact || undefined} ref={shellRef}>
      <Button
        aria-label={`${t("审批模式：", "Approval mode: ")}${labels[mode]}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className={["agent-permission-trigger", compact ? "agent-composer-tool" : ""].join(" ")}
        disabled={busy || permissionStatus === "idle" || permissionStatus === "loading" || saving}
        icon={ShieldCheckIcon}
        onClick={() => setOpen((value) => !value)}
        size={compact ? "square" : "default"}
        title={`${t("审批模式：", "Approval mode: ")}${labels[mode]}`}
        type="button"
        variant="ghost"
      >
        {!compact ? <><span>{labels[mode]}</span><CaretDownIcon size={14} /></> : null}
      </Button>
      <PresenceSurface open={open && !busy} placement={compact ? "top" : "bottom"} className="agent-permission-menu" data-placement={compact ? "top" : "bottom"} role="menu">
          {(Object.keys(labels) as AiPermissionMode[]).map((value) => (
            <button
              aria-checked={mode === value}
              key={value}
              onClick={() => void changeMode(value)}
              role="menuitemradio"
              type="button"
            >
              <strong>{labels[value]}</strong>
              {mode === value ? <CheckIcon aria-hidden="true" className="agent-permission-check" size={16} /> : null}
              <small>
                {value === "ask" && t("写入前都先询问。", "Ask before every change.")}
                {value === "auto_approve" && t("低风险自动执行，不确定时询问。", "Apply low-risk changes; ask when uncertain.")}
                {value === "full_access" && t("无需询问，直接执行。", "Apply changes without asking.")}
              </small>
            </button>
          ))}
      </PresenceSurface>
    </div>
  );
}
