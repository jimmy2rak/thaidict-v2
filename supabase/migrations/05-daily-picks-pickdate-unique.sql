-- ============================================================================
-- Issue 4 根因修复：每日推荐 daily_picks.pick_date 唯一约束
-- ----------------------------------------------------------------------------
-- 现象：首页「每日一词」每天刷新都变，且数据库里 daily_picks 始终没有真实写入。
-- 根因：Python 自动化脚本用 upsert(row, on_conflict="pick_date") 写入每日推荐，
--       但 daily_picks 表缺少 pick_date 上的唯一约束，PostgREST 执行 upsert 时
--       报 "there is no unique or exclusion constraint matching the ON CONFLICT
--       specification" 而失败，脚本捕获错误后 return False → 从未写入任何行。
--       → 前端 loadDailyPick 读不到今日推荐 → 每次回退随机取词 → 刷新就变。
-- 修复：补上 pick_date 唯一索引，脚本即可按日期正确去重写入；
--       同时脚本侧改为「先查再 update/insert」的稳健写法（见 scripts/daily_pick.py）。
-- 幂等：空表 + IF NOT EXISTS，对已有 6 万词库安全。
-- ============================================================================

create unique index if not exists daily_picks_pick_date_key
  on daily_picks (pick_date);
