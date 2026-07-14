# 原研医疗内部获客系统部署说明

本文适用于 Windows 内部服务器或一台长期在线的公司电脑。当前默认使用模拟数据源，不依赖外部 API 额度。

## 1. 上线前检查

在 `web` 目录准备 `.env`，至少确认：

- `DATABASE_URL` 指向专用 PostgreSQL 数据库。
- `SESSION_SECRET` 是不少于 32 位的随机字符串。
- `SEED_ADMIN_PASSWORD` 与 `SEED_SALES_PASSWORD` 使用不同的强密码。
- `USE_MOCK_ADAPTERS="true"`，等真实数据源验收后再改为 `false`。
- `BACKUP_RETENTION_DAYS="14"`，或按公司要求调整。
- PostgreSQL 不在默认目录时，设置 `POSTGRES_BIN`，例如 `C:\Program Files\PostgreSQL\17\bin`。

不要把 `.env`、数据库备份或任何 API Key 提交到 Git。

## 2. 准备生产版本

```powershell
cd "D:\Codex\原研\web"
npm ci
npm run deploy:prepare
npm run prisma:seed
```

`prisma:seed` 用于首次创建或更新内部管理员、业务员和产品数据。密码来自 `.env`，不会写入源代码。

## 3. 启动网站

```powershell
npm run start -- --port 3000
```

生产启动会监听 `0.0.0.0`。本机访问：

```text
http://127.0.0.1:3000
```

同一局域网的同事可使用服务器的局域网 IP，例如：

```text
http://192.168.1.20:3000
```

只应在受信任的公司局域网开放 3000 端口。若需要互联网访问，不要直接暴露 3000 端口，应在前方配置 HTTPS 反向代理，并限制允许访问的人员或网络。

## 4. 健康检查

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

正常响应包含：

```json
{
  "status": "ok",
  "database": "ok",
  "providerMode": "mock"
}
```

健康检查不会返回数据库连接串、密码或外部服务密钥。

## 5. 数据库备份

手动备份：

```powershell
npm run db:backup
```

备份默认保存在 `web/backups`，文件名包含 UTC 时间。系统只会自动清理符合本项目命名规则且超过保留天数的旧备份。

建议使用 Windows 任务计划程序每天执行一次：

- 程序：`C:\Program Files\nodejs\npm.cmd`
- 参数：`run db:backup`
- 起始位置：`D:\Codex\原研\web`
- 频率：每天一次，安排在无人使用系统的时间。

备份目录应定期复制到另一块磁盘或受控的公司存储；只保存在同一台电脑上不能防止硬盘损坏。

## 6. 恢复数据库

恢复会覆盖当前数据库，必须先停止网站并再次备份当前数据。命令要求显式添加 `--confirm`：

```powershell
npm run db:restore -- ".\backups\yonye_leads_YYYYMMDD_HHMMSS.dump" --confirm
```

恢复后重新执行：

```powershell
npm run prisma:deploy
npm run start -- --port 3000
```

生产数据第一次恢复演练应在独立测试数据库中进行，不要直接用正式数据库试验。

## 7. 更新网站

先停止正在运行的网站进程，再执行：

```powershell
git pull
npm ci
npm run db:backup
npm run deploy:prepare
```

确认构建成功后重启网站，再检查 `/api/health`、登录、客户列表和客户编辑功能。

如果 Windows 提示 Prisma 的 `query_engine-windows.dll.node` 无法重命名，说明旧的 Next.js 进程仍在占用文件。请在任务管理器中确认并结束属于本项目的 `node.exe`，然后重新运行 `npm run deploy:prepare`；不要结束正在运行其他系统的 Node 进程。

## 8. 尚需外部条件的工作

以下项目需要服务器或网络信息后才能完成：

- 公司内部服务器或云服务器地址。
- 域名或内部访问域名。
- HTTPS 证书和反向代理配置。
- 防火墙允许范围和公司访问策略。
- Windows 服务账户或自动启动方式。

在这些信息确认前，本机生产构建和局域网测试不受影响。
