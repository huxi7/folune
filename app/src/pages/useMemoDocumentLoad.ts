/**
 * [INPUT]: 依赖正文 Store 的按 ID 加载命令、访问令牌、当前目录就绪状态与 Toast
 * [OUTPUT]: 对外提供只为当前未缓存笔记加载正文并在切换时中止旧请求的 useMemoDocumentLoad
 * [POS]: app/src/pages 的正文请求生命周期边界；Dashboard 只选择笔记，本文负责按需读取与错误反馈
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect } from "react";

import type { MemoDetailNode } from "../shared/api/memo";
import { useToast } from "../shared/design-system/components";
import { useMemoDocumentStore } from "../shared/store/memoDocumentStore";

type UseMemoDocumentLoadInput = {
  accessToken: string;
  enabled: boolean;
  memo: MemoDetailNode | null;
  memoId: string | null;
};

export function useMemoDocumentLoad({
  accessToken,
  enabled,
  memo,
  memoId,
}: UseMemoDocumentLoadInput) {
  const loadMemo = useMemoDocumentStore((state) => state.loadMemo);
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled || memoId === null || memo !== null) return;

    const controller = new AbortController();
    void loadMemo(accessToken, memoId, controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "备忘录正文加载失败",
        variant: "error",
      });
    });

    return () => controller.abort();
  }, [accessToken, enabled, loadMemo, memo, memoId, toast]);
}
