# 中泰词典 ThaiDict · 开发待办清单（TODO）

> 这份文档写给「未来的自己」和「完全不懂代码的小白」看。
> 只要照着做，就能知道：这个项目是什么、现在做到哪一步了、接下来要做什么、怎么运行它。
> 最后更新时间：2026-07-13

---

## 一、一句话说明这个项目是什么

这是一个**中泰双语词典网页应用**（中文 ↔ 泰语）。
技术栈为 **Next.js 14（App Router）+ React 18**（2026-07-13 已从 Vite 迁移到 Next.js）。
用户可以：查词、看例句、听发音、收藏单词、写学习日记、做练习、看学习统计、AI 智能查词等。

- 现在处于「**本地开发阶段**」：所有数据都是**假数据（mock 模拟数据）**，存在浏览器里，方便一个人先把功能全部做完。
- 等功能全部做好、测试没问题后，再一次性接入真正的云端数据库（Supabase）并上线。

---

## 二、怎么运行这个项目（小白必看）

### 方法 A：最简单 —— 双击启动（推荐）
1. 打开项目文件夹 `/Users/jimmywang/多媒体/开发者/thaidict`。
2. 找到文件 **`启动中泰词典.command`**，**双击它**。
3. 会弹出一个黑色终端窗口，自动安装依赖（首次）、启动服务、并自动打开浏览器。
4. 浏览器出现 `http://localhost:3000` 的页面，就说明成功了。

> 想关闭：回到那个黑色窗口，按键盘 `Control + C`，或者直接关掉窗口。

> 如果双击提示「无法打开，因为它来自身份不明的开发者」：
> 右键点该文件 → 选「打开」→ 再点「打开」，之后就能双击了。

### 方法 B：命令行手动启动（给会用终端的人）
```bash
cd /Users/jimmywang/多媒体/开发者/thaidict
npm install     # 只有第一次需要
npm run dev     # 启动开发服务器，访问 http://localhost:3000
```

### 常见问题
- **「http://localhost:3000 打不开」**：99% 是因为**开发服务器没在运行**。双击 `启动中泰词典.command` 即可。
- **改了代码看不到变化**：浏览器刷新一下（Cmd+R）；页面通常会自动热更新。
- **端口被占用**：启动脚本会自动关掉占用 3000 端口的旧进程，一般无需手动处理。

---

## 三、项目现在做到哪一步了（进度总览）

| 阶段 | 内容 | 状态 |
|------|------|------|
| 阶段 1 | 项目初始化（Vite + React + 目录结构 + mock 数据层） | ✅ 已完成 |
| 阶段 2 | 登录/注册页、主框架（4 个标签页 + 页面切换） | ✅ 已完成 |
| 阶段 3 | 核心页面 + 9 项功能（词典/单词本/学习/我的 全部页面） | ✅ 已完成 |
| 阶段 3.5 | 两轮新需求迭代（共 10 项，见下方明细） | ✅ 已完成 |
| 阶段 3.6 | **从 Vite 迁移到 Next.js 14（App Router）**：入口改 `app/`（layout/page/AppShell，ssr:false 客户端渲染）；`src/pages`→`src/screens` 避免被 Pages Router 误当路由；`supabase.js` 改 `NEXT_PUBLIC_*`；生产构建通过 | ✅ 已完成 |
| 阶段 4 | Bug 逐项核对（A~G 类历史 Bug 是否已规避） | ✅ 已完成 |
| 阶段 5 | 整体自测 + 打磨（交互细节、样式统一） | ✅ 已完成 |
| 阶段 6 | 接入真实 Supabase + 部署上线（Vercel） | ⏳ 待办 |

---

## 四、已经完成的功能明细（✅）

### 核心页面（4 个标签页）
- ✅ **词典页 HomePage**：搜索框、搜索结果、每日一词、单词详情。
- ✅ **单词本页 WordBookPage**：最近浏览 / 单词夹 / 句子夹 / 单词书 4 个 Tab。
- ✅ **学习页 LearnPage**：每日打卡任务 + 各种学习工具入口。
- ✅ **我的页 ProfilePage**：设置、API 密钥、WebDAV、提醒、成就、管理后台等。

