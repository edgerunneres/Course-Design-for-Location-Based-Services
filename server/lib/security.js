"use strict";

const crypto = require("node:crypto");

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function randomId(prefix = "") {
  return `${prefix}${crypto.randomBytes(16).toString("hex")}`;
}

function createApiKey() {
  return `lbs_${crypto.randomBytes(24).toString("base64url")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const test = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
}

function signToken(user, secret, ttlSeconds = 8 * 60 * 60) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const encoded = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(fromBase64url(payload));
  if (data.exp < Math.floor(Date.now() / 1000)) return null;
  return data;
}

class RateLimiter {
  constructor({ limit = 120, windowMs = 60_000, cleanupMs = 5 * 60_000, maxBuckets = 10_000 } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxBuckets = maxBuckets;
    this.buckets = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);
    if (typeof this.cleanupInterval.unref === "function") {
      this.cleanupInterval.unref();
    }
  }

  check(key) {
    const now = Date.now();
    const bucketKey = String(key || "anonymous");
    const current = this.buckets.get(bucketKey);
    if (!current || current.resetAt <= now) {
      this.buckets.set(bucketKey, { count: 1, resetAt: now + this.windowMs, lastSeen: now });
      if (this.buckets.size > this.maxBuckets) this.cleanup(now);
      return { ok: true, remaining: this.limit - 1, resetAt: now + this.windowMs };
    }
    current.count += 1;
    current.lastSeen = now;
    return {
      ok: current.count <= this.limit,
      remaining: Math.max(0, this.limit - current.count),
      resetAt: current.resetAt
    };
  }

  cleanup(now = Date.now()) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
    if (this.buckets.size <= this.maxBuckets) return;
    const overflow = this.buckets.size - this.maxBuckets;
    const oldest = [...this.buckets.entries()]
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
      .slice(0, overflow);
    for (const [key] of oldest) {
      this.buckets.delete(key);
    }
  }
}

module.exports = {
  RateLimiter,
  createApiKey,
  hashPassword,
  randomId,
  signToken,
  verifyPassword,
  verifyToken
};
