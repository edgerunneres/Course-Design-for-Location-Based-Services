const config = require("./config");

App({
  globalData: {
    apiBase: config.API_BASE,
    apiKey: config.DEMO_API_KEY,
    token: "",
    user: null
  },
  onLaunch() {
    const apiBase = wx.getStorageSync("apiBase");
    const apiKey = wx.getStorageSync("apiKey");
    const token = wx.getStorageSync("token");
    const user = wx.getStorageSync("user");
    if (apiBase) this.globalData.apiBase = apiBase;
    if (apiKey) this.globalData.apiKey = apiKey;
    if (token) this.globalData.token = token;
    if (user) this.globalData.user = user;
  }
});
