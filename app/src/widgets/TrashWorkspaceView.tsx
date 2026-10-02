/**
 * [INPUT]: 依赖 MotionSurface 条目入退场与位置重排、回收站最小 DTO、locale 文案/日期格式、共享 Button/Dialog/Skeleton 与 Lucide 图标
 * [OUTPUT]: 对外提供 TrashWorkspaceView 及其视图状态类型
 * [POS]: app/src/widgets 的纯回收站视图；不请求数据、不复制 active tree，供控制器和无网络测试复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { AnimatePresence } from "motion/react";
import { MotionSurface } from "../shared/design-system/components/PresenceSurface";
import {
  ArrowCounterClockwiseIcon,
  FileTextIcon,
  FolderIcon,
  TrashIcon,
} from "../shared/design-system/icons";

import type { MemoTrashItem } from "../shared/api/memo";
import {
  Button,
  Dialog,
  Skeleton,
  SkeletonGroup,
} from "../shared/design-system/components";
import { useLocale } from "../shared/locale";

export type TrashStatus = "empty" | "error" | "loading" | "ready";
export type TrashBusyAction =
  | { kind: "clear" }
  | { kind: "permanent" | "restore"; nodeId: string }
  | null;
export type TrashConfirmation =
  | { kind: "clear" }
  | { kind: "permanent"; item: MemoTrashItem }
  | null;

type TrashWorkspaceViewProps = {
  busyAction: TrashBusyAction;
  confirmation: TrashConfirmation;
  items: MemoTrashItem[];
  onCloseConfirmation: () => void;
  onConfirmClear: () => void;
  onConfirmPermanent: (item: MemoTrashItem) => void;
  onRequestClear: () => void;
  onRequestPermanent: (item: MemoTrashItem) => void;
  onRestore: (item: MemoTrashItem) => void;
  onRetry: () => void;
  status: TrashStatus;
};

function TrashLoading() {
  const { t } = useLocale();
  return (
    <SkeletonGroup
      className="trash-loading-list"
      label={t("正在加载回收站", "Loading Trash")}
      visible
    >
      {[0, 1, 2].map((index) => (
        <div className="trash-loading-row" key={index}>
          <Skeleton className="trash-loading-icon" />
          <div className="trash-loading-copy">
            <Skeleton className="trash-loading-title" shape="text" />
            <Skeleton className="trash-loading-detail" shape="text" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}

export function TrashWorkspaceView({
  busyAction,
  confirmation,
  items,
  onCloseConfirmation,
  onConfirmClear,
  onConfirmPermanent,
  onRequestClear,
  onRequestPermanent,
  onRestore,
  onRetry,
  status,
}: TrashWorkspaceViewProps) {
  const { t, formatDate } = useLocale();
  const mutating = busyAction !== null;
  const permanentTarget = confirmation?.kind === "permanent"
    ? confirmation.item
    : null;
  const confirmationDescription = confirmation?.kind === "clear"
    ? t("这会永久删除当前登录用户回收站中的全部文件夹、备忘录和正文。其他用户不受影响，操作不可恢复。", "All folders, notes and their content in your Trash will be permanently deleted. This cannot be undone.")
    : permanentTarget?.node_type === "folder"
      ? t("这个文件夹及其内部所有文件夹、备忘录和正文都会被永久删除。操作不可恢复。", "This folder and every folder and note inside it will be permanently deleted. This cannot be undone.")
      : t("这条备忘录及其正文会被永久删除。操作不可恢复。", "This note and its content will be permanently deleted. This cannot be undone.");

  return (
    <main className="ui-page">
      <div className="ui-page-inner">
        <header className="ui-page-header trash-page-header">
          <div className="trash-page-heading">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <TrashIcon aria-hidden="true" size={16} />
                <p className="ui-kicker">Library</p>
              </div>
              <h1 className="ui-page-title">{t("回收站", "Trash")}</h1>
              <p className="ui-page-description">
                {t("已删除项目保留原层级；文件夹只显示删除入口，不展开内部内容。", "Deleted items keep their original structure. Restore a folder to bring back everything inside.")}
              </p>
            </div>
            <Button
              disabled={status !== "ready" || items.length === 0 || mutating}
              icon={TrashIcon}
              onClick={onRequestClear}
              variant="danger"
            >
              {t("清空回收站", "Empty Trash")}
            </Button>
          </div>
        </header>

        {status === "loading" ? <TrashLoading /> : null}
        {status === "error" ? (
          <section className="trash-state" role="alert">
            <TrashIcon aria-hidden="true" size={24} />
            <strong>{t("回收站加载失败", "Couldn't load Trash")}</strong>
            <span>{t("请检查网络或后端服务后重试。", "Please check your connection and try again.")}</span>
            <Button onClick={onRetry} variant="secondary">{t("重试", "Try again")}</Button>
          </section>
        ) : null}
        {status === "empty" ? (
          <section className="trash-state" role="status">
            <TrashIcon aria-hidden="true" size={24} />
            <strong>{t("回收站是空的", "Trash is empty")}</strong>
            <span>{t("从文件树移除的备忘录和文件夹会显示在这里。", "Notes and folders you delete from the library will appear here.")}</span>
          </section>
        ) : null}
          <section
            aria-label={t("已删除项目", "Deleted items")}
            className="trash-list divide-y divide-border/70 border-y border-border/70"
          >
            <AnimatePresence initial={false} mode="popLayout">
            {(status === "ready" ? items : []).map((item) => {
              const Icon = item.node_type === "folder"
                ? FolderIcon
                : FileTextIcon;
              const restoring = busyAction?.kind === "restore" &&
                busyAction.nodeId === item.id;

              return (
                <MotionSurface role="article" kind="fade" layout="position" className="trash-item" key={item.id}>
                  <div className="trash-item-icon" aria-hidden="true">
                    <Icon size={16} />
                  </div>
                  <div className="trash-item-copy">
                    <div className="trash-item-title-row">
                      <h2>{item.title}</h2>
                      <span>{item.node_type === "folder" ? t("文件夹", "Folder") : t("备忘录", "Note")}</span>
                    </div>
                    <p className="trash-item-path">{t("原位置：", "Original location: ")}{item.original_path}</p>
                    {item.node_type === "memo" && item.excerpt ? (
                      <p className="trash-item-excerpt">{item.excerpt}</p>
                    ) : null}
                  </div>
                  <div className="trash-item-meta">
                    <time dateTime={item.deleted_at}>
                      {formatDate(item.deleted_at, { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                    <div className="trash-item-actions">
                      <Button
                        disabled={mutating}
                        icon={ArrowCounterClockwiseIcon}
                        loading={restoring}
                        onClick={() => onRestore(item)}
                        variant="secondary"
                      >
                        {t("恢复", "Restore")}
                      </Button>
                      <Button
                        disabled={mutating}
                        icon={TrashIcon}
                        onClick={() => onRequestPermanent(item)}
                        variant="danger"
                      >
                        {t("永久删除", "Delete forever")}
                      </Button>
                    </div>
                  </div>
                </MotionSurface>
              );
            })}
            </AnimatePresence>
          </section>
      </div>

      <Dialog
        closeLabel={t("关闭弹窗", "Close dialog")}
        density="compact"
        description={confirmationDescription}
        onOpenChange={(open) => {
          if (!open && !mutating) {
            onCloseConfirmation();
          }
        }}
        open={confirmation !== null}
        title={confirmation?.kind === "clear" ? t("清空回收站？", "Empty Trash?") : t("永久删除？", "Delete forever?")}
      >
        <div className="trash-confirm-actions">
          <Button
            disabled={mutating}
            onClick={onCloseConfirmation}
            variant="ghost"
          >
            {t("取消", "Cancel")}
          </Button>
          <Button
            data-dialog-autofocus
            loading={busyAction?.kind === "clear" || busyAction?.kind === "permanent"}
            onClick={() => {
              if (confirmation?.kind === "clear") {
                onConfirmClear();
              } else if (permanentTarget !== null) {
                onConfirmPermanent(permanentTarget);
              }
            }}
            variant="danger"
          >
            {confirmation?.kind === "clear" ? t("确认清空", "Empty Trash") : t("确认永久删除", "Delete forever")}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
