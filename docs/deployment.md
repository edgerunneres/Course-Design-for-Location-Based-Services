# 部署与演示说明

## 后端环境变量

| 变量 | 建议值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | Node 服务端口 |
| `HOST` | `127.0.0.1` 或 `0.0.0.0` | 监听地址 |
| `LBS_TOKEN_SECRET` | 随机长字符串 | Token 签名密钥 |
| `LBS_ADMIN_PASSWORD` | 强密码 | 维护人员初始密码 |
| `LBS_PUBLIC_RATE_LIMIT` | `120` | 公众 APIKEY 每分钟限制 |
| `LBS_FORCE_HTTPS` | `true` | 部署时强制 HTTPS |
| `LBS_DB_PATH` | `/data/lbs/db.json` | 持久化数据文件 |
| `LBS_HTTPS_CERT` | 证书路径 | Node 直接启 HTTPS 时使用 |
| `LBS_HTTPS_KEY` | 私钥路径 | Node 直接启 HTTPS 时使用 |

## 推荐部署流程：Docker + Caddy

项目已提供可直接使用的部署目录 `deploy/`。Caddy 会自动申请 HTTPS 证书，并把请求转发到 Node API 服务。

```bash
git clone https://gitee.com/lbs-252602/course-design---yu-peilin.git
cd course-design---yu-peilin/deploy
cp .env.example .env
```

编辑 `.env` 后启动：

```bash
docker compose up -d --build
```

验证：

```bash
curl https://你的API域名/api/v1/health
```

## 传统部署流程

1. 将 `heritage-lbs` 上传到服务器或 Gitee 仓库。
2. 在服务器安装 Node.js 18+。
3. 运行：

```bash
cd heritage-lbs
LBS_TOKEN_SECRET="replace-with-random-secret" \
LBS_ADMIN_PASSWORD="replace-with-strong-password" \
node server/server.js
```

4. 使用 Nginx、Caddy 或宝塔面板配置 HTTPS 反向代理。
5. 将域名配置到微信公众平台“开发管理 - 开发设置 - 服务器域名 - request 合法域名”。
6. 在小程序“我的”页将 API 地址改为 `https://你的域名/api/v1`。