### 9 项功能（阶段 3）
- ✅ 3.1 WebDAV 云备份（密码加密后存本地，模拟上传）
- ✅ 3.2 学习日记（列表 / 编辑 / 详情）
- ✅ 3.3 短语库（词组浏览 + 详情）
- ✅ 3.4 构词法（词根词缀讲解）
- ✅ 3.5 学习统计（柱状图 / 热力图 / 饼图，用 recharts）
- ✅ 3.6 练习测验（题库答题）
- ✅ 3.7 学习提醒（定时提醒设置）
- ✅ 3.8 单词书/句子夹管理
- ✅ 3.9 用户笔记（每个词条可写笔记）

### 第一轮 5 项新需求
- ✅ 字体设置：中文字体（Noto Sans SC / Noto Serif SC）+ 泰语字体（Sarabun / Noto Sans Thai / Charm），可切换并持久保存。
- ✅ 「我的」页面每个菜单项下方加了说明小字。
- ✅ 三种权限组：超级管理员 / 管理员 / 普通用户（超管仅能在数据库手动设置）。
- ✅ AI 生成词条审批工作流：AI 查出来的词先进「待审批」，管理员批准后才进入词库。
- ✅ 收藏弹层修复：点收藏星标会弹出选择/新建单词夹的菜单。

### 第二轮 5 项新需求
- ✅ 单词夹「x 词 / x 句」计数不再恒为 0，与实际条目同步。
- ✅ 「我的」页面可上下滚动；WebDAV 增加「一键上传 / 一键导出」按钮（可选学习日记/笔记/统计）。
- ✅ 搜索无结果时，末尾出现「未找到词语？AI 搜索」按钮；AI 结果经审批后自动入主词典。
- ✅ 词条详情左上角左右箭头改为真实可用（原来是摆设）。
- ✅ 词条详情增强：每个例句加朗读按钮；一词多义加序号；近反义词/学习建议词后加中文括号注释。

---

## 五、接下来要做什么（⏳ 待办，按优先级）

### 阶段 4：Bug 逐项核对（✅ 已完成，2026-07-13）

目标：把历史遗留的 A~G 类 Bug 逐条对照现有代码，确认是否都已规避。
核对方法：实际打开 `rebuild/02-全量Bug汇总与修复方案.md` 并比对当前 `src/lib/db/*`、`src/context/AppContext.jsx`、`app/layout.jsx`、`src/index.css`。

**状态总表**（✅ 已规避 / 🟡 部分 / ⏸ 推迟到阶段6真实库）

