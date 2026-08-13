/**
 * [INPUT]: 依赖 Bun test 与 agentPanelStore 的审批确认状态
 * [OUTPUT]: 覆盖审批模式仅在后端确认后改变和失败保留原值
 * [POS]: shared/store 的 AgentPanel 权限薄状态回归测试，不启动 React 或真实 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { useAgentPanelStore } from "./agentPanelStore";

describe("AgentPanel permission preference", () => {
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
