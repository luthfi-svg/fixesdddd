const axios = require('axios');
const { assertSiteOpen } = require('./_lib/control');
const { checkRateLimit, recordRequest, recordError } = require('./_lib/analytics');
const { sendJson, methodNotAllowed, handleOptions } = require('./_lib/http');

const BASE_URL = 'https://igexport.com';
const REFERER = `${BASE_URL}/id/reels-download/`;

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: REFERER,
  Origin: BASE_URL,
  Accept: 'application/json, text/plain, */*'
};

function cleanInstagramUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return '';

  const trimmed = inputUrl.trim();

  const match = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)\/?/i
  );

  if (!match) return '';

  return `https://www.instagram.com/${trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split(/[?#]/)[0]
    .replace(/\/+$/, '')
    .replace(/^instagram\.com\//i, '')}/`;
}

function extractShortcode(inputUrl) {
  const match = String(inputUrl || '').match(
    /\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i
  );

  return match ? match[1] : '';
}

function isValidInstagramUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return false;

  try {
    const url = new URL(inputUrl.trim());
    const host = url.hostname.toLowerCase();

    const allowedHost =
      host === 'instagram.com' ||
      host === 'www.instagram.com';

    const validPath =
      /^\/(?:reel|p|tv)\/[a-zA-Z0-9_-]+\/?$/i.test(url.pathname);

    return (
      allowedHost &&
      validPath &&
      (url.protocol === 'https:' || url.protocol === 'http:')
    );
  } catch {
    return false;
  }
}

async function fetchFromApi(endpoint, targetUrl) {
  const requestUrl =
    `${BASE_URL}${endpoint}?url=${encodeURIComponent(targetUrl)}`;

  const response = await axios.get(requestUrl, {
    headers: DEFAULT_HEADERS,
    timeout: 20000,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 2 * 1024 * 1024
  });

  return response.data;
}

async function igexportInstagram(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('URL Instagram harus diisi.');
  }

  const cleanedUrl = cleanInstagramUrl(inputUrl);
  const shortcode = extractShortcode(cleanedUrl);

  if (!cleanedUrl || !shortcode || !isValidInstagramUrl(cleanedUrl)) {
    throw new Error(
      'Format URL tidak valid. Gunakan URL Instagram /reel/, /p/, atau /tv/.'
    );
  }

  let apiData = null;
  let lastError = null;

  try {
    apiData = await fetchFromApi('/api/ig-reels/', cleanedUrl);
  } catch (error) {
    lastError = error;
  }

  if (!apiData?.ok) {
    try {
      apiData = await fetchFromApi('/api/ig-photo/', cleanedUrl);
    } catch (error) {
      lastError = error;
    }
  }

  if (!apiData?.ok) {
    const errorMessage =
      apiData?.error ||
      lastError?.message ||
      'Instagram tidak dapat diproses atau akun bersifat privat.';

    throw new Error(`Gagal memproses Instagram: ${errorMessage}`);
  }

  const media = apiData.media || {};

  let videoUrl = null;
  let thumbnailUrl = null;
  let filename = `lutsave-instagram-${shortcode}.mp4`;

  if (media.videoUrl) {
    videoUrl = media.videoUrl;
    thumbnailUrl = media.thumbnailUrl || null;
    filename = media.filename || filename;
  } else if (Array.isArray(media.items) && media.items.length) {
    const videoItem =
      media.items.find(
        (item) => String(item?.type || '').toLowerCase() === 'video'
      ) || media.items[0];

    videoUrl = videoItem?.url || null;
    thumbnailUrl = videoItem?.thumbnailUrl || null;
    filename = videoItem?.filename || filename;
  }

  if (!videoUrl) {
    throw new Error(
      'Video tidak ditemukan di dalam tautan Instagram tersebut.'
    );
  }

  const downloads = [
    {
      type: 'video',
      quality: 'Original / High Quality',
      format: 'MP4',
      resolution: null,
      size: null,
      size_bytes: null,
      url: videoUrl
    }
  ];

  return {
    status: true,
    platform: 'instagram',
    data: {
      id: shortcode,
      type: 'video',
      title: filename.replace(/\.mp4$/i, ''),
      cover: thumbnailUrl,
      author: {},
      statistics: {},
      duration_seconds: 0,
      video_nowm: videoUrl,
      video_wm: null,
      images: [],
      downloads,
      instagram: {
        shortcode,
        post_url: cleanedUrl,
        filename
      }
    }
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  const started = Date.now();
  try {
    checkRateLimit(req, 'instagram');
    await assertSiteOpen();

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    const result = await igexportInstagram(body.url);
    await recordRequest({ req, platform: 'instagram', success: true, durationMs: Date.now() - started });
    return sendJson(res, 200, result);
  } catch (error) {
    const status = error.statusCode || (error.code === 'SITE_CLOSED' ? 503 : 500);
    if (error.code !== 'RATE_LIMITED') {
      await recordRequest({ req, platform: 'instagram', success: false, durationMs: Date.now() - started, error: error.message });
      await recordError({ req, platform: 'instagram', error });
    }
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    console.error('[INSTAGRAM]', error.message);
    return sendJson(res, status, { status: false, message: error.message || 'Terjadi kesalahan saat memproses Instagram.' });
  }
};

module.exports.igexportInstagram = igexportInstagram;
module.exports.cleanInstagramUrl = cleanInstagramUrl;
module.exports.extractShortcode = extractShortcode;
module.exports.isValidInstagramUrl = isValidInstagramUrl;
