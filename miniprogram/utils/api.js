const app = getApp();
const config = require("../config");

function getBase() {
  return app.globalData.apiBase || config.API_BASE;
}

function getHeaders(extra = {}) {
  const headers = {
    "X-API-Key": app.globalData.apiKey || config.DEMO_API_KEY,
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

function rawRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBase()}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header: options.header === undefined ? getHeaders(options.extraHeader || {}) : options.header,
      success(res) {
        resolve({
          statusCode: res.statusCode,
          headers: res.header || {},
          body: res.data
        });
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

function clearAuth() {
  app.globalData.apiKey = config.DEMO_API_KEY;
  app.globalData.token = "";
  app.globalData.user = null;
  wx.removeStorageSync("apiKey");
  wx.removeStorageSync("token");
  wx.removeStorageSync("user");
}

module.exports = {
  getBase,
  request,
  rawRequest,
  saveAuth,
  clearAuth
};
