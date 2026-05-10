# Apifox / Apipost 调试说明

老师推荐的 Apifox、Apipost 对本项目有实际价值，但定位是开发测试工具，不是系统运行依赖。

## 用途

- 直接导入 `docs/openapi.yaml`，生成 API 文档和调试集合。
- 设置环境变量 `baseUrl=http://127.0.0.1:3000/api/v1` 或 HTTPS 部署域名。
- 设置公共 Header：`X-API-Key=demo-public-key`。
- 登录维护账号后，把响应中的 `token` 填入 Bearer Token，用于测试新增、修改、删除接口。
- 建立自动化测试：健康检查、无 APIKEY 返回 401、名称查询返回结果、维护人员 CRUD 成功。

## 建议测试流程

1. 导入 OpenAPI 文件：`docs/openapi.yaml`。
2. 创建环境：`local`，设置 `baseUrl`。
3. 调用 `GET /health`，确认服务运行。
4. 调用 `GET /pois?name=三塔&pageSize=5`，确认公众查询。
5. 调用 `GET /pois` 且不带 APIKEY，确认错误码 `APIKEY_REQUIRED`。
6. 调用 `POST /auth/login`，使用 `admin / Admin@123456` 获取 Token。
7. 使用 Token 调用 `POST /pois`、`PATCH /pois/{id}`、`DELETE /pois/{id}`，确认维护角色权限。

## 课程展示价值

这份 OpenAPI 文件能证明 API 不是临时接口，而是按端点、参数、权限、响应和错误码进行规范化设计。Apifox/Apipost 的运行截图可放入答辩 PPT 或现场演示，用来支撑“API 文档、设计、调试、自动化测试一体化”的课程要求。
