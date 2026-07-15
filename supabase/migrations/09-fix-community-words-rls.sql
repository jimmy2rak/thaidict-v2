-- 修复 community_words 审批入库时 authenticated 用户无法 upsert 的问题。
-- 已有 INSERT 策略，但缺少 UPDATE 策略；upsert 在记录已存在时会走 UPDATE 分支并被 RLS 拦截。
-- 本迁移为 community_words 补充 UPDATE 策略，并对 INSERT 策略做幂等重建。

ALTER TABLE community_words ENABLE ROW LEVEL SECURITY;

-- INSERT：已登录用户均可写入
DROP POLICY IF EXISTS "auth_users_can_insert_community_words" ON community_words;
CREATE POLICY "auth_users_can_insert_community_words"
  ON community_words FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE：已登录用户均可更新（用于审批时的 upsert 覆盖）
DROP POLICY IF EXISTS "auth_users_can_update_community_words" ON community_words;
CREATE POLICY "auth_users_can_update_community_words"
  ON community_words FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- SELECT：已登录用户可查看（匿名也能查，由应用决定）
DROP POLICY IF EXISTS "auth_users_can_select_community_words" ON community_words;
CREATE POLICY "auth_users_can_select_community_words"
  ON community_words FOR SELECT TO authenticated
  USING (true);
