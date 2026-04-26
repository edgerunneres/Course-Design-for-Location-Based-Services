const api = require("../../utils/api");

Page({
  data: {
    id: "",
    item: null,
    markers: []
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadDetail();
  },

  async loadDetail() {
    try {
      const data = await api.request(`/pois/${this.data.id}`);
      const item = data.item;
      this.setData({
        item,
        markers: [{
          id: 1,
          latitude: item.gcjLat || item.lat,
          longitude: item.gcjLng || item.lng,
          callout: {
            content: item.name,
            display: "ALWAYS",
            padding: 8,
            borderRadius: 4
          }
        }]
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  copyJson() {
    wx.setClipboardData({
      data: JSON.stringify(this.data.item, null, 2)
    });
  },

  copyWebsite() {
    wx.setClipboardData({
      data: this.data.item.website
    });
  }
});
