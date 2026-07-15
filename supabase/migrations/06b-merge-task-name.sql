-- ============================================================================
-- 06b - 合并 user_checkin_tasks 的 name / task_name（修复创建任务 400）
-- ----------------------------------------------------------------------------
-- 现象：新建打卡任务报 400，后端提示
--   `null value in column "task_name" of relation "user_checkin_tasks"
--    violates not-null constraint`
-- 根因：老项目真实表的主名称列是 `task_name`（NOT NULL），而 06 误加了一个
--   空的 `name` 列。代码按新结构写 `name`，导致老 `task_name` 仍为 NULL → 报错。
-- 处理：把数据并回 `name` 并删除老 `task_name`，使代码期望的 `name` 成为真正列。
-- 幂等：无论用户是否已跑过 06（即是否存在多余的 name 列）都能安全执行。
-- 执行：Supabase 控制台 → SQL Editor → 粘贴 → Run。
-- ============================================================================

DO $$
BEGIN
  -- 情况 A：老 task_name 与 06 误加的 name 同时存在 → 合并后删老列
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_checkin_tasks' AND column_name='task_name')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_checkin_tasks' AND column_name='name') THEN
    UPDATE user_checkin_tasks SET name = task_name WHERE name IS NULL OR name = '';
    ALTER TABLE user_checkin_tasks DROP COLUMN task_name;

  -- 情况 B：只有老 task_name（未跑过 06）→ 直接重命名
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_checkin_tasks' AND column_name='task_name')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_checkin_tasks' AND column_name='name') THEN
    ALTER TABLE user_checkin_tasks RENAME COLUMN task_name TO name;
  END IF;
END $$;

-- 确保 name 为 NOT NULL（对齐新代码 + 老数据已并入）
ALTER TABLE user_checkin_tasks ALTER COLUMN name SET NOT NULL;

-- 06 已加的 plan_days 保留（代码写入 plan_days）；老 schedule_days/is_custom/updated_at
-- 为可空遗留列，代码不写它们，保持原样即可。
-- ============================================================================
