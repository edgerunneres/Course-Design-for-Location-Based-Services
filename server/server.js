"use strict";

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const zlib = require("node:zlib");
const { URL } = require("node:url");
const { DataStore, publicUser } = require("./lib/data-store");
const { RateLimiter, signToken, verifyPassword, verifyToken } = require("./lib/security");
const { parseBbox, parseCenter } = require("./lib/geo");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = Number(process.env.PORT || 3000);

function loadConfig(overrides = {}) {
  return {
    port: DEFAULT_PORT,
    host: process.env.HOST || "0.0.0.0",
    tokenSecret: process.env.LBS_TOKEN_SECRET || "change-this-secret-before-deploy",
    forceHttps: process.env.LBS_FORCE_HTTPS === "true",
    httpsCert: process.env.LBS_HTTPS_CERT || "",
    httpsKey: process.env.LBS_HTTPS_KEY || "",
    adminPassword: process.env.LBS_ADMIN_PASSWORD || "Admin@123456",
    rateLimit: Number(process.env.LBS_PUBLIC_RATE_LIMIT || 120),
    seedPath: path.join(__dirname, "data", "poi-seed.json"),
    dbPath: process.env.LBS_DB_PATH || path.join(__dirname, "data", "db.json"),
    docsUrl: "/api/v1/docs",
    ...overrides
  };
}

function makeEnvelope(ok, payload, requestId) {
  if (ok) {
    return {
      success: true,
      code: "OK",
      message: "success",
      data: payload,
      requestId
    };
  }
  return payload;
}

function sendJson(req, res, status, body, headers = {}) {
  const raw = JSON.stringify(body, null, 2);
  const responseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Vary": "Accept-Encoding",
    ...headers
  };
  const acceptsGzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
  if (acceptsGzip && raw.length >= 1024) {
    const compressed = zlib.gzipSync(raw);
    res.writeHead(status, {
      ...responseHeaders,
      "Content-Encoding": "gzip",
      "Content-Length": compressed.length
    });
    res.end(compressed);
    return;
  }
  res.writeHead(status, {
    ...responseHeaders,
    "Content-Length": Buffer.byteLength(raw)
  });
  res.end(raw);
}

function success(req, res, requestId, data, status = 200, headers = {}) {
  sendJson(req, res, status, makeEnvelope(true, data, requestId), headers);
}

function fail(req, res, requestId, status, businessCode, message, debug = {}) {
  sendJson(req, res, status, {
    success: false,
    error: {
      httpStatus: status,
      businessCode,
      message,
      debug: {
        requestId,
        docs: "/api/v1/docs",
        ...debug
      }
    }
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(Object.assign(new Error("request body too large"), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(Object.assign(error, { status: 400, code: "INVALID_JSON" }));
      }
    });
    req.on("error", reject);
  });
}

function normalizeBool(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return ["true", "1", "yes", "y"].includes(String(value).toLowerCase());
}

function paginate(items, page, pageSize) {
  const safePage = Math.max(1, Number(page || 1));
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize || 20)));
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: items.length,
      pages: Math.ceil(items.length / safePageSize)
    }
  };
}

