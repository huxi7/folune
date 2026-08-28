-- [INPUT]: 依赖 memos.sql 的 memo_nodes 邻接树与 revision 触发器、canvas-v2-schema.sql 的 canvases.canvas_kind/origin_node_id
-- [OUTPUT]: 提供唯一标题规范化函数 memo_title_norm、同父同类型重名唯一索引（含根节点分支）、默认 Canvas 标题的同事务同步与只读锚定触发器
-- [POS]: api/supabase 的命名边界契约；重名的最终真相在此，前端预检查只做快速反馈。存量收敛与冲突解开是一次性 DML，记录在文件末尾以备审阅
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

-- ============================================================
-- 一、标题规范化：全库唯一的一处实现
-- ============================================================
-- 处理首尾空白、连续空白折叠与拉丁大小写；中文无大小写故不需额外分支，
-- 项目其余位置沿用的 btrim / regexp_replace(_, '\s+', ' ') 语义在此收口。
-- 前端 normalizeMemoTitle() 是它的镜像，但只负责即时反馈——并发下的最终
-- 真相永远是下面两条唯一索引。
-- ⚠️ 本函数被唯一索引表达式引用：修改函数体后必须 REINDEX 两条索引，
--    否则索引内容与函数语义静默不一致。
create or replace function public.memo_title_norm(p_title text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select lower(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')))
$$;

-- ============================================================
-- 二、重名唯一约束
-- ============================================================
-- 合法：一篇笔记与它的默认 Canvas 同名（node_type 不同）；不同类型对象同名。
-- 禁止：同 user、同 parent、同 node_type、规范化标题相同。
-- 已软删的行被排除，回收站里的对象不阻塞新命名。
-- parent_id IS NULL 的根节点单独一条 partial index——普通唯一索引对 NULL
-- 不去重，而 coalesce 到哨兵 UUID 会引入一个魔法值，故按分支拆开。
create unique index if not exists memo_nodes_sibling_title_key
  on public.memo_nodes (
    user_id, parent_id, node_type, public.memo_title_norm(title)
  )
  where deleted_at is null and parent_id is not null;

create unique index if not exists memo_nodes_root_title_key
  on public.memo_nodes (
    user_id, node_type, public.memo_title_norm(title)
  )
  where deleted_at is null and parent_id is null;

-- ============================================================
-- 三、默认 Canvas 标题跟随来源笔记
-- ============================================================
-- 笔记改名有三条入口（PATCH /memo-nodes/:id、PATCH /memos/:id 的 title
-- 分支、AI 整理的重命名命令）。在 service 层逐条补同步会产生三份实现且都
-- 不在同一事务里，所以同步只在数据库实现一次：触发器与用户的 UPDATE 天然
-- 同事务，原子性由 Postgres 保证。
create or replace function public.sync_memo_default_canvas_title()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 只有笔记是来源。canvas 行不是任何行的 origin，这个判据同时截断了
  -- 下面 UPDATE 递归触发本触发器时的级联。
  if new.node_type <> 'memo' then
    return null;
  end if;

  update public.memo_nodes cn
  set title = new.title
  from public.canvases c
  where c.node_id = cn.id
    and c.canvas_kind = 'memo_default'
    and c.origin_node_id = new.id
    and cn.user_id = new.user_id
    and cn.title is distinct from new.title;

  return null;
end;
$$;

-- 默认 Canvas 的标题不可独立编辑：由数据层兜底，而不是只靠 UI 隐藏入口。
-- 任何把默认画布标题改成别的值的 UPDATE 都被回落到来源笔记的当前标题；
-- 上面的同步触发器写入的正是这个值，因此两者互不打架。
-- 名字以 anchor 开头是为了在 BEFORE UPDATE 触发器的字母序里排在
-- memo_nodes_bump_revision 之前——先回落标题，再决定要不要 +1 revision，
-- 否则一次被驳回的改名会留下一个没有任何可见变化的 revision 跳变。
create or replace function public.anchor_memo_default_canvas_title()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  origin_title text;
begin
  if new.node_type <> 'canvas' or new.title = old.title then
    return new;
  end if;

  select o.title
  into origin_title
  from public.canvases c
  join public.memo_nodes o on o.id = c.origin_node_id
  where c.node_id = new.id
    and c.canvas_kind = 'memo_default';

  if origin_title is not null then
    new.title := origin_title;
  end if;

  return new;
end;
$$;

drop trigger if exists memo_nodes_anchor_default_canvas_title on public.memo_nodes;
create trigger memo_nodes_anchor_default_canvas_title
  before update of title on public.memo_nodes
  for each row
  when (old.title is distinct from new.title)
  execute function public.anchor_memo_default_canvas_title();

drop trigger if exists memo_nodes_sync_default_canvas_title on public.memo_nodes;
create trigger memo_nodes_sync_default_canvas_title
  after update of title on public.memo_nodes
  for each row
  when (old.title is distinct from new.title)
  execute function public.sync_memo_default_canvas_title();

-- ============================================================
-- 四、权限
-- ============================================================
-- 两个触发器函数只被触发器调用，不是入口；规范化函数需要被 authenticated
-- 的查询计划读到（唯一索引与 RPC 都会用它），故只给它执行权。
revoke all on function public.memo_title_norm(text)
from public, anon, authenticated, service_role;
revoke all on function public.sync_memo_default_canvas_title()
from public, anon, authenticated, service_role;
revoke all on function public.anchor_memo_default_canvas_title()
from public, anon, authenticated, service_role;

grant execute on function public.memo_title_norm(text) to authenticated;

-- ============================================================
-- 五、一次性存量处置（2026-08-29 已在远端执行，留档备审）
-- ============================================================
-- 1) 解开唯一约束冲突，零删除，只改 title：
--      9e803c3a-0760-49ff-bce4-885f2e489651  牛逼          → 牛逼 2
--      e0eb3d32-f159-48b2-977d-82cf75910da1  未命名 Canvas → 未命名 Canvas 2
--      f525ca95-43eb-44ec-b501-ef710c4a7df7  未命名 Canvas → 未命名 Canvas 2
--    实际影响 3 行。两组「未命名 Canvas」是 standalone 画布默认名不分配
--    唯一后缀的历史产物，见 create_standalone_canvas 的修正。
-- 2) 存量默认 Canvas 标题收敛为来源笔记当前标题（Plan 7.1），
--    按查询结果作用于全部 memo_default，不硬编码 id 或数量：
--      update memo_nodes cn set title = o.title
--      from canvases c join memo_nodes o on o.id = c.origin_node_id
--      where c.node_id = cn.id and c.canvas_kind = 'memo_default'
--        and cn.user_id = c.user_id and cn.title is distinct from o.title;
--    实际影响 12 行（回收站 0 行）。收敛掉的三种历史格式：
--    「X」的关联 ×5、X · 画布 ×5、被手工改过名的 ×2。
