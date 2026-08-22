/**
 * [INPUT]: 依赖 shared/api/ai settings GET/PATCH、AgentPanel Store 的后端确认状态、全局 Toast、当前 access token 与 busy 状态
 * [OUTPUT]: 对外提供账号全局“每次询问/智能审批实验/完全访问”切换、中性选中表面、精简模式说明、紧凑图标入口、加载/保存错误明示及失败不漂移语义
 * [POS]: AgentPanel Composer 的 AI 权限偏好控制器；界面只展示 API 已确认模式，不用乐观假象代替持久化事实
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { CaretDownIcon, ShieldCheckIcon } from "../../shared/design-system/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDismissable } from "../../shared/design-system/useDismissable";

import {
  getAiSettings,
  updateAiSettings,
  type AiPermissionMode,
} from "../../shared/api/ai";
import { Button, useToast } from "../../shared/design-system/components";
import { useAgentPanelStore } from "../../shared/store/agentPanelStore";

const labels: Record<AiPermissionMode, string> = {
  ask: "每次询问",
  auto_approve: "智能审批 · 实验",
  full_access: "完全访问",
};

type PermissionModeControlProps = {
  accessToken: string;
  busy: boolean;
  compact?: boolean;
};

export function PermissionModeControl({
  accessToken,
  busy,
  compact = false,
}: PermissionModeControlProps) {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);
  const { toast } = useToast();
  const mode = useAgentPanelStore((state) => state.permissionMode);
  const permissionStatus = useAgentPanelStore((state) => state.permissionStatus);
  const beginLoad = useAgentPanelStore((state) => state.beginPermissionLoad);
  const beginSave = useAgentPanelStore((state) => state.beginPermissionSave);
  const failPermission = useAgentPanelStore((state) => state.failPermission);
  const resolvePermission = useAgentPanelStore((state) => state.resolvePermission);
  const saving = permissionStatus === "saving";

  useEffect(() => {
    const sequence = ++requestSequence.current;
    beginLoad();
    void getAiSettings(accessToken)
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
          description: `${message} 当前继续使用“每次询问”。`,
          title: "审批设置加载失败",
          variant: "error",
        });
      });
    return () => {
      requestSequence.current += 1;
    };
  }, [accessToken, beginLoad, failPermission, resolvePermission, toast]);

  const closeMenu = useCallback(() => setOpen(false), []);

  useDismissable({ onDismiss: closeMenu, open, shellRef });

  const changeMode = async (nextMode: AiPermissionMode) => {
    if (saving || nextMode === mode) {
      setOpen(false);
      return;
    }
    const sequence = ++requestSequence.current;
    setOpen(false);
    beginSave();
    try {
      const settings = await updateAiSettings(accessToken, nextMode);
      if (sequence !== requestSequence.current) return;
      resolvePermission(settings.permission_mode);
      toast({ title: `审批模式已切换为“${labels[settings.permission_mode]}”`, variant: "success" });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      const message = error instanceof Error ? error.message : "无法保存审批设置。";
      failPermission(message);
      toast({
        description: `${message} 仍使用“${labels[mode]}”。`,
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
      {open ? (
        <div className="agent-permission-menu" data-placement={compact ? "top" : "bottom"} role="menu">
          {(Object.keys(labels) as AiPermissionMode[]).map((value) => (
            <button
              aria-checked={mode === value}
              key={value}
              onClick={() => void changeMode(value)}
              role="menuitemradio"
              type="button"
            >
              <strong>{labels[value]}</strong>
              <small>
                {value === "ask" && "写入前都先询问。"}
                {value === "auto_approve" && "低风险自动执行，不确定时询问。"}
                {value === "full_access" && "无需询问，直接执行。"}
              </small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
