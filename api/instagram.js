const axios = require('axios');

const { assertSiteOpen } = require('./_lib/control');
const {
  sendJson,
  methodNotAllowed,
  handleOptions
} = require('./_lib/http');

const API_ENDPOINT = 'https://api-faa.my.id/faa/aio';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01'
};

function formatNumber(value) {
  if (typeof value === 'number') return value;

  if (
    value === null ||
    value === undefined ||
    value === '' ||
    Number.isNaN(Number(value))
  ) {
    return 0;
  }

  return Number(value);
}

function parseDuration(value) {
  if (!value) return 0;

  if (typeof value === 'number') {
    return value;
  }

  const text = String(value).trim();

  // 00:35
  const timeMatch = text.match(/^(\d+):(\d+)(?::(\d+))?$/);

  if (timeMatch) {
    if (timeMatch[3] !== undefined) {
      return (
        Number(timeMatch[1]) * 3600 +
        Number(timeMatch[2]) * 60 +
        Number(timeMatch[3])
      );
    }

    return (
      Number(timeMatch[1]) * 60 +
      Number(timeMatch[2])
    );
  }

  const numberMatch = text.match(/\d+(?:\.\d+)?/);

  return numberMatch ? Number(numberMatch[0]) : 0;
}

function isValidInstagramUrl(input) {
  try {
    const parsed = new URL(String(input).trim());
    const host = parsed.hostname.toLowerCase();

    const allowed =
      host === 'instagram.com' ||
      host === 'www.instagram.com' ||
      host === 'm.instagram.com' ||
      host.endsWith('.instagram.com');

    const blocked = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::1]'
    ].includes(host);

    return (
      allowed &&
      !blocked &&
      (
        parsed.protocol === 'https:' ||
        parsed.protocol === 'http:'
      )
    );
  } catch {
    return false;
  }
}

function cleanUrl(value) {
  if (!value || typeof value !== 'string') return null;

  const url = value.trim();

  if (
    !url ||
    !/^https?:\/\//i.test(url)
  ) {
    return null;
  }

  return url;
}

