const app = getApp();

function getBase() {
  return app.globalData.apiBase || "http://127.0.0.1:3000/api/v1";
}

function getHeaders(extra = {}) {
  const headers = {
    "X-API-Key": app.globalData.apiKey || "demo-public-key",
    ...extra
  };
  if (app.globalData.token) {
    headers.Authorization = `Bearer ${app.globalData.token}`;
  }
  return headers;
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBase()}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header: getHeaders(options.header || {}),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data.success) {
          resolve(res.data.data);
        } else {
          const message = res.data && res.data.error ? res.data.error.message : "接口请求失败";
          reject(new Error(message));
        }
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function saveAuth({ apiBase, apiKey, token, user }) {
  if (apiBase) {
    app.globalData.apiBase = apiBase;
    wx.setStorageSync("apiBase", apiBase);
  }
  if (apiKey) {
    app.globalData.apiKey = apiKey;
    wx.setStorageSync("apiKey", apiKey);
  }
  if (token) {
    app.globalData.token = token;
    wx.setStorageSync("token", token);
  }
  if (user) {
    app.globalData.user = user;
    wx.setStorageSync("user", user);
  }
}

module.exports = {
  getBase,
  request,
  saveAuth
};
