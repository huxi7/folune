-- [INPUT]: 依赖 memos.sql 的 memo_nodes 邻接树与 revision 触发器、canvas-v2-schema.sql 的 canvases.canvas_kind/origin_node_id
-- [OUTPUT]: 提供唯一标题规范化函数 memo_title_norm、同父同类型重名唯一索引（含根节点分支），并收走默认 Canvas 标题的跟随与锚定触发器
-- [POS]: api/supabase 的命名边界契约；重名的最终真相在此，前端预检查只做快速反馈。画布命名零特例——两种 Canvas 共用一条规则，血缘由 canvases.origin_node_id 表达而不由标题表达
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
-- 三、画布标题的独立性（原「默认 Canvas 标题跟随来源笔记」）
-- ============================================================
-- 这里曾有两个触发器: sync 让默认 Canvas 跟着来源笔记改名, anchor 把任何改
-- 默认 Canvas 标题的 UPDATE 回落成来源笔记标题。两者合起来的语义是「默认
-- Canvas 没有自己的名字」——它是笔记的一个视图, 不是一件作品。
--
-- 该语义已被推翻。默认 Canvas 与 standalone Canvas 从此共用同一条命名规则:
-- 出生时抄一份来源笔记标题作为初值, 此后各自独立, 谁也不跟随谁。理由是画布
-- 承载了笔记里根本不存在的内容（AI 拓展出的节点、连接、自由文字）, 它是笔记
-- 的派生产物而不是笔记的渲染方式, 因此它必须能被自己的名字找到。
--
-- 血缘不靠名字表达: 它存在 canvases.origin_node_id 与画布上那张 memo_ref
-- 卡片里, 两处都不受改名影响。放开命名不丢任何关联信息。
--
-- 于是这一节从「两个触发器」收敛成「两条 drop」, 命名逻辑零特例。drop 必须
-- 留着: 远端已经建过它们, 声明式脚本要能把它们收走。
drop trigger if exists memo_nodes_anchor_default_canvas_title on public.memo_nodes;
drop trigger if exists memo_nodes_sync_default_canvas_title on public.memo_nodes;
drop function if exists public.anchor_memo_default_canvas_title();
drop function if exists public.sync_memo_default_canvas_title();

-- ============================================================
-- 四、权限
-- ============================================================
-- 规范化函数需要被 authenticated 的查询计划读到（唯一索引与 RPC 都会用它）,
-- 故只给它执行权。
revoke all on function public.memo_title_norm(text)
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
-- 3) 2026-08-29 放开默认 Canvas 命名（本文件第三节的四条 drop，已在远端执行）：
--    零 DML。存量默认 Canvas（执行时 14 张）保留当前标题——即各自来源笔记的
--    当前标题——作为初值，此后由用户自由改名。唯一索引「同父同类型」本就允许
--    笔记与画布同名，因此改名不需要任何数据迁移，重名照旧由索引裁决。
--    执行后在一个 rollback 掉的事务里正向验证过两个方向都已独立：给默认画布
--    改名不再被回落，来源笔记改名也不再带着画布一起改。
