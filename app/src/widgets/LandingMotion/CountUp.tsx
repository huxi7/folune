/**
 * [INPUT]: 依赖 React effect/ref、IntersectionObserver、requestAnimationFrame 与 reduced-motion 媒体查询
 * [OUTPUT]: 对外提供进入视口后平缓减速递增的 CountUp 数字组件
 * [POS]: app/src/widgets/LandingMotion 的数据微动效，被 Landing 行为指标带消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useRef } from "react";

type CountUpProps = {
  prefix?: string;
  suffix?: string;
  value: number;
};

const DURATION = 1100;

export function CountUp({ prefix = "", suffix = "", value }: CountUpProps) {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = valueRef.current;
    if (!element) {
      return;
    }

    function render(target: HTMLSpanElement, nextValue: number) {
      target.textContent = `${prefix}${nextValue}${suffix}`;
    }

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      render(element, value);
      return;
    }

    let animationFrame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        const startedAt = performance.now();
        const animate = (timestamp: number) => {
          const progress = Math.min((timestamp - startedAt) / DURATION, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          render(element, Math.round(value * eased));

          if (progress < 1) {
            animationFrame = requestAnimationFrame(animate);
          }
        };

        animationFrame = requestAnimationFrame(animate);
        observer.disconnect();
      },
      { threshold: 0.55 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [prefix, suffix, value]);

  return <span ref={valueRef}>{`${prefix}0${suffix}`}</span>;
}
