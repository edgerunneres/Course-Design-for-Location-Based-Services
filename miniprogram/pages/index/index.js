const api = require("../../utils/api");

Page({
  data: {
    center: { lat: 34.3416, lng: 108.9398 },
    scale: 5,
    categories: ["全部类别"],
    provinces: ["全部省份"],
    filters: {
      name: "",
      province: "",
      category: "",
      hasExt: false
    },
    pois: [],
    markers: [],
    pagination: { total: 0, page: 1, pageSize: 80 },
    loading: false,
    userLocation: null,
    lastMode: "normal",
    resultTitle: "精选文保点",
    resultSubtitle: "支持名称、省份、类别、视野范围和周边半径查询"
  },

  onLoad() {
    this.mapContext = wx.createMapContext("heritageMap", this);
    this.initMarkerCluster();
    this.loadMeta();
    this.loadPois();
    this.locateMe(false);
  },

  initMarkerCluster() {
    if (!this.mapContext || typeof this.mapContext.initMarkerCluster !== "function") return;
    this.mapContext.initMarkerCluster({
      enableDefaultStyle: true,
      zoomOnClick: true,
      gridSize: 60,
      complete: () => {}
    });
  },

  async loadMeta() {
    try {
      const [categories, provinces] = await Promise.all([
        api.request("/categories"),
        api.request("/provinces")
      ]);
      this.setData({
        categories: ["全部类别", ...categories.items],
        provinces: ["全部省份", ...provinces.items]
      });
    } catch (error) {
      this.toast(error.message);
    }
  },

  buildQuery(extra = {}) {
    const filters = this.data.filters;
    const query = {
      page: 1,
      pageSize: 80,
      ...extra
    };
    if (filters.name) query.name = filters.name;
    if (filters.province) query.province = filters.province;
    if (filters.category) query.category = filters.category;
    if (filters.hasExt) query.has_ext = "true";
    return Object.keys(query)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join("&");
  },

  async loadPois(extra = {}) {
    this.setData({ loading: true });
    try {
      const data = await api.request(`/pois?${this.buildQuery(extra)}`);
      const markers = data.items.map((item, index) => ({
        id: index + 1,
        poiId: item.id,
        latitude: item.gcjLat || item.lat,
        longitude: item.gcjLng || item.lng,
        joinCluster: true,
        width: 28,
        height: 28,
        callout: {
          content: item.name,
          display: "BYCLICK",
          padding: 8,
          borderRadius: 4,
          bgColor: "#ffffff",
          color: "#10231f"
        }
      }));
      const subtitle = this.describeResult(data.pagination.total, data.items.length);
      this.setData({
        pois: data.items,
        pagination: data.pagination,
        markers,
        loading: false,
        resultTitle: this.getResultTitle(extra),
        resultSubtitle: subtitle
      });
      if (data.items[0]) {
        this.setData({
          center: {
            lat: data.items[0].gcjLat || data.items[0].lat,
            lng: data.items[0].gcjLng || data.items[0].lng
          },
          scale: extra.center ? 12 : this.data.scale
        });
      }
    } catch (error) {
      this.setData({ loading: false });
      this.toast(error.message);
    }
  },

  getResultTitle(extra = {}) {
    if (extra.center) return "周边文保单位";
    if (extra.bbox) return "当前视野结果";
    if (this.data.filters.name) return `搜索：${this.data.filters.name}`;
    if (this.data.filters.province || this.data.filters.category || this.data.filters.hasExt) return "筛选结果";
    return "精选文保点";
  },

  describeResult(total, shown) {
    const filters = this.data.filters;
    const chips = [];
    if (filters.province) chips.push(filters.province);
    if (filters.category) chips.push(filters.category);
    if (filters.hasExt) chips.push("含扩展信息");
    const suffix = chips.length ? ` · ${chips.join(" · ")}` : "";
    return `共 ${total} 条，当前显示 ${shown} 条${suffix}`;
  },

  locateMe(showToast = true) {
    wx.getLocation({
      type: "gcj02",
      success: (res) => {
        const userLocation = { lat: res.latitude, lng: res.longitude };
        this.setData({ userLocation, center: userLocation, scale: 12 });
        if (showToast) this.toast("已定位当前位置");
      },
      fail: () => {
        if (showToast) this.toast("请在微信中授权位置权限");
      }
    });
  },

  loadNearby() {
    const userLocation = this.data.userLocation;
    if (!userLocation) {
      this.locateMe();
      return;
    }
    this.setData({ lastMode: "nearby" });
    this.loadPois({
      center: `${userLocation.lng},${userLocation.lat}`,
      radius: 10000
    });
  },

  loadByMapBounds() {
    this.mapContext.getRegion({
      success: (res) => {
        const sw = res.southwest;
        const ne = res.northeast;
        this.setData({ lastMode: "bounds" });
        this.loadPois({
          bbox: `${sw.longitude},${sw.latitude},${ne.longitude},${ne.latitude}`
        });
      },
      fail: () => this.toast("无法读取当前地图视野")
    });
  },

  onRegionChange(event) {
    if (event.type === "end") {
      this.setData({ scale: this.data.scale });
    }
  },

  onNameInput(event) {
    this.setData({ "filters.name": event.detail.value });
  },

  onProvinceChange(event) {
    const value = this.data.provinces[event.detail.value];
    this.setData({
      "filters.province": value === "全部省份" ? "" : value,
      lastMode: "normal"
    });
    this.loadPois();
  },

  onCategoryChange(event) {
    const value = this.data.categories[event.detail.value];
    this.setData({
      "filters.category": value === "全部类别" ? "" : value,
      lastMode: "normal"
    });
    this.loadPois();
  },

  toggleExt() {
    this.setData({
      "filters.hasExt": !this.data.filters.hasExt,
      lastMode: "normal"
    });
    this.loadPois();
  },

  clearFilters() {
    this.setData({
      filters: { name: "", province: "", category: "", hasExt: false },
      lastMode: "normal",
      scale: 5
    });
    this.loadPois();
  },

  onMarkerTap(event) {
    const marker = this.data.markers.find((item) => item.id === event.markerId);
    if (marker) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${marker.poiId}` });
    }
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  },

  toast(title) {
    wx.showToast({ title, icon: "none" });
  }
});
