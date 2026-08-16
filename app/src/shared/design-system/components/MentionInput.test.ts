/**
 * [INPUT]: 依赖 Bun test 与 MentionInput 的纯文本分段函数
 * [OUTPUT]: 覆盖普通正文、中文 @笔记、重名优先级与特殊字符标题的内联高亮边界
 * [POS]: MentionInput 的纯逻辑回归测试；DOM 光标与 contenteditable 行为由浏览器验收覆盖
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, test } from "bun:test";

import { splitMentionInputValue } from "./MentionInput";

describe("splitMentionInputValue", () => {
  test("keeps normal copy separate from selected note mentions", () => {
    expect(splitMentionInputValue("对照 @产品规划 生成行动项", [
      { id: "memo-1", label: "产品规划" },
    ])).toEqual([
      { kind: "text", text: "对照 " },
      { kind: "mention", text: "@产品规划", tokenId: "memo-1" },
      { kind: "text", text: " 生成行动项" },
    ]);
  });

  test("matches longer titles first and escapes punctuation", () => {
    expect(splitMentionInputValue("@Roadmap(v2) @Roadmap ", [
      { id: "memo-1", label: "Roadmap" },
      { id: "memo-2", label: "Roadmap(v2)" },
    ])).toEqual([
      { kind: "mention", text: "@Roadmap(v2)", tokenId: "memo-2" },
      { kind: "text", text: " " },
      { kind: "mention", text: "@Roadmap", tokenId: "memo-1" },
      { kind: "text", text: " " },
    ]);
  });
});
