/**
 * [INPUT]: 依赖 Bun test、Composer sources 纯领域函数与 memo tree fixture
 * [OUTPUT]: 覆盖当前笔记默认 @、删除抑制、切换更新、置顶/手动去重、数量上限、发送冻结与发送后收束
 * [POS]: AgentPanel Prompt Bar 上下文不漂移回归测试，不启动 React、Chat 或真实 API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { describe, expect, test } from "bun:test";

import type { MemoTreeNode } from "../../shared/api/memo";
import {
  addComposerSource,
  buildFrozenComposerContext,
  reconcileComposerSources,
  settleComposerSourcesAfterSend,
} from "./composerSources";

const memo = (id: string, title: string, revision: number): MemoTreeNode => ({
  id,
  user_id: "11111111-1111-4111-8111-111111111111",
  parent_id: null,
  node_type: "memo",
  title,
  sort_order: "1000",
  icon: null,
  color: null,
  metadata: {},
  revision,
  deleted_at: null,
  deleted_root_id: null,
  created_at: "2026-08-13T08:00:00.000Z",
  updated_at: "2026-08-13T08:00:00.000Z",
  children: [],
  memo: {
    node_id: id,
    user_id: "11111111-1111-4111-8111-111111111111",
    content_mdx: "正文",
    excerpt: null,
    word_count: 2,
    metadata: {},
    created_at: "2026-08-13T08:00:00.000Z",
    updated_at: "2026-08-13T08:00:00.000Z",
  },
});

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tree = [memo(A, "当前笔记", 4), memo(B, "参考笔记", 7)];

describe("Composer sources", () => {
  test("当前笔记进入同一来源数组，删除后不会被同一草稿重新加入", () => {
    const selected = reconcileComposerSources([], tree, A, [], null);
    expect(selected.map((source) => [source.id, source.current])).toEqual([[A, true]]);
    expect(reconcileComposerSources([], tree, A, [], A)).toEqual([]);
  });

  test("切换当前笔记会替换默认来源，手动与置顶来源保持去重", () => {
    const initial = reconcileComposerSources([], tree, A, [], null);
    const withManual = addComposerSource(initial, {
      id: B,
      path: "根目录",
      revision: 7,
      title: "参考笔记",
    });
    const pinned = reconcileComposerSources(withManual, tree, B, [B], null);
    expect(pinned).toHaveLength(1);
    expect(pinned[0]).toMatchObject({ id: B, current: true, manual: true, pinned: true });
  });

  test("发送冻结最新 revision，且当前笔记按普通 @引用发送", () => {
    const selected = reconcileComposerSources([], tree, A, [B], null);
    const frozen = buildFrozenComposerContext(selected, tree);
    expect(frozen.context.active_memo_id).toBeNull();
    expect(frozen.context.reference_memo_ids).toEqual([A, B]);
    expect(frozen.context.revisions).toEqual({ [A]: 4, [B]: 7 });
    expect(frozen.display.primary).toBeNull();
    expect(frozen.display.references.map((source) => source.title)).toEqual([
      "当前笔记",
      "参考笔记",
    ]);
  });

  test("发送后仅清理纯手动来源，当前和置顶来源留给下一草稿", () => {
    const selected = reconcileComposerSources([], tree, A, [B], null);
    const manualOnly = addComposerSource(selected, {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      path: "根目录",
      revision: 1,
      title: "临时来源",
    });
    expect(settleComposerSourcesAfterSend(manualOnly).map((source) => source.id)).toEqual([A, B]);
  });
});
