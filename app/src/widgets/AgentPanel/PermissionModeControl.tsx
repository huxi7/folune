/**
 * [INPUT]: 依赖 PresenceSurface 的统一入退场、 shared/api/ai settings GET/PATCH、AgentPanel 权限设置缓存、后端确认状态、全局 Toast、当前用户/access token 与 busy 状态
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

const labels: Record<AiPermissionMode, string> = {
  ask: "每次询问",
  auto_approve: "智能审批 · 实验",
  full_access: "完全访问",
};

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
        const message = error instanceof Error ? error.message : "无法读取审批设置。";
        failPermission(message);
        toast({
          description: `${message} 请重新选择审批模式，确认后再发送。`,
          title: "审批设置加载失败",
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
      const message = error instanceof Error ? error.message : "无法保存审批设置。";
      failPermission(message);
      toast({
        description: `${message} 尚未确认切换，请重新选择后再发送。`,
        title: "审批模式切换失败",
        variant: "error",
      });
    }
  };

  return (
    <div className="agent-permission-control" data-compact={compact || undefined} ref={shellRef}>
      <Button
        aria-label={`审批模式：${labels[mode]}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className={["agent-permission-trigger", compact ? "agent-composer-tool" : ""].join(" ")}
        disabled={busy || permissionStatus === "idle" || permissionStatus === "loading" || saving}
        icon={ShieldCheckIcon}
        onClick={() => setOpen((value) => !value)}
        size={compact ? "square" : "default"}
        title={`审批模式：${labels[mode]}`}
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
                {value === "ask" && "写入前都先询问。"}
                {value === "auto_approve" && "低风险自动执行，不确定时询问。"}
                {value === "full_access" && "无需询问，直接执行。"}
              </small>
            </button>
          ))}
      </PresenceSurface>
    </div>
  );
}
