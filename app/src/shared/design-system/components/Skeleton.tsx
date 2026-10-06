/**
 * [INPUT]: 依赖 React 原生 div/span 属性、index.css 的 Skeleton 语义 token 与 design-system.css 的单光带组动画
 * [OUTPUT]: 对外提供 Skeleton、仅可见时宣告 busy/status 的 SkeletonGroup 与默认延迟 180ms/内容就绪立即退出的 useDelayedSkeleton；支持显式最短展示时长
 * [POS]: app/src/shared/design-system/components 的统一占位加载原语；业务层只组合真实布局，不自行实现灰块、shimmer 或延迟计时器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export type SkeletonShape = "circle" | "rect" | "text";

type SkeletonProps = HTMLAttributes<HTMLSpanElement> & {
  shape?: SkeletonShape;
};

type SkeletonGroupProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  label?: string;
  visible?: boolean;
};

type DelayedSkeletonOptions = {
  delayMs?: number;
  minimumVisibleMs?: number;
};

const DEFAULT_DELAY_MS = 180;
const DEFAULT_MINIMUM_VISIBLE_MS = 0;

export function Skeleton({
  className = "",
  shape = "rect",
  ...props
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={["ds-skeleton", `ds-skeleton-${shape}`, className].join(" ")}
      {...props}
    />
  );
}

export function SkeletonGroup({
  children,
  className = "",
  label = "正在加载内容",
  visible = true,
  ...props
}: SkeletonGroupProps) {
  return (
    <div
      aria-busy={visible || undefined}
      className={["ds-skeleton-group", className].join(" ")}
      data-visible={visible}
      {...props}
    >
      {visible ? (
        <span aria-live="polite" className="sr-only" role="status">
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function useDelayedSkeleton(
  active: boolean,
  {
    delayMs = DEFAULT_DELAY_MS,
    minimumVisibleMs = DEFAULT_MINIMUM_VISIBLE_MS,
  }: DelayedSkeletonOptions = {},
) {
  const [visible, setVisible] = useState(false);
  const visibleSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      if (visible) {
        return;
      }

      const timerId = window.setTimeout(() => {
        visibleSinceRef.current = Date.now();
        setVisible(true);
      }, Math.max(0, delayMs));

      return () => window.clearTimeout(timerId);
    }

    if (!visible) {
      visibleSinceRef.current = null;
      return;
    }

    const elapsed = Date.now() - (visibleSinceRef.current ?? Date.now());
    const remaining = Math.max(0, minimumVisibleMs - elapsed);
    if (remaining === 0) {
      // 内容已就绪时直接复位本轮，不能由零毫秒计时器把旧可见状态带入下一次加载。
      visibleSinceRef.current = null;
      setVisible(false);
      return;
    }
    const timerId = window.setTimeout(() => {
      visibleSinceRef.current = null;
      setVisible(false);
    }, remaining);

    return () => window.clearTimeout(timerId);
  }, [active, delayMs, minimumVisibleMs, visible]);

  // 默认不让被动 Effect 的复位晚于本轮绘制；显式最短时长仍由计时器补足。
  return visible && (active || minimumVisibleMs > 0);
}
