# 专题 POI Web API 设计

## 统一响应

成功：

```json
{
  "success": true,
  "code": "OK",
  "message": "success",
  "data": {},
  "requestId": "req_xxx"
}
```

失败：

```json
{
  "success": false,
  "error": {
    "httpStatus": 400,
    "businessCode": "INVALID_GEO_QUERY",
    "message": "错误描述",
    "debug": {
      "requestId": "req_xxx",
      "docs": "/api/v1/docs",
      "resource": "/api/v1/pois"
    }
  }
}
```

## 认证方式

- 公众查询：`X-API-Key: <apiKey>` 或 `?api_key=<apiKey>`。
- 登录授权：`Authorization: Bearer <token>`。
- 默认公众 APIKEY：`demo-public-key`，仅用于课程演示。
- 默认维护账号：`admin`，密码建议部署时通过 `LBS_ADMIN_PASSWORD` 设置。

## 端点

| 方法 | 路径 | 角色 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | 公开 | 服务健康检查 |
| GET | `/api/v1/docs` | 公开 | API 摘要 |
| POST | `/api/v1/auth/register` | 公开 | 注册公众用户并获取 APIKEY |
| POST | `/api/v1/auth/login` | 公开 | 登录并获取 Token |
| GET | `/api/v1/users/me` | 登录用户 | 查询个人资料 |
| PATCH | `/api/v1/users/me` | 登录用户 | 修改昵称、电话、邮箱 |
| POST | `/api/v1/apikey/rotate` | 登录用户 | 重新生成 APIKEY |
| GET | `/api/v1/categories` | APIKEY/登录 | 查询类别列表 |
| GET | `/api/v1/provinces` | APIKEY/登录 | 查询省份列表 |
| GET | `/api/v1/stats` | APIKEY/登录 | 查询统计信息 |
| GET | `/api/v1/pois` | APIKEY/登录 | 批量查询 POI |
| GET | `/api/v1/pois/{id}` | APIKEY/登录 | 查询 POI 详情 |
| POST | `/api/v1/pois` | 维护人员 | 新增 POI |
| PATCH/PUT | `/api/v1/pois/{id}` | 维护人员 | 修改 POI |
| DELETE | `/api/v1/pois/{id}` | 维护人员 | 删除 POI |

## 查询参数

| 参数 | 示例 | 说明 |
| --- | --- | --- |
| `name` | `三塔` | 名称模糊查询 |
| `province` | `云南省` | 按省份过滤 |
| `category` | `古建筑` | 按类别过滤 |
| `batch` | `第五批` | 按批次过滤 |
| `bbox` | `100,25,101,26` | 地图框选范围，格式为 `minLng,minLat,maxLng,maxLat` |
| `center` | `116.397,39.908` | 中心点坐标，通常配合 `radius` |
| `radius` | `10000` | 半径，单位为米 |
| `has_ext` | `true` | 是否包含扩展信息 |
| `page` | `1` | 页码 |
| `pageSize` | `50` | 每页数量，最大 100 |

## 业务错误码

| HTTP | 业务错误码 | 场景 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 参数缺失或格式错误 |
| 400 | `INVALID_JSON` | 请求体不是合法 JSON |
| 400 | `INVALID_GEO_QUERY` | bbox/center 参数格式错误 |
| 401 | `APIKEY_REQUIRED` | 公众查询未携带 APIKEY |
| 401 | `AUTH_REQUIRED` | 需要登录 Token |
| 401 | `INVALID_CREDENTIALS` | 用户名或密码错误 |
| 403 | `ROLE_FORBIDDEN` | 当前角色无权限 |
| 403 | `HTTPS_REQUIRED` | 开启强制 HTTPS 后访问了 HTTP |
| 404 | `POI_NOT_FOUND` | POI 不存在 |
| 404 | `ROUTE_NOT_FOUND` | 路由不存在 |
| 409 | `USERNAME_EXISTS` | 用户名已存在 |
| 429 | `RATE_LIMITED` | 公众 APIKEY 访问超过限速 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

## 性能与鲁棒性说明

- `GET /pois` 等较大的 JSON 响应支持 gzip。客户端请求头包含 `Accept-Encoding: gzip` 时，服务端返回 `Content-Encoding: gzip`。
- `db.json` 采用临时文件写入后原子重命名的方式保存，避免直接覆盖写入导致的数据损坏。
- 公众访问限速器会定时清理过期桶，并在桶数量异常膨胀时淘汰最久未使用记录，避免长期运行内存持续增长。
- 半径检索当前使用 Haversine 球面距离。课程规模下足够稳定；若进入真实生产环境，建议迁移至 PostGIS 或 WGS84 椭球体距离计算模型。
