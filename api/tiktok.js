const axios = require('axios');
const { assertSiteOpen } = require('./_lib/control');
const { checkRateLimit, recordRequest, recordError } = require('./_lib/analytics');
const { sendJson, methodNotAllowed, handleOptions } = require('./_lib/http');

const BASE_URL = 'https://snaptikid.com';
const API_ENDPOINT = 'https://www.tikwm.com/api/';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Origin: BASE_URL,
  Referer: `${BASE_URL}/`,
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  Accept: 'application/json, text/javascript, */*; q=0.01'
};

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(Number(bytes)) || Number(bytes) <= 0) return null;
  const mb = Number(bytes) / (1024 * 1024);
  return mb >= 1
    ? `${mb.toFixed(2)} MB`
    : `${(Number(bytes) / 1024).toFixed(2)} KB`;
}

function formatNumber(num) {
  if (typeof num === 'number') return num;
  if (!num || Number.isNaN(Number(num))) return 0;
  return Number(num);
}

function formatIsoDate(epochSeconds) {
  if (!epochSeconds) return null;
  const date = new Date(Number(epochSeconds) * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isValidTikTokUrl(input) {
  try {
    const url = new URL(String(input).trim());
    const host = url.hostname.toLowerCase();

    const allowed =
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com');

    const blocked = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::1]'
    ].includes(host);

    return allowed && !blocked && (url.protocol === 'https:' || url.protocol === 'http:');
  } catch {
    return false;
  }
}

async function downloadTikTok(tiktokUrl) {
  if (!tiktokUrl || typeof tiktokUrl !== 'string') {
    throw new Error('URL TikTok wajib diisi.');
  }

  const cleanUrl = tiktokUrl.trim();

  if (!isValidTikTokUrl(cleanUrl)) {
    throw new Error('URL TikTok tidak valid. Gunakan link tiktok.com atau vt.tiktok.com.');
  }

  const payload = new URLSearchParams({
    url: cleanUrl,
    hd: '1'
  });

  const response = await axios.post(API_ENDPOINT, payload.toString(), {
    headers: DEFAULT_HEADERS,
    timeout: 30000,
    maxBodyLength: 2 * 1024 * 1024,
    maxContentLength: 5 * 1024 * 1024
  });

  const body = response.data;

  if (!body || body.code !== 0 || !body.data) {
    throw new Error(body?.msg || 'Gagal mengambil data TikTok.');
  }

  const d = body.data;
  const downloads = [];
  const seenUrls = new Set();

  function addDownload(item) {
    if (!item?.url || seenUrls.has(item.url)) return;
    downloads.push(item);
    seenUrls.add(item.url);
  }

  if (d.hdplay) {
    addDownload({
      type: 'video',
      quality: 'HD No Watermark',
      format: 'MP4',
      resolution: d.width && d.height ? `${d.width}x${d.height}` : 'HD',
      size: formatBytes(d.hd_size || d.size),
      size_bytes: d.hd_size || d.size || null,
      url: d.hdplay
    });
  }

  if (d.play) {
    addDownload({
      type: 'video',
      quality: 'No Watermark',
      format: 'MP4',
      resolution: d.width && d.height ? `${d.width}x${d.height}` : 'SD',
      size: formatBytes(d.size),
      size_bytes: d.size || null,
      url: d.play
    });
  }

  if (d.wmplay) {
    addDownload({
      type: 'video',
      quality: 'With Watermark',
      format: 'MP4',
      resolution: d.width && d.height ? `${d.width}x${d.height}` : 'Watermarked',
      size: formatBytes(d.wm_size),
      size_bytes: d.wm_size || null,
      url: d.wmplay
    });
  }

  const audioUrl = d.music || d.music_info?.play || null;
  if (audioUrl) {
    addDownload({
      type: 'audio',
      quality: 'Original Audio',
      format: 'MP3',
      resolution: null,
      size: null,
      size_bytes: null,
      url: audioUrl
    });
  }

  const images = Array.isArray(d.images) ? Array.from(new Set(d.images)) : [];
  images.forEach((imgUrl, index) => {
    addDownload({
      type: 'image',
      quality: `Photo ${index + 1}`,
      format: 'JPEG',
      resolution: null,
      size: null,
      size_bytes: null,
      url: imgUrl
    });
  });

  return {
    status: true,
    platform: 'tiktok',
    data: {
      id: d.id || null,
      type: images.length ? 'slide' : 'video',
      title: String(d.title || '').trim(),
      region: d.region || null,
      duration_seconds: d.duration || 0,
      created_at: formatIsoDate(d.create_time),
      cover: d.cover || d.origin_cover || null,
      author: {
        id: d.author?.id || null,
        username: d.author?.unique_id || null,
        nickname: d.author?.nickname || null,
        avatar: d.author?.avatar || null
      },
      statistics: {
        views: formatNumber(d.play_count),
        likes: formatNumber(d.digg_count),
        comments: formatNumber(d.comment_count),
        shares: formatNumber(d.share_count),
        saves: formatNumber(d.collect_count)
      },
      music: d.music_info
        ? {
            id: d.music_info.id || null,
            title: d.music_info.title || null,
            author: d.music_info.author || null,
            duration_seconds: d.music_info.duration || null,
            url: audioUrl
          }
        : null,
      video_nowm: d.hdplay || d.play || null,
      video_wm:
        d.wmplay && d.wmplay !== d.play && d.wmplay !== d.hdplay
          ? d.wmplay
          : null,
      images,
      downloads
    }
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  const started = Date.now();
  try {
    checkRateLimit(req, 'tiktok');
    await assertSiteOpen();

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const url = body.url || body.tiktokUrl;
    const result = await downloadTikTok(url);
    await recordRequest({ req, platform: 'tiktok', success: true, durationMs: Date.now() - started });
    res.setHeader('X-RateLimit-Remaining', 'available');
    return sendJson(res, 200, result);
  } catch (error) {
    const status = error.statusCode || (error.code === 'SITE_CLOSED' ? 503 : 500);
    if (error.code !== 'RATE_LIMITED') {
      await recordRequest({ req, platform: 'tiktok', success: false, durationMs: Date.now() - started, error: error.message });
      await recordError({ req, platform: 'tiktok', error });
    }
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    console.error('[TIKTOK]', error.message);
    return sendJson(res, status, { status: false, message: error.message || 'Terjadi kesalahan pada server.' });
  }
};

module.exports.downloadTikTok = downloadTikTok;
module.exports.isValidTikTokUrl = isValidTikTokUrl;