| Bug | 类别 | 状态 | 当前代码位置 / 说明 |
|-----|------|------|---------------------|
| A-1 | RLS anon 策略 | ⏸ | `user_folder_sentences` 表 RLS，真实库才出现；SQL 见 `supabase/migrations/00-fix-known-bugs.sql` |
| A-2 | user_api_keys 无建表脚本 | ⏸ | 阶段6建库时一并执行迁移 SQL |
| A-3 | user_sentence_bookmarks user_id 类型 | ⏸ | 迁移脚本顺序问题，阶段6执行时修正 |
| A-4 | community_words INSERT 对 anon 开放 | ⏸ | 阶段6 RLS 修正 |
| A-5 | create_default_folders 参数 TEXT | ⏸ | 阶段6 RPC 修正 |
| B-1 | recordWordLookup 不递增 | ✅ | `src/lib/db/recent.js` 已先 update 再 insert |
| B-2 | handleWordTap 并发竞态 | ✅ | `src/context/AppContext.jsx` 已有 `pendingLookups` in-flight 守卫 |
| B-3 | getDictionaryCount 查错表 | ✅ | `src/lib/db/search.js` 已查 `dictionary_full` |
| B-4 | refreshDailyPick anon 写入失败 | ⏸ | 真实库 RLS 问题，阶段6用 Edge Function 或加策略 |
| B-5 | saveUserSettings 读改写竞态 | ✅ | `src/lib/db/settings.js` 已改数据库层合并 upsert |
| B-6 | 打卡 study_minutes 竞态 | ✅ | `src/lib/db/checkin.js` 已原子累加（real 走 `add_study_minutes` RPC） |
| C-1 | daily_picks 文本引用悬空 | ⏸ | 设计权衡，阶段6加 fallback 重生成 |
| C-2 | community_words LOWER 索引不一致 | ⏸ | 阶段6 upsert 统一 LOWER |
| C-3 | user_settings user_id TEXT | ⏸ | 阶段6建表直接用 UUID |
| C-4 | getFolders count 解析依赖版本 | ✅ | `src/lib/db/folders.js` 已做防御性解析 |
| D-1 | OAuth 回调 /auth/callback 无处理 | ⏸ | 阶段6接 Supabase OAuth 时加 PKCE code 交换 |
| D-2 | signUp 不自动登录无提示 | ⏸ | 阶段6处理邮箱确认 UI |
| D-3 | magic link redirectTo 无处理 | ⏸ | 同 D-1，阶段6统一处理 token |
| E-1 | iOS 动态视口高度抖动 | ✅ | `src/index.css` `#root` 已用 `100dvh`（回退 `100vh`） |
| E-2 | user-scalable=no 无障碍 | ✅ | `app/layout.jsx` 已移除 `maximumScale`/`user-scalable`；改用 `.no-select` + `touch-action:manipulation` |
| F-1 | ai-proxy 缓存无失效 | ⏸ | 阶段6 Edge Function 加 Cache-Control / updated_at 比对 |
| F-2 | send-otp Brevo 错误未分类 | ⏸ | 阶段6 Edge Function 按 HTTP 状态码区分 |
| F-3 | send-reminder tasks 无验证 | ⏸ | 阶段6 Edge Function 加输入校验 |
| G-1 | supabase.js 1923 行单文件 | ✅ | 已拆为 `src/lib/supabase.js`(17行) + `src/lib/db/*` 模块 |
| G-2 | ProfilePage 897 行 | ✅ | 已拆为 `src/screens/ProfilePage.jsx`(94行) + `subsections/*` |
| G-3 | 无错误日志收集 | 🟡 | mock 阶段暂不强求；建议阶段6接轻量错误上报（Sentry 或 error_logs 表） |
| G-4 | thaiSegment 词典无版本控制 | 🟡 | 轻微；可在 `dictionary_full` 加 `updated_at`，加载时比对 |

> **结论**：当前 mock 阶段可复现的前端 Bug（B-1/B-2/B-3/B-5/B-6、C-4、E-1/E-2、G-1/G-2）**已全部规避**。
> 剩余的 ⏸ 项均为"接入真实 Supabase（阶段6）才会出现"的数据库/RLS/Edge Function 问题，
> 文档 `rebuild/02-全量Bug汇总与修复方案.md` 已给出每条的完整修复 SQL/代码，
> 并已固化到 `supabase/migrations/00-fix-known-bugs.sql`，阶段6建库时一次性执行即可。

### 阶段 5：整体自测 + 打磨（视觉风格大改，✅ 已完成）
- [x] 4 个标签页逐页点一遍，确认没有白屏 / 报错。
- [x] 登录 → 查词 → 收藏 → 写日记 → 看统计 全流程走通。
- [x] **视觉风格改造（新中式奶油轻泰式复古极简风）**：
  - 整体低饱和奶油米白色底色，柔和莫兰迪浅金 / 浅豆绿 / 灰褐色点缀，大面积留白。
  - 全页面超大圆角卡片分区，轻微柔和浅灰软阴影；哑光柔和质感，无浓烈色彩。
  - 线性细描边图标；泰式佛塔、粽叶、碗盏极简线条装饰元素点缀。
  - 按钮区分：实线描边主按钮 / 虚线描边次要操作按钮。
  - 氛围素雅治愈、安静书香学习感；手机竖屏界面，干净清爽极简 UI。
  - 落地方式：先在 `src/index.css` 建立新设计令牌（CSS 变量：底色/文字/主色/圆角/阴影/描边），
    再统一改造 `UIComponents` 的卡片/按钮/标题，并给首页 App 外壳加入线描装饰；其余页面随令牌自动换肤。
