/**
 * [INPUT]: 依赖 React 节点克隆、react-markdown、remark-gfm/remark-breaks/rehype-sanitize、Unicode 分词与可选词级流状态
 * [OUTPUT]: 对外提供安全 MarkdownReadingView；流式态只在最后可见块的末尾创建最多五个动画 span，历史正文保持原生文本节点
 * [POS]: app/src/widgets 的共享只读 Markdown 渲染边界；备忘录维持阅读语义，Agent 回复额外透传 design-system 词级流式表现
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import rehypeSanitize from "rehype-sanitize";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import type { StreamingTextRenderState } from "../shared/design-system/components";
import { splitStreamingTextUnits } from "../shared/design-system/components/streamingTextSegments";

type MarkdownReadingViewProps = {
  content: string;
  preserveSoftBreaks?: boolean;
  streamingText?: StreamingTextRenderState;
};

const standardRemarkPlugins = [remarkGfm];
const softBreakRemarkPlugins = [remarkGfm, remarkBreaks];

type WrappedNode = {
  hasText: boolean;
  node: ReactNode;
  resolvingWords: number;
};

function decorateTextNodes(
  node: ReactNode,
  state: StreamingTextRenderState,
  resolvingOffset = 0,
  allowResolving = true,
): WrappedNode {
  if (!allowResolving) {
    return {
      hasText: typeof node === "string" && node.length > 0,
      node,
      resolvingWords: 0,
    };
  }

  if (typeof node === "string") {
    const units = splitStreamingTextUnits(node);

    if (units.length === 0) {
      return {
        hasText: false,
        node,
        resolvingWords: 0,
      };
    }

    const resolvingWords = allowResolving
      ? Math.min(
          units.length,
          Math.max(0, state.resolvingWordStyles.length - resolvingOffset),
        )
      : 0;
    const resolvingStart = units.length - resolvingWords;
    const content = resolvingWords > 0
      ? [
          units.slice(0, resolvingStart).join(""),
          ...units.slice(resolvingStart).map((unit, index) => {
            const unitIndex = resolvingStart + index;

            return (
              <span
                className="ds-streaming-text-token"
                data-resolving="true"
                key={unitIndex}
                style={state.resolvingWordStyles[
                  resolvingOffset + units.length - unitIndex - 1
                ]}
              >
                {unit}
              </span>
            );
          }),
        ]
      : node;
    return {
      hasText: true,
      node: content,
      resolvingWords,
    };
  }

  if (Array.isArray(node)) {
    const next = [...node];
    let hasText = false;
    let resolvingWords = 0;

    for (let index = next.length - 1; index >= 0; index -= 1) {
      const result = decorateTextNodes(
        next[index],
        state,
        resolvingOffset + resolvingWords,
        resolvingWords < state.resolvingWordStyles.length,
      );
      next[index] = result.node;
      hasText ||= result.hasText;
      resolvingWords += result.resolvingWords;
    }

    return { hasText, node: next, resolvingWords };
  }

  if (isValidElement<{ children?: ReactNode; className?: string }>(node)) {
    if (node.props.className === "ds-streaming-text-token") {
      return {
        hasText: true,
        node,
        resolvingWords: 0,
      };
    }

    const result = decorateTextNodes(
      node.props.children,
      state,
      resolvingOffset,
      allowResolving,
    );
    if (!result.hasText) {
      return {
        hasText: false,
        node,
        resolvingWords: 0,
      };
    }

    return {
      hasText: result.hasText,
      node: cloneElement(
        node as ReactElement<{ children?: ReactNode }>,
        undefined,
        result.node,
      ),
      resolvingWords: result.resolvingWords,
    };
  }

  return {
    hasText: false,
    node,
    resolvingWords: 0,
  };
}

type PositionedNode = {
  position?: {
    end?: {
      offset?: number;
    };
  };
};

function isFinalVisibleNode(node: PositionedNode | undefined, finalOffset: number) {
  const endOffset = node?.position?.end?.offset;
  return typeof endOffset === "number" && endOffset === finalOffset;
}

type StreamingMarkdownContextValue = {
  finalOffset: number;
  state: StreamingTextRenderState;
};

const StreamingMarkdownContext = createContext<StreamingMarkdownContextValue | null>(null);

function useStreamingChildren(
  children: ReactNode,
  node: PositionedNode | undefined,
) {
  const context = useContext(StreamingMarkdownContext);

  if (!context) {
    return children;
  }

  if (context.state.resolvingWordStyles.length === 0) {
    return children;
  }

  if (!isFinalVisibleNode(node, context.finalOffset)) {
    return children;
  }

  return decorateTextNodes(
    children,
    context.state,
    0,
    true,
  ).node;
}

const streamingMarkdownComponents: Components = {
  code: function StreamingCode({ children, node, ...props }) {
    return <code {...props}>{useStreamingChildren(children, node)}</code>;
  },
  h1: function StreamingHeadingOne({ children, node, ...props }) {
    return <h1 {...props}>{useStreamingChildren(children, node)}</h1>;
  },
  h2: function StreamingHeadingTwo({ children, node, ...props }) {
    return <h2 {...props}>{useStreamingChildren(children, node)}</h2>;
  },
  h3: function StreamingHeadingThree({ children, node, ...props }) {
    return <h3 {...props}>{useStreamingChildren(children, node)}</h3>;
  },
  h4: function StreamingHeadingFour({ children, node, ...props }) {
    return <h4 {...props}>{useStreamingChildren(children, node)}</h4>;
  },
  h5: function StreamingHeadingFive({ children, node, ...props }) {
    return <h5 {...props}>{useStreamingChildren(children, node)}</h5>;
  },
  h6: function StreamingHeadingSix({ children, node, ...props }) {
    return <h6 {...props}>{useStreamingChildren(children, node)}</h6>;
  },
  li: function StreamingListItem({ children, node, ...props }) {
    return <li {...props}>{useStreamingChildren(children, node)}</li>;
  },
  p: function StreamingParagraph({ children, node, ...props }) {
    return <p {...props}>{useStreamingChildren(children, node)}</p>;
  },
  pre: function StreamingPreformatted({ children, node, ...props }) {
    return <pre {...props}>{useStreamingChildren(children, node)}</pre>;
  },
  td: function StreamingTableData({ children, node, ...props }) {
    return <td {...props}>{useStreamingChildren(children, node)}</td>;
  },
  th: function StreamingTableHeader({ children, node, ...props }) {
    return <th {...props}>{useStreamingChildren(children, node)}</th>;
  },
};

export function MarkdownReadingView({
  content,
  preserveSoftBreaks = false,
  streamingText,
}: MarkdownReadingViewProps) {
  const markdown = (
    <ReactMarkdown
      components={streamingMarkdownComponents}
      rehypePlugins={[rehypeSanitize]}
      remarkPlugins={preserveSoftBreaks
        ? softBreakRemarkPlugins
        : standardRemarkPlugins}
      skipHtml
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="markdown-reading-view">
      <StreamingMarkdownContext
        value={streamingText
          ? { finalOffset: content.trimEnd().length, state: streamingText }
          : null}
      >
        {markdown}
      </StreamingMarkdownContext>
    </div>
  );
}
