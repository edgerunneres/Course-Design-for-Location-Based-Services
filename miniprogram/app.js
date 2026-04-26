App({
  globalData: {
    apiBase: "http://127.0.0.1:3000/api/v1",
    apiKey: "demo-public-key",
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
