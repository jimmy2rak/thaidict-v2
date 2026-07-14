# 中泰词典 · Supabase 上线小白手册

> 目标：把你已经在 Supabase 里的词库（6 万+ 词）接到线上应用。
> 就算你**完全不懂 SQL**，照着下面"复制 → 粘贴 → 点按钮"也能做。
> 只需按顺序跑 **02 → 03 → 00** 三个文件，然后部署到 Vercel。

---

## 一、开始前，确认你手上有这些

| 序号 | 你需要的东西 | 怎么确认 |
|---|---|---|
| 1 | Supabase 账号，能打开你的项目 | 登录 supabase.com，左侧能看到项目 `zvemahqskgluhirzbcqu` |
| 2 | Vercel 账号（用来把网站发布到互联网） | 登录 vercel.com |
| 3 | 已推送到 GitHub 的代码仓库 | 仓库地址 `https://github.com/jimmy2rak/thaidict-v2` |
| 4 | 一个 `.env.local` 文件（7 个密钥） | 在你电脑的项目文件夹里，已经生成好了 |

> 如果第 4 项没有，先找 AI 帮你生成（密钥来自你之前在 Supabase / Brevo 后台拿到的那 7 个值）。

---

## 二、在 Supabase 里跑数据库脚本（按顺序：02 → 03 → 00）

### 2.0 先找到"跑脚本"的地方（只做一次）

