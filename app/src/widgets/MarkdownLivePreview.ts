/**
 * [INPUT]: 依赖 CodeMirror 6 syntaxTree/ViewPlugin/Decoration/WidgetType/atomicRanges/visibleRanges 与 Lezer Markdown GFM 语法树
 * [OUTPUT]: 对外提供 markdownLivePreviewExtension，为可见 block 构建无损显示装饰，并让活动标题保留弱化源码标记
 * [POS]: app/src/widgets 的 Obsidian 风格 Live Preview 引擎；活动块和不安全语法回退源码，非活动标题隐藏定界符，所有隐藏/替换范围保持原文不变并作为原子光标区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { syntaxTree } from "@codemirror/language";
import {
  RangeSet,
  StateEffect,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode, Tree } from "@lezer/common";

const refreshLivePreview = StateEffect.define<null>();

const supportedBlocks = new Set([
  "ATXHeading1",
  "ATXHeading2",
  "ATXHeading3",
  "ATXHeading4",
  "ATXHeading5",
  "ATXHeading6",
  "Blockquote",
  "BulletList",
  "FencedCode",
  "HorizontalRule",
  "OrderedList",
  "Paragraph",
  "SetextHeading1",
  "SetextHeading2",
  "Table",
]);

const unsafeSyntax = new Set([
  "Autolink",
  "Entity",
  "Escape",
  "HTMLBlock",
  "HTMLTag",
  "Image",
  "InlineHTML",
  "LinkReference",
  "LinkReferenceDefinition",
]);

type PreviewSets = {
  atomicRanges: DecorationSet;
  decorations: DecorationSet;
};

type TableModel = {
  headers: string[];
  rows: string[][];
};

class MarkerWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly className: string,
    readonly ariaLabel?: string,
  ) {
    super();
  }

  override eq(other: MarkerWidget) {
    return this.text === other.text &&
      this.className === other.className &&
      this.ariaLabel === other.ariaLabel;
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = this.className;
    marker.textContent = this.text;
    marker.setAttribute("aria-hidden", this.ariaLabel ? "false" : "true");

    if (this.ariaLabel) {
      marker.setAttribute("aria-label", this.ariaLabel);
      marker.setAttribute("role", "img");
    }

    return marker;
  }
}

class HorizontalRuleWidget extends WidgetType {
  toDOM() {
    const rule = document.createElement("span");
    rule.className = "cm-live-horizontal-rule";
    rule.setAttribute("aria-hidden", "true");
    return rule;
  }
}

class TableWidget extends WidgetType {
  private readonly signature: string;

  constructor(readonly model: TableModel) {
    super();
    this.signature = JSON.stringify(model);
  }

  override eq(other: TableWidget) {
    return this.signature === other.signature;
  }

  toDOM() {
    const table = document.createElement("span");
    table.className = "cm-live-table";
    table.setAttribute("role", "table");

    const appendRow = (cells: string[], header: boolean) => {
      const row = document.createElement("span");
      row.className = "cm-live-table-row";
      row.setAttribute("role", "row");

      for (const cellText of cells) {
        const cell = document.createElement("span");
        cell.className = header
          ? "cm-live-table-cell cm-live-table-header-cell"
          : "cm-live-table-cell";
        cell.setAttribute("role", header ? "columnheader" : "cell");
        cell.textContent = cellText;
        row.append(cell);
      }

      table.append(row);
    };

    appendRow(this.model.headers, true);
    for (const row of this.model.rows) {
      appendRow(row, false);
    }

    return table;
  }
}

function isActiveBlock(state: EditorState, block: SyntaxNode) {
  return state.selection.ranges.some((range) =>
    range.empty
      ? range.head >= block.from && range.head <= block.to
      : range.from < block.to && range.to > block.from);
}

function visibleBlocks(view: EditorView, tree: Tree) {
  const blocks = new Map<string, SyntaxNode>();

  for (const visibleRange of view.visibleRanges) {
    let block = tree.topNode.childAfter(visibleRange.from);

    while (block !== null && block.from <= visibleRange.to) {
      if (
        block.to >= visibleRange.from &&
        supportedBlocks.has(block.name)
      ) {
        blocks.set(`${block.name}:${block.from}:${block.to}`, block);
      }
      block = block.nextSibling;
    }
  }

  return [...blocks.values()];
}

function blockHasUnsafeVisibleSyntax(
  view: EditorView,
  tree: Tree,
  block: SyntaxNode,
) {
  let unsafe = block.type.isError;

  for (const visibleRange of view.visibleRanges) {
    const from = Math.max(block.from, visibleRange.from);
    const to = Math.min(block.to, visibleRange.to);

    if (from > to) {
      continue;
    }

    tree.iterate({
      enter(node) {
        if (node.type.isError || unsafeSyntax.has(node.name)) {
          unsafe = true;
          return false;
        }
        return !unsafe;
      },
      from,
      to,
    });

    if (unsafe) {
      return true;
    }
  }

  return false;
}

function directCells(row: SyntaxNode, state: EditorState) {
  const cells: string[] = [];

  for (let child = row.firstChild; child !== null; child = child.nextSibling) {
    if (child.name === "TableCell") {
      cells.push(state.doc.sliceString(child.from, child.to).trim());
    }
  }

  return cells;
}

function tableModel(table: SyntaxNode, state: EditorState): TableModel | null {
  let headers: string[] = [];
  const rows: string[][] = [];

  for (let child = table.firstChild; child !== null; child = child.nextSibling) {
    if (child.name === "TableHeader") {
      headers = directCells(child, state);
    } else if (child.name === "TableRow") {
      rows.push(directCells(child, state));
    }
  }

  if (headers.length === 0 || rows.some((row) => row.length !== headers.length)) {
    return null;
  }

  return { headers, rows };
}

function headingLevel(name: string) {
  if (name === "SetextHeading1") {
    return 1;
  }
  if (name === "SetextHeading2") {
    return 2;
  }
  return Number(name.at(-1));
}

function isHeadingBlock(block: SyntaxNode) {
  return block.name.startsWith("ATXHeading") ||
    block.name.startsWith("SetextHeading");
}

function buildPreview(view: EditorView): PreviewSets {
  const tree = syntaxTree(view.state);
  const decorationRanges: ReturnType<Decoration["range"]>[] = [];
  const atomicRangeValues: ReturnType<Decoration["range"]>[] = [];
  const decorationKeys = new Set<string>();
  const atomicKeys = new Set<string>();

  const addDecoration = (
    from: number,
    to: number,
    decoration: Decoration,
    key: string,
  ) => {
    const rangeKey = `${key}:${from}:${to}`;
    if (!decorationKeys.has(rangeKey)) {
      decorationKeys.add(rangeKey);
      decorationRanges.push(decoration.range(from, to));
    }
  };

  const addReplacement = (
    from: number,
    to: number,
    decoration: Decoration,
    key: string,
  ) => {
    if (from >= to) {
      return;
    }
    addDecoration(from, to, decoration, key);
    const rangeKey = `${key}:${from}:${to}`;
    if (!atomicKeys.has(rangeKey)) {
      atomicKeys.add(rangeKey);
      atomicRangeValues.push(decoration.range(from, to));
    }
  };

  const addLineClass = (position: number, className: string) => {
    const line = view.state.doc.lineAt(position);
    addDecoration(
      line.from,
      line.from,
      Decoration.line({ class: className }),
      `line:${className}`,
    );
  };

  const lineIsVisible = (line: { from: number; to: number }) =>
    view.visibleRanges.some((visibleRange) =>
      line.from <= visibleRange.to && line.to >= visibleRange.from);

  const addVisibleLineClasses = (
    block: SyntaxNode,
    className: string,
    excludeFirstAndLast = false,
  ) => {
    const firstLine = view.state.doc.lineAt(block.from).number;
    const lastLine = view.state.doc.lineAt(block.to).number;

    for (const visibleRange of view.visibleRanges) {
      const from = Math.max(block.from, visibleRange.from);
      const to = Math.min(block.to, visibleRange.to);
      if (from > to) {
        continue;
      }

      let line = view.state.doc.lineAt(from);
      while (line.from <= to) {
        if (
          !excludeFirstAndLast ||
          (line.number !== firstLine && line.number !== lastLine)
        ) {
          addLineClass(line.from, className);
        }
        if (line.number >= view.state.doc.lines) {
          break;
        }
        line = view.state.doc.line(line.number + 1);
      }
    }
  };

  const addHeadingDecorations = (block: SyntaxNode, active: boolean) => {
    addLineClass(
      block.from,
      `cm-live-heading cm-live-heading-${headingLevel(block.name)}${
        active ? " cm-live-heading-active" : ""
      }`,
    );

    if (!active) {
      return;
    }

    for (const visibleRange of view.visibleRanges) {
      const from = Math.max(block.from, visibleRange.from);
      const to = Math.min(block.to, visibleRange.to);
      if (from > to) {
        continue;
      }

      tree.iterate({
        enter(nodeRef) {
          const node = nodeRef.node;
          if (node.from < block.from || node.to > block.to) {
            return true;
          }
          if (node.name === "HeaderMark") {
            addDecoration(
              node.from,
              node.to,
              Decoration.mark({ class: "cm-live-heading-marker" }),
              `active-heading-marker:${node.from}:${node.to}`,
            );
          }
          return true;
        },
        from,
        to,
      });
    }
  };

  const headerMarkerEnd = (node: SyntaxNode) => {
    const line = view.state.doc.lineAt(node.to);
    let to = node.to;

    while (to < line.to) {
      const character = view.state.doc.sliceString(to, to + 1);
      if (character !== " " && character !== "\t") {
        break;
      }
      to += 1;
    }

    return to;
  };

  for (const block of visibleBlocks(view, tree)) {
    if (blockHasUnsafeVisibleSyntax(view, tree, block)) {
      continue;
    }

    if (isActiveBlock(view.state, block)) {
      if (isHeadingBlock(block)) {
        addHeadingDecorations(block, true);
      }
      continue;
    }

    if (block.name === "HorizontalRule") {
      addReplacement(
        block.from,
        block.to,
        Decoration.replace({ widget: new HorizontalRuleWidget() }),
        "horizontal-rule",
      );
      continue;
    }

    if (block.name === "Table") {
      if (
        block.to - block.from > 20_000 ||
        block.from < view.viewport.from ||
        block.to > view.viewport.to
      ) {
        continue;
      }

      const model = tableModel(block, view.state);
      if (model === null) {
        continue;
      }

      let line = view.state.doc.lineAt(block.from);
      const lastLine = view.state.doc.lineAt(block.to).number;
      while (line.number <= lastLine) {
        addReplacement(
          line.from,
          line.to,
          Decoration.replace({
            widget: line.number === view.state.doc.lineAt(block.from).number
              ? new TableWidget(model)
              : undefined,
          }),
          `table-line:${line.number}`,
        );
        addLineClass(
          line.from,
          line.number === view.state.doc.lineAt(block.from).number
            ? "cm-live-table-widget-line"
            : "cm-live-syntax-only-line",
        );
        if (line.number === lastLine) {
          break;
        }
        line = view.state.doc.line(line.number + 1);
      }
      continue;
    }

    if (block.name === "FencedCode") {
      const firstLine = view.state.doc.lineAt(block.from);
      const lastLine = view.state.doc.lineAt(block.to);
      if (lineIsVisible(firstLine)) {
        addReplacement(
          firstLine.from,
          firstLine.to,
          Decoration.replace({}),
          "fence-open",
        );
        addLineClass(firstLine.from, "cm-live-syntax-only-line");
      }

      if (
        lastLine.number !== firstLine.number &&
        lineIsVisible(lastLine)
      ) {
        addReplacement(
          lastLine.from,
          lastLine.to,
          Decoration.replace({}),
          "fence-close",
        );
        addLineClass(lastLine.from, "cm-live-syntax-only-line");
      }
      addVisibleLineClasses(block, "cm-live-code-line", true);
      continue;
    }

    if (isHeadingBlock(block)) {
      addHeadingDecorations(block, false);
    } else if (block.name === "Blockquote") {
      addVisibleLineClasses(block, "cm-live-blockquote");
    } else if (block.name === "BulletList" || block.name === "OrderedList") {
      addVisibleLineClasses(block, "cm-live-list-line");
    }

    for (const visibleRange of view.visibleRanges) {
      const from = Math.max(block.from, visibleRange.from);
      const to = Math.min(block.to, visibleRange.to);
      if (from > to) {
        continue;
      }

      tree.iterate({
        enter(nodeRef) {
          const node = nodeRef.node;
          const nodeKey = `${node.name}:${node.from}:${node.to}`;

          if (node.from < block.from || node.to > block.to) {
            return true;
          }

          if (node.name === "StrongEmphasis") {
            addDecoration(
              node.from,
              node.to,
              Decoration.mark({ class: "cm-live-strong" }),
              `strong:${nodeKey}`,
            );
          } else if (node.name === "Emphasis") {
            addDecoration(
              node.from,
              node.to,
              Decoration.mark({ class: "cm-live-emphasis" }),
              `emphasis:${nodeKey}`,
            );
          } else if (node.name === "Strikethrough") {
            addDecoration(
              node.from,
              node.to,
              Decoration.mark({ class: "cm-live-strikethrough" }),
              `strike:${nodeKey}`,
            );
          } else if (node.name === "InlineCode") {
            addDecoration(
              node.from,
              node.to,
              Decoration.mark({ class: "cm-live-inline-code" }),
              `inline-code:${nodeKey}`,
            );
          } else if (node.name === "Link") {
            addDecoration(
              node.from,
              node.to,
              Decoration.mark({ class: "cm-live-link" }),
              `link:${nodeKey}`,
            );
          }

          if (
            node.name === "EmphasisMark" ||
            node.name === "StrikethroughMark" ||
            node.name === "CodeMark" ||
            node.name === "HeaderMark" ||
            node.name === "LinkMark" ||
            node.name === "QuoteMark" ||
            node.name === "URL"
          ) {
            if (node.name === "HeaderMark" && block.name.startsWith("SetextHeading")) {
              const markerLine = view.state.doc.lineAt(node.from);
              addReplacement(
                markerLine.from,
                markerLine.to,
                Decoration.replace({}),
                `setext-marker:${nodeKey}`,
              );
              addLineClass(markerLine.from, "cm-live-syntax-only-line");
            } else {
              addReplacement(
                node.from,
                node.name === "HeaderMark" && block.name.startsWith("ATXHeading")
                  ? headerMarkerEnd(node)
                  : node.to,
                Decoration.replace({}),
                `syntax:${nodeKey}`,
              );
            }
          } else if (node.name === "ListMark") {
            const listItem = node.parent?.name === "ListItem" ? node.parent : null;
            const taskMarker = listItem?.getChild("Task")?.getChild("TaskMarker") ?? null;
            addReplacement(
              node.from,
              node.to,
              taskMarker === null
                ? Decoration.replace({
                    widget: new MarkerWidget(
                      view.state.doc.sliceString(node.from, node.to).match(/^\d/) 
                        ? view.state.doc.sliceString(node.from, node.to)
                        : "•",
                      "cm-live-list-marker",
                    ),
                  })
                : Decoration.replace({}),
              `list:${nodeKey}`,
            );
          } else if (node.name === "TaskMarker") {
            const checked = /[xX]/.test(
              view.state.doc.sliceString(node.from, node.to),
            );
            addReplacement(
              node.from,
              node.to,
              Decoration.replace({
                widget: new MarkerWidget(
                  checked ? "✓" : "",
                  checked
                    ? "cm-live-task-marker cm-live-task-marker-checked"
                    : "cm-live-task-marker",
                  checked ? "已完成" : "未完成",
                ),
              }),
              `task:${nodeKey}`,
            );
          }

          return true;
        },
        from,
        to,
      });
    }
  }

  return {
    atomicRanges: atomicRangeValues.length === 0
      ? Decoration.none
      : RangeSet.of(atomicRangeValues, true),
    decorations: decorationRanges.length === 0
      ? Decoration.none
      : Decoration.set(decorationRanges, true),
  };
}

class LivePreviewPluginValue {
  atomicRanges: DecorationSet;
  decorations: DecorationSet;
  private refreshTimer: number | null = null;

  constructor(view: EditorView) {
    const preview = buildPreview(view);
    this.atomicRanges = preview.atomicRanges;
    this.decorations = preview.decorations;
  }

  update(update: ViewUpdate) {
    if (update.view.composing) {
      this.atomicRanges = this.atomicRanges.map(update.changes);
      this.decorations = this.decorations.map(update.changes);
      return;
    }

    const forcedRefresh = update.transactions.some((transaction) =>
      transaction.effects.some((effect) => effect.is(refreshLivePreview)));

    if (
      forcedRefresh ||
      update.docChanged ||
      update.focusChanged ||
      update.selectionSet ||
      update.viewportChanged
    ) {
      const preview = buildPreview(update.view);
      this.atomicRanges = preview.atomicRanges;
      this.decorations = preview.decorations;
    }
  }

  scheduleCompositionRefresh(view: EditorView) {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      view.dispatch({ effects: refreshLivePreview.of(null) });
    }, 0);
  }

  destroy() {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
  }
}

const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPluginValue, {
  decorations: (plugin) => plugin.decorations,
  eventObservers: {
    compositionend(_event, view) {
      this.scheduleCompositionRefresh(view);
    },
  },
  provide: (plugin) =>
    EditorView.atomicRanges.of((view) =>
      view.plugin(plugin)?.atomicRanges ?? Decoration.none),
});

export const markdownLivePreviewExtension: Extension = livePreviewPlugin;
