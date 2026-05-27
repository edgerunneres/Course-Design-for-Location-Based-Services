const app = getApp();
const api = require("../../utils/api");

const DEFAULT_CENTER = { lat: 36.8, lng: 104.2 };
const DEFAULT_SCALE = 4;

Page({
  data: {
    center: DEFAULT_CENTER,
    scale: DEFAULT_SCALE,
    sheetHeight: 46,
    sheetDragging: false,
    radiusOptions: ["2km", "5km", "10km", "20km", "50km"],
    radiusMeters: [2000, 5000, 10000, 20000, 50000],
    radiusIndex: 2,
    pageSizeOptions: ["20条/页", "50条/页", "80条/页"],
    pageSizeValues: [20, 50, 80],
    pageSizeIndex: 0,
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
    circles: [],
    pagination: { total: 0, page: 1, pageSize: 20, pages: 1 },
    loading: false,
    userLocation: null,
    lastMode: "normal",
    resultTitle: "精选文保点",
    resultSubtitle: "支持名称、省份、类别、视野范围和中心半径查询"
  },

  onLoad() {
    this.mapContext = wx.createMapContext("heritageMap", this);
    this.hasInitialViewport = false;
    this.sheetTouchStartY = 0;
    this.sheetTouchLastY = 0;
    this.sheetStartHeight = this.data.sheetHeight;
    this.windowHeight = this.getWindowHeight();
    this.currentSpatialQuery = null;
    this.userLocation = null;
    this.lastLocationRenderAt = 0;
    this.initMarkerCluster();
    if (this.ensureLoggedIn()) {
      this.startLocationWatch();
      this.loadMeta();
      this.loadPois({ preserveViewport: true });
    }
  },

  onShow() {
    if (!this.ensureLoggedIn()) return;
    this.startLocationWatch();
    if (!this.data.pois.length && !this.data.loading) {
      this.loadMeta();
      this.loadPois({ preserveViewport: true });
    }
  },

  onHide() {
    this.stopLocationWatch();
  },

  onUnload() {
    this.stopLocationWatch();
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

  ensureLoggedIn() {
    if (app.globalData.user) return true;
    wx.showToast({ title: "请先登录后使用地图查询", icon: "none" });
    wx.switchTab({ url: "/pages/me/me" });
    return false;
  },

  getWindowHeight() {
    if (typeof wx.getWindowInfo === "function") {
      return wx.getWindowInfo().windowHeight || 667;
    }
    return wx.getSystemInfoSync().windowHeight || 667;
  },

  startLocationWatch() {
    if (this.locationWatching) return;
    if (typeof wx.startLocationUpdate !== "function" || typeof wx.onLocationChange !== "function") return;
    this.locationWatching = true;
    this.handleLocationChange = (res) => {
      this.userLocation = { lat: res.latitude, lng: res.longitude };
      const now = Date.now();
      if (now - this.lastLocationRenderAt > 5000) {
        this.lastLocationRenderAt = now;
        this.setData({ userLocation: this.userLocation });
      }
    };
    wx.onLocationChange(this.handleLocationChange);
    wx.startLocationUpdate({
      type: "gcj02",
      fail: () => {}
    });
  },

  stopLocationWatch() {
    if (this.handleLocationChange && typeof wx.offLocationChange === "function") {
      wx.offLocationChange(this.handleLocationChange);
    }
    if (typeof wx.stopLocationUpdate === "function") {
      wx.stopLocationUpdate({});
    }
    this.locationWatching = false;
  },

  async loadMeta() {
    if (!this.ensureLoggedIn()) return;
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
      page: this.data.pagination.page || 1,
      pageSize: this.data.pageSizeValues[this.data.pageSizeIndex] || 20,
      ...extra
    };
    delete query.fit;
    delete query.preserveViewport;
    if (filters.name) query.name = filters.name;
    if (filters.province) query.province = filters.province;
    if (filters.category) query.category = filters.category;
    if (filters.hasExt) query.has_ext = "true";
    return Object.keys(query)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join("&");
  },

  async loadPois(extra = {}) {
    if (!this.ensureLoggedIn()) return;
    this.setData({ loading: true });
    try {
      const data = await api.request(`/pois?${this.buildQuery(extra)}`);
      const markers = data.items
        .filter((item) => Number.isFinite(Number(item.gcjLat || item.lat)) && Number.isFinite(Number(item.gcjLng || item.lng)))
        .map((item, index) => ({
          id: index + 1,
          poiId: item.id,
          latitude: item.gcjLat || item.lat,
          longitude: item.gcjLng || item.lng,
          joinCluster: true,
          width: 28,
          height: 28,
          title: item.name
        }));
      const subtitle = this.describeResult(data.pagination.total, data.items.length, extra);
      this.setData({
        pois: data.items,
        pagination: {
          ...data.pagination,
          pages: data.pagination.pages || 1
        },
        markers,
        loading: false,
        resultTitle: this.getResultTitle(extra),
        resultSubtitle: subtitle
      });

      const shouldFit = markers.length && !extra.preserveViewport && (extra.fit || extra.center || !this.hasInitialViewport);
      if (shouldFit) {
        this.fitMarkers(markers);
        this.hasInitialViewport = true;
      }
    } catch (error) {
      this.setData({ loading: false });
      this.toast(error.message);
    }
  },

  fitMarkers(markers) {
    if (!this.mapContext || typeof this.mapContext.includePoints !== "function") return;
    const points = markers.map((marker) => ({
      latitude: marker.latitude,
      longitude: marker.longitude
    }));
    this.mapContext.includePoints({
      points,
      padding: [110, 48, 420, 48]
    });
  },

  getResultTitle(extra = {}) {
    if (extra.center) return "中心半径结果";
    if (extra.bbox) return "当前视野结果";
    if (this.data.filters.name) return `搜索：${this.data.filters.name}`;
    if (this.data.filters.province || this.data.filters.category || this.data.filters.hasExt) return "筛选结果";
    return "精选文保点";
  },

  describeResult(total, shown, extra = {}) {
    const filters = this.data.filters;
    const chips = [];
    if (extra.center && extra.radius) chips.push(`半径 ${this.formatRadius(extra.radius)}`);
    if (filters.province) chips.push(filters.province);
    if (filters.category) chips.push(filters.category);
    if (filters.hasExt) chips.push("含扩展信息");
    const suffix = chips.length ? ` · ${chips.join(" · ")}` : "";
    return `共 ${total} 条，当前显示 ${shown} 条${suffix}`;
  },

  formatRadius(radius) {
    const value = Number(radius);
    if (!Number.isFinite(value)) return "";
    return value >= 1000 ? `${Math.round(value / 1000)}km` : `${value}m`;
  },

  scaleForRadius(radius) {
    const value = Number(radius);
    if (value <= 2000) return 13;
    if (value <= 5000) return 12;
    if (value <= 10000) return 11;
    if (value <= 20000) return 10;
    return 8;
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

  onRadiusChange(event) {
    this.setData({ radiusIndex: Number(event.detail.value) });
  },

  loadByCenterRadius() {
    if (!this.ensureLoggedIn()) return;
    const radius = this.data.radiusMeters[this.data.radiusIndex] || 10000;
    const run = (center) => {
      this.setData({
        lastMode: "center",
        "pagination.page": 1,
        circles: [this.createRadiusCircle(center, radius)]
      });
      this.currentSpatialQuery = {
        center: `${center.lng},${center.lat}`,
        radius,
        preserveViewport: true
      };
      this.loadPois(this.currentSpatialQuery);
    };
    if (!this.mapContext || typeof this.mapContext.getCenterLocation !== "function") {
      run(this.data.center);
      return;
    }
    this.mapContext.getCenterLocation({
      success: (res) => run({ lat: res.latitude, lng: res.longitude }),
      fail: () => run(this.data.center)
    });
  },

  createRadiusCircle(center, radius) {
    return {
      latitude: center.lat,
      longitude: center.lng,
      radius,
      color: "#a4382f88",
      fillColor: "#a4382f18",
      strokeWidth: 2
    };
  },

  loadByMapBounds() {
    if (!this.ensureLoggedIn()) return;
    this.mapContext.getRegion({
      success: (res) => {
        const sw = res.southwest;
        const ne = res.northeast;
        this.setData({ lastMode: "bounds", "pagination.page": 1 });
        this.currentSpatialQuery = {
          bbox: `${sw.longitude},${sw.latitude},${ne.longitude},${ne.latitude}`,
          preserveViewport: true
        };
        this.loadPois(this.currentSpatialQuery);
      },
      fail: () => this.toast("无法读取当前地图视野")
    });
  },

  searchPois() {
    if (!this.ensureLoggedIn()) return;
    this.setData({ "pagination.page": 1 });
    this.reloadCurrentQuery();
  },

  reloadCurrentQuery() {
    if (this.data.lastMode === "bounds") {
      this.loadByMapBounds();
      return;
    }
    if (this.data.lastMode === "center") {
      this.refreshCenterRadiusQuery();
      return;
    }
    this.loadPois({ fit: true });
  },

  refreshCenterRadiusQuery() {
    const radius = this.data.radiusMeters[this.data.radiusIndex] || 10000;
    const run = (center) => {
      this.setData({
        circles: [this.createRadiusCircle(center, radius)]
      });
      this.currentSpatialQuery = {
        center: `${center.lng},${center.lat}`,
        radius,
        preserveViewport: true
      };
      this.loadPois(this.currentSpatialQuery);
    };
    if (!this.mapContext || typeof this.mapContext.getCenterLocation !== "function") {
      run(this.data.center);
      return;
    }
    this.mapContext.getCenterLocation({
      success: (res) => run({ lat: res.latitude, lng: res.longitude }),
      fail: () => run(this.data.center)
    });
  },

  onSheetTouchStart(event) {
    if (!event.touches || !event.touches[0]) return;
    this.windowHeight = this.getWindowHeight();
    this.sheetTouchStartY = event.touches[0].clientY;
    this.sheetTouchLastY = this.sheetTouchStartY;
    this.sheetStartHeight = this.data.sheetHeight;
    this.setData({ sheetDragging: true });
  },

  onSheetTouchMove(event) {
    if (!event.touches || !event.touches[0]) return;
    this.sheetTouchLastY = event.touches[0].clientY;
    const delta = this.sheetTouchLastY - this.sheetTouchStartY;
    const nextHeight = this.sheetStartHeight - (delta / this.windowHeight) * 100;
    this.setData({ sheetHeight: Math.max(18, Math.min(82, Number(nextHeight.toFixed(1)))) });
  },

  onSheetTouchEnd() {
    this.setData({ sheetDragging: false });
  },

  onNameInput(event) {
    this.setData({ "filters.name": event.detail.value });
  },

  onProvinceChange(event) {
    const value = this.data.provinces[event.detail.value];
    this.setData({
      "filters.province": value === "全部省份" ? "" : value,
      "pagination.page": 1
    });
    this.reloadCurrentQuery();
  },

  onCategoryChange(event) {
    const value = this.data.categories[event.detail.value];
    this.setData({
      "filters.category": value === "全部类别" ? "" : value,
      "pagination.page": 1
    });
    this.reloadCurrentQuery();
  },

  toggleExt() {
    this.setData({
      "filters.hasExt": !this.data.filters.hasExt,
      "pagination.page": 1
    });
    this.reloadCurrentQuery();
  },

  onPageSizeChange(event) {
    this.setData({
      pageSizeIndex: Number(event.detail.value),
      "pagination.page": 1
    });
    this.reloadCurrentQuery();
  },

  prevPage() {
    const page = this.data.pagination.page || 1;
    if (page <= 1) return;
    this.setData({ "pagination.page": page - 1 });
    this.reloadCurrentQuery();
  },

  nextPage() {
    const page = this.data.pagination.page || 1;
    const pages = this.data.pagination.pages || 1;
    if (page >= pages) return;
    this.setData({ "pagination.page": page + 1 });
    this.reloadCurrentQuery();
  },

  clearFilters() {
    this.currentSpatialQuery = null;
    this.setData({
      filters: { name: "", province: "", category: "", hasExt: false },
      "pagination.page": 1,
      lastMode: "normal",
      center: DEFAULT_CENTER,
      scale: DEFAULT_SCALE,
      circles: []
    });
    this.loadPois({ preserveViewport: true });
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
