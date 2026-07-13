-- ============================================================================
-- 00-fix-known-bugs.sql
-- 历史 Bug 修复合集（来源：rebuild/02-全量Bug汇总与修复方案.md，A/B/C/D/F 类）
-- 用途：阶段 6（接入真实 Supabase）建库后一次性执行。
-- 注意：执行前请确认实际表结构与此文件中的引用一致；部分策略/类型需结合
--       当阶段 6 实际建表脚本调整（例如建表时直接采用 UUID 即可省去 ALTER）。
-- 执行顺序建议：先建表（阶段6主迁移），再跑本文件做 RLS/RPC 修正。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A-1：user_folder_sentences 表 RLS 升级为 JWT（auth.uid()）
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_select_folder_sentences" ON user_folder_sentences;
DROP POLICY IF EXISTS "anon_insert_folder_sentences" ON user_folder_sentences;
DROP POLICY IF EXISTS "anon_update_folder_sentences" ON user_folder_sentences;
DROP POLICY IF EXISTS "anon_delete_folder_sentences" ON user_folder_sentences;

CREATE POLICY "user_select_folder_sentences" ON user_folder_sentences
  FOR SELECT TO authenticated
  USING (folder_id IN (SELECT id FROM user_folders WHERE user_id = auth.uid()));
CREATE POLICY "user_insert_folder_sentences" ON user_folder_sentences
  FOR INSERT TO authenticated
  WITH CHECK (folder_id IN (SELECT id FROM user_folders WHERE user_id = auth.uid()));
CREATE POLICY "user_delete_folder_sentences" ON user_folder_sentences
  FOR DELETE TO authenticated
  USING (folder_id IN (SELECT id FROM user_folders WHERE user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- A-2：user_api_keys 建表脚本（若阶段6主迁移未包含则执行）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_api_keys (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'openai',
  key TEXT NOT NULL,
  base_url TEXT DEFAULT '',
  model TEXT DEFAULT 'gpt-4o',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON user_api_keys(user_id);
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select_api_keys" ON user_api_keys
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_insert_api_keys" ON user_api_keys
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_delete_api_keys" ON user_api_keys
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- A-3：user_sentence_bookmarks user_id 统一为 UUID（如主迁移已是 UUID 可跳过 ALTER）
-- ---------------------------------------------------------------------------
-- 阶段6主迁移建表时建议直接定义为 UUID，无需以下 ALTER：
--   CREATE TABLE IF NOT EXISTS user_sentence_bookmarks (
--     id BIGSERIAL PRIMARY KEY,
--     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--     sentence_id BIGINT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     UNIQUE(user_id, sentence_id)
--   );
-- （若已按 TEXT 创建，运行阶段6主迁移前先确保顺序，避免 TRUNCATE 丢数据）

-- ---------------------------------------------------------------------------
-- A-4：community_words INSERT 策略限制为 authenticated
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "auth_users_can_insert_community_words" ON community_words;
CREATE POLICY "auth_users_can_insert_community_words"
  ON community_words FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- A-5：create_default_folders RPC 参数改为 UUID
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_default_folders(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO user_folders (user_id, name, color, folder_type)
  VALUES (p_user_id, '我的单词', '#5B8C7E', 'word')
  ON CONFLICT DO NOTHING;
  INSERT INTO user_folders (user_id, name, color, folder_type)
  VALUES (p_user_id, '我的句子', '#C4993D', 'sentence')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- B-6：add_study_minutes RPC（打卡 study_minutes 原子累加）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_study_minutes(
  p_user_id UUID, p_date DATE, p_minutes INT
) RETURNS void AS $$
BEGIN
  INSERT INTO user_learning_progress (user_id, date, study_minutes)
  VALUES (p_user_id, p_date, p_minutes)
  ON CONFLICT (user_id, date)
  DO UPDATE SET study_minutes = user_learning_progress.study_minutes + p_minutes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- C-2：community_words 唯一索引/upsert 统一为 LOWER(word)
-- 说明：在建表迁移里应直接 `CREATE UNIQUE INDEX ... ON community_words (LOWER(word))`，
--       并让 upsert 使用 LOWER(word) 作为冲突列。此处给出应用层等价处理提醒：
--       在 src/lib/db/community.js 的 saveCommunityWord 中：
--         .upsert({ ...row, word: row.word.toLowerCase() }, { onConflict: 'word' })
--       （若唯一索引基于 LOWER，则 onConflict 列也应是表达式索引对应列，按实际索引调整）
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- B-4（可选）：允许 authenticated 用户刷新每日推荐（避免 anon 写入被 RLS 拒）
-- 二选一：用 Edge Function（推荐），或放开 RLS：
-- CREATE POLICY "authenticated_can_refresh_daily_picks"
--   ON daily_picks FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "authenticated_can_update_daily_picks"
--   ON daily_picks FOR UPDATE TO authenticated USING (true);
-- ---------------------------------------------------------------------------

-- ============================================================================
-- 以下为阶段6应用层需同步的代码修复（非 SQL，记录于此备忘）：
--   D-1/D-3：App 启动时处理 URL 中的 ?code= / token（Supabase PKCE + magic link）
--            调用 supabase.auth.exchangeCodeForSession(code) 后清除 URL 参数。
--   D-2：signUp 后若 session 为 null（邮箱未确认），展示「请查收邮件确认」提示。
--   F-1：ai-proxy 缓存加 Cache-Control / 比对 system_config.updated_at。
--   F-2：send-otp 按 Brevo HTTP 状态码返回分类错误。
--   F-3：send-reminder 校验 tasks 数组长度(≤20) 与字段完整性。
-- ============================================================================