1. 打开 [supabase.com](https://supabase.com) 并进入你的项目。
2. 看页面**最左边那一竖排图标**，找到 **`SQL Editor`**（图标像 `><` 或一个终端）。
3. 点进去后，点 **`New query`**（新建查询），会出现一个**空白的大输入框**——这就是你粘贴代码的地方。

> 之后每一步都是：新建一个 query 窗口 → 复制对应文件内容 → 粘贴 → 点 Run。

---

### 第 1 步：跑 `02-sync-existing.sql`（补表 + 开放查词权限）

1. 用编辑器打开本手册同目录下的文件：`migrations/02-sync-existing.sql`
   （完整路径：`supabase/migrations/02-sync-existing.sql`）
2. **全选**里面的全部内容（`Ctrl/Cmd + A` → `Ctrl/Cmd + C`）。
3. 粘贴到刚才的 SQL Editor 空白框里。
4. 点右上角的绿色 **`Run`** 按钮（▶ 形状）。
5. **怎么算成功**：
   - 下方结果区出现**绿色对勾 / 绿色 Success**，没有红色报错，就成功了。
   - 如果有零星黄色警告（warning）一般没关系，只要没有红色 Error 就行。

> 🧠 这一步在干嘛（人话版）：你的库里其实**缺了几张新表**（成就、角色、审批、日记、练习、单词书等），这个脚本把它们补上；再给已有表加几个新字段；最后开放"任何人都能查词"的权限。**它一个字的数据都不会删、不会改你的 6 万词。**

---

### 第 2 步：跑 `03-extend-dictionary-full.sql`（合并"用户新增的词"）

1. 在 SQL Editor 里再点一次 **`New query`**（新建一个窗口，别和上一个混在一起）。
2. 打开 `migrations/03-extend-dictionary-full.sql`，**全选复制** → 粘贴。
3. 点 **`Run`**。
4. **成功标志**：绿色对勾，无红色报错。

> 🧠 这一步在干嘛：建立一个"统一视图"。这样用户/AI 后来新增的词，也能和你的 6 万主词库一起被搜到、一起进词条详情。它是在原视图**外面再包一层**，随时可以删掉回退，不会碰你的原始数据。

---

### 第 3 步：跑 `00-fix-known-bugs.sql`（修已知问题 + 补函数）

1. 再点 **`New query`** 新建窗口。
2. 打开 `migrations/00-fix-known-bugs.sql`，**全选复制** → 粘贴。
3. 点 **`Run`**。
4. **成功标志**：绿色对勾，无红色报错。

> ⚠️ 这个文件里有些"修权限"的语句，我已经特意改成了**"先删旧的再建新的"**安全写法，所以你哪怕重复跑、哪怕库里已经有这些权限，也**不会报错中断**。

---

### 🚫 绝对不要跑 `01-create-schema.sql`！

- 这个文件是给**从零新建的空数据库**用的。
- 你的库**已经有数据**（6 万词 + 31 张表），跑它会因为"权限已存在"而报错、还可能把权限搞乱。
- **你只需要跑 02、03、00 这三个**，一个都不要多。

---

## 三、部署到 Vercel（让网站真正上线）

数据库搞定后，把网站发布出去。

### 方式一：网页点一点（最推荐小白）

1. 登录 [vercel.com](https://vercel.com) → 右上角 **`Add New`** → 选 **`Project`**。
2. 在列表里找到 GitHub 仓库 **`jimmy2rak/thaidict-v2`** → 点 **`Import`**。
3. 构建设置**什么都别改**（Next.js 会被自动识别）。
4. **先别急着 Deploy**，先把密钥配上：
   - 进入项目后，左侧点 **`Settings`** → **`Environment Variables`**。
   - 点 **`Import from .env`** 按钮 → 选你电脑项目里的 `.env.local` 文件上传（7 个变量一次性进去了）。
   - 万一没有这个按钮，就手动一条条 `Add` 粘贴（变量名和值照抄 `.env.local` 里的 7 行）。
5. 回到项目首页点 **`Deploy`**。
6. 等 **1~2 分钟**，出现 **✅ Ready**，点那个预览网址就能用了。

### 方式二：命令行（如果你装了 Vercel CLI）

```bash
vercel env import .env.local   # 把 7 个密钥导入 Vercel
vercel --prod                  # 发布到生产环境
```

---

## 四、上线后自查清单（勾完就大功告成）

- [ ] 首页搜索框能搜词，点结果能进**词条详情**
- [ ] 用户/AI **新增的词**也能被搜到
- [ ] 注册/登录的**邮箱验证码**能收到（来自 Brevo 发的邮件）
- [ ] 学习中心**打卡、调整计划**能保存、刷新后还在

---

## 五、小白排错锦囊

**Q1：跑脚本时下方出现红色报错，怎么办？**
- 先看报错文字里有没有 `already exists`（已存在）。这通常是你重复跑了脚本，没关系——**重跑一遍 02 → 03 → 00** 即可（这三个都设计成能重复跑，不会冲突）。
- 如果报错是 `permission denied` 或别的看不懂的，把红色文字整段截图发给 AI。

**Q2：网站能打开，但搜不到词？**
- 去 Supabase 左侧 **`Table Editor`**，看有没有一个带"👁 小眼睛图标"的表叫 `dictionary_full`——它应该在（那是你的词库视图）。
- 再去 Vercel 的 **`Settings → Environment Variables`** 确认有 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 这两条，且值没贴错。

**Q3：收不到验证码邮件？**
- 确认 Vercel 环境变量里有 Brevo 三项：`BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME`。
- 确认发信邮箱 `noreply@thaidict.182183.xyz` 已经在 Brevo 后台验证过。

**Q4：我想回退、怕改坏了？**
- 这三个脚本都不会删你的词。`03` 建的是个"外面包的视图"，不想用就 `DROP VIEW dictionary_full_ext;` 即可，原始 `dictionary_full` 毫发无损。

---

## 附：三个文件一句话总结

| 文件 | 作用 | 能不能重复跑 |
|---|---|---|
| `02-sync-existing.sql` | 补缺失表 + 开放查词权限 | ✅ 能（全用 IF NOT EXISTS） |
| `03-extend-dictionary-full.sql` | 合并用户新增词到统一视图 | ✅ 能（CREATE OR REPLACE） |
| `00-fix-known-bugs.sql` | 修权限/补函数 | ✅ 能（已改安全写法） |
| `01-create-schema.sql` | ❌ 仅限全新空库，**别跑** | — |
