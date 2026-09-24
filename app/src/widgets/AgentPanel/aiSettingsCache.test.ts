/**
 * [INPUT]: 依赖 aiSettingsCache 的用户缓存/在途合并接口与测试替身 API
 * [OUTPUT]: 覆盖审批设置读取的并发合并、用户隔离、TTL 命中、写入更新与写命令实时权限合并
 * [POS]: AgentPanel 权限设置缓存的纯行为回归；不触达真实网络或 UI
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { afterEach, describe, expect, mock, test } from "bun:test";

import type { AiUserSettings } from "../../shared/api/ai";

let getAiSettingsHandler: (accessToken: string) => Promise<AiUserSettings>;

mock.module("../../shared/api/ai", () => ({
  getAiSettings: (accessToken: string) => getAiSettingsHandler(accessToken),
}));

const {
  AI_SETTINGS_CACHE_FRESH_MS,
  readAiSettings,
  readFreshAiSettings,
  resetAiSettingsCacheForTests,
  writeAiSettings,
} = await import("./aiSettingsCache");

const settings = (
  permission_mode: "ask" | "auto_approve" | "full_access",
  user_id = "user-a",
): AiUserSettings => ({
  created_at: "2026-08-30T00:00:00.000Z",
  permission_mode,
  updated_at: "2026-08-30T00:00:00.000Z",
  user_id,
});

describe("aiSettingsCache", () => {
  afterEach(() => {
    getAiSettingsHandler = async () => settings("ask");
    resetAiSettingsCacheForTests();
  });

  test("新鲜设置直接复用，过期后再次读取", async () => {
    let calls = 0;
    getAiSettingsHandler = async () => {
      calls += 1;
      return settings("full_access");
    };
    writeAiSettings("user-a", settings("ask"), 1_000);

    expect(await readAiSettings("token", "user-a", 1_000 + AI_SETTINGS_CACHE_FRESH_MS - 1)).toEqual(settings("ask"));
    expect(calls).toBe(0);
    expect(await readAiSettings("token", "user-a", 1_000 + AI_SETTINGS_CACHE_FRESH_MS)).toEqual(settings("full_access"));
    expect(calls).toBe(1);
  });

  test("不同用户不共享设置快照", async () => {
    writeAiSettings("user-a", settings("full_access"), 1_000);
    getAiSettingsHandler = async () => settings("ask", "user-b");

    const result = await readAiSettings("token", "user-b", 1_000);

    expect(result).toEqual(settings("ask", "user-b"));
  });

  test("并发读取同一用户只发一个请求", async () => {
    let calls = 0;
    let resolveRequest!: (value: AiUserSettings) => void;
    getAiSettingsHandler = () => {
      calls += 1;
      return new Promise<AiUserSettings>((resolve) => {
        resolveRequest = resolve;
      });
    };

    const first = readAiSettings("token", "user-c");
    const second = readAiSettings("token", "user-c");
    resolveRequest(settings("ask", "user-c"));

    expect(await first).toEqual(await second);
    expect(calls).toBe(1);
  });

  test("写入新设置后下一次读取立即返回新值", async () => {
    writeAiSettings("user-a", settings("ask"), 1_000);
    writeAiSettings("user-a", settings("auto_approve"), 2_000);

    expect(await readAiSettings("token", "user-a", 2_000)).toEqual(settings("auto_approve"));
  });
  test("写命令只合并同凭据在途请求，完成后重读且不借用侧栏缓存", async () => {
    const resolvers: Array<(value: AiUserSettings) => void> = [];
    getAiSettingsHandler = () => new Promise(resolve => resolvers.push(resolve));
    writeAiSettings("user-a", settings("full_access"));
    const first = readFreshAiSettings("token-a");
    expect(readFreshAiSettings("token-a")).toBe(first);
    const other = readFreshAiSettings("token-b");
    expect(resolvers).toHaveLength(2);
    resolvers[0]!(settings("ask"));
    resolvers[1]!(settings("auto_approve", "user-b"));
    expect((await first).permission_mode).toBe("ask");
    expect((await other).user_id).toBe("user-b");
    const next = readFreshAiSettings("token-a");
    expect(resolvers).toHaveLength(3);
    resolvers[2]!(settings("auto_approve"));
    expect((await next).permission_mode).toBe("auto_approve");
  });

  test("写权限读取失败后释放在途请求，下一次可以重试", async () => {
    getAiSettingsHandler = async () => { throw new Error("offline"); };
    await expect(readFreshAiSettings("token-a")).rejects.toThrow("offline");
    getAiSettingsHandler = async () => settings("ask");
    expect((await readFreshAiSettings("token-a")).permission_mode).toBe("ask");
  });

});
