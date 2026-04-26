"use strict";

const EARTH_RADIUS_M = 6371008.8;
const X_PI = Math.PI * 3000.0 / 180.0;

const PROVINCES = [
  "北京市", "天津市", "上海市", "重庆市",
  "河北省", "山西省", "辽宁省", "吉林省", "黑龙江省",
  "江苏省", "浙江省", "安徽省", "福建省", "江西省", "山东省",
  "河南省", "湖北省", "湖南省", "广东省", "海南省",
  "四川省", "贵州省", "云南省", "陕西省", "甘肃省", "青海省",
  "内蒙古自治区", "广西壮族自治区", "西藏自治区", "宁夏回族自治区", "新疆维吾尔自治区"
];

function extractProvince(address = "") {
  const text = String(address).trim();
  const province = PROVINCES.find((item) => text.startsWith(item));
  if (province) return province;
  const fallback = text.match(/^(.{2,3}[省市区])/u);
  return fallback ? fallback[1] : "未识别";
}

function bd09ToGcj02(bdLng, bdLat) {
  const x = Number(bdLng) - 0.0065;
  const y = Number(bdLat) - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  return {
    lng: Number((z * Math.cos(theta)).toFixed(6)),
    lat: Number((z * Math.sin(theta)).toFixed(6))
  };
}

function toRad(deg) {
  return Number(deg) * Math.PI / 180;
}

function distanceMeters(aLng, aLat, bLng, bLat) {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function parseBbox(value) {
  if (!value) return null;
  const parts = String(value).split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error("bbox must be minLng,minLat,maxLng,maxLat");
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng >= maxLng || minLat >= maxLat) {
    throw new Error("bbox minimum values must be smaller than maximum values");
  }
  return { minLng, minLat, maxLng, maxLat };
}

function parseCenter(value) {
  if (!value) return null;
  const parts = String(value).split(",").map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error("center must be lng,lat");
  }
  return { lng: parts[0], lat: parts[1] };
}

function inBbox(poi, bbox) {
  if (!bbox) return true;
  return poi.lng >= bbox.minLng
    && poi.lng <= bbox.maxLng
    && poi.lat >= bbox.minLat
    && poi.lat <= bbox.maxLat;
}

module.exports = {
  PROVINCES,
  bd09ToGcj02,
  distanceMeters,
  extractProvince,
  inBbox,
  parseBbox,
  parseCenter
};
