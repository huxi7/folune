/**
 * [INPUT]: 依赖 Kumo Toast Provider/Manager/Parts 的可访问队列、自动关闭、悬停暂停、焦点与滑动生命周期，依赖 Phosphor 轻量状态图标及 toast.css 的 Apple-like SuperNote 材质
 * [OUTPUT]: 对外提供稳定的 ToastProvider、useToast、ToastVariant 与 ToastInput，把既有 info/success/warning/error 业务协议适配到 Kumo Toast
 * [POS]: app/src/shared/design-system/components 的全局瞬时反馈边界；Kumo 只拥有交互机制，SuperNote 本地 API 与样式继续隔离业务和第三方实现
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
} from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastInput = {
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

const DEFAULT_TOAST_DURATION = 4200;
const MAX_VISIBLE_TOASTS = 4;
const TOAST_ID_PREFIX = "supernote-toast-";
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

function ToastItem({ toast }: { toast: KumoManagedToast }) {
  const variant = getToastVariant(toast.variant);
  const IconComponent = variantIcons[variant];

  return (
    <KumoToast.Root
      className="ds-toast"
      data-variant={variant}
      swipeDirection={["down", "right"]}
      toast={toast}
    >
      <span aria-hidden="true" className="ds-toast-material" />
      <KumoToast.Content className="ds-toast-content">
        <span aria-hidden="true" className="ds-toast-icon">
          <IconComponent size={20} weight="regular" />
        </span>
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
        <KumoToast.Close aria-label="关闭提示" className="ds-toast-dismiss">
          <XIcon aria-hidden="true" size={12} weight="bold" />
        </KumoToast.Close>
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
      const id = ++nextToastId.current;
      const variant = input.variant ?? "info";

      toastManagerRef.current.add({
        description: input.description,
        id: getToastId(id),
        priority: variant === "error" || variant === "warning" ? "high" : "low",
        timeout: input.duration ?? DEFAULT_TOAST_DURATION,
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
            <ToastItem key={currentToast.id} toast={currentToast} />
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
