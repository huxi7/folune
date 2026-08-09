/**
 * [INPUT]: 依赖请求中间件采集的安全 HTTP 元数据与显式颜色开关
 * [OUTPUT]: 对外提供开发态紧凑 ASCII 请求卡片、健康探针摘要与生产态 JSON 格式化器
 * [POS]: middleware 层纯日志呈现器，不读取请求对象、查询串、Authorization、JWT 或响应正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type RequestLogRecord = Readonly<{
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  origin: string;
  source: "client" | "docker-health";
}>;

type Tone = "dim" | "cyan" | "green" | "yellow" | "red";

const ANSI: Readonly<Record<Tone | "reset", string>> = {
  dim: "\u001B[2m",
  cyan: "\u001B[36m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  red: "\u001B[31m",
  reset: "\u001B[0m",
};
const WIDTH = 76;
const LABEL_WIDTH = 10;
const VALUE_WIDTH = WIDTH - LABEL_WIDTH - 5;

const clean = (value: string): string => {
  const sanitized = value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "-";
};

const clip = (value: string, width: number): string =>
  value.length <= width ? value : `${value.slice(0, width - 3)}...`;

const paint = (value: string, tone: Tone, enabled: boolean): string =>
  enabled ? `${ANSI[tone]}${value}${ANSI.reset}` : value;

const statusTone = (status: number): Tone =>
  status >= 500 ? "red" : status >= 400 ? "yellow" : "green";

const durationTone = (durationMs: number): Tone =>
  durationMs >= 1_000 ? "red" : durationMs >= 250 ? "yellow" : "green";

const durationText = (durationMs: number): string =>
  durationMs >= 1_000
    ? `${(durationMs / 1_000).toFixed(2)} s`
    : `${durationMs.toFixed(2)} ms`;

const border = (title: string): string => {
  const heading = `-- ${title} `;
  return `+${heading.padEnd(WIDTH - 2, "-")}+`;
};

const row = (
  label: string,
  value: string,
  tone: Tone,
  enabled: boolean,
): string => {
  const safeLabel = clip(clean(label).toUpperCase(), LABEL_WIDTH)
    .padEnd(LABEL_WIDTH);
  const safeValue = clip(clean(value), VALUE_WIDTH).padEnd(VALUE_WIDTH);

  return `| ${paint(safeLabel, "dim", enabled)}${paint(safeValue, tone, enabled)} |`;
};

export const formatRequestCard = (
  record: RequestLogRecord,
  colorEnabled: boolean,
): string => {
  const tone = statusTone(record.status);

  return [
    paint(border(`CHAT HTTP #${clip(clean(record.requestId), 28)}`), tone, colorEnabled),
    row("started", record.timestamp, "cyan", colorEnabled),
    row("request", `${record.method.toUpperCase()} ${record.path}`, "cyan", colorEnabled),
    row("status", String(record.status), tone, colorEnabled),
    row("duration", durationText(record.durationMs), durationTone(record.durationMs), colorEnabled),
    row("origin", record.origin, "cyan", colorEnabled),
    paint(`+${"-".repeat(WIDTH - 2)}+`, tone, colorEnabled),
  ].join("\n");
};

export const formatHealthProbe = (
  record: RequestLogRecord,
  colorEnabled: boolean,
): string => [
  paint("[CHAT HEALTH]", "dim", colorEnabled),
  paint(String(record.status), statusTone(record.status), colorEnabled),
  paint(durationText(record.durationMs), durationTone(record.durationMs), colorEnabled),
].join("  ");

export const formatRequestJson = (record: RequestLogRecord): string =>
  JSON.stringify({
    event: "chat_http_request",
    request_id: clean(record.requestId),
    timestamp: clean(record.timestamp),
    method: clean(record.method.toUpperCase()),
    path: clean(record.path),
    status: record.status,
    duration_ms: Number(Math.max(0, record.durationMs).toFixed(2)),
    origin: clean(record.origin),
    source: record.source,
  });
