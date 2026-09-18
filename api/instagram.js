const axios = require('axios');

const API_ENDPOINT = 'https://api-faa.my.id/faa/aio';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept':
    'application/json, text/javascript, */*; q=0.01'
};


/* ==========================================
 * HELPER
 * ========================================== */

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) {
    return null;
  }

  const mb = bytes / (1024 * 1024);

  return mb >= 1
    ? `${mb.toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(2)} KB`;
}


function parseDurationToSeconds(duration) {
  if (!duration) return 0;

  if (typeof duration === 'number') {
    return duration;
  }

  const match = String(duration).match(/(\d+)/);

  return match ? Number(match[1]) : 0;
}


/* ==========================================
 * INSTAGRAM SCRAPER
 * ========================================== */

async function downloadInstagram(url) {

  if (!url || typeof url !== 'string') {
    throw new Error(
      'Parameter url wajib diisi berupa string.'
    );
  }

  const cleanUrl = url.trim();

  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error(
      'Format URL tidak valid. Masukkan URL yang benar.'
    );
  }

  try {

    const apiUrl =
      `${API_ENDPOINT}?url=${encodeURIComponent(cleanUrl)}`;

    const response = await axios.get(apiUrl, {
      headers: DEFAULT_HEADERS,
      timeout: 30000
    });

    const body = response.data;

    /*
     * Pastikan API berhasil
     */

    if (
      !body ||
      body.status !== true ||
      !body.result
    ) {
      throw new Error(
        body?.message ||
        'API FAA gagal mengambil media Instagram.'
      );
    }

    const d = body.result;


    /* ==========================================
     * DOWNLOAD LIST
     * ========================================== */

    const downloads = [];
    const seen = new Set();

    const rawDownloads =
      Array.isArray(d.downloads)
        ? d.downloads
        : [];


    for (const item of rawDownloads) {

      if (!item?.url) continue;

      if (seen.has(item.url)) {
        continue;
      }

      let type = 'video';
      let format = 'MP4';

      if (item.type === 'audio') {
        type = 'audio';
        format = 'MP3';
      }

      if (item.type === 'image') {
        type = 'image';
        format = 'JPEG';
      }

      downloads.push({
        type,

        quality:
          item.quality ||
          item.label ||
          'Default',

        format,

        resolution:
          item.resolution ||
          null,

        size:
          item.size ||
          formatBytes(item.size_bytes) ||
          null,

        size_bytes:
          item.size_bytes ||
          null,

        url: item.url
      });

      seen.add(item.url);
    }


    /* ==========================================
     * MEDIA
     * ========================================== */

    const videos = downloads.filter(
      item => item.type === 'video'
    );

    const images = downloads.filter(
      item => item.type === 'image'
    );

    const audios = downloads.filter(
      item => item.type === 'audio'
    );


    /*
     * Semua URL media
     */

    const mediaUrls = [
      ...videos.map(item => item.url),
      ...images.map(item => item.url)
    ].filter(Boolean);


    /*
     * Fallback jika downloads kosong
     */

    if (
      !mediaUrls.length &&
      d.video_nowm
    ) {
      mediaUrls.push(d.video_nowm);
    }


    if (
      !mediaUrls.length &&
      d.video
    ) {
      mediaUrls.push(d.video);
    }


    if (
      !mediaUrls.length &&
      d.url
    ) {

      if (Array.isArray(d.url)) {

        mediaUrls.push(
          ...d.url.filter(Boolean)
        );

      } else if (
        typeof d.url === 'string'
      ) {

        mediaUrls.push(d.url);
      }
    }


    /*
     * Jika benar-benar tidak ada media,
     * hentikan dengan error yang jelas.
     */

    if (!mediaUrls.length) {

      console.error(
        '[INSTAGRAM] API RESPONSE:',
        JSON.stringify(body, null, 2)
      );

      throw new Error(
        'Media Instagram tidak ditemukan pada respons API FAA.'
      );
    }


    /* ==========================================
     * VIDEO
     * ========================================== */

    const videoUrl =
      d.video_nowm ||
      d.video ||
      videos[0]?.url ||
      null;


    const audioUrl =
      d.audio ||
      audios[0]?.url ||
      null;


    const isVideo =
      !!videoUrl ||
      videos.length > 0;


    /* ==========================================
     * THUMBNAIL
     * ========================================== */

    const thumbnail =
      d.thumbnail ||
      d.cover ||
      d.origin_cover ||
      null;


    /* ==========================================
     * METADATA
     * ========================================== */

    const username =
      d.author?.username ||
      d.username ||
      'Instagram';


    const caption =
      String(
        d.title ||
        d.caption ||
        'Instagram media'
      ).trim();


    /* ==========================================
     * RESPONSE LUTLOAD
     * ========================================== */

    return {

      status: true,

      /*
       * Dipakai frontend LUTLOAD
       */

      url: mediaUrls,

      metadata: {

        username,

        caption,

        like:
          d.statistics?.likes ??
          d.likes ??
          'N/A',

        comment:
          d.statistics?.comments ??
          d.comments ??
          'N/A',

        isVideo,

        thumbnail,

        duration:
          parseDurationToSeconds(
            d.duration
          ),

        platform:
          d.platform ||
          'Instagram'
      },


      /*
       * Data lengkap
       */

      data: {

        id:
          d.id ||
          null,

        type:
          d.type ||
          (images.length
            ? 'carousel'
            : 'reel'),

        title:
          caption,

        region:
          d.region ||
          null,

        duration_seconds:
          parseDurationToSeconds(
            d.duration
          ),

        cover:
          thumbnail,

        author: {

          id:
            d.author?.id ||
            null,

          username,

          nickname:
            d.author?.nickname ||
            'Instagram',

          avatar:
            d.author?.avatar ||
            null
        },

        statistics: {

          views:
            d.statistics?.views ??
            d.views ??
            0,

          likes:
            d.statistics?.likes ??
            d.likes ??
            0,

          comments:
            d.statistics?.comments ??
            d.comments ??
            0,

          shares:
            d.statistics?.shares ??
            d.shares ??
            0,

          saves:
            d.statistics?.saves ??
            d.saves ??
            0
        },

        music:
          audioUrl
            ? {
                id: null,
                title: null,
                author: null,
                duration_seconds: null,
                url: audioUrl
              }
            : null,

        video_nowm:
          videoUrl,

        video_wm:
          null,

        images:
          images.map(
            item => item.url
          ),

        downloads
      },


      /*
       * Info internal
       */

      _meta: {

        original_platform:
          d.platform ||
          'Unknown',

        source:
          'api-faa.my.id',

        from_cache:
          d.from_cache ??
          false
      }
    };

  } catch (error) {

    console.error(
      '[INSTAGRAM]',
      error.response?.data ||
      error.message
    );

    throw new Error(
      `Downloader Error: ${error.message}`
    );
  }
}


