/**
 * [INPUT]: 依赖 React 状态/计时器、Unicode 分词、目标文本、真实流状态与可选渲染器
 * [OUTPUT]: 对外提供按词追赶 SSE、多个尾词按真实时间错峰模糊落定与静态细光标的 StreamingText，以及供回归验证续播进度的 resolvingWordStyle
 * [POS]: design-system AI 消息家族的动态文字内核，统一节奏但把纯文本/Markdown 的稳定词节点交给各自渲染器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { splitStreamingTextUnits } from "./streamingTextSegments";

export type StreamingTextRenderState = {
  resolvingWordStyles: readonly CSSProperties[];
  showCursor: boolean;
};

type StreamingTextProps = {
  onProgress?: () => void;
  renderText?: (text: string, state: StreamingTextRenderState) => ReactNode;
  streaming?: boolean;
  text: string;
};

const WORD_DELAY_MS = 55;
const WORD_RESOLVE_MS = 420;
const MAX_RESOLVING_WORDS = 8;

type RevealState = {
  count: number;
  revealedAt: number[];
};

function motionTime() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function resolvedWordTimes(count: number) {
  return Array.from({ length: count }, () => Number.NEGATIVE_INFINITY);
}

export function resolvingWordStyle(elapsed: number): CSSProperties {
  return {
    animationDelay: `${-Math.max(0, elapsed)}ms`,
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function defaultRenderText(text: string, state: StreamingTextRenderState) {
  const units = splitStreamingTextUnits(text);

  return (
    <p className="ds-streaming-text-plain">
      {state.resolvingWordStyles.length > 0
        ? units.map((unit, index) => (
            <span
              className="ds-streaming-text-token"
              data-resolving={
                index >= units.length - state.resolvingWordStyles.length
                || undefined
              }
              key={index}
              style={state.resolvingWordStyles[units.length - index - 1]}
            >
              {unit}
            </span>
          ))
        : text}
      {state.showCursor ? (
        <span aria-hidden="true" className="ds-streaming-text-cursor" />
      ) : null}
    </p>
  );
}

export function StreamingText({
  onProgress,
  renderText = defaultRenderText,
  streaming = false,
  text,
}: StreamingTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const units = useMemo(() => splitStreamingTextUnits(text), [text]);
  const [reveal, setReveal] = useState<RevealState>(() => ({
    count: streaming ? 0 : units.length,
    revealedAt: resolvedWordTimes(streaming ? 0 : units.length),
  }));
  const [settled, setSettled] = useState(!streaming);

  useEffect(() => {
    if (reducedMotion) {
      setReveal({
        count: units.length,
        revealedAt: resolvedWordTimes(units.length),
      });
      setSettled(true);
      return;
    }

    if (streaming) {
      setSettled(false);
    }

    if (reveal.count > units.length) {
      setReveal((current) => ({
        count: units.length,
        revealedAt: current.revealedAt.slice(0, units.length),
      }));
      return;
    }

    if (reveal.count < units.length) {
      setSettled(false);
      const timer = window.setTimeout(() => {
        const revealedAt = motionTime();
        setReveal((current) => {
          const count = Math.min(current.count + 1, units.length);
          const nextTimes = current.revealedAt.slice(0, count);

          for (let index = current.count; index < count; index += 1) {
            nextTimes[index] = revealedAt;
          }

          return { count, revealedAt: nextTimes };
        });
      }, WORD_DELAY_MS);

      return () => window.clearTimeout(timer);
    }

    if (streaming || settled) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSettled(true);
    }, WORD_RESOLVE_MS);

    return () => window.clearTimeout(timer);
  }, [reducedMotion, reveal.count, settled, streaming, units.length]);

  const renderedCount = reducedMotion
    ? units.length
    : Math.min(reveal.count, units.length);
  const visibleText = units.slice(0, renderedCount).join("");
  const visuallyStreaming = streaming || !settled;
  const resolvingWordStyles = useMemo(() => {
    if (reducedMotion || !visuallyStreaming) {
      return [];
    }

    const styles: CSSProperties[] = [];
    const now = motionTime();

    for (
      let index = renderedCount - 1;
      index >= 0 && styles.length < MAX_RESOLVING_WORDS;
      index -= 1
    ) {
      const revealedAt = reveal.revealedAt[index];

      if (revealedAt === undefined) {
        break;
      }

      const elapsed = now - revealedAt;

      if (!Number.isFinite(elapsed) || elapsed >= WORD_RESOLVE_MS) {
        break;
      }

      styles.push(resolvingWordStyle(elapsed));
    }

    return styles;
  }, [reducedMotion, renderedCount, reveal.revealedAt, visibleText, visuallyStreaming]);
  const renderState: StreamingTextRenderState = {
    resolvingWordStyles,
    showCursor: visuallyStreaming && visibleText.length > 0,
  };

  useEffect(() => {
    onProgress?.();
  }, [onProgress, visibleText]);

  return (
    <div
      className="ds-streaming-text"
      data-streaming={visuallyStreaming || undefined}
    >
      <div className="ds-streaming-text-content">
        {renderText(visibleText, renderState)}
      </div>
    </div>
  );
}
