/**
 * [INPUT]: 依赖 config/env 的非敏感运行配置与进程运行时信息
 * [OUTPUT]: 对外提供只打印一次、绝不展示凭据的 chat 服务 ASCII 启动 Banner
 * [POS]: lib 层启动可观测性边界，让容器启动时立即暴露服务、模型、端口和路由状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Env } from "@/config/env";

const cyan = "\u001B[36m";
const green = "\u001B[32m";
const dim = "\u001B[2m";
const reset = "\u001B[0m";
const WIDTH = 76;

type BannerState = typeof globalThis & {
  __foluneChatBannerPrinted?: boolean;
};

const colorEnabled = process.env["NO_COLOR"] !== "1";
const paint = (value: string, color: string): string =>
  colorEnabled ? `${color}${value}${reset}` : value;

const clean = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").trim();

const row = (label: string, value: string): string => {
  const content = `  ${label.padEnd(10)} ${clean(value)}`;
  const clipped = content.length > WIDTH - 4
    ? `${content.slice(0, WIDTH - 7)}...`
    : content;

  return `|${clipped.padEnd(WIDTH - 2)}|`;
};

export const printStartupBanner = (
  runtimeEnv: Env,
  routes: readonly string[],
): void => {
  const state = globalThis as BannerState;

  if (state.__foluneChatBannerPrinted) {
    return;
  }

  state.__foluneChatBannerPrinted = true;
  const border = `+${"-".repeat(WIDTH - 2)}+`;
  const strongBorder = `+${"=".repeat(WIDTH - 2)}+`;
  const runtime = typeof Bun === "undefined"
    ? `Node ${process.version}`
    : `Bun ${Bun.version}`;

  console.info(
    [
      paint(strongBorder, cyan),
      paint(row("service", runtimeEnv.SYSTEM_NAME), cyan),
      paint(row("status", "BOOTING / CONFIG VALID"), green),
      paint(border, dim),
      row("runtime", runtime),
      row("environment", runtimeEnv.NODE_ENV),
      row("listen", `0.0.0.0:${runtimeEnv.PORT}`),
      row("agent", "memo-agent"),
      row("model", runtimeEnv.DEFAULT_MODEL),
      row("routes", routes.join(" | ")),
      paint(strongBorder, cyan),
    ].join("\n"),
  );
};
