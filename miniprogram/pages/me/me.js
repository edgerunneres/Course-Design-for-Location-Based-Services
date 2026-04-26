const app = getApp();
const api = require("../../utils/api");

Page({
  data: {
    apiBase: "",
    apiKey: "",
    user: null,
    register: { username: "", password: "", nickname: "" },
    login: { username: "demo", password: "Demo@123456" }
  },

  onShow() {
    this.setData({
      apiBase: app.globalData.apiBase,
      apiKey: app.globalData.apiKey,
      user: app.globalData.user
    });
  },

  onApiBaseInput(e) { this.setData({ apiBase: e.detail.value }); },
  onApiKeyInput(e) { this.setData({ apiKey: e.detail.value }); },
  onRegisterUsername(e) { this.setData({ "register.username": e.detail.value }); },
  onRegisterPassword(e) { this.setData({ "register.password": e.detail.value }); },
  onRegisterNickname(e) { this.setData({ "register.nickname": e.detail.value }); },
  onLoginUsername(e) { this.setData({ "login.username": e.detail.value }); },
  onLoginPassword(e) { this.setData({ "login.password": e.detail.value }); },

  saveConfig() {
    api.saveAuth({ apiBase: this.data.apiBase, apiKey: this.data.apiKey });
    wx.showToast({ title: "已保存", icon: "success" });
  },

  async registerUser() {
    try {
      api.saveAuth({ apiBase: this.data.apiBase });
      const data = await api.request("/auth/register", {
        method: "POST",
        data: this.data.register
      });
      api.saveAuth({ apiKey: data.apiKey, user: data.user });
      this.setData({ apiKey: data.apiKey, user: data.user });
      wx.showToast({ title: "注册成功", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async loginUser() {
    try {
      api.saveAuth({ apiBase: this.data.apiBase, apiKey: this.data.apiKey });
      const data = await api.request("/auth/login", {
        method: "POST",
        data: this.data.login
      });
      api.saveAuth({ token: data.token, apiKey: data.apiKey, user: data.user });
      this.setData({ apiKey: data.apiKey, user: data.user });
      wx.showToast({ title: "登录成功", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async rotateApiKey() {
    try {
      const data = await api.request("/apikey/rotate", { method: "POST" });
      api.saveAuth({ apiKey: data.user.apiKey, user: data.user });
      this.setData({ apiKey: data.user.apiKey, user: data.user });
      wx.showToast({ title: "已更新 APIKEY", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  }
});
