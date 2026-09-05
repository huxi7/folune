/**
 * [INPUT]: 读取 useDismissable、AppSidebar、PaperWorkspaceShell、CanvasWorkspace 与 KnowledgeCanvas 的 Escape 监听目标
 * [OUTPUT]: 锁定 Escape 层级仲裁只用两档冒泡目标表达——内层弹层挂 document、壳层守卫挂 window 并让行于 defaultPrevented
 * [POS]: 弹层与壳层之间的键盘层序静态门禁；不挂载 React，也不替代真实浏览器里"按一下只收一层"的验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string): string =>
  readFileSync(join(import.meta.dir, relative), "utf8");

const dismissable = read("../shared/design-system/useDismissable.ts");
const sidebar = read("./AppSidebar.tsx");
const paperShell = read("./PaperWorkspaceShell.tsx");
const canvasShell = read("./CanvasWorkspace.tsx");
const canvas = read("./KnowledgeCanvas/KnowledgeCanvas.tsx");

describe("Escape 层级仲裁", () => {
  /*
   * 冒泡链只提供两档可用目标: document 恒先于 window。因此协议是
   *   内层弹层 → document + preventDefault
   *   壳层守卫 → window + 检查 defaultPrevented
   * 内层若也挂 window, 就与壳层同档、只按注册顺序决胜负 —— 而壳层注册更早,
   * 于是一次 Escape 连关两层(文件树右键菜单曾因此把文件库一起关掉)。
   */
  test("共享弹层原语挂 document 并必定 preventDefault", () => {
    expect(dismissable).toContain('document.addEventListener("keydown"');
    expect(dismissable).not.toContain('window.addEventListener("keydown"');
    expect(dismissable).toContain("event.preventDefault();");
  });

  test("文件树右键菜单与共享原语同档，不再和壳层抢 window", () => {
    const effect = sidebar.slice(
      sidebar.indexOf("function dismissContextMenu"),
      sidebar.indexOf("function captureFlipPositions"),
    );
    expect(effect).toContain('document.addEventListener("keydown"');
    expect(effect).toContain('document.removeEventListener("keydown"');
    expect(effect).not.toContain('window.addEventListener("keydown"');
    expect(effect).toContain("event.preventDefault();");
  });

  test("两个壳层守卫都留在 window 并让行于已消费的 Escape", () => {
    for (const shell of [paperShell, canvasShell]) {
      expect(shell).toContain('window.addEventListener("keydown"');
      expect(shell).toContain('event.key !== "Escape" || event.defaultPrevented');
    }
  });

  test("画布内容层同样留在 window: 它必须让 Dialog 先收，再由壳层兜底", () => {
    // 三层只有两档目标可用, 画布内容与壳层共用 window、靠 defaultPrevented 分先后;
    // 把它搬到 document 会和 Dialog 抢同一档, 确认框里按 Esc 会连带清掉节点选择。
    expect(canvas).toContain('window.addEventListener("keydown"');
    expect(canvas).not.toContain('window.document.addEventListener("keydown"');
    expect(canvas).toContain('event.key !== "Escape" || event.defaultPrevented');
  });
});
