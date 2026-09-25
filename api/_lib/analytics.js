const axios = require('axios');
const config = require('../../config');
const { getGistJson, updateGistJson } = require('./control');

const rateBuckets = new Map();

function nowIso() {
  return new Date().toISOString();
}

function getClientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req?.headers?.['x-real-ip'] || req?.headers?.['cf-connecting-ip'] || 'unknown').trim() || 'unknown';
}

function detectDevice(userAgent = '') {
  const ua = String(userAgent);
  const lower = ua.toLowerCase();

  let type = 'Desktop';
  if (/ipad|tablet|playbook|silk/i.test(ua) || (lower.includes('android') && !/mobile/i.test(ua))) type = 'Tablet';
  else if (/android|iphone|ipod|windows phone|mobile/i.test(ua)) type = 'Mobile';

  let os = 'Unknown';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua)) browser = 'Opera';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';

  return { type, os, browser };
}

function cleanKey(value, fallback = 'unknown') {
  return String(value || fallback).slice(0, 80);
}

function pruneRateBuckets() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of rateBuckets) {
    if (value.startedAt < cutoff) rateBuckets.delete(key);
  }
}

function checkRateLimit(req, bucket = 'global') {
  pruneRateBuckets();
  const ip = getClientIp(req);
  const limit = Math.max(1, Number(config.security?.rateLimitMax || 30));
  const windowMs = Math.max(5000, Number(config.security?.rateLimitWindowMs || 60000));
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  let item = rateBuckets.get(key);

  if (!item || now - item.startedAt >= windowMs) {
    item = { startedAt: now, count: 0 };
  }

  item.count += 1;
  rateBuckets.set(key, item);

  if (item.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - item.startedAt)) / 1000));
    const error = new Error(`Terlalu banyak request. Coba lagi dalam ${retryAfter} detik.`);
    error.code = 'RATE_LIMITED';
    error.statusCode = 429;
    error.retryAfter = retryAfter;
    throw error;
  }

  return { ip, remaining: Math.max(0, limit - item.count), limit };
}

function baseAnalytics() {
  return {
    version: 1,
    updatedAt: null,
    totals: { requests: 0, successes: 0, failures: 0 },
    byPlatform: {},
    byDevice: {},
    daily: {},
    hourly: {},
    recent: []
  };
}

function normalizeAnalytics(value) {
  const base = baseAnalytics();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  return {
    ...base,
    ...value,
    totals: { ...base.totals, ...(value.totals || {}) },
    byPlatform: value.byPlatform || {},
    byDevice: value.byDevice || {},
    daily: value.daily || {},
    hourly: value.hourly || {},
    recent: Array.isArray(value.recent) ? value.recent : []
  };
}

