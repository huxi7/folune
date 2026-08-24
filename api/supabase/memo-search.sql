-- [INPUT]: 依赖 public.memo_nodes/public.memos、auth.uid() 与 PGroonga 全文检索扩展；PGroonga 在目标库可用但未安装，故本文件显式 create extension（与仅在 [INPUT] 声明 Supabase 预装扩展的既有约定不同，原因是它必须先被创建）
-- [OUTPUT]: 建立 memo 标题/正文的 PGroonga 索引，并提供 search_memos_hybrid 三路召回 + RRF 融合 RPC、search_memos_keyword 关键词 RPC 与显式 grants
-- [POS]: api/supabase 的备忘录检索契约；取代 PostgREST ilike 全表匹配，以中文可分词的词面相似通道（PGroonga &@* 相似搜索）、结构邻近通道与（待 memo_relations 落地后启用的）关系通道按名次融合，正文永不进入返回载荷
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

-- Postgres 内置 FTS 不切中文词（to_tsvector('simple','熵增者妄作之果') 会当成单个 token），
-- 因此使用 PGroonga 的变长 N-gram。显式指定 schema，使 search_path = '' 的函数能稳定限定操作符。
create extension if not exists pgroonga with schema extensions;

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------

create index if not exists memos_content_pgroonga_idx
on public.memos using pgroonga (content_mdx);

create index if not exists memo_nodes_title_pgroonga_idx
on public.memo_nodes using pgroonga (title);

-- --------------------------------------------------------------------------
-- Hybrid recall
-- --------------------------------------------------------------------------

create or replace function public.search_memos_hybrid(
  p_user_id uuid,
  p_query_text text,
  p_source_node_id uuid default null,
  p_limit integer default 12,
  p_exclude_node_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- k = 60 是 Reciprocal Rank Fusion 原论文的标准常数，不是可调参数。
  -- RRF 只消费名次不消费分数，因此三个通道无需归一化、无需权重。
  rrf_k constant integer := 60;
  -- 每路召回先各自截断再融合：否则一个宽泛查询能命中数万行，窗口函数会全扫。
  channel_limit constant integer := 40;
  query_text text;
  effective_limit integer;
  excluded uuid[] := coalesce(p_exclude_node_ids, '{}'::uuid[]);
  hits jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  query_text := btrim(coalesce(p_query_text, ''));

  if query_text = '' then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'MEMO_SEARCH_QUERY_EMPTY'
    );
  end if;

  -- 选中整段正文也可作为查询，故限长以避免把一整篇塞进检索
  if length(query_text) > 2000 then
    query_text := left(query_text, 2000);
  end if;

  effective_limit := least(greatest(coalesce(p_limit, 12), 1), 50);

  with source as (
    select node.id, node.parent_id, node.created_at
    from public.memo_nodes node
    where node.user_id = p_user_id
      and node.id = p_source_node_id
      and node.deleted_at is null
  ),
  -- 唯一的候选闸门: 必须是本人的、active 的、memo 类型，且排除源自身与显式排除项。
  -- 现有 ilike 搜索只查 public.memos 而 memos 无 deleted_at，导致回收站正文可被搜到；此处 join 修正。
  candidates as (
    select
      node.id,
      node.parent_id,
      node.title,
      node.created_at,
      node.revision,
      content.excerpt
    from public.memo_nodes node
    join public.memos content
      on content.user_id = node.user_id
      and content.node_id = node.id
    where node.user_id = p_user_id
      and node.node_type = 'memo'
      and node.deleted_at is null
      and node.id is distinct from p_source_node_id
      and not (node.id = any (excluded))
  ),
  -- 通道 1 · 词面/标题相似
  -- 两处经验校准（都在真实库上验过，不是推断）:
  --   1. `&@` 是「单个关键词」语义，把一整段选中文字连标点当成一个词，对本场景恒不命中；
  --      `&@*` 是相似搜索——给一段文档找相似行，正是 Explore 的语义。2/3/6 字与整段均可用。
  --   2. `&@*` 只在索引扫描下可用，因此必须直接打在索引表上；写在 candidates CTE 之上会报
  --      「similar search available only in index scan」。active/类型/排除的过滤下沉到融合处的 join。
  lexical_title as (
    select
      node.id,
      row_number() over (order by node.updated_at desc, node.id) as rank
    from public.memo_nodes node
    where node.user_id = p_user_id
      and node.node_type = 'memo'
      and node.deleted_at is null
      and node.title operator(extensions.&@*) query_text
    limit channel_limit
  ),
  -- 通道 2 · 词面/正文相似
  lexical_body as (
    select
      content.node_id as id,
      row_number() over (order by content.updated_at desc, content.node_id) as rank
    from public.memos content
    where content.user_id = p_user_id
      and content.content_mdx operator(extensions.&@*) query_text
    limit channel_limit
  ),
  -- 通道 3 · 结构邻近: 同文件夹优先，其次写作时间邻近。纯 SQL，零成本，
  -- 且信号质量常高于词面——同一天写在同一文件夹的两篇本来就相关。
  structural as (
    select
      candidate.id,
      row_number() over (
        order by
          case when candidate.parent_id is not distinct from src.parent_id then 0 else 1 end,
          abs(extract(epoch from (candidate.created_at - src.created_at))),
          candidate.id
      ) as rank
    from candidates candidate
    cross join source src
    where candidate.parent_id is not distinct from src.parent_id
      or abs(extract(epoch from (candidate.created_at - src.created_at))) < 259200
    limit channel_limit
  ),
  -- 通道 4 · 关系邻近: 待 public.memo_relations 落地后启用（见知识画布阶段）。
  -- 此处保留为恒空通道，届时只需替换本 CTE 的来源，融合与返回结构不变。
  relational as (
    select
      candidate.id,
      row_number() over (order by candidate.id) as rank
    from candidates candidate
    where false
    limit channel_limit
  ),
  channelled as (
    select id, 'lexical_title'::text as channel, rank from lexical_title
    union all
    select id, 'lexical_body'::text, rank from lexical_body
    union all
    select id, 'structural'::text, rank from structural
    union all
    select id, 'relational'::text, rank from relational
  ),
  fused as (
    select
      channelled.id,
      sum(1.0 / (rrf_k + channelled.rank)) as score,
      array_agg(distinct channelled.channel) as channels
    from channelled
    group by channelled.id
  )
  select jsonb_agg(hit order by hit -> 'rank')
  into hits
  from (
    select jsonb_build_object(
      'node_id', candidate.id,
      'title', candidate.title,
      'excerpt', candidate.excerpt,
      'revision', candidate.revision,
      'matched_channels', to_jsonb(fused.channels),
      'rank', row_number() over (order by fused.score desc, candidate.id)
    ) as hit
    from fused
    join candidates candidate on candidate.id = fused.id
    order by fused.score desc, candidate.id
    limit effective_limit
  ) ranked;

  return jsonb_build_object(
    'status', 'ok',
    'hits', coalesce(hits, '[]'::jsonb)
  );
