/**
 * [INPUT]: 依赖共享Dialog/Button、确认动作tap spring与动态偏好、双语locale与上层确认后执行的统一退出命令
 * [OUTPUT]: 对外提供受控SignOutConfirmationDialog；取消不执行退出，确认防连点，失败保留弹窗可重试
 * [POS]: widgets的退出确认表面；只管理交互与错误展示，保存/认证/工作区清理仍由页面控制器拥有
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { motionSpring } from "../shared/design-system/motion";
import { useMotionPreference } from "../shared/design-system/useMotionPreference";
import { Button, Dialog } from "../shared/design-system/components";
import { useLocale } from "../shared/locale";
import "../styles/signout-confirmation.css";

const MotionButton = motion.create(Button);

type SignOutConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export function SignOutConfirmationDialog({ open, onOpenChange, onConfirm }: SignOutConfirmationDialogProps) {
  const { t } = useLocale();
  const reduced = useMotionPreference();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);
  useEffect(() => { if (open) setFailed(false); }, [open]);
  const title = t("退出登录?", "Sign out?");
  const description = t("需要重新登录才能继续。", "You'll need to sign in again to continue.");
  async function confirm() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      setFailed(true);
    } finally {
      running.current = false;
      setPending(false);
    }
  }
  const close = (next: boolean) => { if (!running.current) onOpenChange(next); };
  return <Dialog open={open} onOpenChange={close} surface="bare" backdrop="dim" title={title} description={description}>
    <section className="signout-confirmation" aria-busy={pending || undefined}>
      <h2>{title}</h2>
      <p className="signout-confirmation-description">{description}</p>
      {failed ? <p className="signout-confirmation-error" role="alert">{t("退出未完成，请稍后重试。", "Couldn't sign out. Please try again.")}</p> : null}
      <div className="signout-confirmation-actions">
        <Button data-dialog-autofocus disabled={pending} onClick={() => close(false)} variant="secondary">{t("取消", "Cancel")}</Button>
        <MotionButton loading={pending} onClick={() => void confirm()} variant="primary" style={{ scale: 1 }}
          whileHover={pending || reduced ? undefined : { scale: 1.02 }}
          whileTap={pending || reduced ? undefined : { scale: "var(--press-scale)" }} transition={motionSpring.tap}>
          <span className="signout-confirmation-submit-label">{t("退出登录", "Sign out")}</span>
        </MotionButton>
      </div>
    </section>
  </Dialog>;
}
