/**
 * [INPUT]: 依赖 React 节点克隆、react-markdown、remark-gfm/remark-breaks/rehype-sanitize、Unicode 分词与可选词级流状态
 * [OUTPUT]: 对外提供安全 MarkdownReadingView，并以模块级稳定渲染器与 Context 在 SSE 更新间保留词节点、只在正文末尾放置流式光标
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
  cursorPlaced: boolean;
  hasText: boolean;
  node: ReactNode;
};

function decorateTextNodes(
  node: ReactNode,
  state: StreamingTextRenderState,
  allowCursor: boolean,
): WrappedNode {
  if (typeof node === "string") {
    const units = splitStreamingTextUnits(node);

    if (units.length === 0) {
      return { cursorPlaced: false, hasText: false, node };
    }

    const content = state.animateWords
      ? units.map((unit, index) => (
          <span className="ds-streaming-text-token" key={index}>
            {unit}
          </span>
        ))
      : node;
    const showCursor = allowCursor && state.showCursor;

    return {
      cursorPlaced: showCursor,
      hasText: true,
      node: showCursor
        ? [
            content,
            <span
              aria-hidden="true"
              className="ds-streaming-text-cursor"
              key="streaming-cursor"
            />,
          ]
        : content,
    };
  }

  if (Array.isArray(node)) {
    const next = [...node];
    let cursorPlaced = false;
    let hasText = false;

    for (let index = next.length - 1; index >= 0; index -= 1) {
      const result = decorateTextNodes(
        next[index],
        state,
        allowCursor && !cursorPlaced,
      );
      next[index] = result.node;
      cursorPlaced ||= result.cursorPlaced;
      hasText ||= result.hasText;
    }

    return { cursorPlaced, hasText, node: next };
  }

  if (isValidElement<{ children?: ReactNode; className?: string }>(node)) {
    if (node.props.className === "ds-streaming-text-token") {
      return { cursorPlaced: false, hasText: true, node };
    }

    if (node.props.className === "ds-streaming-text-cursor") {
      return { cursorPlaced: true, hasText: false, node };
    }

    const result = decorateTextNodes(node.props.children, state, allowCursor);
    if (!result.hasText && !result.cursorPlaced) {
      return { cursorPlaced: false, hasText: false, node };
    }

    return {
      cursorPlaced: result.cursorPlaced,
      hasText: result.hasText,
      node: cloneElement(
        node as ReactElement<{ children?: ReactNode }>,
        undefined,
        result.node,
      ),
    };
  }

  return { cursorPlaced: false, hasText: false, node };
}

type PositionedNode = {
  position?: {
    end?: {
      offset?: number;
    };
  };
};

function isFinalVisibleNode(node: PositionedNode | undefined, content: string) {
  const endOffset = node?.position?.end?.offset;
  return typeof endOffset === "number"
    && content.slice(endOffset).trim().length === 0;
}

function decoratedChildren(
  children: ReactNode,
  state: StreamingTextRenderState,
  showCursor: boolean,
) {
  return decorateTextNodes(children, state, showCursor).node;
}

type StreamingMarkdownContextValue = {
  content: string;
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

  return decoratedChildren(
    children,
    context.state,
    context.state.showCursor && isFinalVisibleNode(node, context.content),
  );
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
  const streamingActive = Boolean(
    streamingText
    && (streamingText.animateWords || streamingText.showCursor),
  );

  const markdown = (
    <ReactMarkdown
      components={streamingActive ? streamingMarkdownComponents : undefined}
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
      {streamingActive && streamingText ? (
        <StreamingMarkdownContext
          value={{ content, state: streamingText }}
        >
          {markdown}
        </StreamingMarkdownContext>
      ) : markdown}
    </div>
  );
}