function bump(obj, key, amount = 1) {
  const safe = cleanKey(key);
  obj[safe] = Number(obj[safe] || 0) + amount;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function hourKey(date = new Date()) {
  return date.toISOString().slice(0, 13);
}

async function recordRequest({ req, platform, success, durationMs = 0, error = '' }) {
  try {
    const analytics = normalizeAnalytics(await getGistJson(config.control.analyticsFileName, baseAnalytics()));
    const now = new Date();
    const device = detectDevice(req?.headers?.['user-agent'] || '');
    const day = dayKey(now);
    const hour = hourKey(now);
    const key = cleanKey(platform);

    analytics.totals.requests += 1;
    analytics.totals[success ? 'successes' : 'failures'] += 1;

    if (!analytics.byPlatform[key]) analytics.byPlatform[key] = { requests: 0, successes: 0, failures: 0 };
    analytics.byPlatform[key].requests += 1;
    analytics.byPlatform[key][success ? 'successes' : 'failures'] += 1;

    bump(analytics.byDevice, device.type);

    if (!analytics.daily[day]) analytics.daily[day] = { requests: 0, successes: 0, failures: 0 };
    analytics.daily[day].requests += 1;
    analytics.daily[day][success ? 'successes' : 'failures'] += 1;

    if (!analytics.hourly[hour]) analytics.hourly[hour] = 0;
    analytics.hourly[hour] += 1;

    analytics.recent.unshift({
      time: nowIso(),
      platform: key,
      success: Boolean(success),
      durationMs: Math.max(0, Math.round(durationMs)),
      device: device.type,
      os: device.os,
      browser: device.browser,
      error: success ? null : String(error || '').slice(0, 300)
    });

    analytics.recent = analytics.recent.slice(0, 100);
    const keepDays = Math.max(7, Number(config.analytics?.retentionDays || 90));
    const cutoff = new Date(now.getTime() - keepDays * 86400000);
    for (const keyName of Object.keys(analytics.daily)) {
      if (new Date(`${keyName}T00:00:00.000Z`) < cutoff) delete analytics.daily[keyName];
    }
    for (const keyName of Object.keys(analytics.hourly)) {
      if (new Date(`${keyName}:00:00.000Z`) < cutoff) delete analytics.hourly[keyName];
    }

    analytics.updatedAt = nowIso();
    await updateGistJson(config.control.analyticsFileName, analytics);
  } catch (logError) {
    console.error('[ANALYTICS]', logError.message);
  }
}

function baseVisitors() {
  return { version: 1, updatedAt: null, visitors: [] };
}

async function recordVisitor(req) {
  const ip = getClientIp(req);
  const ua = String(req?.headers?.['user-agent'] || '');
  const device = detectDevice(ua);
  const entry = {
    time: nowIso(),
    ip: ip.slice(0, 120),
    device: device.type,
    os: device.os,
    browser: device.browser,
    path: String(req?.body?.path || req?.headers?.referer || '/').slice(0, 300)
  };

  try {
    const data = await getGistJson(config.control.visitorFileName, baseVisitors());
    data.visitors = Array.isArray(data.visitors) ? data.visitors : [];
    data.visitors.unshift(entry);

    const retentionMs = Math.max(1, Number(config.analytics?.visitorRetentionDays || 7)) * 86400000;
    const cutoff = Date.now() - retentionMs;
    data.visitors = data.visitors.filter((item) => new Date(item.time).getTime() >= cutoff).slice(0, 1000);
    data.updatedAt = nowIso();
    await updateGistJson(config.control.visitorFileName, data);
  } catch (error) {
    console.error('[VISITOR]', error.message);
  }

  return { ip, device };
}

function baseErrors() {
  return { version: 1, updatedAt: null, errors: [] };
}

async function recordError({ req, platform, error }) {
  try {
    const data = await getGistJson(config.control.errorFileName, baseErrors());
    data.errors = Array.isArray(data.errors) ? data.errors : [];
    data.errors.unshift({
      time: nowIso(),
      platform: cleanKey(platform),
      message: String(error?.message || error || 'Unknown error').slice(0, 500),
      code: String(error?.code || '').slice(0, 80),
      ip: getClientIp(req).slice(0, 120),
      device: detectDevice(req?.headers?.['user-agent'] || '')
    });
    data.errors = data.errors.slice(0, 300);
    data.updatedAt = nowIso();
    await updateGistJson(config.control.errorFileName, data);
  } catch (logError) {
    console.error('[ERROR-LOGGER]', logError.message);
  }
}

async function getDashboardData() {
  const [analytics, visitors, errors] = await Promise.all([
    getGistJson(config.control.analyticsFileName, baseAnalytics()),
    getGistJson(config.control.visitorFileName, baseVisitors()),
    getGistJson(config.control.errorFileName, baseErrors())
  ]);

  const today = dayKey();
  const todayStats = normalizeAnalytics(analytics).daily[today] || { requests: 0, successes: 0, failures: 0 };
  const recentVisitors = Array.isArray(visitors.visitors) ? visitors.visitors.slice(0, 10) : [];
  const recentErrors = Array.isArray(errors.errors) ? errors.errors.slice(0, 10) : [];

  return {
    analytics: normalizeAnalytics(analytics),
    today: todayStats,
    recentVisitors,
    recentErrors,
    errorCount: Array.isArray(errors.errors) ? errors.errors.length : 0
  };
}

async function clearLogs() {
  await Promise.all([
    updateGistJson(config.control.visitorFileName, baseVisitors()),
    updateGistJson(config.control.errorFileName, baseErrors())
  ]);
  return true;
}

async function checkHealth() {
  const started = Date.now();
  const checks = [];

  async function check(name, url) {
    const t = Date.now();
    try {
      const response = await axios.get(url, { timeout: 8000, validateStatus: () => true });
      checks.push({ name, ok: response.status >= 200 && response.status < 500, status: response.status, latencyMs: Date.now() - t });
    } catch (error) {
      checks.push({ name, ok: false, status: null, latencyMs: Date.now() - t, error: error.message });
    }
  }

  await Promise.all([
    check('TikTok API', 'https://www.tikwm.com/'),
    check('Instagram scraper', 'https://igexport.com/id/reels-download/'),
    check('TikTok website', 'https://www.tiktok.com/')
  ]);

  return { checkedAt: nowIso(), totalLatencyMs: Date.now() - started, checks, healthy: checks.every((item) => item.ok) };
}

module.exports = {
  getClientIp,
  detectDevice,
  checkRateLimit,
  recordVisitor,
  recordRequest,
  recordError,
  getDashboardData,
  clearLogs,
  checkHealth
};
