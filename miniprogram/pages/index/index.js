const api = require("../../utils/api");

const DEFAULT_CENTER = { lat: 35.8617, lng: 104.1954 };
const DEFAULT_SCALE = 4;

Page({
  data: {
    center: DEFAULT_CENTER,
    scale: DEFAULT_SCALE,
    sheetState: "half",
    radiusOptions: ["2km", "5km", "10km", "20km", "50km"],
    radiusMeters: [2000, 5000, 10000, 20000, 50000],
    radiusIndex: 2,
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
    resultSubtitle: "支持名称、省份、类别、视野范围和中心半径查询"
  },

  onLoad() {
    this.mapContext = wx.createMapContext("heritageMap", this);
    this.hasInitialViewport = false;
    this.sheetTouchStartY = 0;
    this.sheetTouchLastY = 0;
    this.initMarkerCluster();
    this.loadMeta();
    this.loadPois({ fit: true });
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
          callout: {
            content: item.name,
            display: "BYCLICK",
            padding: 8,
            borderRadius: 4,
            bgColor: "#ffffff",
            color: "#10231f"
          }
        }));
      const subtitle = this.describeResult(data.pagination.total, data.items.length, extra);
      this.setData({
        pois: data.items,
        pagination: data.pagination,
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

  syncMapViewport(event = {}) {
    if (!this.mapContext || typeof this.mapContext.getCenterLocation !== "function") return;
    const next = {};
    if (event.detail && event.detail.scale) next.scale = event.detail.scale;
    this.mapContext.getCenterLocation({
      success: (res) => {
        next.center = { lat: res.latitude, lng: res.longitude };
        this.setData(next);
      }
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
    const radius = this.data.radiusMeters[this.data.radiusIndex] || 10000;
    const run = (center) => {
      this.setData({
        center,
        scale: this.scaleForRadius(radius),
        lastMode: "center"
      });
      this.loadPois({
        center: `${center.lng},${center.lat}`,
        radius,
        preserveViewport: true
      });
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

  loadByMapBounds() {
    this.mapContext.getRegion({
      success: (res) => {
        const sw = res.southwest;
        const ne = res.northeast;
        this.setData({ lastMode: "bounds" });
        this.loadPois({
          bbox: `${sw.longitude},${sw.latitude},${ne.longitude},${ne.latitude}`,
          preserveViewport: true
        });
      },
      fail: () => this.toast("无法读取当前地图视野")
    });
  },

  searchPois() {
    this.setData({ lastMode: "normal" });
    this.loadPois({ fit: true });
  },

  onRegionChange(event) {
    if (event.type === "end") {
      this.syncMapViewport(event);
    }
  },

  onSheetTouchStart(event) {
    if (!event.touches || !event.touches[0]) return;
    this.sheetTouchStartY = event.touches[0].clientY;
    this.sheetTouchLastY = this.sheetTouchStartY;
  },

  onSheetTouchMove(event) {
    if (!event.touches || !event.touches[0]) return;
    this.sheetTouchLastY = event.touches[0].clientY;
  },

  onSheetTouchEnd() {
    const delta = this.sheetTouchLastY - this.sheetTouchStartY;
    if (Math.abs(delta) < 18) {
      this.toggleSheet();
      return;
    }
    if (delta < 0) this.expandSheet();
    if (delta > 0) this.collapseSheet();
  },

  toggleSheet() {
    const current = this.data.sheetState;
    this.setData({ sheetState: current === "expanded" ? "half" : "expanded" });
  },

  expandSheet() {
    const current = this.data.sheetState;
    this.setData({ sheetState: current === "collapsed" ? "half" : "expanded" });
  },

  collapseSheet() {
    const current = this.data.sheetState;
    this.setData({ sheetState: current === "expanded" ? "half" : "collapsed" });
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
    this.loadPois({ fit: true });
  },

  onCategoryChange(event) {
    const value = this.data.categories[event.detail.value];
    this.setData({
      "filters.category": value === "全部类别" ? "" : value,
      lastMode: "normal"
    });
    this.loadPois({ fit: true });
  },

  toggleExt() {
    this.setData({
      "filters.hasExt": !this.data.filters.hasExt,
      lastMode: "normal"
    });
    this.loadPois({ fit: true });
  },

  clearFilters() {
    this.setData({
      filters: { name: "", province: "", category: "", hasExt: false },
      lastMode: "normal",
      center: DEFAULT_CENTER,
      scale: DEFAULT_SCALE
    });
    this.loadPois({ fit: true });
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
