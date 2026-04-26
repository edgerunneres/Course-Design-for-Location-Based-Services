"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createApiKey, hashPassword, randomId } = require("./security");
const { distanceMeters, inBbox } = require("./geo");

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

class DataStore {
  constructor({ seedPath, dbPath, adminPassword = "Admin@123456" }) {
    this.seedPath = seedPath;
    this.dbPath = dbPath;
    this.adminPassword = adminPassword;
    this.data = { pois: [], users: [] };
  }

  load() {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    if (fs.existsSync(this.dbPath)) {
      this.data = JSON.parse(fs.readFileSync(this.dbPath, "utf8"));
    } else {
      const pois = JSON.parse(fs.readFileSync(this.seedPath, "utf8"));
      this.data = { pois, users: [] };
      this.ensureDefaultUsers();
      this.save();
    }
    this.ensureDefaultUsers();
    this.save();
  }

  ensureDefaultUsers() {
    if (!this.data.users.some((user) => user.username === "admin")) {
      this.data.users.push({
        id: randomId("usr_"),
        username: "admin",
        nickname: "数据维护管理员",
        role: "maintainer",
        phone: "",
        email: "",
        apiKey: createApiKey(),
        passwordHash: hashPassword(this.adminPassword),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    if (!this.data.users.some((user) => user.username === "demo")) {
      this.data.users.push({
        id: randomId("usr_"),
        username: "demo",
        nickname: "公众演示用户",
        role: "public",
        phone: "",
        email: "",
        apiKey: "demo-public-key",
        passwordHash: hashPassword("Demo@123456"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  save() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), "utf8");
  }

  stats() {
    const byType = {};
    const byProvince = {};
    const byBatch = {};
    for (const poi of this.data.pois) {
      byType[poi.type] = (byType[poi.type] || 0) + 1;
      byProvince[poi.province] = (byProvince[poi.province] || 0) + 1;
      byBatch[poi.batch] = (byBatch[poi.batch] || 0) + 1;
    }
    return {
      total: this.data.pois.length,
      byType,
      byProvince,
      byBatch
    };
  }

  categories() {
    return [...new Set(this.data.pois.map((poi) => poi.type))].sort();
  }

  provinces() {
    return [...new Set(this.data.pois.map((poi) => poi.province))].sort();
  }

  listPois(filters = {}) {
    let items = this.data.pois.slice();
    if (filters.name) {
      const keyword = String(filters.name).trim().toLowerCase();
      items = items.filter((poi) => poi.name.toLowerCase().includes(keyword));
    }
    if (filters.province) {
      items = items.filter((poi) => poi.province === filters.province);
    }
    if (filters.category) {
      items = items.filter((poi) => poi.type === filters.category);
    }
    if (filters.batch) {
      items = items.filter((poi) => poi.batch === filters.batch);
    }
    if (filters.hasExt !== undefined) {
      items = items.filter((poi) => Boolean(poi.hasExt) === filters.hasExt);
    }
    if (filters.bbox) {
      items = items.filter((poi) => inBbox(poi, filters.bbox));
    }
    if (filters.center && Number.isFinite(filters.radius)) {
      items = items
        .map((poi) => ({
          ...poi,
          distance: Math.round(distanceMeters(filters.center.lng, filters.center.lat, poi.lng, poi.lat))
        }))
        .filter((poi) => poi.distance <= filters.radius)
        .sort((a, b) => a.distance - b.distance);
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    }
    return items;
  }

  getPoi(id) {
    return this.data.pois.find((poi) => poi.id === id);
  }

  addPoi(input) {
    const now = new Date().toISOString();
    const poi = {
      id: randomId("poi_"),
      code: input.code || "",
      classCode: input.classCode || "",
      name: input.name,
      age: input.age || "",
      address: input.address || "",
      province: input.province || "",
      type: input.type || "其他",
      batch: input.batch || "",
      remark: input.remark || "",
      lng: Number(input.lng),
      lat: Number(input.lat),
      bdLng: Number(input.bdLng || input.lng),
      bdLat: Number(input.bdLat || input.lat),
      gcjLng: Number(input.gcjLng || input.lng),
      gcjLat: Number(input.gcjLat || input.lat),
      hasExt: Boolean(input.hasExt || input.imageUrl || input.website || input.remark),
      imageUrl: input.imageUrl || "",
      website: input.website || "",
      createdAt: now,
      updatedAt: now
    };
    this.data.pois.push(poi);
    this.save();
    return poi;
  }

  updatePoi(id, patch) {
    const poi = this.getPoi(id);
    if (!poi) return null;
    Object.assign(poi, patch, { updatedAt: new Date().toISOString() });
    if ("lng" in patch) poi.lng = Number(patch.lng);
    if ("lat" in patch) poi.lat = Number(patch.lat);
    poi.hasExt = Boolean(poi.remark || poi.imageUrl || poi.website);
    this.save();
    return poi;
  }

  deletePoi(id) {
    const index = this.data.pois.findIndex((poi) => poi.id === id);
    if (index === -1) return false;
    this.data.pois.splice(index, 1);
    this.save();
    return true;
  }

  findUserByUsername(username) {
    return this.data.users.find((user) => user.username === username);
  }

  findUserById(id) {
    return this.data.users.find((user) => user.id === id);
  }

  findUserByApiKey(apiKey) {
    return this.data.users.find((user) => user.apiKey === apiKey);
  }

  createUser(input) {
    if (this.findUserByUsername(input.username)) {
      const error = new Error("username already exists");
      error.code = "USERNAME_EXISTS";
      throw error;
    }
    const now = new Date().toISOString();
    const user = {
      id: randomId("usr_"),
      username: input.username,
      nickname: input.nickname || input.username,
      role: "public",
      phone: input.phone || "",
      email: input.email || "",
      apiKey: createApiKey(),
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now
    };
    this.data.users.push(user);
    this.save();
    return publicUser(user);
  }

  updateUser(id, patch) {
    const user = this.findUserById(id);
    if (!user) return null;
    for (const field of ["nickname", "phone", "email"]) {
      if (field in patch) user[field] = patch[field];
    }
    user.updatedAt = new Date().toISOString();
    this.save();
    return publicUser(user);
  }

  rotateApiKey(id) {
    const user = this.findUserById(id);
    if (!user) return null;
    user.apiKey = createApiKey();
    user.updatedAt = new Date().toISOString();
    this.save();
    return publicUser(user);
  }
}

module.exports = {
  DataStore,
  publicUser
};