- [x] （已舍弃）移动端窄屏下布局正常 —— 项目本就是移动端竖屏优先，此项无需单独核查。

> 完成结论：已重新建立 `src/index.css` 莫兰迪奶油设计令牌，更新 `Card`/`Btn`/`IconButton` 等通用组件，
> 首页加入佛塔/粽叶/碗盏线描装饰，并统一替换源码中残留的旧色值（`#5B8C7E`/`#C4993D`/`#C45B5B`/`#5B7E9E`/`#D4934D`/`#8B7355`）。
> `npm run build` 通过；headless（Edge 内核）3 轮冒烟 0 JS 错误 / 0 HTTP 失败；已截图核对首页/搜索/单词本/学习/我的/短语库风格一致。

### 阶段 6：接入真实 Supabase + 上线
- [ ] 在 Supabase 建库，创建所有数据表（重点：`user_roles`、`pending_approvals` 是新表）。
- [ ] **先执行 `supabase/migrations/00-fix-known-bugs.sql`**（含 A 类 RLS 修正、C-2 LOWER 索引、B-6 的 `add_study_minutes` RPC 等历史 Bug 修复，来自 `rebuild/02-全量Bug汇总与修复方案.md`）。
- [ ] 配置环境变量 `.env.local`：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`。
      （代码会自动检测：有这两个变量就用真实数据库，没有就用 mock，页面**零改动**。）
- [ ] 用 Next Route Handlers 实现 4 个后端接口（对应原 Edge Function）：
      `app/api/ai-proxy`、`app/api/send-otp`、`app/api/verify-otp`、`app/api/send-reminder`。
- [ ] 审批中心批准逻辑接入「腾讯翻译君 API」做校验（预留接入点在 `ApprovalCenterSection` 的 `onApprove`）。
- [ ] 部署到 Vercel（目标域名 thaidict.vercel.app），配置 GitHub 自动部署。

---

## 六、已知问题 / 待确认（发现新问题写这里）

> 阶段 4 核对结论：当前 mock（本地）阶段**无新增已知缺陷**，历史上 A~G 类 Bug 中可在前端复现的均已规避。
> 以下为**推迟到阶段 6（接入真实 Supabase）才需处理**的已知项，修复方案已就绪。

- **[阶段6] A 类 RLS/建表**：`user_folder_sentences` 等表策略、缺 `user_api_keys` 建表脚本、类型不一致 → 执行 `supabase/migrations/00-fix-known-bugs.sql`。
- **[阶段6] B-4**：`refreshDailyPick` 用 anon key 写 `daily_picks` 会被 RLS 拒 → 改用 Edge Function 或加 authenticated 策略。
- **[阶段6] C-1/C-2/C-3**：`daily_picks` 文本引用、community_words LOWER 索引、user_settings 类型 → 阶段6 建表/迁移时统一修正。
- **[阶段6] D 类 OAuth**：`/auth/callback` PKCE code 交换、注册邮箱确认提示、magic link token 处理 → 阶段6 接 Supabase Auth 时统一加。
- **[阶段6] F 类 Edge Function**：ai-proxy 缓存失效、send-otp 错误分类、send-reminder 输入校验 → 实现 `app/api/*` Route Handlers 时一并处理。
- **[建议阶段6] G-3**：加轻量错误日志收集（Sentry 或 `error_logs` 表）。
- **[轻微] G-4**：`thaiSegment` 分词词典加载加版本号，避免词典更新后需手动刷新。

---

## 七、重要提醒（不要踩的坑）
1. **项目路径包含中文「开发者」**，写文件/命令时务必核对，别误写成「developer」。
2. 现在**没有连接远程 git 仓库**，只在本地 commit；等阶段 6 上线时再加 remote 并 push。
3. 所有页面只依赖 `src/lib/db/*`，**不要**在页面里直接写数据库逻辑，方便日后无痛切换真实数据库。
4. 开发服务器端口固定 **3000**（`next dev` 默认端口）。
