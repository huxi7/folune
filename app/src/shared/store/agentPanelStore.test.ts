/**
 * [INPUT]: 依赖 Bun test 与 agentPanelStore 的偏好纯函数/审批确认状态
 * [OUTPUT]: 覆盖按用户隔离面板开关、刷新恢复，以及审批模式仅在后端确认后改变和失败保留原值
 * [POS]: shared/store 的 AgentPanel 薄状态回归测试，不启动 React 或真实 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  agentPanelStorageKey,
  parseAgentPanelOpen,
  useAgentPanelStore,
} from "./agentPanelStore";

describe("AgentPanel open preference", () => {
  test("按用户隔离偏好 key", () => {
    expect(agentPanelStorageKey("user-a")).not.toBe(
      agentPanelStorageKey("user-b"),
    );
  });

  test("首次默认打开并严格恢复布尔文本", () => {
    expect(parseAgentPanelOpen(null)).toBe(true);
    expect(parseAgentPanelOpen("true")).toBe(true);
    expect(parseAgentPanelOpen("false")).toBe(false);
    expect(parseAgentPanelOpen("invalid")).toBe(false);
  });

  test("审批模式只在后端确认后改变，保存失败保留原值", () => {
    useAgentPanelStore.setState({
      permissionError: null,
      permissionMode: "ask",
      permissionStatus: "idle",
    });
    useAgentPanelStore.getState().beginPermissionSave();
    expect(useAgentPanelStore.getState()).toMatchObject({
      permissionMode: "ask",
      permissionStatus: "saving",
    });
    useAgentPanelStore.getState().failPermission("保存失败");
    expect(useAgentPanelStore.getState()).toMatchObject({
      permissionError: "保存失败",
      permissionMode: "ask",
      permissionStatus: "error",
    });
    useAgentPanelStore.getState().resolvePermission("full_access");
    expect(useAgentPanelStore.getState()).toMatchObject({
      permissionError: null,
      permissionMode: "full_access",
      permissionStatus: "ready",
    });
  });
});
