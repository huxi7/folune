/**
 * [INPUT]: 依赖 Bun test 与 lib/motion 的全站动效语义
 * [OUTPUT]: 锁定 Spring 物理参数、核心变体入口与页面/模态的退场边界
 * [POS]: app/src/lib 的动效契约测试，防止页面重新复制线性过渡或无阻尼弹跳
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, it } from "bun:test";

import {
  bouncy,
  contentSwitch,
  gentle,
  hoverLift,
  modalContent,
  modalOverlay,
  pageAnimate,
  pageExit,
  pageTransition,
  snappy,
  smooth,
  staggerContainer,
  staggerItem,
  tapScale,
} from "./motion.js";

describe("Motion language", () => {
  it("keeps every shared spring damped and inside the Apple-style range", () => {
    for (const transition of [snappy, gentle, bouncy, smooth]) {
      expect(transition.type).toBe("spring");
      expect(transition.damping).toBeGreaterThanOrEqual(25);
      expect(transition.damping).toBeLessThanOrEqual(40);
    }
  });

  it("exposes the complete interaction and page variant set", () => {
    expect(Object.keys(hoverLift)).toEqual(["rest", "hover", "pressed"]);
    expect(Object.keys(tapScale)).toEqual(["rest", "pressed"]);
    expect(Object.keys(staggerContainer)).toEqual(["hidden", "visible"]);
    expect(Object.keys(staggerItem)).toEqual(["hidden", "visible"]);
    expect(Object.keys(modalOverlay)).toEqual(["hidden", "visible", "exit"]);
    expect(Object.keys(modalContent)).toEqual(["hidden", "visible", "exit"]);
    expect(Object.keys(contentSwitch)).toEqual(["hidden", "visible", "exit"]);
  });

  it("uses spring for page entry and short exits for route replacement", () => {
    expect((pageAnimate.transition as { type?: string }).type).toBe("spring");
    expect((pageExit.transition as { duration?: number }).duration).toBeLessThan(0.2);
    expect(pageTransition.animate).toBeDefined();
    expect(pageTransition.exit).toBeDefined();
  });
});
