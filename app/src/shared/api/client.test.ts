/**
 * [INPUT]: 依赖 Bun test 与 access-token 的请求期 token 解析纯策略
 * [OUTPUT]: 锁定刷新后的当前 session 必须覆盖路由旧快照，并保留无 session 测试调用的显式 token 兜底
 * [POS]: app/src/shared/api 的长会话鉴权回归门禁；防止正文、画布等按需请求重新带上过期 Bearer
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { resolveApiAccessToken } from "./access-token";

describe("resolveApiAccessToken", () => {
  test("当前 session 已刷新时覆盖 loader 留下的旧 token", async () => {
    expect(await resolveApiAccessToken("expired-loader-token", async () => "fresh-session-token"))
      .toBe("fresh-session-token");
  });

  test("无当前 session 时保留显式 token 作为测试与兼容调用兜底", async () => {
    expect(await resolveApiAccessToken("explicit-token", async () => null))
      .toBe("explicit-token");
    expect(await resolveApiAccessToken(undefined, async () => null)).toBeNull();
  });
});