end;
$$;

-- --------------------------------------------------------------------------
-- Keyword recall
-- --------------------------------------------------------------------------

-- 手动搜索框与 @候选用的关键词检索，与上面的相似召回是两种语义，故分开两个入口:
-- 搜索框期望「含这个词」，Explore 期望「意思相近」。此处沿用 `&@`（单关键词），
-- 与被它取代的 ilike 子串匹配行为对等，但换成索引扫描且中文按词切分。
-- 返回结构刻意与旧 ilike 路径完全一致（node_id + excerpt），使前端零改动。
create or replace function public.search_memos_keyword(
  p_user_id uuid,
  p_query_text text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  query_text text;
  effective_limit integer;
  hits jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  query_text := btrim(coalesce(p_query_text, ''));

  if query_text = '' then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'MEMO_SEARCH_QUERY_EMPTY'
    );
  end if;

  effective_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  select jsonb_agg(hit)
  into hits
  from (
    select jsonb_build_object(
      'node_id', matched.id,
      'excerpt', matched.excerpt
    ) as hit
    from (
      -- 标题命中与正文命中取并集；两路都直接打在各自的 PGroonga 索引表上
      select node.id, content.excerpt, node.updated_at
      from public.memo_nodes node
      join public.memos content
        on content.user_id = node.user_id
        and content.node_id = node.id
      where node.user_id = p_user_id
        and node.node_type = 'memo'
        and node.deleted_at is null
        and node.title operator(extensions.&@) query_text

      union

      select node.id, content.excerpt, node.updated_at
      from public.memos content
      join public.memo_nodes node
        on node.user_id = content.user_id
        and node.id = content.node_id
      where content.user_id = p_user_id
        and node.node_type = 'memo'
        and node.deleted_at is null
        and content.content_mdx operator(extensions.&@) query_text
    ) matched
    order by matched.updated_at desc, matched.id
    limit effective_limit
  ) ranked;

  return jsonb_build_object(
    'status', 'ok',
    'hits', coalesce(hits, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.search_memos_keyword(uuid, text, integer)
from public, anon, authenticated, service_role;

grant execute on function public.search_memos_keyword(uuid, text, integer)
to authenticated;

-- --------------------------------------------------------------------------
-- Grants
-- --------------------------------------------------------------------------

revoke all on function public.search_memos_hybrid(uuid, text, uuid, integer, uuid[])
from public, anon, authenticated, service_role;

grant execute on function public.search_memos_hybrid(uuid, text, uuid, integer, uuid[])
to authenticated;
