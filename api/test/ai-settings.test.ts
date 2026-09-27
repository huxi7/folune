/**
 * [INPUT]: 依赖真实 aiSettingsService/repository/PostgREST 请求链和可暂停的网络替身
 * [OUTPUT]: 验证默认完全访问、显式选择保留、并发初始化不覆盖 PATCH，以及冲突后重读胜出值
 * [POS]: API 权限初始化的时序回归门禁；不访问真实数据库或模型
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import type { AiUserSettings } from "../src/model/ai.model.ts";

Bun.env["SUPABASE_URL"] = "https://profile-test.supabase.co";
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_profile_test";
const { aiSettingsService } = await import("../src/service/ai-command.service.ts");
const auth = { id: "11111111-1111-4111-8111-111111111111", email: null, userMetadata: {} };
const token = "settings-test-token";
const originalFetch = globalThis.fetch;
let row: AiUserSettings | null;
let beforeInsert: () => Promise<void>;
const preferences: string[] = [];
const fixture = (permission_mode: AiUserSettings["permission_mode"]): AiUserSettings => ({
  user_id: auth.id, permission_mode,
  created_at: "2026-09-27T00:00:00Z", updated_at: "2026-09-27T00:00:00Z",
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  row = null;
  preferences.length = 0;
  beforeInsert = async () => undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    expect(new URL(request.url).pathname).toBe("/rest/v1/ai_user_settings");
    expect(request.headers.get("Authorization")).toBe(`Bearer ${token}`);
    if (request.method === "GET") return Response.json(row ? [row] : []);
    const prefer = request.headers.get("Prefer")!;
    preferences.push(prefer);
    const body = await request.json() as AiUserSettings;
    const ignore = prefer.includes("resolution=ignore-duplicates");
    if (ignore) await beforeInsert();
    if (ignore && row) return Response.json([]);
    row = fixture(body.permission_mode);
    return Response.json([row]);
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; });

test("新账号默认完全访问；已选每次询问或智能审批的账号重开仍保留选择", async () => {
  expect((await aiSettingsService.get(auth, token)).permission_mode).toBe("full_access");
  expect(preferences[0]).toContain("resolution=ignore-duplicates");
  for (const permission_mode of ["ask", "auto_approve", "full_access"] as const) {
    await aiSettingsService.update(auth, token, { permission_mode });
    expect((await aiSettingsService.get(auth, token)).permission_mode).toBe(permission_mode);
  }
});

test("冷启动 GET 晚于用户 PATCH 完成时不能把选择重置为默认值", async () => {
  const entered = deferred();
  const release = deferred();
  beforeInsert = () => { entered.resolve(); return release.promise; };
  const initialRead = aiSettingsService.get(auth, token);
  await entered.promise;
  await aiSettingsService.update(auth, token, { permission_mode: "ask" });
  release.resolve();
  expect((await initialRead).permission_mode).toBe("ask");
  expect(row?.permission_mode).toBe("ask");
  expect(preferences).toEqual([
    "resolution=ignore-duplicates, return=representation",
    "resolution=merge-duplicates, return=representation",
  ]);
});

test("两个首次读取并发初始化都取得同一确认值，后到插入不覆盖", async () => {
  const entered = deferred();
  const release = deferred();
  let inserts = 0;
  beforeInsert = () => {
    if (++inserts === 2) entered.resolve();
    return release.promise;
  };
  const first = aiSettingsService.get(auth, token);
  const second = aiSettingsService.get(auth, token);
  await entered.promise;
  release.resolve();
  expect((await first).permission_mode).toBe("full_access");
  expect((await second).permission_mode).toBe("full_access");
});
