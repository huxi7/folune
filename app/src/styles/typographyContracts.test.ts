/**
 * [INPUT]: 读取 APP 排版入口与生产样式，设计规范约束组件只消费文字角色
 * [OUTPUT]: 阻止局部数字字重回流、主正文/聊天失去角色接线，并确认认证与营销标准按钮复用 APP 排版而营销正文保持独立
 * [POS]: styles 的排版消费门禁；按用户/助手正文选择器验证角色，不把其他组件复用同一角色算作违规
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
const typography = read("app-typography.css");
const consumers = ["workspace", "button", "sidebar-button", "ai-message", "design-system", "user-menu", "toast", "codemirror", "note-paper", "design-system-workspace", "motion", "auth"];

describe("APP 排版角色消费", () => {
  test("APP、认证和营销标准按钮共读角色，营销正文保持独立", () => {
    expect(typography).toContain('html:root[data-visual-context="app"]');
    expect(typography).toContain(".auth-page,");
    expect(typography).toContain(".auth-callback-page,");
    expect(typography).toContain(".landing-blueprint :is(.ds-button, .glow-button) {");
    expect(typography).not.toContain(".landing-blueprint {");
    expect(read("../index.css")).toContain('@import "./styles/app-typography.css";');
    const declarations = [...typography.matchAll(/--font-weight-\w+:\s*(\d+);/g)].map(match => Number(match[1]));
    expect(declarations).toEqual([400, 500, 600, 700]);
    expect(typography).toContain('--weight-conversation: var(--font-weight-medium)');
    expect(typography).toContain('--weight-editor: var(--weight-body)');
  });

  test("生产消费层不能绕过角色写数字字重", () => {
    for (const name of consumers) {
      expect(read(`${name}.css`)).not.toMatch(/font-weight:\s*\d/);
    }
    for (const component of ["Select", "UserButton", "Dialog"]) {
      expect(read(`../shared/design-system/components/${component}.tsx`)).not.toMatch(/\bfont-(normal|medium|semibold|bold)\b/);
    }
  });

  test("消息双方显式消费相同字重与字号，编辑正文独立消费阅读角色", () => {
    const messages = read("ai-message.css");
    for (const selector of [".ds-user-message-bubble", ".ds-streaming-text"]) {
      const declarations = [...messages.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .find(match => match[1]?.trim() === selector)?.[2] ?? "";
      expect(declarations, selector).toContain("font-weight: var(--weight-conversation, 400)");
      expect(declarations, selector).toContain("font-size: var(--type-conversation, 0.75rem)");
    }
    expect(read("codemirror.css")).toContain('font-weight: var(--weight-editor, 400)');
    expect(read("button.css")).toContain('font-weight: var(--weight-action, 650)');
  });
});
