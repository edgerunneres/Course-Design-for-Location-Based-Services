# 基于位置的服务课程设计：全国重点文保单位 POI 服务

本项目完成课程设计“专题 POI Web API 设计实现与地图客户端应用测试”的主要交付物：REST 风格 POI Web API、微信小程序地图客户端、数据预处理脚本、测试脚本与部署说明。

## 小组信息

- 小组人数：1 人
- 成员分工：数据预处理 20%，REST API 与安全设计 35%，微信小程序地图客户端 30%，测试与报告整理 15%
- 数据主题：全国重点文物保护单位 POI，共 2356 条

## 目录结构

```text
heritage-lbs/
  server/                 Node.js 后端服务
    data/poi-seed.json    预处理后的 POI 种子数据
    lib/                  安全、地理计算、数据仓库模块
    scripts/              数据预处理脚本
    tests/                API 自动测试
  miniprogram/            微信小程序项目
  docs/                   API 与部署文档
```

## 功能清单

- API 安全：用户注册、登录、HMAC Token、公众 APIKEY、内存限速、HTTPS 强制开关。
- 角色权限：公众角色只读查询，维护人员角色可新增、修改、删除、查询 POI。
- POI 查询：按名称、省份、类别、批次、地图框选范围、中心点半径、是否包含扩展信息筛选。
- JSON 响应：成功响应包含业务数据与 requestId；错误响应包含 HTTP 状态码、业务错误码、错误描述和调试链接。
- 地图客户端：微信小程序地图可视化、当前位置显示、当前视野查询、周边查询、详情页、公众注册登录、维护页 CRUD。
- 自动测试：覆盖 APIKEY 鉴权、查询、维护人员登录、CRUD 流程。

## 本地运行

1. 进入项目目录：

```bash
cd heritage-lbs
```

2. 如需重新生成数据：

```bash
python server/scripts/preprocess_poi.py
```

3. 启动后端：

```bash
node server/server.js
```

默认地址为 `http://127.0.0.1:3000/api/v1`。

4. 运行测试：

```bash
node --test server/tests/*.test.js
```

## 演示账号

- 公众用户：`demo` / `Demo@123456`
- 演示 APIKEY：`demo-public-key`
- 维护人员：`admin` / `Admin@123456`

部署时请通过环境变量 `LBS_ADMIN_PASSWORD` 修改维护人员默认密码，并设置 `LBS_TOKEN_SECRET`。

## 微信小程序运行

1. 用微信开发者工具导入 `heritage-lbs/miniprogram`。
2. AppID 可先选择测试号；本地调试时在详情中勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。
3. 先启动后端，再运行小程序。默认 API 地址为 `http://127.0.0.1:3000/api/v1`。
4. 真机或正式提交前，需要把后端部署到 HTTPS 域名，在“我的”页修改 API 地址，并在微信公众平台配置 request 合法域名。

## HTTPS 部署

后端支持两种方式：

- 推荐：Nginx/Caddy 反向代理负责 HTTPS，Node 服务监听内网 HTTP，同时设置 `LBS_FORCE_HTTPS=true` 并转发 `X-Forwarded-Proto=https`。
- 直接 Node HTTPS：设置 `LBS_HTTPS_CERT=/path/fullchain.pem` 与 `LBS_HTTPS_KEY=/path/privkey.pem`。

详见 [docs/deployment.md](docs/deployment.md)。

## 典型接口

```bash
curl -H "X-API-Key: demo-public-key" "http://127.0.0.1:3000/api/v1/pois?name=三塔&pageSize=5"
curl -H "X-API-Key: demo-public-key" "http://127.0.0.1:3000/api/v1/pois?bbox=100,25,101,26"
curl -H "X-API-Key: demo-public-key" "http://127.0.0.1:3000/api/v1/pois?center=116.397,39.908&radius=10000"
```

更多说明见 [docs/API.md](docs/API.md)。
