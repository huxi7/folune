/**
 * [INPUT]: 依赖可选桌面 bridge、共享 Toast 与业务注册的保存函数
 * [OUTPUT]: 非模态更新 Toast 和退出前保存应答，普通浏览器为空操作
 * [POS]: 应用装配层的桌面生命周期；更新器不感知业务状态，保存失败阻止重启/退出
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef } from "react";
import { useToast } from "../shared/design-system/components";
import { prepareDesktopClose, type DesktopUpdate } from "../shared/desktop/bridge";

export function DesktopLifecycle() {
  const { toast, dismissToast } = useToast();
  const announced = useRef<string | null>(null);
  useEffect(() => {
    const bridge = window.foluneDesktop;
    if (!bridge) return;
    let active = true;
    const showUpdate = (update: DesktopUpdate | null) => {
      if (!active || !update || announced.current === `${update.kind}:${update.version}`) return;
      announced.current = `${update.kind}:${update.version}`;
      const id = toast({
        title: update.kind === "ready" ? "新版本已经准备好" : "发现新版本",
        duration: 0,
        action: { label: update.kind === "ready" ? "重启更新" : "下载更新", onClick: () => {
          dismissToast(id);
          void (update.kind === "ready" ? bridge.restartUpdate() : bridge.downloadUpdate()).catch(() => {
            announced.current = null;
            toast({ title: "暂时无法更新，请稍后重试", variant: "error" });
          });
        } },
        secondaryAction: { label: "稍后", onClick: () => dismissToast(id) },
      });
    };
    const removeUpdate = bridge.onUpdate(showUpdate);
    void bridge.getUpdate().then(showUpdate);
    const removeClose = bridge.onPrepareClose((id) => {
      void prepareDesktopClose().then(() => bridge.finishClose(id, true)).catch(() => {
        void bridge.finishClose(id, false);
        announced.current = null;
        toast({ title: "内容尚未保存，已取消退出", description: "请检查网络或保存提示后重试。", variant: "error" });
      });
    });
    return () => { active = false; removeUpdate(); removeClose(); };
  }, [dismissToast, toast]);
  return null;
}
