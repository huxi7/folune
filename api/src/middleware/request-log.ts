/**
 * [INPUT]: 依赖请求中间件采集的安全 HTTP 元数据与显式颜色开关
 * [OUTPUT]: 对外提供 RequestLogRecord、彩色 ASCII 请求卡片、健康探针摘要与生产 JSON 格式化能力
 * [POS]: middleware 层的纯日志呈现器，不读取请求对象，不接触 Authorization、API key 或响应正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type RequestLogSource = "client" | "docker-health";

export type RequestLogRecord = Readonly<{
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  origin: string;
  source: RequestLogSource;
}>;

type Tone =
  | "plain"
  | "dim"
  | "cyan"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "magenta";

const ANSI: Readonly<Record<Tone | "reset", string>> = {
  plain: "",
  dim: "\u001B[2m",
  cyan: "\u001B[36m",
  blue: "\u001B[34m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  red: "\u001B[31m",
  magenta: "\u001B[35m",
  reset: "\u001B[0m",
};

const CARD_WIDTH = 78;
const BORDER_INNER_WIDTH = CARD_WIDTH - 2;
const CONTENT_WIDTH = CARD_WIDTH - 4;
const LABEL_WIDTH = 11;
const VALUE_WIDTH = CONTENT_WIDTH - LABEL_WIDTH;

const STATUS_TEXT: Readonly<Record<number, string>> = {
  200: "OK",
  201: "CREATED",
  202: "ACCEPTED",
  204: "NO CONTENT",
  301: "MOVED PERMANENTLY",
  302: "FOUND",
  304: "NOT MODIFIED",
  400: "BAD REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT FOUND",
  405: "METHOD NOT ALLOWED",
  409: "CONFLICT",
  422: "UNPROCESSABLE CONTENT",
  429: "TOO MANY REQUESTS",
  500: "INTERNAL SERVER ERROR",
  502: "BAD GATEWAY",
  503: "SERVICE UNAVAILABLE",
  504: "GATEWAY TIMEOUT",
};

const sanitize = (value: string): string => {
  const sanitized = value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "-";
};

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

const paint = (
  value: string,
  tone: Tone,
  colorEnabled: boolean,
): string => {
  if (!colorEnabled || tone === "plain") {
    return value;
  }

  return `${ANSI[tone]}${value}${ANSI.reset}`;
};

const statusTone = (status: number): Tone => {
  if (status >= 500) {
    return "red";
  }

  if (status >= 400) {
    return "yellow";
  }

  if (status >= 300) {
    return "cyan";
  }

  return "green";
};

const methodTone = (method: string): Tone => {
  switch (method.toUpperCase()) {
    case "GET":
      return "cyan";
    case "POST":
      return "green";
    case "PUT":
    case "PATCH":
      return "yellow";
    case "DELETE":
      return "red";
    case "OPTIONS":
      return "magenta";
    default:
      return "blue";
  }
};

const durationTone = (durationMs: number): Tone => {
  if (durationMs >= 1_000) {
    return "red";
  }

  if (durationMs >= 250) {
    return "yellow";
  }

  return "green";
};

const formatDuration = (durationMs: number): string => {
  const safeDuration = Math.max(0, durationMs);
  const value = safeDuration >= 1_000
    ? `${(safeDuration / 1_000).toFixed(2)} s`
    : `${safeDuration.toFixed(2)} ms`;

  return safeDuration >= 1_000 ? `${value} [SLOW]` : value;
};

const renderBorder = (
  requestId: string,
  tone: Tone,
  colorEnabled: boolean,
): string => {
  const title = `-- HTTP REQUEST #${truncate(sanitize(requestId), 36)} `;
  const border = `+${title.padEnd(BORDER_INNER_WIDTH, "-")}+`;

  return paint(border, tone, colorEnabled);
};

const renderBottomBorder = (
  tone: Tone,
  colorEnabled: boolean,
): string => paint(
  `+${"-".repeat(BORDER_INNER_WIDTH)}+`,
  tone,
  colorEnabled,
);

const renderRow = (
  label: string,
  value: string,
  valueTone: Tone,
  borderTone: Tone,
  colorEnabled: boolean,
): string => {
  const labelColumn = truncate(sanitize(label).toUpperCase(), LABEL_WIDTH)
    .padEnd(LABEL_WIDTH);
  const valueColumn = truncate(sanitize(value), VALUE_WIDTH)
    .padEnd(VALUE_WIDTH);

  return [
    paint("|", borderTone, colorEnabled),
    " ",
    paint(labelColumn, "dim", colorEnabled),
    paint(valueColumn, valueTone, colorEnabled),
    " ",
    paint("|", borderTone, colorEnabled),
  ].join("");
};

export const formatRequestCard = (
  record: RequestLogRecord,
  colorEnabled: boolean,
): string => {
  const borderTone = statusTone(record.status);
  const status = `${record.status} ${STATUS_TEXT[record.status] ?? "HTTP RESPONSE"}`;
  const request = `${record.method.toUpperCase()} ${record.path}`;

  return [
    renderBorder(record.requestId, borderTone, colorEnabled),
    renderRow("started", record.timestamp, "plain", borderTone, colorEnabled),
    renderRow(
      "request",
      request,
      methodTone(record.method),
      borderTone,
      colorEnabled,
    ),
    renderRow(
      "status",
      status,
      statusTone(record.status),
      borderTone,
      colorEnabled,
    ),
    renderRow(
      "duration",
      formatDuration(record.durationMs),
      durationTone(record.durationMs),
      borderTone,
      colorEnabled,
    ),
    renderRow("origin", record.origin, "blue", borderTone, colorEnabled),
    renderBottomBorder(borderTone, colorEnabled),
  ].join("\n");
};

export const formatHealthProbe = (
  record: RequestLogRecord,
  colorEnabled: boolean,
): string => {
  const status = paint(
    String(record.status),
    statusTone(record.status),
    colorEnabled,
  );
  const duration = paint(
    formatDuration(record.durationMs),
    durationTone(record.durationMs),
    colorEnabled,
  );

  return [
    paint("[HEALTH]", "dim", colorEnabled),
    paint(`#${sanitize(record.requestId)}`, "dim", colorEnabled),
    paint(sanitize(record.timestamp), "dim", colorEnabled),
    status,
    duration,
  ].join("  ");
};

export const formatRequestJson = (record: RequestLogRecord): string =>
  JSON.stringify({
    event: "http_request",
    request_id: sanitize(record.requestId),
    timestamp: sanitize(record.timestamp),
    method: sanitize(record.method.toUpperCase()),
    path: sanitize(record.path),
    status: record.status,
    duration_ms: Number(Math.max(0, record.durationMs).toFixed(2)),
    origin: sanitize(record.origin),
    source: record.source,
  });
