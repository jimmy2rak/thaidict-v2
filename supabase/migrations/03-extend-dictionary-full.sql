-- ============================================================================
-- 03-extend-dictionary-full.sql
-- 用途：把「用户新增的词」并入 dictionary_full 视图的映射，使前端只查 dictionary_full
--       就能同时拿到：主词典词（dictionary）+ 词频（word_freqs）+ 来源（word_sources）
--       + 用户/AI 新增词（community_words 等）。
--
-- ⚠️ 安全铁律：
--   1. 本脚本【绝不 DROP / 重建】字典_full 的既有定义，只在其末尾追加 UNION ALL。
--   2. 必须先拿到你真实库里 dictionary_full 的视图定义（见下方 §0），用其原 defin
--      替换下面的 <EXISTING_VIEWDEF> 占位，才能执行——否则列数/列序不对会直接报错。
--   3. 执行前请先在 Supabase SQL Editor 里跑 §0 的查询，把结果贴给我，由我定稿本文件。
--
-- 适用场景：你希望"用户添加的词语"也走 dictionary_full 统一映射、前端单一入口读取。
-- 若暂不并入视图，也可保持现状：search.js 仍单独查 community_words 并在前端合并去重。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- §0 先在你真实库执行下面 3 条查询，把结果贴回来（用于定稿 UNION 投影）
-- ----------------------------------------------------------------------------
-- 0.1 dictionary_full 的列清单（顺序很重要，UNION 必须一一对应）
select ordinal_position, column_name, data_type
from information_schema.columns
where table_name = 'dictionary_full'
order by ordinal_position;

-- 0.2 dictionary_full 的当前视图定义（CREATE OR REPLACE 时原样保留其 SELECT 部分）
select pg_get_viewdef('dictionary_full'::regclass, true) as view_def;

-- 0.3 用户新增词来源表（通常是 community_words）的列清单
select ordinal_position, column_name, data_type
from information_schema.columns
where table_name = 'community_words'
order by ordinal_position;

-- ----------------------------------------------------------------------------
-- §1 定稿后的视图（模板，需你贴回 §0 结果后由我补全占位）
-- ----------------------------------------------------------------------------
-- 结构示意（不要直接执行，等定稿）：
--
-- create or replace view dictionary_full as
--   <EXISTING_VIEWDEF>          -- §0.2 的完整 SELECT（保留 freq/source 映射，不动）
-- union all
-- select
--   c.word,                     -- 与 dictionary_full 第 1 列同类型
--   ''::text as romanization,   -- 用户词若无拼音填空
--   c.senses,                   -- jsonb
--   '{}'::text[] as synonyms,
--   '{}'::text[] as antonyms,
--   '[]'::jsonb as learner_associations,
--   coalesce(jsonb_array_length(c.senses),0)::int as sense_count,
--   'enriched'::text as enrichment_status,
--   0::int as freq_ttc,
--   'community'::text as source
--   -- ⚠️ 其余字典_full 列必须按 §0.1 的顺序/类型逐个补齐（NULL 或默认值），
--   --    列数、列序、类型与字典_full 完全一致，UNION 才能成功。
-- from community_words c
-- where c.status = 'approved';   -- 仅并入已通过审批的用户词；按需改成不过滤
--
-- 注意：
--   * 若 community_words 没有 status 列，去掉 where 条件即可。
--   * 若只想把"已审批"的词并入主检索，加 where；若希望"待审"也可见，去掉 where。
--   * 用户句子不进本视图（词/句结构不同）。句子走 sentences 表，
--     用户新增句子由 sentences.js 在查询层 UNION 对应表（见 DATABASE_MAPPING.md §3.4）。
-- ============================================================================
