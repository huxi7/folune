/**
 * [INPUT]: 依赖 React effect、Unicode 分词、目标文本、真实流状态与可选渲染器
 * [OUTPUT]: 对外提供 SSE 同步直出、仅尾部最多五词使用常数节点模糊落定的 StreamingText，以及尾词错峰样式
 * [POS]: design-system AI 消息家族的动态文字内核；每个网络分块只消费一次上游渲染，不维护逐字队列、全文时间轴或历史词节点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { splitStreamingTextUnits } from "./streamingTextSegments";

export type StreamingTextRenderState = {
  resolvingWordStyles: readonly CSSProperties[];
};

type StreamingTextProps = {
  onProgress?: () => void;
  renderText?: (text: string, state: StreamingTextRenderState) => ReactNode;
  streaming?: boolean;
  text: string;
};

const WORD_STAGGER_MS = 55;
const WORD_RESOLVE_MS = 420;
const MAX_RESOLVING_WORDS = 5;

export type StreamingWordTimeline = {
  revealedAt: readonly number[];
  units: readonly string[];
};

function motionTime() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function resolvedWordTimes(count: number) {
  return Array.from({ length: count }, () => Number.NEGATIVE_INFINITY);
}

function sameUnits(left: readonly string[], right: readonly string[]) {
  return left.length === right.length
    && left.every((unit, index) => unit === right[index]);
}

/** 时间轴只提供视觉进度；任何时刻都不会决定正文显示多少。 */
export function advanceStreamingWordTimeline(
  previous: StreamingWordTimeline,
  nextUnits: readonly string[],
  now: number,
  animate: boolean,
): StreamingWordTimeline {
  if (sameUnits(previous.units, nextUnits)) {
    if (animate || previous.revealedAt.every((time) => !Number.isFinite(time))) {
      return previous;
    }

    return { units: nextUnits, revealedAt: resolvedWordTimes(nextUnits.length) };
  }

  let stablePrefix = 0;
  const prefixLimit = Math.min(previous.units.length, nextUnits.length);

  while (
    stablePrefix < prefixLimit
    && previous.units[stablePrefix] === nextUnits[stablePrefix]
  ) {
    stablePrefix += 1;
  }

  const revealedAt = Array.from({ length: nextUnits.length }, (_, index) => {
    if (index < stablePrefix) {
      return previous.revealedAt[index] ?? Number.NEGATIVE_INFINITY;
    }

    if (!animate) {
      return Number.NEGATIVE_INFINITY;
    }

    const distanceFromTail = nextUnits.length - index - 1;
    return now - Math.min(distanceFromTail * WORD_STAGGER_MS, WORD_RESOLVE_MS);
  });

  return { units: nextUnits, revealedAt };
}

export function resolvingWordStyle(elapsed: number): CSSProperties {
  return { animationDelay: `${-Math.max(0, elapsed)}ms` };
}

export function activeResolvingWordStyles(
  timeline: StreamingWordTimeline,
  now: number,
): CSSProperties[] {
  const styles: CSSProperties[] = [];

  for (
    let index = timeline.units.length - 1;
    index >= 0 && styles.length < MAX_RESOLVING_WORDS;
    index -= 1
  ) {
    const revealedAt = timeline.revealedAt[index] ?? Number.NEGATIVE_INFINITY;
    const elapsed = now - revealedAt;

    if (!Number.isFinite(elapsed) || elapsed >= WORD_RESOLVE_MS) {
      break;
    }

    styles.push(resolvingWordStyle(elapsed));
  }

  return styles;
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

const RESOLVING_WORD_STYLES = Array.from(
  { length: MAX_RESOLVING_WORDS },
  (_, index) => resolvingWordStyle(index * WORD_STAGGER_MS),
);

function defaultRenderText(text: string, state: StreamingTextRenderState) {
  if (state.resolvingWordStyles.length === 0) {
    return (
      <p className="ds-streaming-text-plain">{text}</p>
    );
  }

  const units = splitStreamingTextUnits(text);
  const resolvingCount = Math.min(
    units.length,
    state.resolvingWordStyles.length,
  );
  const resolvingStart = units.length - resolvingCount;

  return (
    <p className="ds-streaming-text-plain">
      {units.slice(0, resolvingStart).join("")}
      {units.slice(resolvingStart).map((unit, index) => {
        const unitIndex = resolvingStart + index;

        return (
          <span
            className="ds-streaming-text-token"
            data-resolving="true"
            key={unitIndex}
            style={state.resolvingWordStyles[units.length - unitIndex - 1]}
          >
            {unit}
          </span>
        );
      })}
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
  const [settled, setSettled] = useState(!streaming);
  const visuallyStreaming = streaming || !settled;

  useEffect(() => {
    if (reducedMotion) {
      setSettled(true);
      return;
    }

    if (streaming) {
      setSettled(false);
      return;
    }

    if (settled) {
      return;
    }

    const timer = window.setTimeout(() => setSettled(true), WORD_RESOLVE_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, settled, streaming]);

  const resolvingWordStyles = reducedMotion || !visuallyStreaming
    ? []
    : RESOLVING_WORD_STYLES;
  const renderState: StreamingTextRenderState = {
    resolvingWordStyles,
  };

  // onProgress 只作为「text 前进时通知」的副作用触发器, 不参与依赖判定。
  // 放进依赖数组时, 调用方传入的内联箭头函数每次渲染都是新引用, 语义会
  // 退化成「任何渲染都通知」—— 于是外部无关的按键都会触发 scrollTo,
  // 把 AI 列表反复拽到底部, 用户上滑读历史无法停留。
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    onProgressRef.current?.();
  }, [text]);

  return (
    <div
      className="ds-streaming-text"
      data-streaming={visuallyStreaming || undefined}
    >
      <div className="ds-streaming-text-content">
        {renderText(text, renderState)}
      </div>
    </div>
  );
}
