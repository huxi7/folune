/**
 * [INPUT]: 读取 ArchiveCordOverlay.tsx / archiveCordMotion.ts / AppSidebar.tsx 源码，并直接驱动运动租约总线
 * [OUTPUT]: 锁定归档几何的架构决策：几何只走 rAF + ref + SVG 属性、单帧至多一个 rAF、静止零空转、代表由树给出而不由 Overlay 猜、运动结束靠租约而不靠 transitionend
 * [POS]: Archive Cord 架构门禁；它守的是「不能这样写」而不是「现在长什么样」，真实端点跟手与逐帧证据一律归 Ego Lite fixture 验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  beginArchiveMotion,
  endArchiveMotion,
  isArchiveMotionActive,
  subscribeArchiveMotion,
} from "./archiveCordMotion";

/*
 * 门禁读的是代码而不是注释：这些文件的注释里正好写着「不靠 transitionend 猜」
 * 之类的句子, 不剥注释的话, 解释为什么不这样写就会被当成这样写了。
 */
const codeOf = (fileName: string): string => readFileSync(
  join(import.meta.dir, fileName),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

const overlaySource = codeOf("ArchiveCordOverlay.tsx");
const sidebarSource = codeOf("useTreeReorder.ts");

describe("Archive Cord 运动租约", () => {
  test("有租约在手才逐帧，全部归还即停下——静止页面不许常驻测量循环", () => {
    expect(isArchiveMotionActive()).toBe(false);
    beginArchiveMotion("tree-flip");
    expect(isArchiveMotionActive()).toBe(true);
    endArchiveMotion("tree-flip");
    expect(isArchiveMotionActive()).toBe(false);
  });

  test("同一来源可重入，不同来源互不干扰，计数归零才算结束", () => {
    beginArchiveMotion("tree-flip");
    beginArchiveMotion("tree-flip");
    beginArchiveMotion("library-panel");
    endArchiveMotion("tree-flip");
    // 连续折叠两次时第一段还没结束，租约不能被第二段的归还提前清掉
    expect(isArchiveMotionActive()).toBe(true);
    endArchiveMotion("tree-flip");
    expect(isArchiveMotionActive()).toBe(true);
    endArchiveMotion("library-panel");
    expect(isArchiveMotionActive()).toBe(false);
  });

  test("多余的归还不会把计数压到负数，从而卡住后续运动", () => {
    endArchiveMotion("never-started");
    expect(isArchiveMotionActive()).toBe(false);
    beginArchiveMotion("library-panel");
    expect(isArchiveMotionActive()).toBe(true);
    endArchiveMotion("library-panel");
    expect(isArchiveMotionActive()).toBe(false);
  });

  test("租约变化会通知调度器，退订后不再通知", () => {
    let notifications = 0;
    const unsubscribe = subscribeArchiveMotion(() => {
      notifications += 1;
    });
    beginArchiveMotion("tree-flip");
    endArchiveMotion("tree-flip");
    expect(notifications).toBe(2);
    unsubscribe();
    beginArchiveMotion("tree-flip");
    endArchiveMotion("tree-flip");
    expect(notifications).toBe(2);
  });
});

describe("Archive Cord 几何架构门禁", () => {
  test("几何只进 SVG 属性，不进 React state：每帧 setState 就是那条追在滚动后面的线", () => {
    const drawBody = overlaySource.slice(
      overlaySource.indexOf("const draw = ()"),
      overlaySource.indexOf("const schedule = ()"),
    );
    expect(drawBody.length).toBeGreaterThan(0);
    expect(drawBody).toContain('path.setAttribute("d"');
    expect(drawBody).toContain('hit.setAttribute("d"');
    expect(drawBody).not.toContain("setState");
    expect(drawBody).not.toContain("setPhase");
    // 唯一的 React state 是 phase 这个低频语义（import 不算一次调用）
    expect(overlaySource.match(/useState[(<]/g)).toHaveLength(1);
  });

  test("单帧至多一个 rAF，且只有租约或迁移未完才续帧", () => {
    expect(overlaySource).toContain("if (frame !== null) return;");
    expect(overlaySource).toContain("if (draw() || isArchiveMotionActive()) schedule();");
  });

  test("Overlay 不自己遍历树：代表只能来自树上唯一那个标记", () => {
    expect(overlaySource).toContain('const REPRESENTATIVE_SELECTOR = "[data-archive-representative]:not([inert] *)"');
    expect(overlaySource).not.toContain("getAncestorFolderIds");
    expect(overlaySource).not.toContain("expandedFolders");
    expect(overlaySource).not.toContain("resolveArchiveRepresentative");
    expect(overlaySource).not.toContain("archiveRepresentativeCandidates");
    // 旧的目录优先出口不得以任何形式回到这一层
    expect(overlaySource).not.toContain("targetFolderId");
  });

  test("transform 动画的结尾由发起方交还租约，不靠 transitionend 猜", () => {
    expect(overlaySource).not.toContain("transitionend");
    expect(overlaySource).toContain("subscribeArchiveMotion");
    expect(sidebarSource).toContain('beginArchiveMotion("tree-flip")');
    expect(sidebarSource).toContain('endArchiveMotion("tree-flip")');
    expect(sidebarSource).toContain("animation.finished");
  });

  test("树行位移与线头迁移共用同一条 FLIP 时间轴，不各配一套数字", () => {
    expect(sidebarSource).toContain("treeFlipDurationMs");
    expect(sidebarSource).toContain("treeFlipEasing");
    expect(sidebarSource).not.toContain("cubic-bezier(");
    expect(overlaySource).toContain("treeFlipDurationMs");
    expect(overlaySource).toContain("treeFlipEase(progress)");
    // fresh 结束靠真实 animationend 回落, 不靠计时器
    expect(overlaySource).toContain("onAnimationEnd");
    // 线的生命感来自连续事实, 不来自晃动
    expect(overlaySource).not.toContain("spring");
    expect(overlaySource).not.toContain("setTimeout");
  });
});
