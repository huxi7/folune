/**
 * [INPUT]: 依赖浏览器 Intl.Segmenter 的 Unicode 词边界与原始 SSE 文本
 * [OUTPUT]: 对外提供保留标点/空白/Markdown 标记的 splitStreamingTextUnits 纯函数
 * [POS]: design-system AI 文本的语言无关分词内核，让英文按词、中文按语义词组共享同一流式节奏
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

export function splitStreamingTextUnits(text: string) {
  const units: string[] = [];
  let current = "";
  let hasWord = false;

  for (const segment of wordSegmenter.segment(text)) {
    if (segment.isWordLike && hasWord) {
      units.push(current);
      current = segment.segment;
      continue;
    }

    current += segment.segment;
    hasWord ||= segment.isWordLike === true;
  }

  if (current.length > 0) {
    units.push(current);
  }

  return units;
}
