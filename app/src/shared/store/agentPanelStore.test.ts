/**
 * [INPUT]: 依赖 Bun test 与 agentPanelStore 的审批确认状态
 * [OUTPUT]: 覆盖审批模式仅在后端确认后改变和失败保留原值
 * [POS]: shared/store 的 AgentPanel 权限薄状态回归测试，不启动 React 或真实 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import { isPermissionReady, useAgentPanelStore } from "./agentPanelStore";

describe("AgentPanel permission preference", () => {
  test("首次展示默认完全访问，但确认前和保存期间都不能发送", () => {
    expect(useAgentPanelStore.getInitialState().permissionMode).toBe("full_access");
    const store = useAgentPanelStore.getState();
    store.beginPermissionLoad("user-a");
    expect(isPermissionReady(useAgentPanelStore.getState(), "user-a")).toBe(false);
    store.resolvePermission("full_access");
    expect(isPermissionReady(useAgentPanelStore.getState(), "user-a")).toBe(true);
    store.beginPermissionSave();
    expect(isPermissionReady(useAgentPanelStore.getState(), "user-a")).toBe(false);
  });

  test("同账号重读保留确认值，切账号不借用上一账号权限", () => {
    const store = useAgentPanelStore.getState();
    store.beginPermissionLoad("user-a");
    store.resolvePermission("ask");
    store.beginPermissionLoad("user-a");
    expect(useAgentPanelStore.getState().permissionMode).toBe("ask");
    store.resolvePermission("ask");
    expect(isPermissionReady(useAgentPanelStore.getState(), "user-b")).toBe(false);
    store.beginPermissionLoad("user-b");
    expect(useAgentPanelStore.getState().permissionMode).toBe("full_access");
    expect(isPermissionReady(useAgentPanelStore.getState(), "user-b")).toBe(false);
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
