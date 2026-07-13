# 原研医疗内部获客系统

本文供内部同事在 Windows 本机首次启动和验收系统使用。

> 当前状态（2026-07-13）：本机未检测到 PostgreSQL，也未检测到 Docker。请先安装 PostgreSQL；Docker 不是本说明的前置条件。由于当前缺少可用数据库，尚未完成真实 PostgreSQL 的端到端验收。首次验收请保留 `USE_MOCK_ADAPTERS="true"`，先检查网站流程，不调用真实外部数据服务。

## 首次启动前

需要准备：

- Node.js 20 或更高版本（安装后会同时提供 npm）。
- PostgreSQL，并记住安装时设置的 `postgres` 管理员密码和端口；下文按默认端口 `5432` 说明。
- 本项目文件夹。

### 1. 安装 PostgreSQL 并创建本地数据库

从 PostgreSQL 官方网站下载 Windows 安装程序并完成安装。安装完成后，打开 **SQL Shell (psql)**，按提示连接本机数据库；也可以在 PowerShell 中运行：

```powershell
psql -U postgres -h 127.0.0.1
```

输入安装 PostgreSQL 时设置的管理员密码，然后逐行执行：

```sql
CREATE USER yonye WITH PASSWORD 'YOUR_LOCAL_DB_PASSWORD';
CREATE DATABASE yonye_leads OWNER yonye;
\q
```

请把 `YOUR_LOCAL_DB_PASSWORD` 换成仅用于本机的数据库密码。建议只使用英文字母和数字；如果包含 `@`、`:`、`/` 等字符，需要先做 URL 编码。

### 2. 打开项目并准备配置

打开 PowerShell，进入项目目录：

```powershell
cd D:\Codex\原研\web
Copy-Item .env.example .env
notepad .env
```

在 `.env` 中填写本机配置。下面只有占位符，不是真实密钥：

```dotenv
DATABASE_URL="postgresql://yonye:YOUR_LOCAL_DB_PASSWORD@127.0.0.1:5432/yonye_leads"
SESSION_SECRET="YOUR_LONG_RANDOM_SESSION_SECRET"
PROSPEO_API_KEY=""
HUNTER_API_KEY=""
APIFY_API_KEY=""
CONTACTOUT_API_KEY=""
USE_MOCK_ADAPTERS="true"
```

- 必须替换 `YOUR_LOCAL_DB_PASSWORD` 和 `YOUR_LONG_RANDOM_SESSION_SECRET`；会话密钥应使用密码管理器生成的长随机字符串。
- 首次验收不要填写 API Key，也不要把任何真实 API Key、数据库密码或会话密钥发到聊天、截图或提交记录中。
- `USE_MOCK_ADAPTERS="true"` 表示首次验收使用模拟的外部数据。它不能替代 PostgreSQL，登录、任务和客户数据仍需写入本地数据库。
- 修改 `.env` 后如果网站已经在运行，请先停止再重新启动。

### 3. 安装、迁移并写入初始数据

仍在 `D:\Codex\原研\web` 目录中，依次运行：

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

这些命令分别用于安装依赖、生成数据库客户端、创建/更新数据库表，以及写入产品和本地测试账号。第一次迁移使用名称 `init`；以后数据库结构有更新时，可把名称换成能说明变更内容的英文短语。

### 4. 启动网站

```powershell
npm run dev
```

看到启动成功提示后，在浏览器打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。需要停止网站时，回到 PowerShell 按 `Ctrl+C`。

## 初始测试账号

- 管理员：`admin@cnyonye.local` / `123456`
- 业务员：`sales@cnyonye.local` / `123456`

这两个账号和密码只用于本机首次测试。当前页面没有自助改密功能；在多人使用、共享网络或长期运行前，必须请维护人员更换默认密码，不能继续使用 `123456`。

## 首次验收清单

保持 `USE_MOCK_ADAPTERS="true"`，按下面顺序人工检查：

1. 登录页可以打开，测试账号可以登录。
2. 新建任务页能选择原研产品、目标国家或地区、客户类型和开发信语言，并提示每次 5 家、每天最多 30 家。
3. 提交任务后能进入任务进度和结果页，查看市场调研、客户、联系人、证据、风险提示和开发信。
4. 客户库只显示已交付的 A/B 类客户；客户详情中可以维护备注和跟进状态。
5. 管理员可以打开管理页，查看任务质量、供应商调用记录和 API 配置状态。
6. 右上角退出后回到登录页。

