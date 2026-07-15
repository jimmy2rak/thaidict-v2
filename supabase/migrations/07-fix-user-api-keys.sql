-- ============================================================================
-- 07-fix-user-api-keys.sql
-- 已有库 user_api_keys 结构漂移修复（与 05/06/06b 同性质，需手动在 Supabase SQL Editor 执行）
--
-- 根因：本库是已有库，老系统建的 user_api_keys 结构 = (id, user_id, provider, api_key, model, created_at)
--       新代码（src/lib/db/api-keys.js / ApiKeysSection.jsx）期望 =
--       (id, user_id, name, provider, key, base_url, model, is_active, created_at)
--       —— 主迁移/00 里都是 CREATE TABLE IF NOT EXISTS，老表已存在被跳过，故缺失列 + 列名(api_key≠key)全未对齐。
--       表现：前端「AI API 密钥」保存报 400 "Could not find the 'base_url' column"，且保存走 key 列也会因列名不符失败。
--
-- 本脚本：补齐缺失列 + 把密钥列 api_key 重命名为 key（保留已有数据）+ 补 UPDATE 策略。
-- 纯幂等 DDL，不改动已有业务数据。
-- ============================================================================

-- 1) 补齐缺失列
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS base_url text DEFAULT '';
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2) 密钥列名对齐：老表用 api_key，新代码读写 key（保留已有数据）
DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name  = 'user_api_keys'
          AND column_name = 'api_key'
      )
     AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name  = 'user_api_keys'
          AND column_name = 'key'
      ) THEN
    ALTER TABLE user_api_keys RENAME COLUMN api_key TO key;
  END IF;
END $$;

-- 3) 补齐 UPDATE 策略：老表只有 SELECT/INSERT/DELETE，编辑密钥时 upsert 的 UPDATE 部分会被 RLS 拦截
DROP POLICY IF EXISTS "user_update_api_keys" ON user_api_keys;
CREATE POLICY "user_update_api_keys" ON user_api_keys
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4) 兜底：确保 RLS 开启（老表应已开启，这里幂等确认）
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
