/**
 * [INPUT]: 依赖 Bun test 与 archiveCordPolicy 的无副作用可见性/目标决策
 * [OUTPUT]: 覆盖成功、撤销、根目录回退、关闭文件库与小屏覆盖层的持久连线门禁
 * [POS]: widgets 层 Archive Cord 生命周期回归测试；不启动 DOM、Motion 或 react-archer
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import {
  resolveArchiveTargetNodeId,
  shouldShowArchiveCord,
  type WorkspaceOrganizePresentation,
} from "./archiveCordPolicy";

const presentation: WorkspaceOrganizePresentation = {
  memoId: "memo-1",
  path: "Ideas / Quiet systems",
  runId: "run-1",
  status: "succeeded",
  targetFolderId: "folder-1",
};

describe("Archive Cord presentation policy", () => {
  test("成功与撤销均优先连接真实目标目录", () => {
    expect(resolveArchiveTargetNodeId(presentation)).toBe("folder-1");
    expect(resolveArchiveTargetNodeId({
      ...presentation,
      runId: "run-2",
      status: "undone",
      targetFolderId: "folder-restored",
    })).toBe("folder-restored");
  });

  test("根目录结果回退到当前 memo 节点", () => {
    expect(resolveArchiveTargetNodeId({
      ...presentation,
      targetFolderId: null,
    })).toBe("memo-1");
  });

  test("仅宽屏文件库打开且存在结果时保持连线", () => {
    expect(shouldShowArchiveCord({
      libraryOpen: true,
      overlayPanels: false,
      presentation,
    })).toBe(true);
    expect(shouldShowArchiveCord({
      libraryOpen: false,
      overlayPanels: false,
      presentation,
    })).toBe(false);
    expect(shouldShowArchiveCord({
      libraryOpen: true,
      overlayPanels: true,
      presentation,
    })).toBe(false);
    expect(shouldShowArchiveCord({
      libraryOpen: true,
      overlayPanels: false,
      presentation: null,
    })).toBe(false);
  });
});
