const api = require("../../utils/api");

const ERROR_CODES = [
  { status: 401, code: "APIKEY_REQUIRED", scene: "公众查询未携带 APIKEY", meaning: "拒绝匿名调用专题 POI API" },
  { status: 401, code: "AUTH_REQUIRED", scene: "维护接口未登录", meaning: "要求 Authorization Bearer Token" },
  { status: 403, code: "ROLE_FORBIDDEN", scene: "公众用户调用维护接口", meaning: "角色授权失败" },
  { status: 403, code: "HTTPS_REQUIRED", scene: "生产环境强制 HTTPS", meaning: "服务端启用 LBS_FORCE_HTTPS 后拒绝 HTTP" },
  { status: 404, code: "ROUTE_NOT_FOUND", scene: "接口路径不存在", meaning: "统一返回标准错误对象" },
  { status: 429, code: "RATE_LIMITED", scene: "短时间大量访问", meaning: "公众访问频率超过限制" }
];

Page({
  data: {
    errorCodes: ERROR_CODES,
    running: false,
    pressureProgress: "",
    results: []
  },

  addResult(title, response) {
    const body = response.body || {};
    const error = body.error || {};
    const item = {
      title,
      statusCode: response.statusCode,
      code: error.code || body.code || "OK",
      message: error.message || body.message || "success",
      requestId: body.requestId || "-"
    };
    this.setData({ results: [item, ...this.data.results] });
  },

  clearResults() {
    this.setData({ results: [], pressureProgress: "" });
  },

  async demoMissingApiKey() {
    try {
      const response = await api.rawRequest("/stats", { header: {} });
      this.addResult("未携带 APIKEY 访问统计接口", response);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async demoForbiddenRole() {
    try {
      const login = await api.rawRequest("/auth/login", {
        method: "POST",
        header: { "content-type": "application/json" },
        data: { username: "demo", password: "Demo@123456" }
      });
      const token = login.body && login.body.data ? login.body.data.token : "";
      const response = await api.rawRequest("/pois", {
        method: "POST",
        header: {
          "content-type": "application/json",
          "X-API-Key": "demo-public-key",
          Authorization: `Bearer ${token}`
        },
        data: { name: "权限演示点", lng: 116.39, lat: 39.9 }
      });
      this.addResult("公众用户尝试新增 POI", response);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async demoRouteNotFound() {
    try {
      const response = await api.rawRequest("/not-exists", {
        header: { "X-API-Key": "demo-public-key" }
      });
      this.addResult("访问不存在的 API 路径", response);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async demoRateLimit() {
    if (this.data.running) return;
    this.setData({ running: true, pressureProgress: "正在发起高频访问..." });
    try {
      let latest = null;
      for (let i = 1; i <= 140; i += 1) {
        latest = await api.rawRequest(`/stats?burst=${Date.now()}_${i}`, {
          header: { "X-API-Key": "demo-public-key" }
        });
        this.setData({ pressureProgress: `已发送 ${i}/140 次请求，当前状态码 ${latest.statusCode}` });
        if (latest.statusCode === 429) break;
      }
      this.addResult("高频访问触发公众限速", latest);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ running: false });
    }
  }
});
