const api = require("../../utils/api");

Page({
  data: {
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

  async demoAuthRequired() {
    try {
      const response = await api.rawRequest("/pois", {
        method: "POST",
        header: {
          "content-type": "application/json",
          "X-API-Key": "demo-public-key"
        },
        data: { name: "未登录演示点", lng: 116.39, lat: 39.9 }
      });
      this.addResult("未登录调用维护接口", response);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async demoInvalidCredentials() {
    try {
      const response = await api.rawRequest("/auth/login", {
        method: "POST",
        header: { "content-type": "application/json" },
        data: { username: "demo", password: "wrong-password" }
      });
      this.addResult("账号密码错误登录", response);
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
