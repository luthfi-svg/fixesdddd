const axios = require('axios');

const API_ENDPOINT = 'https://api-faa.my.id/faa/aio';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01'
};

function parseDurationToSeconds(duration) {
  if (!duration) return 0;

  if (typeof duration === 'number') {
    return duration;
  }

  const match = String(duration).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function downloadInstagram(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Parameter url wajib diisi berupa string.');
  }

  const cleanUrl = url.trim();

  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error(
      'Format URL tidak valid. Masukkan URL yang diawali http:// atau https://.'
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

    if (!body || body.status !== true || !body.result) {
      throw new Error(
        body?.message || 'Gagal mengambil data dari API FAA.'
      );
    }

    const d = body.result;

    /*
     * ==========================================
     * NORMALISASI DOWNLOAD
     * ==========================================
     */

    const downloads = [];
    const seenUrls = new Set();

    const rawDownloads = Array.isArray(d.downloads)
      ? d.downloads
      : [];

    for (const item of rawDownloads) {
      if (!item?.url) continue;
      if (seenUrls.has(item.url)) continue;

      let type = 'video';
      let format = 'MP4';

      if (item.type === 'audio') {
        type = 'audio';
        format = 'MP3';
      } else if (item.type === 'image') {
        type = 'image';
        format = 'JPEG';
      }

      downloads.push({
        type,
        quality: item.quality || item.label || 'Default',
        format,
        resolution: item.resolution || null,
        size: item.size || null,
        size_bytes: item.size_bytes || null,
        url: item.url
      });

      seenUrls.add(item.url);
    }

    /*
     * ==========================================
     * AMBIL MEDIA
     * ==========================================
     */

    const videoDownloads = downloads.filter(
      item => item.type === 'video'
    );

    const imageDownloads = downloads.filter(
      item => item.type === 'image'
    );

    const audioDownloads = downloads.filter(
      item => item.type === 'audio'
    );

    /*
     * Frontend LUTLOAD lama membaca:
     * result.url
     *
     * Jadi kita pertahankan struktur tersebut.
     */

    const mediaUrls = [
      ...videoDownloads.map(item => item.url),
      ...imageDownloads.map(item => item.url)
    ].filter(Boolean);

    /*
     * Kalau API tidak mengisi downloads,
     * coba gunakan thumbnail/video langsung.
     */

    if (!mediaUrls.length && d.thumbnail) {
      mediaUrls.push(d.thumbnail);
    }

    if (!mediaUrls.length && d.url) {
      if (Array.isArray(d.url)) {
        mediaUrls.push(
          ...d.url.filter(Boolean)
        );
      } else if (typeof d.url === 'string') {
        mediaUrls.push(d.url);
      }
    }

    /*
     * ==========================================
     * TENTUKAN TIPE MEDIA
     * ==========================================
     */

    const isVideo =
      videoDownloads.length > 0 ||
      !!d.video ||
      !!d.video_nowm;

    /*
     * ==========================================
     * OUTPUT YANG KOMPATIBEL DENGAN LUTLOAD
     * ==========================================
     */

    return {
      status: true,

      /*
       * Struktur yang dipakai frontend lama
       */
      url: mediaUrls,

      metadata: {
        username:
          d.author?.username ||
          d.username ||
          'Instagram',

        caption:
          (d.title || d.caption || '').trim() ||
          'Instagram media',

        like:
          d.statistics?.likes ??
          d.likes ??
          'N/A',

        comment:
          d.statistics?.comments ??
          d.comments ??
          'N/A',

        isVideo,

        thumbnail:
          d.thumbnail || null,

        duration:
          parseDurationToSeconds(d.duration),

        platform:
          d.platform || 'Instagram'
      },

      /*
       * Data tambahan untuk frontend/API lain
       */
      result: {
        id: d.id || null,

        type: d.type || (
          isVideo ? 'reel' : 'image'
        ),

        title:
          (d.title || d.caption || '').trim(),

        cover:
          d.thumbnail || null,

        video_nowm:
          d.video_nowm ||
          videoDownloads[0]?.url ||
          null,

        video_wm:
          d.video_wm || null,

        audio:
          audioDownloads[0]?.url || null,

        images:
          imageDownloads.map(
            item => item.url
          ),

        downloads,

        duration_seconds:
          parseDurationToSeconds(d.duration),

        _meta: {
          original_platform:
            d.platform || 'Unknown',

          source:
            'api-faa.my.id',

          from_cache:
            d.from_cache ?? false
        }
      }
    };

  } catch (err) {
    console.error(
      '[Instagram Downloader]',
      err.response?.data || err.message
    );

    throw new Error(
      `Downloader Error: ${err.message}`
    );
  }
}


/*
 * ==========================================
 * CLI TEST
 * ==========================================
 */

if (require.main === module) {
  const args = process.argv.slice(2);

  const inputUrl =
    args[0] ||
    'https://www.instagram.com/reel/Cxxxxxxxxxx/';

  console.log(
    `[INFO] Download: ${inputUrl}`
  );

  downloadInstagram(inputUrl)
    .then(result => {
      console.log(
        JSON.stringify(result, null, 2)
      );
    })
    .catch(err => {
      console.error(
        '[ERROR]',
        err.message
      );

      process.exit(1);
    });
}


/*
 * ==========================================
 * EXPORT
 * ==========================================
 */

module.exports = {
  downloadInstagram
};
