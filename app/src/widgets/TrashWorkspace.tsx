/**
 * [INPUT]: 依赖 shared/api/memo 的真实回收站 API、上层 Store restore 命令、根级 Toast 与纯 TrashWorkspaceView
 * [OUTPUT]: 对外提供 TrashWorkspace，编排加载/重试/恢复/永久删除/当前用户清空，列表呈现成功结果、Toast 仅报告失败
 * [POS]: app/src/widgets 的回收站控制器；只保存 Trash 列表视图状态，不复制 active tree，恢复结果必须交回唯一 Store
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useState } from "react";

import {
  emptyMemoTrash,
  getMemoTrash,
  permanentlyDeleteMemoNode,
  type MemoTrashItem,
} from "../shared/api/memo";
import { useToast } from "../shared/design-system/components";
import {
  type TrashBusyAction,
  type TrashConfirmation,
  type TrashStatus,
  TrashWorkspaceView,
} from "./TrashWorkspaceView";

type TrashWorkspaceProps = {
  accessToken: string;
  onRestore: (nodeId: string) => Promise<void>;
  refreshKey: number;
};

export function TrashWorkspace({
  accessToken,
  onRestore,
  refreshKey,
}: TrashWorkspaceProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<MemoTrashItem[]>([]);
  const [status, setStatus] = useState<TrashStatus>("loading");
  const [retryRevision, setRetryRevision] = useState(0);
  const [busyAction, setBusyAction] = useState<TrashBusyAction>(null);
  const [confirmation, setConfirmation] = useState<TrashConfirmation>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    void getMemoTrash(accessToken, controller.signal)
      .then((nextItems) => {
        setItems(nextItems);
        setStatus(nextItems.length === 0 ? "empty" : "ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setStatus("error");
      });

    return () => controller.abort();
  }, [accessToken, refreshKey, retryRevision]);

  const removeItem = useCallback((nodeId: string) => {
    setItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== nodeId);
      setStatus(nextItems.length === 0 ? "empty" : "ready");
      return nextItems;
    });
  }, []);

  async function handleRestore(item: MemoTrashItem) {
    if (busyAction !== null) {
      return;
    }

    setBusyAction({ kind: "restore", nodeId: item.id });

    try {
      await onRestore(item.id);
      removeItem(item.id);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "恢复失败",
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePermanentDelete(item: MemoTrashItem) {
    if (busyAction !== null) {
      return;
    }

    setBusyAction({ kind: "permanent", nodeId: item.id });

    try {
      await permanentlyDeleteMemoNode(accessToken, item.id);
      removeItem(item.id);
      setConfirmation(null);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "永久删除失败",
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClear() {
    if (busyAction !== null) {
      return;
    }

    setBusyAction({ kind: "clear" });

    try {
      await emptyMemoTrash(accessToken);
      setItems([]);
      setStatus("empty");
      setConfirmation(null);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : undefined,
        title: "清空回收站失败",
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <TrashWorkspaceView
      busyAction={busyAction}
      confirmation={confirmation}
      items={items}
      onCloseConfirmation={() => setConfirmation(null)}
      onConfirmClear={() => void handleClear()}
      onConfirmPermanent={(item) => void handlePermanentDelete(item)}
      onRequestClear={() => setConfirmation({ kind: "clear" })}
      onRequestPermanent={(item) => setConfirmation({ kind: "permanent", item })}
      onRestore={(item) => void handleRestore(item)}
      onRetry={() => setRetryRevision((revision) => revision + 1)}
      status={status}
    />
  );
}