async function downloadInstagram(instagramUrl) {
  if (!instagramUrl || typeof instagramUrl !== 'string') {
    throw new Error('URL Instagram wajib diisi.');
  }

  const clean = instagramUrl.trim();

  if (!isValidInstagramUrl(clean)) {
    throw new Error(
      'URL Instagram tidak valid. Gunakan link instagram.com/reel/... atau instagram.com/p/...'
    );
  }

  const apiUrl =
    `${API_ENDPOINT}?url=${encodeURIComponent(clean)}`;

  let response;

  try {
    response = await axios.get(apiUrl, {
      headers: DEFAULT_HEADERS,
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024,
      maxBodyLength: 10 * 1024 * 1024,
      validateStatus: () => true
    });
  } catch (error) {
    console.error(
      '[INSTAGRAM API REQUEST]',
      error.message
    );

    throw new Error(
      'Gagal menghubungi scraper Instagram.'
    );
  }

  if (response.status < 200 || response.status >= 300) {
    console.error(
      '[INSTAGRAM API STATUS]',
      response.status,
      response.data
    );

    throw new Error(
      `Scraper Instagram mengembalikan HTTP ${response.status}.`
    );
  }

  const body = response.data;

  console.log(
    '[INSTAGRAM FAA RESPONSE]',
    JSON.stringify(body)
  );

  if (!body) {
    throw new Error(
      'Scraper Instagram tidak memberikan respons.'
    );
  }

  /*
   * FAA AIO biasanya:
   *
   * {
   *   status: true,
   *   result: {...}
   * }
   *
   * Tetapi beberapa versi API bisa membungkus
   * response lebih dalam.
   */

  let d = null;

  if (
    body.result &&
    typeof body.result === 'object'
  ) {
    d = body.result;
  } else if (
    body.data &&
    typeof body.data === 'object'
  ) {
    d = body.data;
  }

  if (!d) {
    throw new Error(
      body.message ||
      body.msg ||
      'Scraper Instagram tidak mengembalikan data media.'
    );
  }

  /*
   * ==========================================
   * DOWNLOADS
   * ==========================================
   */

  const downloads = [];
  const seen = new Set();

  function addDownload(item) {
    const url = cleanUrl(item?.url);

    if (!url || seen.has(url)) {
      return;
    }

    seen.add(url);

    downloads.push({
      type: item.type || 'video',
      quality:
        item.quality ||
        item.label ||
        item.name ||
        'Default',
      format:
        item.format ||
        (
          item.type === 'audio'
            ? 'MP3'
            : item.type === 'image'
              ? 'JPEG'
              : 'MP4'
        ),
      resolution:
        item.resolution ||
        null,
      size:
        item.size ||
        null,
      size_bytes:
        item.size_bytes ||
        item.bytes ||
        null,
      url
    });
  }

  /*
   * FAA downloads
   */

  if (Array.isArray(d.downloads)) {
    for (const item of d.downloads) {
      addDownload(item);
    }
  }

  /*
   * Beberapa response menggunakan media
   * langsung di field lain.
   */

  const directVideoUrls = [
    d.video_nowm,
    d.video,
    d.video_url,
    d.url_video,
    d.download
  ];

  for (const url of directVideoUrls) {
    if (typeof url === 'string') {
      addDownload({
        type: 'video',
        quality: 'No Watermark',
        format: 'MP4',
        url
      });
    }
  }

  /*
   * Watermark
   */

  const watermarkUrls = [
    d.video_wm,
    d.video_watermark,
    d.wm
  ];

  for (const url of watermarkUrls) {
    if (typeof url === 'string') {
      addDownload({
        type: 'video',
        quality: 'With Watermark',
        format: 'MP4',
        url
      });
    }
  }

  /*
   * Audio
   */

  const audioUrls = [
    d.audio,
    d.audio_url,
    d.music?.url,
    d.music
  ];

  for (const url of audioUrls) {
    if (typeof url === 'string') {
      addDownload({
        type: 'audio',
        quality: 'Original Audio',
        format: 'MP3',
        url
      });
    }
  }

  /*
   * ==========================================
   * IMAGES
   * ==========================================
   */

  const images = [];

  function addImage(url) {
    const clean = cleanUrl(url);

    if (!clean || images.includes(clean)) {
      return;
    }

    images.push(clean);

    addDownload({
      type: 'image',
      quality: `Photo ${images.length}`,
      format: 'JPEG',
      url: clean
    });
  }

  if (Array.isArray(d.images)) {
    for (const image of d.images) {
      if (typeof image === 'string') {
        addImage(image);
      } else if (image?.url) {
        addImage(image.url);
      }
    }
  }

  /*
   * Beberapa API menggunakan image/photo/media.
   */

  if (Array.isArray(d.photos)) {
    for (const image of d.photos) {
      if (typeof image === 'string') {
        addImage(image);
      } else if (image?.url) {
        addImage(image.url);
      }
    }
  }

  if (Array.isArray(d.media)) {
    for (const media of d.media) {
      if (
        media?.type === 'image' ||
        media?.type === 'photo'
      ) {
        addImage(media.url);
      }
    }
  }

  /*
   * ==========================================
   * MEDIA URL
   * ==========================================
   */

  const videoDownloads =
    downloads.filter(
      item => item.type === 'video'
    );

  const audioDownloads =
    downloads.filter(
      item => item.type === 'audio'
    );

  const imageDownloads =
    downloads.filter(
      item => item.type === 'image'
    );

  /*
   * Kalau d.url berupa array
   */

  if (Array.isArray(d.url)) {
    for (const url of d.url) {
      const clean = cleanUrl(url);

      if (!clean) continue;

      /*
       * Jangan masukkan URL yang sudah ada.
       */

      if (!seen.has(clean)) {
        addDownload({
          type: 'video',
          quality: 'Default',
          format: 'MP4',
          url: clean
        });
      }
    }
  }

  /*
   * Kalau d.url berupa string
   */

  if (
    typeof d.url === 'string' &&
    cleanUrl(d.url)
  ) {
    const clean = cleanUrl(d.url);

    if (!seen.has(clean)) {
      addDownload({
        type: 'video',
        quality: 'Default',
        format: 'MP4',
        url: clean
      });
    }
  }

  /*
   * ==========================================
   * REFRESH FILTER
   * ==========================================
   */

  const finalVideos =
    downloads.filter(
      item => item.type === 'video'
    );

  const finalAudios =
    downloads.filter(
      item => item.type === 'audio'
    );

  const finalImages =
    downloads.filter(
      item => item.type === 'image'
    );

  /*
   * ==========================================
   * TYPE
   * ==========================================
   */

  const isVideo =
    finalVideos.length > 0 ||
    Boolean(d.video) ||
    Boolean(d.video_nowm) ||
    Boolean(d.video_url);

  let type = 'image';

  if (isVideo) {
    type = 'reel';
  }

  if (
    finalImages.length > 0 &&
    !isVideo
  ) {
    type = 'post';
  }

  /*
   * ==========================================
   * TITLE
   * ==========================================
   */

  const title = String(
    d.title ||
    d.caption ||
    d.description ||
    'Instagram Media'
  ).trim();

  /*
   * ==========================================
   * AUTHOR
   * ==========================================
   */

  const authorSource =
    d.author &&
    typeof d.author === 'object'
      ? d.author
      : {};

  const username =
    authorSource.username ||
    authorSource.unique_id ||
    authorSource.uniqueId ||
    d.username ||
    d.author_username ||
    null;

  const nickname =
    authorSource.nickname ||
    authorSource.name ||
    d.nickname ||
    username ||
    'Instagram';

  /*
   * ==========================================
   * STATISTICS
   * ==========================================
   */

  const statisticsSource =
    d.statistics &&
    typeof d.statistics === 'object'
      ? d.statistics
      : {};

  const likes =
    statisticsSource.likes ??
    statisticsSource.like ??
    d.likes ??
    d.like ??
    0;

  const comments =
    statisticsSource.comments ??
    statisticsSource.comment ??
    d.comments ??
    d.comment ??
    0;

  const views =
    statisticsSource.views ??
    statisticsSource.view ??
    d.views ??
    d.view ??
    0;

  const shares =
    statisticsSource.shares ??
    statisticsSource.share ??
    d.shares ??
    d.share ??
    0;

  /*
   * ==========================================
   * COVER
   * ==========================================
   */

  const cover =
    cleanUrl(d.thumbnail) ||
    cleanUrl(d.cover) ||
    cleanUrl(d.cover_url) ||
    cleanUrl(d.image) ||
    finalImages[0]?.url ||
    null;

  /*
   * ==========================================
   * VIDEO
   * ==========================================
   */

  const videoNowm =
    cleanUrl(d.video_nowm) ||
    cleanUrl(d.video) ||
    cleanUrl(d.video_url) ||
    finalVideos[0]?.url ||
    null;

  const videoWm =
    cleanUrl(d.video_wm) ||
    cleanUrl(d.video_watermark) ||
    cleanUrl(d.wm) ||
    null;

  /*
   * ==========================================
   * AUDIO
   * ==========================================
   */

  const audio =
    cleanUrl(d.audio) ||
    cleanUrl(d.audio_url) ||
    cleanUrl(d.music?.url) ||
    finalAudios[0]?.url ||
    null;

  /*
   * ==========================================
   * VALIDASI MEDIA
   * ==========================================
   */

  if (
    !videoNowm &&
    !audio &&
    !finalImages.length &&
    !downloads.length
  ) {
    throw new Error(
      'Media Instagram tidak ditemukan pada respons scraper.'
    );
  }

  /*
   * ==========================================
   * FORMAT FINAL
   * ==========================================
   *
   * SENGAJA dibuat sama dengan TikTok API.
   */

  return {
    status: true,
    platform: 'instagram',

    data: {
      id:
        d.id ||
        d.shortcode ||
        d.code ||
        null,

      type,

      title,

      region: null,

      duration_seconds:
        parseDuration(
          d.duration ||
          d.duration_seconds
        ),

      created_at:
        d.created_at ||
        d.timestamp ||
        null,

      cover,

      author: {
        id:
          authorSource.id ||
          null,

        username,

        nickname,

        avatar:
          cleanUrl(
            authorSource.avatar ||
            authorSource.profile_pic ||
            authorSource.profile_picture ||
            d.avatar
          ) || null
      },

      statistics: {
        views: formatNumber(views),
        likes: formatNumber(likes),
        comments: formatNumber(comments),
        shares: formatNumber(shares),
        saves: formatNumber(
          statisticsSource.saves ??
          d.saves ??
          0
        )
      },

      music: audio
        ? {
            id: null,
            title:
              d.music?.title ||
              d.audio_title ||
              null,
            author:
              d.music?.author ||
              null,
            duration_seconds:
              parseDuration(
                d.music?.duration
              ),
            url: audio
          }
        : null,

      video_nowm: videoNowm,

      video_wm:
        videoWm &&
        videoWm !== videoNowm
          ? videoWm
          : null,

      images: images,

      downloads: downloads
    }
  };
}


/*
 * ==========================================
 * VERCEL HANDLER
 * ==========================================
 */

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res);
  }

  try {
    await assertSiteOpen();

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const url =
      body.url ||
      body.instagramUrl;

    const result =
      await downloadInstagram(url);

    return sendJson(
      res,
      200,
      result
    );

  } catch (error) {
    const status =
      error.statusCode ||
      (
        error.code === 'SITE_CLOSED'
          ? 503
          : 500
      );

    console.error(
      '[INSTAGRAM]',
      error.stack || error.message
    );

    return sendJson(
      res,
      status,
      {
        status: false,
        message:
          error.message ||
          'Terjadi kesalahan pada server.'
      }
    );
  }
};

module.exports.downloadInstagram =
  downloadInstagram;

module.exports.isValidInstagramUrl =
  isValidInstagramUrl;
