/**
 * [INPUT]: 依赖 shared/api/ai settings GET/PATCH、AgentPanel Store 的后端确认状态、全局 Toast、当前 access token 与 busy 状态
 * [OUTPUT]: 对外提供账号全局“每次询问/智能审批实验/完全访问”切换、加载/保存错误明示及失败不漂移语义
 * [POS]: AgentPanel Header 的 AI 权限偏好控制器；界面只展示 API 已确认模式，不用乐观假象代替持久化事实
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { CaretDownIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import {
  getAiSettings,
  updateAiSettings,
  type AiPermissionMode,
} from "../../shared/api/ai";
import { useToast } from "../../shared/design-system/components";
import { useAgentPanelStore } from "../../shared/store/agentPanelStore";

const labels: Record<AiPermissionMode, string> = {
  ask: "每次询问",
  auto_approve: "智能审批 · 实验",
  full_access: "完全访问",
};

type PermissionModeControlProps = {
  accessToken: string;
  busy: boolean;
};

export function PermissionModeControl({
  accessToken,
  busy,
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

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

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
    <div className="agent-permission-control" ref={shellRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="agent-permission-trigger"
        disabled={busy || permissionStatus === "idle" || permissionStatus === "loading" || saving}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ShieldCheckIcon size={13} />
        <span>{labels[mode]}</span>
        <CaretDownIcon size={11} />
      </button>
      {open ? (
        <div className="agent-permission-menu" role="menu">
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
                {value === "ask" && "所有写操作都由你确认。"}
                {value === "auto_approve" && "AI 会综合要求、目标笔记和修改内容；不明确或高风险时仍会询问。实验功能可能误判，所有操作仍受版本检查、回收站和撤销保护。"}
                {value === "full_access" && "自动执行，仍受版本检查与回收站保护。"}
              </small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
