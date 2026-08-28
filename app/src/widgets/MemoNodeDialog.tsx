/**
 * [INPUT]: 依赖 React 受控表单、本地 Dialog/Input/Button、memoTreeStore 轻量树与 memoTitleRules 重名判据，以及上层异步创建文件夹命令
 * [OUTPUT]: 对外提供 MemoNodeDialog，以设计系统 Dialog 承载新建 Folder 的命名、非空校验、同级重名即时提示、提交锁与错误展示
 * [POS]: app/src/widgets 的 memo tree Folder 创建弹窗；节点重命名已归树行原地 input，本组件不访问 API 或浏览器 prompt
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, type FormEvent } from "react";

import {
  Button,
  Dialog,
  Input,
} from "../shared/design-system/components";
import {
  findMemoTitleConflict,
  isMemoTitleConflictError,
} from "../shared/store/memoTitleRules";
import { useMemoTreeStore } from "../shared/store/memoTreeStore";

type MemoNodeDialogProps = {
  description: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => Promise<void>;
  open: boolean;
  /** 新文件夹的落点；同级重名判据需要它 */
  parentId: string | null;
};

const TITLE_TAKEN_MESSAGE = "此位置已存在同名文件夹，换一个名字。";

export function MemoNodeDialog({
  description,
  onOpenChange,
  onSubmit,
  open,
  parentId,
}: MemoNodeDialogProps) {
  const [title, setTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nodes = useMemoTreeStore((state) => state.nodes);
  /*
   * 用户亲手输入的名字撞名时不替他改名: 敲字的这一刻就提示, 并且不发那次
   * 注定被唯一约束驳回的 POST。唯一索引仍是并发下的最终裁决者, 所以
   * 服务端的 MEMO_TITLE_CONFLICT 也要在下面接住。
   */
  const taken = findMemoTitleConflict({
    nodeId: null,
    nodeType: "folder",
    nodes,
    parentId,
    title,
  }) !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();

    if (normalizedTitle.length === 0) {
      setErrorMessage("名称不能为空。");
      return;
    }

    if (taken) {
      setErrorMessage(TITLE_TAKEN_MESSAGE);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit(normalizedTitle);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        isMemoTitleConflictError(error)
          ? TITLE_TAKEN_MESSAGE
          : error instanceof Error
            ? error.message
            : "操作失败，请稍后再试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      density="compact"
      description={description}
      onOpenChange={onOpenChange}
      open={open}
      title="新建文件夹"
    >
      <form className="memo-node-dialog-form" onSubmit={handleSubmit}>
        <label className="memo-node-dialog-label" htmlFor="memo-node-title">
          文件夹名称
        </label>
        <Input
          aria-invalid={taken ? true : undefined}
          autoComplete="off"
          data-dialog-autofocus
          id="memo-node-title"
          maxLength={500}
          onChange={(event) => {
            setTitle(event.target.value);
            setErrorMessage(null);
          }}
          placeholder="例如：工作"
          value={title}
        />
        {errorMessage ?? (taken ? TITLE_TAKEN_MESSAGE : null) ? (
          <p className="memo-node-dialog-error" role="alert">
            {errorMessage ?? TITLE_TAKEN_MESSAGE}
          </p>
        ) : null}
        <div className="memo-node-dialog-actions">
          <Button
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            取消
          </Button>
          <Button
            disabled={taken}
            loading={submitting}
            type="submit"
            variant="primary"
          >
            创建
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
