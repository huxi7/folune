/**
 * [INPUT]: 依赖 Kumo Toast 可访问队列/焦点/滑动、本地 Button、useToastCountdown 动作时钟与 toast.css 的中性反馈材质
 * [OUTPUT]: 通知关闭入口只保留无障碍名称，不重复提示；对外提供 ToastProvider/useToast/ToastVariant/ToastInput（支持次级动作）；贴近视口顶部居中并从上沿滑入、三条内容自适应等宽堆叠，倒计时动作回执只保留业务按钮与整条底边进度，到期自动消失
 * [POS]: app/src/shared/design-system/components 的全局瞬时反馈边界；Kumo 只拥有队列与交互机制，业务动作仍由 Folune 本地 Button 渲染，隔离业务和第三方表现实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  Toast as KumoToast,
  useKumoToastManager,
} from "@cloudflare/kumo/components/toast";
import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  XCircleIcon,
  XIcon,
} from "../icons";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { Button } from "./Button";
import { useToastCountdown } from "./useToastCountdown";

export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastInput = {
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  action?: {
    label: string;
    onClick: () => void;
  };
  description?: string;
  duration?: number;
  title: string;
  variant?: ToastVariant;
};

type ToastContextValue = {
  dismissToast: (id: number) => void;
  toast: (input: ToastInput) => number;
};

type KumoManagedToast = ReturnType<typeof useKumoToastManager>["toasts"][number];

const DEFAULT_TOAST_DURATION = 2600;
const ACTION_TOAST_DURATION = 6000;
const MAX_VISIBLE_TOASTS = 3;
const TOAST_ID_PREFIX = "folune-toast-";
const ToastContext = createContext<ToastContextValue | null>(null);

const variantIcons = {
  error: XCircleIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningCircleIcon,
} as const;

function getToastId(id: number) {
  return `${TOAST_ID_PREFIX}${id}`;
}

function getToastVariant(variant: unknown): ToastVariant {
  return variant === "success" ||
    variant === "warning" ||
    variant === "error"
    ? variant
    : "info";
}

function ToastItem({ toast, frontmost }: { toast: KumoManagedToast; frontmost: boolean }) {
  const variant = getToastVariant(toast.variant);
  const IconComponent = variantIcons[variant];
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const { close } = useKumoToastManager();
  const action = toast.actions?.[0];
  const showIcon = !action || variant === "error" || variant === "warning";
  const duration = (toast.data?.actionDuration as number | undefined) ?? 0;
  const onExpire = useCallback(() => close(toast.id), [close, toast.id]);
  useToastCountdown({ duration, frontmost, onExpire, progressRef, rootRef });

  return (
    <KumoToast.Root
      className="ds-toast"
      ref={rootRef}
      data-action={action ? "true" : undefined}
      data-countdown={duration > 0 ? "true" : undefined}
      data-variant={variant}
      swipeDirection={["up", "right"]}
      toast={toast}
    >
      <KumoToast.Content className="ds-toast-content">
        {showIcon ? (
          <span aria-hidden="true" className="ds-toast-icon">
            <IconComponent size={16} />
          </span>
        ) : null}
        <div className="ds-toast-copy">
          <KumoToast.Title className="ds-toast-title">
            {toast.title}
          </KumoToast.Title>
          {toast.description ? (
            <KumoToast.Description className="ds-toast-description">
              {toast.description}
            </KumoToast.Description>
          ) : null}
        </div>
        <div className="ds-toast-controls">
          {toast.actions?.map((item, index) => (
            <Button key={index} className="ds-toast-action" onClick={item.onClick} variant="secondary">
              {item.children}
            </Button>
          ))}
          {duration <= 0 ? (
            <KumoToast.Close aria-label="关闭提示" className="ds-toast-dismiss">
              <XIcon aria-hidden="true" size={14} />
            </KumoToast.Close>
          ) : null}
        </div>
        {duration > 0 ? (
          <span aria-hidden="true" className="ds-toast-countdown">
            <span ref={progressRef} className="ds-toast-countdown-progress" />
          </span>
        ) : null}
      </KumoToast.Content>
    </KumoToast.Root>
  );
}

function ToastRuntime({ children }: { children: ReactNode }) {
  const nextToastId = useRef(0);
  const toastManager = useKumoToastManager();
  const toastManagerRef = useRef(toastManager);
  toastManagerRef.current = toastManager;

  const dismissToast = useCallback(
    (id: number) => toastManagerRef.current.close(getToastId(id)),
    [],
  );

  const toast = useCallback(
    (input: ToastInput) => {
      const variant = input.variant ?? "info";
      const id = ++nextToastId.current;
      const duration = input.duration ?? (input.action
        ? ACTION_TOAST_DURATION
        : variant === "error" ? 6500 : variant === "warning" ? 5000 : DEFAULT_TOAST_DURATION);

      toastManagerRef.current.add({
        actions: [input.secondaryAction, input.action].filter((action) => action !== undefined).map(action => ({
          children: action.label,
          onClick: action.onClick,
        })),
        description: input.description,
        data: { actionDuration: input.action ? duration : 0 },
        id: getToastId(id),
        priority: variant === "error" || variant === "warning" ? "high" : "low",
        timeout: input.action ? 0 : duration,
        title: input.title,
        variant,
      });

      return id;
    },
    [],
  );

  const contextValue = useMemo(
    () => ({ dismissToast, toast }),
    [dismissToast, toast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <KumoToast.Portal>
        <KumoToast.Viewport
          aria-label="全局通知"
          className="ds-toast-viewport"
        >
          {toastManager.toasts.map((currentToast) => (
            <ToastItem
              key={currentToast.id}
              toast={currentToast}
              frontmost={currentToast.id === toastManager.toasts.find((item) => item.transitionStatus !== "ending")?.id}
            />
          ))}
        </KumoToast.Viewport>
      </KumoToast.Portal>
    </ToastContext.Provider>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <KumoToast.Provider
      limit={MAX_VISIBLE_TOASTS}
      timeout={DEFAULT_TOAST_DURATION}
    >
      <ToastRuntime>{children}</ToastRuntime>
    </KumoToast.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (context === null) {
    throw new Error("useToast 必须在 ToastProvider 内使用。");
  }

  return context;
}
