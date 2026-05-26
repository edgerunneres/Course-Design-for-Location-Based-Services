const app = getApp();
const api = require("../../utils/api");

const EMPTY_FORM = {
  id: "",
  name: "",
  province: "",
  type: "",
  address: "",
  lng: "",
  lat: "",
  remark: ""
};

Page({
  data: {
    user: null,
    isMaintainer: false,
    login: { username: "admin", password: "Admin@123456" },
    searchKeyword: "",
    pois: [],
    poiOptions: ["新建文保点"],
    selectedPoiIndex: 0,
    provinces: [],
    categories: [],
    form: { ...EMPTY_FORM }
  },

  onShow() {
    this.refreshAuthState();
  },

  refreshAuthState() {
    const user = app.globalData.user;
    const isMaintainer = Boolean(user && ["maintainer", "admin"].includes(user.role));
    this.setData({ user, isMaintainer });
    if (isMaintainer) {
      this.loadMeta();
      this.loadAdminPois();
    }
  },

  onUsername(e) { this.setData({ "login.username": e.detail.value }); },
  onPassword(e) { this.setData({ "login.password": e.detail.value }); },
  onSearchInput(e) { this.setData({ searchKeyword: e.detail.value }); },
  onName(e) { this.setData({ "form.name": e.detail.value }); },
  onAddress(e) { this.setData({ "form.address": e.detail.value }); },
  onLng(e) { this.setData({ "form.lng": e.detail.value }); },
  onLat(e) { this.setData({ "form.lat": e.detail.value }); },
  onRemark(e) { this.setData({ "form.remark": e.detail.value }); },

  async loginMaintainer() {
    try {
      const data = await api.request("/auth/login", {
        method: "POST",
        data: this.data.login
      });
      api.saveAuth({ token: data.token, apiKey: data.apiKey, user: data.user });
      this.refreshAuthState();
      wx.showToast({ title: "维护登录成功", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async loadMeta() {
    try {
      const [categories, provinces] = await Promise.all([
        api.request("/categories"),
        api.request("/provinces")
      ]);
      this.setData({
        categories: categories.items,
        provinces: provinces.items
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async loadAdminPois(selectedId = "") {
    try {
      const keyword = this.data.searchKeyword.trim();
      const query = keyword ? `name=${encodeURIComponent(keyword)}&` : "";
      const data = await api.request(`/pois?${query}pageSize=50`);
      const options = [
        "新建文保点",
        ...data.items.map((item) => `${item.id} · ${item.name} · ${item.province || "未填省份"}`)
      ];
      const matchedIndex = selectedId ? data.items.findIndex((item) => item.id === selectedId) + 1 : this.data.selectedPoiIndex;
      this.setData({
        pois: data.items,
        poiOptions: options,
        selectedPoiIndex: matchedIndex > 0 ? matchedIndex : 0
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  searchAdminPois() {
    this.loadAdminPois();
  },

  onPoiSelect(e) {
    const index = Number(e.detail.value);
    if (index === 0) {
      this.resetForm();
      return;
    }
    const item = this.data.pois[index - 1];
    if (item) this.fillForm(item, index);
  },

  fillForm(item, selectedPoiIndex = this.data.selectedPoiIndex) {
    this.setData({
      selectedPoiIndex,
      form: {
        id: item.id || "",
        name: item.name || "",
        province: item.province || "",
        type: item.type || "",
        address: item.address || "",
        lng: String(item.lng || item.gcjLng || ""),
        lat: String(item.lat || item.gcjLat || ""),
        remark: item.remark || ""
      }
    });
  },

  resetForm() {
    this.setData({
      selectedPoiIndex: 0,
      form: { ...EMPTY_FORM }
    });
  },

  onProvinceChange(e) {
    const value = this.data.provinces[e.detail.value] || "";
    this.setData({ "form.province": value });
  },

  onTypeChange(e) {
    const value = this.data.categories[e.detail.value] || "";
    this.setData({ "form.type": value });
  },

  buildPayload() {
    const form = this.data.form;
    return {
      name: form.name.trim(),
      province: form.province,
      type: form.type,
      address: form.address.trim(),
      lng: Number(form.lng),
      lat: Number(form.lat),
      remark: form.remark.trim()
    };
  },

  validatePayload(payload) {
    if (!payload.name) return "请填写名称";
    if (!Number.isFinite(payload.lng) || !Number.isFinite(payload.lat)) return "请填写合法经纬度";
    return "";
  },

  async savePoi() {
    if (!this.data.isMaintainer) {
      wx.showToast({ title: "当前账号无维护权限", icon: "none" });
      return;
    }
    const payload = this.buildPayload();
    const message = this.validatePayload(payload);
    if (message) {
      wx.showToast({ title: message, icon: "none" });
      return;
    }
    try {
      if (this.data.form.id) {
        const data = await api.request(`/pois/${this.data.form.id}`, { method: "PATCH", data: payload });
        this.fillForm(data.item);
        wx.showToast({ title: "已修改", icon: "success" });
        this.loadAdminPois(data.item.id);
      } else {
        const data = await api.request("/pois", { method: "POST", data: payload });
        this.fillForm(data.item);
        wx.showToast({ title: "已新增", icon: "success" });
        this.loadAdminPois(data.item.id);
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async deletePoi() {
    if (!this.data.form.id) return;
    wx.showModal({
      title: "确认删除",
      content: `删除后不可恢复：${this.data.form.name}`,
      confirmColor: "#a4382f",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.request(`/pois/${this.data.form.id}`, { method: "DELETE" });
          this.resetForm();
          this.loadAdminPois();
          wx.showToast({ title: "已删除", icon: "success" });
        } catch (error) {
          wx.showToast({ title: error.message, icon: "none" });
        }
      }
    });
  }
});
