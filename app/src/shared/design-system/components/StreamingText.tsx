/**
 * [INPUT]: 依赖 React 状态/计时器、Unicode 分词、目标文本、真实流状态与可选渲染器
 * [OUTPUT]: 对外提供按词追赶 SSE、词尾模糊落定与细光标状态的 StreamingText，网络结束后继续平滑排空积压词
 * [POS]: design-system AI 消息家族的动态文字内核，统一节奏但把纯文本/Markdown 的稳定词节点交给各自渲染器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { splitStreamingTextUnits } from "./streamingTextSegments";

export type StreamingTextRenderState = {
  animateWords: boolean;
  showCursor: boolean;
};

type StreamingTextProps = {
  onProgress?: () => void;
  renderText?: (text: string, state: StreamingTextRenderState) => ReactNode;
  streaming?: boolean;
  text: string;
};

const WORD_DELAY_MS = 55;
const MIN_WORD_DELAY_MS = 18;
const WORD_RESOLVE_MS = 420;

function wordDelay(remaining: number) {
  return Math.max(
    MIN_WORD_DELAY_MS,
    WORD_DELAY_MS - Math.max(0, remaining - 4) * 2,
  );
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
      {state.animateWords
        ? units.map((unit, index) => (
            <span className="ds-streaming-text-token" key={index}>
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
  const [visibleCount, setVisibleCount] = useState(
    () => streaming ? 0 : units.length,
  );
  const [settled, setSettled] = useState(!streaming);

  useEffect(() => {
    if (reducedMotion) {
      setVisibleCount(units.length);
      setSettled(true);
      return;
    }

    if (streaming) {
      setSettled(false);
    }

    if (visibleCount > units.length) {
      setVisibleCount(units.length);
      return;
    }

    if (visibleCount < units.length) {
      setSettled(false);
      const remaining = units.length - visibleCount;
      const timer = window.setTimeout(() => {
        setVisibleCount((count) => Math.min(count + 1, units.length));
      }, wordDelay(remaining));

      return () => window.clearTimeout(timer);
    }

    if (streaming || settled) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSettled(true);
    }, WORD_RESOLVE_MS);

    return () => window.clearTimeout(timer);
  }, [reducedMotion, settled, streaming, units.length, visibleCount]);

  const renderedCount = reducedMotion
    ? units.length
    : Math.min(visibleCount, units.length);
  const visibleText = units.slice(0, renderedCount).join("");
  const visuallyStreaming = streaming || !settled;
  const renderState: StreamingTextRenderState = {
    animateWords: visuallyStreaming && !reducedMotion && visibleText.length > 0,
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
