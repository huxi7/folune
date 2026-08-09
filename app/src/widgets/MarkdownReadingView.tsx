/**
 * [INPUT]: 依赖 react-markdown、remark-gfm、remark-breaks、rehype-sanitize 与当前本地原始 Markdown 正文
 * [OUTPUT]: 对外提供可按场景保留软换行、且禁止原始 HTML/JSX/脚本执行的 MarkdownReadingView
 * [POS]: app/src/widgets 的共享只读 Markdown 渲染边界；备忘录阅读态显式保留单换行，其他消费者维持标准 CommonMark 换行语义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import rehypeSanitize from "rehype-sanitize";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type MarkdownReadingViewProps = {
  content: string;
  preserveSoftBreaks?: boolean;
};

const standardRemarkPlugins = [remarkGfm];
const softBreakRemarkPlugins = [remarkGfm, remarkBreaks];

export function MarkdownReadingView({
  content,
  preserveSoftBreaks = false,
}: MarkdownReadingViewProps) {
  return (
    <div className="markdown-reading-view">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={preserveSoftBreaks
          ? softBreakRemarkPlugins
          : standardRemarkPlugins}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
