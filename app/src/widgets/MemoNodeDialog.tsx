/**
 * [INPUT]: 依赖 React 受控表单、本地 Dialog/Input/Button 与上层异步创建文件夹命令
 * [OUTPUT]: 对外提供 MemoNodeDialog，以设计系统 Dialog 承载新建 Folder 的命名、非空校验、提交锁与错误展示
 * [POS]: app/src/widgets 的 memo tree Folder 创建弹窗；节点重命名已归树行原地 input，本组件不访问 API 或浏览器 prompt
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, type FormEvent } from "react";

import {
  Button,
  Dialog,
  Input,
} from "../shared/design-system/components";

type MemoNodeDialogProps = {
  description: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => Promise<void>;
  open: boolean;
};

export function MemoNodeDialog({
  description,
  onOpenChange,
  onSubmit,
  open,
}: MemoNodeDialogProps) {
  const [title, setTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();

    if (normalizedTitle.length === 0) {
      setErrorMessage("名称不能为空。");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit(normalizedTitle);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
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
        {errorMessage ? (
          <p className="memo-node-dialog-error" role="alert">
            {errorMessage}
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
          <Button loading={submitting} type="submit" variant="primary">
            创建
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