/* ==========================================
 * VERCEL API HANDLER
 * ========================================== */

module.exports = async function handler(req, res) {

  /*
   * CORS
   */

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );


  /*
   * OPTIONS
   */

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }


  /*
   * POST ONLY
   */

  if (req.method !== 'POST') {

    return res.status(405).json({
      status: false,
      message: 'Method tidak diizinkan. Gunakan POST.'
    });

  }


  try {

    /*
     * Body
     */

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});


    const url =
      body.url ||
      body.instagramUrl;


    /*
     * Validasi
     */

    if (!url) {

      return res.status(400).json({
        status: false,
        message:
          'URL Instagram wajib diisi.'
      });

    }


    /*
     * Validasi domain Instagram
     */

    let parsedUrl;

    try {

      parsedUrl = new URL(url);

    } catch {

      return res.status(400).json({
        status: false,
        message:
          'URL Instagram tidak valid.'
      });

    }


    const hostname =
      parsedUrl.hostname
        .toLowerCase()
        .replace(/^www\./, '');


    if (
      hostname !== 'instagram.com' &&
      !hostname.endsWith('.instagram.com')
    ) {

      return res.status(400).json({
        status: false,
        message:
          'Gunakan URL dari Instagram.'
      });

    }


    /*
     * Jalankan scraper
     */

    const result =
      await downloadInstagram(url);


    /*
     * Kirim response
     */

    return res.status(200).json(result);

  } catch (error) {

    console.error(
      '[INSTAGRAM API]',
      error
    );

    return res.status(500).json({
      status: false,
      message:
        error.message ||
        'Terjadi kesalahan pada server.'
    });

  }

};


/*
 * Export scraper juga
 */

module.exports.downloadInstagram =
  downloadInstagram;
