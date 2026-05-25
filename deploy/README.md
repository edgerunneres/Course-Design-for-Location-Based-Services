# 生产部署说明

目标：让微信正式版小程序能从所有用户手机访问后端 API。

## 必备条件

1. 一台公网服务器，开放 80 和 443 端口。
2. 一个域名，例如 `api.example.com`，DNS A 记录指向服务器公网 IP。
3. 如果服务器在中国大陆，域名通常需要完成 ICP 备案。
4. Docker 与 Docker Compose。
5. 微信小程序真实 AppID。

## 部署后端

在服务器上执行：

```bash
git clone https://gitee.com/lbs-252602/course-design---yu-peilin.git
cd course-design---yu-peilin/deploy
cp .env.example .env
```

编辑 `.env`：

```env
API_DOMAIN=你的API域名
ACME_EMAIL=你的邮箱
LBS_TOKEN_SECRET=随机长密钥
LBS_ADMIN_PASSWORD=强密码
```

启动：

```bash
docker compose up -d --build
```

验证：

```bash
curl https://你的API域名/api/v1/health
curl -H "X-API-Key: demo-public-key" "https://你的API域名/api/v1/pois?name=三塔&pageSize=3"
```

## 配置小程序

1. 修改 `miniprogram/config.js` 中的 `API_BASE`：

```js
API_BASE: "https://你的API域名/api/v1"
```

也可以参考 `miniprogram/config.prod.example.js`。

2. 微信公众平台后台配置：

路径：开发管理 → 开发设置 → 服务器域名 → request 合法域名。

添加：

```text
https://你的API域名
```

3. 用微信开发者工具上传代码，提交审核，审核通过后发布。

## 回滚

```bash
cd deploy
docker compose logs -f
docker compose restart api
docker compose down
```
