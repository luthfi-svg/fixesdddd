const axios = require('axios');
const { assertSiteOpen } = require('./_lib/control');
const { sendJson, methodNotAllowed, handleOptions } = require('./_lib/http');

const API_BASE = 'https://igexport.com/api/ig-reels/';

function isValidInstagramUrl(input) {
  try {
    const url = new URL(String(input).trim());
    const host = url.hostname.toLowerCase();

    const allowed =
      host === 'instagram.com' ||
      host.endsWith('.instagram.com');

    const blocked = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::1]'
    ].includes(host);

    const supportedPath = /^\/(reel|reels|p|tv)\b/i.test(url.pathname);

    return (
      allowed &&
      !blocked &&
      supportedPath &&
      (url.protocol === 'https:' || url.protocol === 'http:')
    );
  } catch {
    return false;
  }
}

function looksLikeMediaUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false;
  const lower = value.toLowerCase();

  if (lower.includes('instagram.com')) return false;
  if (lower.includes('igexport.com')) return false;

  return (
    /\.(mp4|m4v|mov|webm)(?:$|[?#])/i.test(lower) ||
    lower.includes('mime=video') ||
    lower.includes('video_url') ||
    lower.includes('video') ||
    lower.includes('download')
  );
}

function findMediaUrls(node, path = '', found = []) {
  if (!node || found.length >= 20) return found;

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      findMediaUrls(node[i], `${path}[${i}]`, found);
      if (found.length >= 20) break;
    }
    return found;
  }

  if (typeof node !== 'object') return found;

  const priorityKeys = [
    'video_url',
    'videoUrl',
    'download_url',
    'downloadUrl',
    'video',
    'videoSrc',
    'video_src',
    'media_url',
    'mediaUrl',
    'play',
    'url',
    'src'
  ];

  for (const key of priorityKeys) {
    const value = node[key];
    if (looksLikeMediaUrl(value) && !found.some((item) => item.url === value)) {
      found.push({
        url: value,
        sourceKey: key,
        path: path ? `${path}.${key}` : key
      });
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (found.length >= 20) break;
    if (typeof value === 'object' && value !== null) {
      findMediaUrls(value, path ? `${path}.${key}` : key, found);
    }
  }

  return found;
}

function findFirstString(node, keys, depth = 0) {
  if (!node || depth > 8) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findFirstString(item, keys, depth + 1);
      if (result) return result;
    }
    return null;
  }

  if (typeof node !== 'object') return null;

  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  for (const value of Object.values(node)) {
    const result = findFirstString(value, keys, depth + 1);
    if (result) return result;
  }

  return null;
}

async function downloadInstagram(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('URL Instagram wajib diisi.');
  }

  const cleanUrl = inputUrl.trim();

  if (!isValidInstagramUrl(cleanUrl)) {
    throw new Error('URL Instagram tidak valid. Gunakan link instagram.com/reel/... atau instagram.com/p/....');
  }

  const targetUrl =
    `${API_BASE}?url=${encodeURIComponent(cleanUrl)}&videoOnly=1`;

  const response = await axios.get(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://igexport.com/',
      Origin: 'https://igexport.com'
    },
    timeout: 30000,
    maxContentLength: 10 * 1024 * 1024
  });

  const raw = response.data;
  const media = findMediaUrls(raw);

  const video = media[0]?.url || null;
  if (!video) {
    throw new Error('Video Instagram tidak ditemukan pada respons scraper.');
  }

  const title =
    findFirstString(raw, [
      'title',
      'caption',
      'description',
      'desc',
      'text'
    ]) || 'Instagram Reel';

  const cover =
    findFirstString(raw, [
      'thumbnail',
      'thumbnail_url',
      'thumbnailUrl',
      'cover',
      'coverUrl',
      'image',
      'poster'
    ]) || null;

  const author =
    findFirstString(raw, [
      'username',
      'user_name',
      'author',
      'nickname',
      'owner'
    ]) || null;

  return {
    status: true,
    platform: 'instagram',
    data: {
      type: 'video',
      title,
      cover,
      author: {
        username: author
      },
      statistics: {},
      video_nowm: video,
      images: [],
      downloads: [
        {
          type: 'video',
          quality: 'Instagram Video',
          format: 'MP4',
          resolution: 'Auto',
          size: null,
          size_bytes: null,
          url: video
        }
      ],
      source: cleanUrl
    }
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    await assertSiteOpen();

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const url = body.url || body.instagramUrl || body.igUrl;
    const result = await downloadInstagram(url);

    return sendJson(res, 200, result);
  } catch (error) {
    const status = error.statusCode || (error.code === 'SITE_CLOSED' ? 503 : 500);

    console.error('[INSTAGRAM]', error.message);

    return sendJson(res, status, {
      status: false,
      message: error.message || 'Terjadi kesalahan pada server.'
    });
  }
};

module.exports.downloadInstagram = downloadInstagram;
module.exports.isValidInstagramUrl = isValidInstagramUrl;
