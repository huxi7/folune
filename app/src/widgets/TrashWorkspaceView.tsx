/**
 * [INPUT]: 依赖回收站最小 DTO、共享 Button/Dialog/Skeleton 与 共享 Lucide 图标
 * [OUTPUT]: 对外提供 TrashWorkspaceView 及其视图状态类型
 * [POS]: app/src/widgets 的纯回收站视图；不请求数据、不复制 active tree，供控制器和无网络测试复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

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

const formatDeletedAt = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function TrashLoading() {
  return (
    <SkeletonGroup
      className="trash-loading-list"
      label="正在加载回收站"
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
  const mutating = busyAction !== null;
  const permanentTarget = confirmation?.kind === "permanent"
    ? confirmation.item
    : null;
  const confirmationDescription = confirmation?.kind === "clear"
    ? "这会永久删除当前登录用户回收站中的全部文件夹、备忘录和正文。其他用户不受影响，操作不可恢复。"
    : permanentTarget?.node_type === "folder"
      ? "这个文件夹及其内部所有文件夹、备忘录和正文都会被永久删除。操作不可恢复。"
      : "这条备忘录及其正文会被永久删除。操作不可恢复。";

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
              <h1 className="ui-page-title">回收站</h1>
              <p className="ui-page-description">
                已删除项目保留原层级；文件夹只显示删除入口，不展开内部内容。
              </p>
            </div>
            <Button
              disabled={status !== "ready" || items.length === 0 || mutating}
              icon={TrashIcon}
              onClick={onRequestClear}
              variant="danger"
            >
              清空回收站
            </Button>
          </div>
        </header>

        {status === "loading" ? <TrashLoading /> : null}
        {status === "error" ? (
          <section className="trash-state" role="alert">
            <TrashIcon aria-hidden="true" size={24} />
            <strong>回收站加载失败</strong>
            <span>请检查网络或后端服务后重试。</span>
            <Button onClick={onRetry} variant="secondary">重试</Button>
          </section>
        ) : null}
        {status === "empty" ? (
          <section className="trash-state" role="status">
            <TrashIcon aria-hidden="true" size={24} />
            <strong>回收站是空的</strong>
            <span>从文件树移除的备忘录和文件夹会显示在这里。</span>
          </section>
        ) : null}
        {status === "ready" ? (
          <section
            aria-label="已删除项目"
            className="trash-list divide-y divide-border/70 border-y border-border/70"
          >
            {items.map((item) => {
              const Icon = item.node_type === "folder"
                ? FolderIcon
                : FileTextIcon;
              const restoring = busyAction?.kind === "restore" &&
                busyAction.nodeId === item.id;

              return (
                <article className="trash-item" key={item.id}>
                  <div className="trash-item-icon" aria-hidden="true">
                    <Icon size={17} />
                  </div>
                  <div className="trash-item-copy">
                    <div className="trash-item-title-row">
                      <h2>{item.title}</h2>
                      <span>{item.node_type === "folder" ? "文件夹" : "备忘录"}</span>
                    </div>
                    <p className="trash-item-path">原位置：{item.original_path}</p>
                    {item.node_type === "memo" && item.excerpt ? (
                      <p className="trash-item-excerpt">{item.excerpt}</p>
                    ) : null}
                  </div>
                  <div className="trash-item-meta">
                    <time dateTime={item.deleted_at}>
                      {formatDeletedAt(item.deleted_at)}
                    </time>
                    <div className="trash-item-actions">
                      <Button
                        disabled={mutating}
                        icon={ArrowCounterClockwiseIcon}
                        loading={restoring}
                        onClick={() => onRestore(item)}
                        variant="secondary"
                      >
                        恢复
                      </Button>
                      <Button
                        disabled={mutating}
                        icon={TrashIcon}
                        onClick={() => onRequestPermanent(item)}
                        variant="danger"
                      >
                        永久删除
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>

      <Dialog
        density="compact"
        description={confirmationDescription}
        onOpenChange={(open) => {
          if (!open && !mutating) {
            onCloseConfirmation();
          }
        }}
        open={confirmation !== null}
        title={confirmation?.kind === "clear" ? "清空回收站？" : "永久删除？"}
      >
        <div className="trash-confirm-actions">
          <Button
            disabled={mutating}
            onClick={onCloseConfirmation}
            variant="ghost"
          >
            取消
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
            {confirmation?.kind === "clear" ? "确认清空" : "确认永久删除"}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
