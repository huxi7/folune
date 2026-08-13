/**
 * [INPUT]: 依赖 Bun test 与 useMemoOrganize 的 Run 唤醒纯决策
 * [OUTPUT]: 覆盖成功/撤销唤醒文件库、待确认唤醒 AI、stale/失败/过程态不强迫打开工具
 * [POS]: pages 层整理舞台分流回归测试，不启动 React、网络或真实 Store
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { getOrganizeWakeTarget } from "./organizePresentation";

describe("AI organize workspace wake target", () => {
  test("成功与撤销只唤醒文件库", () => {
    expect(getOrganizeWakeTarget("succeeded")).toBe("library");
    expect(getOrganizeWakeTarget("undone")).toBe("library");
  });

  test("只有待确认方案唤醒 AI", () => {
    expect(getOrganizeWakeTarget("awaiting_confirmation")).toBe("assistant");
  });

  test("stale、失败和过程态不强迫用户进入工具", () => {
    expect(getOrganizeWakeTarget("stale")).toBeNull();
    expect(getOrganizeWakeTarget("failed")).toBeNull();
    expect(getOrganizeWakeTarget("planning")).toBeNull();
    expect(getOrganizeWakeTarget("applying")).toBeNull();
    expect(getOrganizeWakeTarget("rejected")).toBeNull();
  });
});
