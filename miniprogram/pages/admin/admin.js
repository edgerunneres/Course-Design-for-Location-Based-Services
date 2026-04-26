const api = require("../../utils/api");

Page({
  data: {
    login: { username: "admin", password: "Admin@123456" },
    form: {
      id: "",
      name: "",
      province: "",
      type: "",
      address: "",
      lng: "",
      lat: "",
      remark: ""
    }
  },

  onUsername(e) { this.setData({ "login.username": e.detail.value }); },
  onPassword(e) { this.setData({ "login.password": e.detail.value }); },
  onId(e) { this.setData({ "form.id": e.detail.value }); },
  onName(e) { this.setData({ "form.name": e.detail.value }); },
  onProvince(e) { this.setData({ "form.province": e.detail.value }); },
  onType(e) { this.setData({ "form.type": e.detail.value }); },
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
      wx.showToast({ title: "维护登录成功", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async savePoi() {
    const form = this.data.form;
    const payload = {
      name: form.name,
      province: form.province,
      type: form.type,
      address: form.address,
      lng: Number(form.lng),
      lat: Number(form.lat),
      remark: form.remark
    };
    try {
      if (form.id) {
        await api.request(`/pois/${form.id}`, { method: "PATCH", data: payload });
        wx.showToast({ title: "已修改", icon: "success" });
      } else {
        const data = await api.request("/pois", { method: "POST", data: payload });
        this.setData({ "form.id": data.item.id });
        wx.showToast({ title: "已新增", icon: "success" });
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async deletePoi() {
    try {
      await api.request(`/pois/${this.data.form.id}`, { method: "DELETE" });
      this.setData({
        form: { id: "", name: "", province: "", type: "", address: "", lng: "", lat: "", remark: "" }
      });
      wx.showToast({ title: "已删除", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  }
});
