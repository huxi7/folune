/**
 * [INPUT]: 依赖 Bun test 与 workspacePreload 纯策略
 * [OUTPUT]: 验证慢网/省流/后台/离线跳过预取，缺少 Network Information 的浏览器保持正常行为
 * [POS]: pages 非必要预取策略门禁，不伪造浏览器全局或影响主动加载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { shouldPreloadWorkspace } from "./workspacePreload";

test("只在前台在线且没有慢网或省流提示时预取", () => {
  const ready = { online: true, visible: true };
  expect(shouldPreloadWorkspace(ready)).toBe(true);
  expect(shouldPreloadWorkspace({ ...ready, connection: { effectiveType: "4g" } })).toBe(true);
  expect(shouldPreloadWorkspace({ ...ready, online: false })).toBe(false);
  expect(shouldPreloadWorkspace({ ...ready, visible: false })).toBe(false);
  expect(shouldPreloadWorkspace({ ...ready, connection: { saveData: true } })).toBe(false);
  for (const effectiveType of ["slow-2g", "2g", "3g"]) {
    expect(shouldPreloadWorkspace({ ...ready, connection: { effectiveType } })).toBe(false);
  }
});
