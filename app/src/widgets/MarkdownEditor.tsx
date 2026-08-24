/**
 * [INPUT]: 依赖 React 受控状态/ref、CodeMirror Markdown/State/View、GFM 语法树、Live Preview 扩展、ThemeProvider 主题、EditingMode 与干净 content_mdx
 * [OUTPUT]: 对外提供共享同一 EditorState 的 live/source MarkdownEditor/MarkdownEditorHandle（focus 与只读的 readSelection），以及 inflateMarkdownBlankLines、deflateEditorBlankLineMarkers 纯适配函数
 * [POS]: app/src/widgets 的 Markdown 显示协议适配边界；Compartment 只切换显示扩展以保留选区/撤销历史，零宽空段落标记绝不离开编辑器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { markdownLivePreviewExtension } from "./MarkdownLivePreview";
import type { EditingMode } from "./markdownViewTypes";

const EDITOR_BLANK_LINE_MARKER = "\u200B";

const plainTextPaste = EditorView.domEventHandlers({
  paste(event, view) {
    if (event.clipboardData === null) {
      return false;
    }

    event.preventDefault();
    view.dispatch(
      view.state.replaceSelection(
        event.clipboardData.getData("text/plain"),
      ),
    );
    return true;
  },
});

const markdownExtensions: Extension[] = [
  markdown({ extensions: GFM }),
  EditorState.allowMultipleSelections.of(true),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({
    "aria-label": "Markdown 正文",
    spellcheck: "true",
  }),
  plainTextPaste,
];

const editingModeExtension = (mode: EditingMode): Extension => [
  EditorView.editorAttributes.of({ "data-editing-mode": mode }),
  mode === "live" ? markdownLivePreviewExtension : [],
];

const markdownBasicSetup = {
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  highlightSpecialChars: false,
  lineNumbers: false,
};

export const inflateMarkdownBlankLines = (
  databaseValue: string,
): string => {
  if (databaseValue.length === 0) {
    return databaseValue;
  }

  return databaseValue
    .split(/(\r\n|\n|\r)/)
    .map((segment, index) =>
      index % 2 === 0 && /^[\t ]*$/.test(segment)
        ? `${segment}${EDITOR_BLANK_LINE_MARKER}`
        : segment)
    .join("");
};

export const deflateEditorBlankLineMarkers = (
  editorValue: string,
): string => editorValue.split(EDITOR_BLANK_LINE_MARKER).join("");

export type MarkdownEditorHandle = {
  focus(): void;
  /** 读取当前选中的正文文字；只读不写，不触碰选区、撤销历史或自动保存 */
  readSelection(): string | null;
};

type MarkdownEditorProps = {
  editingMode: EditingMode;
  onBlur: () => void;
  onChange: (databaseValue: string) => void;
  placeholder?: string;
  theme: "dark" | "light";
  value: string;
};

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(
  { editingMode, onBlur, onChange, placeholder, theme, value },
  forwardedRef,
) {
  const codeMirrorRef = useRef<ReactCodeMirrorRef>(null);
  const [editingModeCompartment] = useState(() => new Compartment());
  const editingModeRef = useRef(editingMode);
  const [editorExtensions] = useState<Extension[]>(() => [
    ...markdownExtensions,
    editingModeCompartment.of(editingModeExtension(editingMode)),
  ]);
  const [editorValue, setEditorValue] = useState(() =>
    inflateMarkdownBlankLines(value));
  const editorValueRef = useRef(editorValue);

  useImperativeHandle(forwardedRef, () => ({
    focus() {
      codeMirrorRef.current?.view?.focus();
    },
    readSelection() {
      const view = codeMirrorRef.current?.view;
      if (view === undefined) {
        return null;
      }
      const { from, to } = view.state.selection.main;
      if (from === to) {
        return null;
      }
      // 零宽空段落标记绝不离开编辑器，选中文字同样要先剥掉
      const text = deflateEditorBlankLineMarkers(view.state.sliceDoc(from, to)).trim();
      return text.length === 0 ? null : text;
    },
  }), []);

  useEffect(() => {
    if (editingModeRef.current === editingMode) {
      return;
    }

    const view = codeMirrorRef.current?.view;
    if (view === undefined) {
      return;
    }

    view.dispatch({
      effects: editingModeCompartment.reconfigure(
        editingModeExtension(editingMode),
      ),
    });
    editingModeRef.current = editingMode;
  }, [editingMode, editingModeCompartment]);

  useEffect(() => {
    if (deflateEditorBlankLineMarkers(editorValueRef.current) === value) {
      return;
    }

    const nextEditorValue = inflateMarkdownBlankLines(value);
    editorValueRef.current = nextEditorValue;
    setEditorValue(nextEditorValue);
  }, [value]);

  return (
    <CodeMirror
      basicSetup={markdownBasicSetup}
      className="supernote-md-editor"
      extensions={editorExtensions}
      onBlur={onBlur}
      onChange={(nextEditorValue) => {
        editorValueRef.current = nextEditorValue;
        setEditorValue(nextEditorValue);
        onChange(deflateEditorBlankLineMarkers(nextEditorValue));
      }}
      placeholder={placeholder}
      ref={codeMirrorRef}
      theme={theme}
      value={editorValue}
    />
  );
});
