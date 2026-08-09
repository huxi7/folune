/**
 * [INPUT]: 依赖 config/env 的非敏感运行配置、Bun 运行时版本、NO_COLOR 与服务 URL
 * [OUTPUT]: 对外提供 printBanner、printRuntimeInfo、printReady 三段纯 ASCII 启动输出
 * [POS]: lib 层启动可观测性工具，只展示端口、Supabase host、CORS 等安全摘要
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Env } from "../config/env.ts";

const cyan = "\u001B[36m";
const green = "\u001B[32m";
const dim = "\u001B[2m";
const reset = "\u001B[0m";

const colorEnabled = Bun.env["NO_COLOR"] !== "1";

const colorize = (value: string, color: string): string =>
  colorEnabled ? `${color}${value}${reset}` : value;

const section = (title: string): void => {
  console.info(colorize(`--- ${title} ---`, dim));
};

export const printBanner = (systemName: string): void => {
  console.info(
    colorize(
      String.raw`
  ____                        _   _       _
 / ___| _   _ _ __   ___ _ __| \ | | ___ | |_ ___
 \___ \| | | | '_ \ / _ \ '__|  \| |/ _ \| __/ _ \
  ___) | |_| | |_) |  __/ |  | |\  | (_) | ||  __/
 |____/ \__,_| .__/ \___|_|  |_| \_|\___/ \__\___|
             |_|`,
      cyan,
    ),
  );
  console.info(`system: ${systemName}`);
};

export const printRuntimeInfo = (runtimeEnv: Env): void => {
  section("runtime");
  console.info(`env: ${runtimeEnv.NODE_ENV}`);
  console.info(`runtime: Bun ${Bun.version}`);
  console.info(`port: ${runtimeEnv.PORT}`);
  console.info(
    `supabase-host: ${new URL(runtimeEnv.SUPABASE_URL).host}`,
  );
  console.info(`cors-origins: ${runtimeEnv.CORS_ORIGINS.join(", ")}`);
};

export const printReady = (
  serverUrl: URL,
  routes: readonly string[],
): void => {
  const endpoint = serverUrl.origin;

  section("ready");
  console.info(colorize(`endpoint: ${endpoint}`, green));
  console.info(`health-check: ${endpoint}/health`);
  console.info(`routes: ${routes.join(", ")}`);
};
