/**
 * [INPUT]: 依赖 Bun test 与平台判断纯策略
 * [OUTPUT]: 验证支持架构、移动设备和未知 CPU 不误下载
 * [POS]: 官网下载兼容边界的确定性验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { platformFromHints } from "./download";
test("平台和 CPU 提示必须匹配支持的安装包", () => {
  expect(platformFromHints({ platform:"macOS", architecture:"arm", bitness:"64" }, "")).toBe("macos");
  expect(platformFromHints({ platform:"Windows", architecture:"x86", bitness:"64" }, "")).toBe("windows");
  expect(platformFromHints({ platform:"macOS", architecture:"x86", bitness:"64" }, "")).toBeNull();
  expect(platformFromHints({ platform:"Windows", architecture:"arm", bitness:"64" }, "")).toBeNull();
  expect(platformFromHints({}, "Mozilla Macintosh Intel Mac OS X")).toBeNull();
  expect(platformFromHints({}, "Windows NT 10.0; Win64; x64")).toBe("windows");
  expect(platformFromHints({}, "iPhone Mac OS X")).toBeNull();
  expect(platformFromHints({ mobile:true, platform:"Windows" }, "Win64")).toBeNull();
});
