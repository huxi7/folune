/**
 * [INPUT]: 依赖 React 原生 contenteditable、受控文本值、已确认 mention token 与浏览器 Selection/Range
 * [OUTPUT]: 对外提供支持多行纯文本、内联不可编辑 @token、原生粘贴与 ref 的 MentionInput 组件及分段纯函数
 * [POS]: app/src/shared/design-system/components 的 AI Composer 输入基础件；普通正文使用 foreground，已选 @笔记使用主题 primary，不依赖第三方输入框架
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  type ClipboardEvent,
  type HTMLAttributes,
  type Ref,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

export type MentionInputToken = {
  id: string;
  label: string;
};

export type MentionInputSegment = {
  kind: "mention" | "text";
  text: string;
  tokenId?: string;
};

export type MentionInputProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "onInput"> & {
  mentions: readonly MentionInputToken[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  ref?: Ref<HTMLDivElement>;
  value: string;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const splitMentionInputValue = (
  value: string,
  mentions: readonly MentionInputToken[],
): MentionInputSegment[] => {
  const byLabel = new Map(mentions.map((mention) => [mention.label, mention]));
  const labels = [...byLabel.keys()].filter(Boolean).sort((left, right) => right.length - left.length);
  if (labels.length === 0) return value.length === 0 ? [] : [{ kind: "text", text: value }];

  const pattern = new RegExp(`@(${labels.map(escapeRegExp).join("|")})(?=\\s|$)`, "gu");
  const segments: MentionInputSegment[] = [];
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ kind: "text", text: value.slice(cursor, index) });
    const label = match[1] ?? "";
    segments.push({
      kind: "mention",
      text: match[0],
      tokenId: byLabel.get(label)?.id,
    });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) segments.push({ kind: "text", text: value.slice(cursor) });
  return segments;
};

const placeCaretAtEnd = (element: HTMLDivElement) => {
  const selection = window.getSelection();
  if (selection === null) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

/**
 * 以「纯文本偏移」记录光标位置。
 *
 * DOM 会被 replaceChildren 整体重建, 旧的 Range 随节点一起失效, 所以不能
 * 保存 Range 本身 —— 只有跨重建仍然稳定的量 (光标前的字符数) 可用。
 */
const readCaretOffset = (element: HTMLDivElement): number | null => {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return null;

  const probe = document.createRange();
  probe.selectNodeContents(element);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length;
};

const placeCaretAtOffset = (element: HTMLDivElement, offset: number) => {
  const selection = window.getSelection();
  if (selection === null) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();

  while (node !== null) {
    const length = node.textContent?.length ?? 0;

    if (consumed + length >= offset) {
      const range = document.createRange();
      range.setStart(node, offset - consumed);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    consumed += length;
    node = walker.nextNode();
  }

  placeCaretAtEnd(element);
};

const renderValue = (
  element: HTMLDivElement,
  value: string,
  mentions: readonly MentionInputToken[],
) => {
  const fragment = document.createDocumentFragment();
  for (const segment of splitMentionInputValue(value, mentions)) {
    if (segment.kind === "text") {
      fragment.append(document.createTextNode(segment.text));
      continue;
    }
    const mention = document.createElement("span");
    mention.className = "ds-mention-input-token";
    mention.contentEditable = "false";
    mention.dataset.mentionId = segment.tokenId;
    mention.textContent = segment.text;
    fragment.append(mention);
  }
  element.replaceChildren(fragment);
  element.dataset.empty = value.length === 0 ? "true" : "false";
};

const insertPlainText = (text: string) => {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

export function MentionInput({
  className = "",
  mentions,
  onPaste,
  onValueChange,
  placeholder = "",
  ref,
  value,
  ...props
}: MentionInputProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const lastDomValue = useRef("");
  const mentionSignature = useMemo(
    () => mentions.map((mention) => `${mention.id}:${mention.label}`).join("|"),
    [mentions],
  );
  const lastMentionSignature = useRef("");
  useImperativeHandle(ref, () => elementRef.current as HTMLDivElement, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element === null) return;
    if (lastDomValue.current === value && lastMentionSignature.current === mentionSignature) return;
    const restoreCaret = document.activeElement === element;
    // 删除正文中间的 @token 时 text 未变但 mentions 变了, 于是走到这里重建
    // DOM。无条件 placeCaretAtEnd 会把光标从编辑位置弹到末尾 —— 必须按
    // 纯文本偏移原位恢复。
    const caretOffset = restoreCaret ? readCaretOffset(element) : null;
    renderValue(element, value, mentions);
    lastDomValue.current = value;
    lastMentionSignature.current = mentionSignature;

    if (restoreCaret) {
      if (caretOffset === null) {
        placeCaretAtEnd(element);
      } else {
        placeCaretAtOffset(element, caretOffset);
      }
    }
  }, [mentionSignature, mentions, value]);

  const emitCurrentValue = () => {
    const element = elementRef.current;
    if (element === null) return;
    const nextValue = element.innerText.replaceAll("\u00a0", " ");
    lastDomValue.current = nextValue;
    element.dataset.empty = nextValue.length === 0 ? "true" : "false";
    onValueChange(nextValue);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    onPaste?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    insertPlainText(event.clipboardData.getData("text/plain"));
    emitCurrentValue();
  };

  return (
    <div
      aria-multiline="true"
      className={["ds-mention-input", className].join(" ")}
      contentEditable
      data-empty={value.length === 0 ? "true" : "false"}
      data-placeholder={placeholder}
      onInput={emitCurrentValue}
      onPaste={handlePaste}
      ref={elementRef}
      role="textbox"
      suppressContentEditableWarning
      {...props}
    />
  );
}