function getBearer(req) {
  const value = req.headers.authorization || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function getApiKey(req, url) {
  return req.headers["x-api-key"] || url.searchParams.get("api_key") || "";
}

function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const store = new DataStore(config);
  store.load();
  const limiter = new RateLimiter({ limit: config.rateLimit, windowMs: 60_000 });

  function requireHttps(req, res, requestId) {
    if (!config.forceHttps) return false;
    const proto = req.headers["x-forwarded-proto"];
    if (req.socket.encrypted || proto === "https") return false;
    fail(req, res, requestId, 403, "HTTPS_REQUIRED", "服务端已启用强制 HTTPS 访问。", {
      resource: req.url
    });
    return true;
  }

  function currentUser(req) {
    const token = getBearer(req);
    if (!token) return null;
    const payload = verifyToken(token, config.tokenSecret);
    return payload ? store.findUserById(payload.sub) : null;
  }

  function requireLogin(req, res, requestId) {
    const user = currentUser(req);
    if (!user) {
      fail(req, res, requestId, 401, "AUTH_REQUIRED", "请先登录并在 Authorization 中携带 Bearer Token。");
      return null;
    }
    return user;
  }

  function requireRole(req, res, requestId, roles) {
    const user = requireLogin(req, res, requestId);
    if (!user) return null;
    if (!roles.includes(user.role)) {
      fail(req, res, requestId, 403, "ROLE_FORBIDDEN", "当前角色无权访问该资源。", {
        requiredRoles: roles,
        currentRole: user.role
      });
      return null;
    }
    return user;
  }

  function requireApiKey(req, res, requestId, url) {
    const tokenUser = currentUser(req);
    if (tokenUser) return tokenUser;
    const apiKey = getApiKey(req, url);
    const user = apiKey ? store.findUserByApiKey(apiKey) : null;
    if (!user) {
      fail(req, res, requestId, 401, "APIKEY_REQUIRED", "公众查询需要先注册并携带有效 APIKEY。", {
        header: "X-API-Key",
        query: "api_key"
      });
      return null;
    }
    const rate = limiter.check(`${user.id}:${req.socket.remoteAddress}`);
    res.setHeader("X-RateLimit-Limit", String(config.rateLimit));
    res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
    if (!rate.ok) {
      fail(req, res, requestId, 429, "RATE_LIMITED", "访问频率超过公众角色限制，请稍后再试。", {
        resetAt: new Date(rate.resetAt).toISOString()
      });
      return null;
    }
    return user;
  }

  async function handleRequest(req, res) {
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    if (req.method === "OPTIONS") {
      return sendJson(req, res, 204, {});
    }
    if (requireHttps(req, res, requestId)) return;

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "api" || segments[1] !== "v1") {
      return fail(req, res, requestId, 404, "ROUTE_NOT_FOUND", "未找到接口路径。", {
        resource: url.pathname
      });
    }

    try {
      if (req.method === "GET" && segments[2] === "health") {
        return success(req, res, requestId, {
          service: "heritage-poi-api",
          status: "ok",
          poiCount: store.data.pois.length,
          httpsRequired: config.forceHttps
        });
      }

      if (req.method === "GET" && segments[2] === "docs") {
        return success(req, res, requestId, {
          title: "全国重点文物保护单位 POI REST API",
          auth: {
            publicQuery: "Header X-API-Key 或 query api_key",
            login: "POST /api/v1/auth/login 后使用 Authorization: Bearer <token>",
            demoAccount: { username: "demo", password: "Demo@123456", apiKey: "demo-public-key" },
            maintainerAccount: { username: "admin", password: "由 LBS_ADMIN_PASSWORD 环境变量设置，默认 Admin@123456" }
          },
          endpoints: [
            "POST /api/v1/auth/register",
            "POST /api/v1/auth/login",
            "GET/PATCH /api/v1/users/me",
            "POST /api/v1/apikey/rotate",
            "GET /api/v1/pois?name=&province=&category=&bbox=&center=&radius=&has_ext=&page=&pageSize=",
            "GET /api/v1/pois/{id}",
            "POST/PATCH/DELETE /api/v1/pois/{id}",
            "GET /api/v1/categories",
            "GET /api/v1/provinces",
            "GET /api/v1/stats"
          ],
          errorShape: {
            success: false,
            error: {
              httpStatus: 400,
              businessCode: "BUSINESS_CODE",
              message: "错误描述",
              debug: { requestId: "请求编号", resource: "维护资源", docs: config.docsUrl }
            }
          }
        });
      }

      if (segments[2] === "auth" && segments[3] === "register" && req.method === "POST") {
        const body = await readJson(req);
        if (!body.username || !body.password) {
          return fail(req, res, requestId, 400, "VALIDATION_FAILED", "username 与 password 为必填字段。");
        }
        const user = store.createUser(body);
        return success(req, res, requestId, { user, apiKey: user.apiKey }, 201);
      }

      if (segments[2] === "auth" && segments[3] === "login" && req.method === "POST") {
        const body = await readJson(req);
        const user = store.findUserByUsername(body.username);
        if (!user || !verifyPassword(body.password, user.passwordHash)) {
          return fail(req, res, requestId, 401, "INVALID_CREDENTIALS", "用户名或密码错误。");
        }
        const token = signToken(user, config.tokenSecret);
        return success(req, res, requestId, {
          token,
          user: publicUser(user),
          apiKey: user.apiKey
        });
      }

      if (segments[2] === "users" && segments[3] === "me" && req.method === "GET") {
        const user = requireLogin(req, res, requestId);
        if (!user) return;
        return success(req, res, requestId, { user: publicUser(user) });
      }

      if (segments[2] === "users" && segments[3] === "me" && req.method === "PATCH") {
        const user = requireLogin(req, res, requestId);
        if (!user) return;
        const body = await readJson(req);
        return success(req, res, requestId, { user: store.updateUser(user.id, body) });
      }

      if (segments[2] === "apikey" && segments[3] === "rotate" && req.method === "POST") {
        const user = requireLogin(req, res, requestId);
        if (!user) return;
        return success(req, res, requestId, { user: store.rotateApiKey(user.id) });
      }

      if (segments[2] === "categories" && req.method === "GET") {
        if (!requireApiKey(req, res, requestId, url)) return;
        return success(req, res, requestId, { items: store.categories() });
      }

      if (segments[2] === "provinces" && req.method === "GET") {
        if (!requireApiKey(req, res, requestId, url)) return;
        return success(req, res, requestId, { items: store.provinces() });
      }

      if (segments[2] === "stats" && req.method === "GET") {
        if (!requireApiKey(req, res, requestId, url)) return;
        return success(req, res, requestId, store.stats());
      }

      if (segments[2] === "pois" && !segments[3] && req.method === "GET") {
        if (!requireApiKey(req, res, requestId, url)) return;
        const bbox = parseBbox(url.searchParams.get("bbox"));
        const center = parseCenter(url.searchParams.get("center"));
        const radius = url.searchParams.has("radius") ? Number(url.searchParams.get("radius")) : undefined;
        const items = store.listPois({
          name: url.searchParams.get("name"),
          province: url.searchParams.get("province"),
          category: url.searchParams.get("category"),
          batch: url.searchParams.get("batch"),
          hasExt: normalizeBool(url.searchParams.get("has_ext")),
          bbox,
          center,
          radius
        });
        return success(req, res, requestId, paginate(items, url.searchParams.get("page"), url.searchParams.get("pageSize")));
      }

      if (segments[2] === "pois" && !segments[3] && req.method === "POST") {
        if (!requireRole(req, res, requestId, ["maintainer", "admin"])) return;
        const body = await readJson(req);
        if (!body.name || !Number.isFinite(Number(body.lng)) || !Number.isFinite(Number(body.lat))) {
          return fail(req, res, requestId, 400, "VALIDATION_FAILED", "新增 POI 至少需要 name、lng、lat。");
        }
        return success(req, res, requestId, { item: store.addPoi(body) }, 201);
      }

      if (segments[2] === "pois" && segments[3] && req.method === "GET") {
        if (!requireApiKey(req, res, requestId, url)) return;
        const item = store.getPoi(decodeURIComponent(segments[3]));
        if (!item) return fail(req, res, requestId, 404, "POI_NOT_FOUND", "未找到指定 POI。");
        return success(req, res, requestId, { item });
      }

      if (segments[2] === "pois" && segments[3] && ["PATCH", "PUT"].includes(req.method)) {
        if (!requireRole(req, res, requestId, ["maintainer", "admin"])) return;
        const body = await readJson(req);
        const item = store.updatePoi(decodeURIComponent(segments[3]), body);
        if (!item) return fail(req, res, requestId, 404, "POI_NOT_FOUND", "未找到指定 POI。");
        return success(req, res, requestId, { item });
      }

      if (segments[2] === "pois" && segments[3] && req.method === "DELETE") {
        if (!requireRole(req, res, requestId, ["maintainer", "admin"])) return;
        const deleted = store.deletePoi(decodeURIComponent(segments[3]));
        if (!deleted) return fail(req, res, requestId, 404, "POI_NOT_FOUND", "未找到指定 POI。");
        return success(req, res, requestId, { deleted: true });
      }

      return fail(req, res, requestId, 404, "ROUTE_NOT_FOUND", "未找到接口路径。", {
        resource: url.pathname
      });
    } catch (error) {
      if (error.code === "USERNAME_EXISTS") {
        return fail(req, res, requestId, 409, "USERNAME_EXISTS", "用户名已存在。");
      }
      if (error.status === 400 || error.code === "INVALID_JSON") {
        return fail(req, res, requestId, 400, "INVALID_JSON", "请求体必须是合法 JSON。");
      }
      if (error.message && (error.message.startsWith("bbox") || error.message.startsWith("center"))) {
        return fail(req, res, requestId, 400, "INVALID_GEO_QUERY", error.message);
      }
      return fail(req, res, requestId, error.status || 500, "INTERNAL_ERROR", "服务端处理失败。", {
        message: error.message,
        resource: req.url
      });
    }
  }

  const server = (config.httpsCert && config.httpsKey)
    ? https.createServer({
      cert: fs.readFileSync(config.httpsCert),
      key: fs.readFileSync(config.httpsKey)
    }, handleRequest)
    : http.createServer(handleRequest);

  server.store = store;
  server.config = config;
  return server;
}

if (require.main === module) {
  const server = createApp();
  server.listen(server.config.port, server.config.host, () => {
    const protocol = server.config.httpsCert ? "https" : "http";
    console.log(`Heritage LBS API is running at ${protocol}://${server.config.host}:${server.config.port}`);
    console.log("Demo public API key: demo-public-key");
    console.log("Maintainer login: admin / Admin@123456 (change it through LBS_ADMIN_PASSWORD)");
  });
}

module.exports = {
  createApp,
  loadConfig
};
