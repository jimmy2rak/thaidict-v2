-- ============================================================================
-- 10-add-community-words-unique.sql
-- 用途：给已有库的 community_words.word 补唯一约束，与 dictionary 对齐，
--       防止社区贡献词出现重复 word（dictionary_full_ext 视图 UNION ALL 会因此重复）。
-- 背景：已有库（跑 02-sync-existing.sql 对齐）的 community_words 是旧系统建的表，
--       未对 word 建唯一约束，导致 saveCommunityWord 的 upsert onConflict:'word' 报
--       「no unique or exclusion constraint matching the ON CONFLICT specification」。
--       代码侧已改为「先查后 insert/update」不再依赖此约束；本迁移是额外的去重加固。
-- 执行：Supabase 控制台 → SQL Editor → 粘贴全选 → Run。纯 DDL，不增改业务数据
--       （仅可能删除同一 word 的旧重复行，保留 created_at 最新的一行）。
-- ============================================================================

-- 1) 去重：同一 word（大小写不敏感）仅保留 created_at 最新的一行
delete from community_words
 where ctid not in (
   select distinct on (lower(word)) ctid
   from community_words
   order by lower(word), created_at desc nulls last
 );

-- 2) 建唯一索引（幂等）
drop index if exists uniq_community_words_word;
create unique index uniq_community_words_word
  on community_words (lower(word));
