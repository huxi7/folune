/**
 * [INPUT]: 依赖 React 状态/计时器、目标文本、真实流状态与可选渲染器
 * [OUTPUT]: 对外提供逐字符追赶 SSE 文本与每字轻微光晕的 StreamingText，流结束立即补齐正文
 * [POS]: design-system AI 消息家族的动态文字内核，不拥有消息容器、Markdown 规则或工具状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type StreamingTextProps = {
  onProgress?: () => void;
  renderText?: (text: string) => ReactNode;
  streaming?: boolean;
  text: string;
};

const CHARACTER_DELAY_MS = 18;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function defaultRenderText(text: string) {
  return <p className="ds-streaming-text-plain">{text}</p>;
}

export function StreamingText({
  onProgress,
  renderText = defaultRenderText,
  streaming = false,
  text,
}: StreamingTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const characters = useMemo(() => Array.from(text), [text]);
  const [visibleCount, setVisibleCount] = useState(
    () => streaming ? 0 : characters.length,
  );

  useEffect(() => {
    if (reducedMotion || !streaming) {
      setVisibleCount(characters.length);
      return;
    }

    if (visibleCount > characters.length) {
      setVisibleCount(characters.length);
      return;
    }

    if (visibleCount >= characters.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, characters.length));
    }, CHARACTER_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [characters.length, reducedMotion, streaming, visibleCount]);

  const visibleText = characters.slice(0, visibleCount).join("");

  useEffect(() => {
    onProgress?.();
  }, [onProgress, visibleText]);

  return (
    <div
      className="ds-streaming-text"
      data-streaming={streaming || undefined}
    >
      {streaming && visibleCount > 0 ? (
        <span
          aria-hidden="true"
          className="ds-streaming-text-glow"
          data-direction={visibleCount % 2 === 0 ? "right" : "left"}
          key={`glow-${visibleCount}`}
        />
      ) : null}
      <div className="ds-streaming-text-content">
        {renderText(visibleText)}
      </div>
    </div>
  );
}
