/**
 * [INPUT]: 依赖 React Context、稳定回调/定时器清理与 Phosphor 状态图标，依赖 toast.css 的全局视口和变体样式
 * [OUTPUT]: 对外提供 ToastProvider、useToast、ToastVariant 与 ToastInput，统一调度 info/success/warning/error 全局反馈
 * [POS]: app/src/shared/design-system/components 的全局瞬时反馈边界，由 main.tsx 在路由外装配，业务组件只提交消息而不拥有弹层生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastInput = {
  description?: string;
  duration?: number;
  title: string;
  variant?: ToastVariant;
};

type ToastRecord = Required<Pick<ToastInput, "duration" | "title" | "variant">> &
  Pick<ToastInput, "description"> & {
    id: number;
  };

type ToastContextValue = {
  dismissToast: (id: number) => void;
  toast: (input: ToastInput) => number;
};

const DEFAULT_TOAST_DURATION = 4200;
const MAX_VISIBLE_TOASTS = 4;
const ToastContext = createContext<ToastContextValue | null>(null);

const variantIcons = {
  error: XCircleIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningCircleIcon,
} as const;

function ToastItem({
  description,
  duration,
  id,
  onDismiss,
  title,
  variant,
}: ToastRecord & { onDismiss: (id: number) => void }) {
  const IconComponent = variantIcons[variant];

  useEffect(() => {
    const timerId = window.setTimeout(() => onDismiss(id), duration);

    return () => window.clearTimeout(timerId);
  }, [duration, id, onDismiss]);

  return (
    <div
      aria-atomic="true"
      className="ds-toast"
      data-variant={variant}
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="ds-toast-icon">
        <IconComponent size={18} weight="fill" />
      </span>
      <div className="ds-toast-copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      <button
        aria-label="关闭提示"
        className="ds-toast-dismiss"
        onClick={() => onDismiss(id)}
        type="button"
      >
        <XIcon aria-hidden="true" size={14} weight="bold" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextToastId = useRef(0);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((currentToasts) =>
      currentToasts.filter((currentToast) => currentToast.id !== id),
    );
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = ++nextToastId.current;
    const nextToast: ToastRecord = {
      description: input.description,
      duration: input.duration ?? DEFAULT_TOAST_DURATION,
      id,
      title: input.title,
      variant: input.variant ?? "info",
    };

    setToasts((currentToasts) =>
      [...currentToasts, nextToast].slice(-MAX_VISIBLE_TOASTS),
    );

    return id;
  }, []);

  const contextValue = useMemo(
    () => ({ dismissToast, toast }),
    [dismissToast, toast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div aria-label="全局通知" className="ds-toast-viewport">
        {toasts.map((currentToast) => (
          <ToastItem
            {...currentToast}
            key={currentToast.id}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (context === null) {
    throw new Error("useToast 必须在 ToastProvider 内使用。");
  }

  return context;
}
