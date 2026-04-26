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

## 推荐部署流程

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

## 微信小程序协作事项

你需要自己完成以下申请/注册步骤：

1. 注册微信小程序账号，拿到 AppID。
2. 安装微信开发者工具，导入 `miniprogram` 目录。
3. 本地开发阶段可以使用测试号并关闭域名校验；提交审核或真机正式演示必须使用 HTTPS 域名。
4. 腾讯地图基础 `map` 组件可以显示地图与定位；如果后续要用路线规划、逆地址解析等高级能力，再申请腾讯位置服务 Key。

## 演示路径

1. 打开 API：`GET /api/v1/health`，说明服务状态、数据条数和 HTTPS 开关。
2. 在小程序地图页搜索“三塔”，展示按名称查询。
3. 使用“当前视野”展示 bbox 查询。
4. 授权定位后使用“周边 10km”，展示中心点半径查询。
5. 打开详情页，展示 POI JSON、扩展信息与坐标。
6. 在“我的”页注册公众用户并获取 APIKEY。
7. 在“维护”页用维护账号新增、修改、删除一条测试 POI，展示角色权限。
