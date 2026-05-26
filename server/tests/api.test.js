"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");
const { createApp } = require("../server");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function request(base, route, options = {}) {
  const res = await fetch(`${base}${route}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  return { status: res.status, body: await res.json() };
}

function rawRequest(port, route, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: route,
      method: "GET",
      headers
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("public API key can query and maintainer can create/update/delete POI", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lbs-api-"));
  const server = createApp({ dbPath: path.join(temp, "db.json"), rateLimit: 1000 });
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await request(base, "/api/v1/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.data.poiCount > 1000, true);

    const unauth = await request(base, "/api/v1/pois");
    assert.equal(unauth.status, 401);
    assert.equal(unauth.body.error.businessCode, "APIKEY_REQUIRED");

    const list = await request(base, "/api/v1/pois?name=三塔&pageSize=5", {
      headers: { "X-API-Key": "demo-public-key" }
    });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items.length >= 1, true);

    const login = await request(base, "/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "Admin@123456" })
    });
    assert.equal(login.status, 200);
    const token = login.body.data.token;

    const created = await request(base, "/api/v1/pois", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "课程设计测试点",
        type: "其他",
        province: "北京市",
        address: "北京市海淀区",
        lng: 116.3,
        lat: 39.9
      })
    });
    assert.equal(created.status, 201);

    const id = created.body.data.item.id;
    const updated = await request(base, `/api/v1/pois/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ remark: "已通过测试更新" })
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.item.hasExt, true);

    const deleted = await request(base, `/api/v1/pois/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.deleted, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("large JSON responses are gzip-compressed when requested", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lbs-api-gzip-"));
  const server = createApp({ dbPath: path.join(temp, "db.json"), rateLimit: 1000 });
  const port = await listen(server);

  try {
    const res = await rawRequest(port, "/api/v1/pois?pageSize=100", {
      "X-API-Key": "demo-public-key",
      "Accept-Encoding": "gzip"
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-encoding"], "gzip");
    const body = JSON.parse(zlib.gunzipSync(res.body).toString("utf8"));
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 100);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
