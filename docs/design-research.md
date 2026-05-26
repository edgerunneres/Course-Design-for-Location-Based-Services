# 地图类应用设计调研摘要

## 采用的设计原则

- 地图优先：第一屏让地图和检索结果同时可见，而不是先展示说明页。
- 检索优先：顶部提供关键词搜索和高频筛选，减少进入详情前的操作成本。
- 空间交互明确：把“当前视野”和“周边 10km”作为显性动作，直接对应课程要求的 bbox 与 center/radius 查询。
- 结果可扫读：结果列表保持名称、地区、类别、地址、距离/扩展资料标签，方便快速判断。
- 详情可行动：详情页提供地图导航、复制 JSON、复制资料链接，便于演示 API 返回数据和地图能力。
- 账户与维护分离：公众 APIKEY 管理和维护人员 CRUD 分页呈现，强化分角色权限。

## 对本项目的落地

- 地图页改为“地图 + 搜索控制台 + 结果底栏”，接近成熟地图应用的搜索/结果联动模式。
- 按钮不堆叠成长文本说明，改成短动作：查找、当前视野、周边 10km、定位、重置。
- 详情页从纯文本信息改为地点卡片，突出名称、类型、批次和可执行动作。
- 账户页突出 API 地址、APIKEY、注册登录和 Key 轮换，方便现场答辩。
- 维护页保留单项 CRUD，避免复杂后台系统喧宾夺主。
- 地图 marker 开启点聚合，缩小视野时自动合并密集点位，降低图标重叠和渲染压力。
- API 层补充 gzip 压缩、JSON 数据原子写入、限速器垃圾清理，使课程项目更接近可长期运行的服务。

## 论文与前沿方向

近年的 POI 推荐研究重点已经从普通距离检索扩展到时空序列、地理周期、类别语义、社交关系、隐私保护和图神经网络。本课程项目不引入复杂推荐模型，原因是课程核心要求是 POI API 服务与地图客户端测试；但界面与接口预留了类别、距离、扩展资料、用户 APIKEY 和统计接口，后续可以继续扩展“附近推荐”“个性化推荐”“热门类别推荐”等能力。

空间距离计算方面，本项目仍采用 Haversine 球面距离。该算法对课程级半径查询足够简洁可靠；若面向大范围高精度生产场景，应迁移至 PostGIS、Vincenty 或其他基于 WGS84 椭球体的距离模型。

## 参考来源

- Apifox 官方站点：https://apifox.com/
- Apipost 官方站点：https://www.apipost.cn/
- Google Maps Platform 文档：https://developers.google.com/maps/documentation
- Material Design 3 Chips：https://m3.material.io/components/chips/overview
- Material Design 3 Bottom sheets：https://m3.material.io/components/bottom-sheets/overview
- WeChat Mini Program 官方文档：https://developers.weixin.qq.com/miniprogram/dev/framework/
- 2024 POI 推荐综述：https://arxiv.org/abs/2410.02191
- 2025 MultiPerG 下一 POI 推荐研究：https://link.springer.com/article/10.1007/s44336-025-00012-1
