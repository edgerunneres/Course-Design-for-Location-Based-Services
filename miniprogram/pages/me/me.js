const app = getApp();
const api = require("../../utils/api");

Page({
  data: {
    apiBase: "",
    apiKey: "",
    user: null,
    userInitial: "用",
    showDebugConfig: false,
    profileForm: { nickname: "", phone: "", email: "" },
    register: { username: "", password: "", nickname: "" },
    login: { username: "", password: "" }
  },

  onShow() {
    this.refreshState();
  },

  refreshState() {
    const user = app.globalData.user;
    this.setData({
      apiBase: app.globalData.apiBase,
      apiKey: app.globalData.apiKey,
      user,
      userInitial: this.getInitial(user),
      profileForm: {
        nickname: user ? user.nickname || "" : "",
        phone: user ? user.phone || "" : "",
        email: user ? user.email || "" : ""
      }
    });
  },

  getInitial(user) {
    if (!user || !user.nickname) return "用";
    return String(user.nickname).slice(0, 1);
  },

  isMaintainer(user) {
    return Boolean(user && ["maintainer", "admin"].includes(user.role));
  },

  toggleDebugConfig() {
    this.setData({ showDebugConfig: !this.data.showDebugConfig });
  },

  onApiBaseInput(e) { this.setData({ apiBase: e.detail.value }); },
  onApiKeyInput(e) { this.setData({ apiKey: e.detail.value }); },
  onRegisterUsername(e) { this.setData({ "register.username": e.detail.value }); },
  onRegisterPassword(e) { this.setData({ "register.password": e.detail.value }); },
  onRegisterNickname(e) { this.setData({ "register.nickname": e.detail.value }); },
  onLoginUsername(e) { this.setData({ "login.username": e.detail.value }); },
  onLoginPassword(e) { this.setData({ "login.password": e.detail.value }); },
  onProfileNickname(e) { this.setData({ "profileForm.nickname": e.detail.value }); },
  onProfilePhone(e) { this.setData({ "profileForm.phone": e.detail.value }); },
  onProfileEmail(e) { this.setData({ "profileForm.email": e.detail.value }); },

  saveConfig() {
    api.saveAuth({ apiBase: this.data.apiBase, apiKey: this.data.apiKey });
    wx.showToast({ title: "已保存", icon: "success" });
  },

  copyApiKey() {
    wx.setClipboardData({ data: this.data.apiKey || "" });
  },

  async registerUser() {
    try {
      api.saveAuth({ apiBase: this.data.apiBase });
      const data = await api.request("/auth/register", {
        method: "POST",
        data: this.data.register
      });
      api.saveAuth({ apiKey: data.apiKey, user: data.user });
      this.refreshState();
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
      this.refreshState();
      wx.showToast({ title: "登录成功", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async rotateApiKey() {
    try {
      const data = await api.request("/apikey/rotate", { method: "POST" });
      api.saveAuth({ apiKey: data.user.apiKey, user: data.user });
      this.refreshState();
      wx.showToast({ title: "已更新 APIKEY", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async saveProfile() {
    try {
      const data = await api.request("/users/me", {
        method: "PATCH",
        data: this.data.profileForm
      });
      api.saveAuth({ user: data.user });
      this.refreshState();
      wx.showToast({ title: "资料已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  logout() {
    api.clearAuth();
    this.setData({
      user: null,
      apiKey: app.globalData.apiKey,
      userInitial: "用",
      login: { username: "", password: "" }
    });
    wx.showToast({ title: "已退出登录", icon: "success" });
  },

  openAdmin() {
    if (!this.isMaintainer(this.data.user)) {
      wx.showToast({ title: "当前账号不是维护人员", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/admin/admin" });
  }
});
