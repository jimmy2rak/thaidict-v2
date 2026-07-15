-- ============================================================================
-- 08-fix-dictionary-rls.sql
-- 修复 AI 词条审批入库无法写入 dictionary 基表的问题
-- ----------------------------------------------------------------------------
-- 背景：真实库 dictionary 表已启用 RLS，但未给 authenticated 角色配置
--       INSERT/UPDATE 策略。前端超管点击「批准入库」时，addDictionaryWord
--       被 RLS 拦截 401，toast 却显示「已批准入库」，词实际未进词典。
-- 操作：Supabase SQL Editor 执行（supabase CLI 在本机 darwin-arm64 损坏）。
-- 注意：本文件仅 DDL，不修改任何已有词数据。
-- ============================================================================

-- 确保 dictionary 表 RLS 已启用（幂等）
ALTER TABLE dictionary ENABLE ROW LEVEL SECURITY;

-- 允许已登录用户 INSERT/UPDATE dictionary（审批权限由应用层控制）
DROP POLICY IF EXISTS "authenticated_insert_dictionary" ON dictionary;
CREATE POLICY "authenticated_insert_dictionary" ON dictionary
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_dictionary" ON dictionary;
CREATE POLICY "authenticated_update_dictionary" ON dictionary
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
