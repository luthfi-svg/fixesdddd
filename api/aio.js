const axios = require('axios');
const { assertSiteOpen, getSiteState } = require('./_lib/control');
const { checkRateLimit, recordRequest, recordError } = require('./_lib/analytics');
const { sendJson, methodNotAllowed, handleOptions } = require('./_lib/http');
const config = require('../config');

const VALORE_API = config.aio?.endpoint || 'https://dl.valore.web.id/api/download';

function getHost(url) {
  try {
    return new URL(String(url).trim()).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function detectAioPlatform(url) {
  const host = getHost(url);

  if (/tiktok\.com$|douyin\.com$/.test(host)) return 'tiktok';
  if (/instagram\.com$/.test(host)) return 'instagram';
  if (/youtube\.com$|youtu\.be$/.test(host)) return 'youtube';
  if (/facebook\.com$|fb\.watch$/.test(host)) return 'facebook';
  if (/twitter\.com$|x\.com$/.test(host)) return 'twitter';
  if (/pinterest\.com$|pin\.it$/.test(host)) return 'pinterest';
  if (/threads\.net$/.test(host)) return 'threads';
  if (/reddit\.com$|redd\.it$/.test(host)) return 'reddit';
  return 'other';
}

function isAioFeatureEnabled(state, platform) {
  // TikTok Stalker intentionally has no AIO toggle; it remains independent.
  if (platform === 'stalktt') return true;

  const features = state?.aio?.features || {};
  return features[platform] !== false;
}

async function scrapeValore(url) {
  const sessionId =
    'sid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

  const headers = {
    'Content-Type': 'application/json',
    'X-Session-Id': sessionId,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*'
  };

  try {
    const res = await axios.post(
      VALORE_API,
      { url },
      {
        headers,
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 2 * 1024 * 1024,
        validateStatus: () => true
      }
    );

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        res.data?.error ||
          res.data?.message ||
          `Valore API HTTP ${res.status}`
      );
    }

    if (res.data?.success === false || res.data?.status === false) {
      throw new Error(
        res.data?.error ||
          res.data?.message ||
          'Gagal scrape dari Valore.'
      );
    }

    return res.data;
  } catch (error) {
    if (error.response?.data) {
      throw new Error(
        error.response.data.error ||
          error.response.data.message ||
          error.message
      );
    }
    throw error;
  }
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  const started = Date.now();

  try {
    checkRateLimit(req, 'aio');
    await assertSiteOpen();

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    const url = String(body.url || '').trim();

    if (!url) {
      const error = new Error('URL wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    let parsed;
    try {
      parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      const error = new Error('URL tidak valid.');
      error.statusCode = 400;
      throw error;
    }

    const platform = detectAioPlatform(url);
    const state = await getSiteState();

    if (!isAioFeatureEnabled(state, platform)) {
      const error = new Error(
        `AIO ${platform.toUpperCase()} sedang dinonaktifkan oleh administrator.`
      );
      error.code = 'AIO_FEATURE_DISABLED';
      error.statusCode = 503;
      throw error;
    }

    const result = await scrapeValore(url);

    await recordRequest({
      req,
      platform: `aio:${platform}`,
      success: true,
      durationMs: Date.now() - started
    });

    return sendJson(res, 200, {
      status: true,
      platform: 'aio',
      source_platform: platform,
      data: result
    });
  } catch (error) {
    const status =
      error.statusCode ||
      (error.code === 'SITE_CLOSED' ? 503 : 500);

    if (
      error.code !== 'RATE_LIMITED' &&
      error.code !== 'AIO_FEATURE_DISABLED'
    ) {
      await recordRequest({
        req,
        platform: 'aio',
        success: false,
        durationMs: Date.now() - started,
        error: error.message
      });

      await recordError({
        req,
        platform: 'aio',
        error
      });
    }

    if (error.retryAfter) {
      res.setHeader('Retry-After', String(error.retryAfter));
    }

    console.error('[AIO]', error.message);

    return sendJson(res, status, {
      status: false,
      message: error.message || 'Gagal memproses AIO downloader.'
    });
  }
};

module.exports.scrapeValore = scrapeValore;
module.exports.detectAioPlatform = detectAioPlatform;