以上是待执行的本地验收步骤，不代表本仓库已经完成真实 PostgreSQL 或真实外部供应商的端到端验收。

## 当前首版包含

- 管理员和业务员登录、角色权限及退出登录。
- 使用原研固定产品库创建获客任务，选择市场、客户类型和开发信语言。
- 每次 5 家、每名业务员每天最多 30 家的额度控制。
- 任务进度与结果展示，包括市场摘要、客户、联系人、来源证据、需求证据、风险提示和开发信。
- 已交付客户库，以及备注和跟进状态维护。
- 管理员质量指标、供应商调用记录和 API 配置状态。
- 用于首次流程验收的模拟外部数据。

## 当前首版不包含

- Gmail、Outlook 或其他邮箱的自动发信。
- Excel/Word 每日导出。
- 外部用户注册、付费、订阅或公开 SaaS 服务。
- 面向其他公司的通用获客平台。
- 本说明不承诺真实外部供应商的可用性、数据覆盖率或账户余额。

## 有效客户规则

- 每次任务目标交付 5 家有效客户；每名业务员每天最多获取 30 家。
- 只交付 A 类和 B 类客户，C 类及淘汰候选不进入客户库。
- 公司必须真实存在，与至少一个原研产品系列明确匹配，并有可追溯的业务或需求证据。
- 每家公司必须找到至少一名关键负责人或相关负责人，并有个人工作邮箱；只有公共邮箱或没有个人工作邮箱时必须淘汰并替换。
- `valid` 邮箱优先；`accept-all` 邮箱最多只能归为 B 类，并必须显示风险提示；`invalid` 邮箱不能作为有效联系方式。
- 不得编造公司、联系人、职位、邮箱、证据或验证结果。

## API 配置怎么看

管理页的“API 配置”只表示对应环境变量中是否填写了内容，不会验证 Key 是否正确，也不代表供应商账户还有余额。页面中的调用次数和积分来自系统已经记录的调用，同样不是供应商后台的实时余额；余额和套餐请到各供应商官方后台核对。

首次 mock 验收时 API Key 留空是正常情况。

## 不连接数据库也能做的检查

以下命令不会连接 PostgreSQL，可先确认本机 Node.js、npm 和 Prisma 客户端生成流程正常：

```powershell
node --version
npm --version
npm run prisma:generate
```

完整测试、类型检查和生产构建由维护人员统一执行：

```powershell
npm test
npm run typecheck
npm run build
```

## 常见错误

### 提示“无法识别 psql”

PostgreSQL 尚未安装，或安装目录没有加入系统 `PATH`。先确认能打开 **SQL Shell (psql)**；刚安装后请关闭并重新打开 PowerShell。

### 提示 `P1001` 或无法连接数据库

确认 PostgreSQL 服务正在运行，端口与 `DATABASE_URL` 一致，并检查地址是否为 `127.0.0.1`。修改后重新运行迁移命令。

### 提示 `P1000`、密码错误或权限不足

确认 `.env` 中的数据库用户名、密码与创建用户时一致，并确认 `yonye` 是 `yonye_leads` 数据库的所有者。不要把密码发给他人排查。

### 提示数据库不存在

回到“安装 PostgreSQL 并创建本地数据库”一节，先创建 `yonye_leads`，再运行迁移。

### 提示 `SESSION_SECRET is required`

`.env` 中缺少 `SESSION_SECRET`，或修改后没有重启网站。填写长随机字符串，保存文件并重启。

### 测试账号无法登录

确认迁移成功后运行过 `npm run prisma:seed`。seed 可以重复执行，不会重复创建相同账号和产品。

### 端口 3000 已被占用

先关闭占用该端口的旧网站；也可以临时改用 3001：

```powershell
npm run dev -- --port 3001
```

然后打开 [http://127.0.0.1:3001](http://127.0.0.1:3001)。

### PowerShell 不允许运行 `npm.ps1`

把命令中的 `npm` 临时换成 `npm.cmd`，例如 `npm.cmd install` 和 `npm.cmd run dev`。

### 管理页显示 API“未配置”或没有调用积分

首次 mock 验收时这是正常的。不要为了消除提示而随意填写真实 Key；API 配置状态和积分都不是账户余额。
