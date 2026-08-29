/**
 * [INPUT]: 依赖 Bun test、src/testEnv 的公开占位配置、shared/api/ai settings client 与可替换 global fetch
 * [OUTPUT]: 覆盖 GET/PATCH /ai-settings 的 Bearer/body/响应，以及失败响应不会伪装为成功
 * [POS]: shared/api 的审批设置 HTTP 契约回归测试，不访问真实 Supabase 或浏览器会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import "../../testEnv";

import type { AiPermissionMode, AiUserSettings } from "./ai";

let getAiSettings: (accessToken: string) => Promise<AiUserSettings>;
let updateAiSettings: (
  accessToken: string,
  permissionMode: AiPermissionMode,
) => Promise<AiUserSettings>;

const originalFetch = globalThis.fetch;

beforeAll(async () => {
  ({ getAiSettings, updateAiSettings } = await import("./ai"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const settings = (permissionMode: "ask" | "auto_approve" | "full_access") => ({
  code: "ok",
  data: {
    user_id: "11111111-1111-4111-8111-111111111111",
    permission_mode: permissionMode,
    created_at: "2026-08-13T08:00:00.000Z",
    updated_at: "2026-08-13T08:00:00.000Z",
  },
  message: "OK",
});

describe("AI settings API", () => {
  test("GET 与 PATCH 使用同一 JWT 资源并返回后端确认模式", async () => {
    const requests: Request[] = [];
    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      const mode = request.method === "PATCH" ? "auto_approve" : "ask";
      return Response.json(settings(mode));
    }) as typeof fetch;

    expect((await getAiSettings("token")).permission_mode).toBe("ask");
    expect((await updateAiSettings("token", "auto_approve")).permission_mode).toBe("auto_approve");
    expect(requests.map((request) => request.method)).toEqual(["GET", "PATCH"]);
    expect(requests[1]?.headers.get("Authorization")).toBe("Bearer token");
    expect(await requests[1]?.json()).toEqual({ permission_mode: "auto_approve" });
  });

  test("PATCH 失败抛出明确 ApiError，不返回请求中的假模式", async () => {
    globalThis.fetch = (async () => Response.json({
      code: "AI_SETTINGS_WRITE_FAILED",
      data: null,
      message: "AI settings could not be updated",
    }, { status: 502 })) as unknown as typeof fetch;

    await expect(updateAiSettings("token", "full_access")).rejects.toMatchObject({
      code: "AI_SETTINGS_WRITE_FAILED",
      message: "AI settings could not be updated",
      status: 502,
    });
  });
});
