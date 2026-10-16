/**
 * [INPUT]: 依赖当前文档根与宿主元素继承的生产 CSS token
 * [OUTPUT]: LiveTokenValue，显示主题、字体与视口变化后的计算值；颜色规范为紧凑十六进制
 * [POS]: Design System 的数值读数边界；浏览器解析变量与 calc，样板不复制视觉参数
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useLayoutEffect, useRef, useState } from "react";

type TokenKind = "color" | "length" | "font-family" | "font-weight";
type LiveTokenValueProps = { token: string; kind?: TokenKind };

function formatColor(value: string) {
  const rgb = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/u.exec(value);
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/u.exec(value);
  const match = rgb ?? srgb;
  if (!match) return value;
  const channels = match.slice(1, 4).map(channel => Number(channel) * (srgb ? 255 : 1));
  if (match[4] !== undefined && Number(match[4]) < 1) channels.push(Number(match[4]) * 255);
  return `#${channels.map(channel => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, "0")).join("")}`;
}

export function LiveTokenValue({ token, kind = "length" }: LiveTokenValueProps) {
  const host = useRef<HTMLElement>(null);
  const [value, setValue] = useState("—");

  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    let active = true;
    const property = kind === "length" ? "width" : kind;
    const measure = () => {
      if (!active) return;
      const probe = document.createElement("span");
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;display:block;inset:auto;contain:strict;";
      probe.style.setProperty(property, `var(--${token})`);
      node.append(probe);
      const computed = getComputedStyle(probe).getPropertyValue(property).trim();
      probe.remove();
      const next = kind === "color" ? formatColor(computed) : computed;
      setValue(previous => previous === next ? previous : next);
    };
    const theme = new MutationObserver(measure);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "lang", "data-visual-context"],
    });
    window.addEventListener("resize", measure);
    document.fonts.addEventListener("loadingdone", measure);
    void document.fonts.ready.then(measure);
    measure();
    return () => {
      active = false;
      theme.disconnect();
      window.removeEventListener("resize", measure);
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [kind, token]);

  return <samp className="ds-live-token-value" ref={host} title={`--${token}`}>{value}</samp>;
}
