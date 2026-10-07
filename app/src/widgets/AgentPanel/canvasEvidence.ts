/**
 * [INPUT]: 依赖消息中服务端已校验的 data-canvas-evidence 分块
 * [OUTPUT]: 提供去重后的引用清单，拒绝损坏消息数据
 * [POS]: 回复引用投影边界；不根据当前画布或标题猜测来源
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { z } from "zod";
import type { FoluneUIMessage } from "../../shared/api/ai";
import type { CanvasCitation } from "../../shared/api/canvasChat";
const citationSchema = z.object({
  kind: z.enum(["memo", "text", "edge"]),
  source_id: z.uuid(),
  canvas_id: z.uuid(),
  canvas_node_id: z.uuid().nullable(),
  title: z.string(),
  revision: z.number().int().nonnegative(),
  quote: z.string().min(1).max(1200),
  claim: z.string().max(300),
});
export function readCanvasCitations(
  message: FoluneUIMessage,
): CanvasCitation[] {
  const data = message.parts.findLast((p) => p.type === "data-canvas-evidence");
  const parsed = z
    .object({ citations: z.array(citationSchema).max(30) })
    .safeParse(data && "data" in data ? data.data : null);
  return parsed.success ? parsed.data.citations : [];
}
