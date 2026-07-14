-- ============================================================================
-- 03-extend-dictionary-full.sql
-- 用途：把「用户新增的词(community_words)」并入统一的词典读取视图，使前端只查
--       dictionary_full_ext 就能同时拿到：
--         主词典词（dictionary_full 视图，已含 freq/source/user_sentence_count 映射）
--       + 用户/AI 新增词（community_words）
--
-- 安全铁律（基于你真实库结构，已用 §0 三查结果定稿）：
--   1. 绝不 DROP / 重建已有的 dictionary_full 视图，只在它之上包一层新视图
--      dictionary_full_ext = dictionary_full UNION ALL community_words。可随时回退。
--   2. dictionary_full 是【视图】，PostgreSQL 不允许对视图启用 RLS，故本脚本
--      不对其建 policy，只靠底层基表（dictionary / community_words 等）的
--      anon 可读策略 + 显式 grant select 让视图可被前端 anon key 读取。
--   3. 类型对齐（你提供的列清单/视图定义）：
--      - dictionary_full.id = bigint，community_words.id = uuid
--        → 两路 id 统一 cast 成 text，社区词加 'cw_' 前缀防与主表 id 冲突。
--      - dictionary_full.synonyms / antonyms = text[]（ARRAY）；
--        community_words.synonyms / antonyms = jsonb
--        → 社区词侧用 jsonb_array_elements 转 text[]，兼容字符串数组与 {word} 对象数组。
--   4. community_words 真实列：id(uuid) word romanization senses(jsonb)
--      synonyms(jsonb) antonyms(jsonb) learner_associations(jsonb)
--      submitted_by(uuid) source(text) zh_hint(text) created_at。
--      ⚠️ 真实表【没有 status 列】，故不做 status 过滤（全部并入）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- §1 统一视图（superset）
-- ----------------------------------------------------------------------------
create or replace view dictionary_full_ext as

  -- ① 主词典（来自 dictionary_full 视图，已含词频/来源/用户句数映射）
  select
    id::text,
    word,
    romanization,
    romanization_source,
    senses,
    sense_count,
    synonyms,
    antonyms,
    learner_associations,
    enrichment_status,
    origin,
    sources,
    freq_tnc,
    freq_ttc,
    freq_phupha,
    user_sentence_count
  from dictionary_full

  union all

  -- ② 用户 / AI 新增词（community_words，真实列结构见文件头）
  select
    ('cw_' || cw.id::text)::text,                       -- uuid → text，加前缀防冲突
    cw.word,
    cw.romanization,                                    -- 真实表有此列
    null::text,                                         -- community_words 无 romanization_source
    cw.senses,                                          -- jsonb
    coalesce(jsonb_array_length(cw.senses), 0)::int,    -- sense_count
    coalesce(                                           -- synonyms：jsonb → text[]
      ( select array_agg(coalesce(v->>'word', v#>>'{}'))
        from jsonb_array_elements(cw.synonyms) v ),
      '{}'::text[]
    ),
    coalesce(                                           -- antonyms：jsonb → text[]
      ( select array_agg(coalesce(v->>'word', v#>>'{}'))
        from jsonb_array_elements(cw.antonyms) v ),
      '{}'::text[]
    ),
    cw.learner_associations,                            -- jsonb
    'community'::text,                                  -- enrichment_status
    coalesce(cw.source, 'community')::text,             -- origin（真实表有 source 列）
    '{}'::text[],                                       -- sources（社区词暂无来源映射）
    null::bigint,                                       -- freq_tnc
    null::bigint,                                       -- freq_ttc
    null::bigint,                                       -- freq_phupha
    0::bigint                                           -- user_sentence_count
  from community_words cw;

-- 让前端 anon / authenticated key 可读该视图
-- （视图继承底层基表 RLS；这里授予视图级 SELECT 权限）
grant select on dictionary_full_ext to anon, authenticated;

-- ----------------------------------------------------------------------------
-- §2 中文模糊搜索 RPC 改查统一视图（CREATE OR REPLACE 幂等）
--    这样 search_words_zh 也能命中用户新增词。
-- ----------------------------------------------------------------------------
create or replace function search_words_zh(search_term text, max_results int default 20)
returns setof dictionary_full_ext language sql stable security invoker as $$
  select *
  from dictionary_full_ext
  where word ilike '%' || search_term || '%'
     or exists (
       select 1 from jsonb_array_elements(senses) s
       where s->>'meaning' ilike '%' || search_term || '%'
     )
  order by (word = search_term) desc, word
  limit max_results;
$$;

-- ----------------------------------------------------------------------------
-- §3 说明
--   - 用户【句子】不进本词视图（词/句结构不同）。句子走 sentences 表，用户新增句子
--     由 sentences.js 在查询层 UNION user_sentences（见 DATABASE_MAPPING.md §3.4），
--     与 dictionary_full 里已算好的 user_sentence_count 互补，不冲突。
--   - search.js 已优先读 dictionary_full_ext，视图未创建时自动回退到
--     dictionary_full + community_words 双查询，部署无需强制先跑本文件。
-- ============================================================================
