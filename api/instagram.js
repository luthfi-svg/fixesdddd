// instagram.js
// Instagram Downloader - API Faa AIO
// Compatible dengan frontend LUTLOAD

const axios = require("axios");

const API_ENDPOINT = "https://api-faa.my.id/faa/aio";

async function downloadInstagram(url) {
  try {
    // =========================
    // VALIDASI URL
    // =========================
    if (!url || typeof url !== "string") {
      throw new Error("URL Instagram wajib diisi.");
    }

    url = url.trim();

    let parsedURL;

    try {
      parsedURL = new URL(url);
    } catch {
      throw new Error("URL Instagram tidak valid.");
    }

    if (!["http:", "https:"].includes(parsedURL.protocol)) {
      throw new Error("URL harus menggunakan http atau https.");
    }

    const hostname = parsedURL.hostname.toLowerCase();

    if (
      !hostname.includes("instagram.com") &&
      !hostname.includes("instagr.am")
    ) {
      throw new Error("URL bukan link Instagram.");
    }

    // =========================
    // REQUEST API FAA
    // =========================
    const response = await axios.get(API_ENDPOINT, {
      params: {
        url
      },
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36"
      },
      timeout: 30000
    });

    const api = response.data;

    // =========================
    // VALIDASI RESPONSE API
    // =========================
    if (!api || api.status !== true) {
      throw new Error(
        api?.message ||
        api?.error ||
        "API Faa gagal mengambil media Instagram."
      );
    }

    const data = api.result || api.data || {};

    // =========================
    // AMBIL DOWNLOADS
    // =========================
    let downloads = [];

    if (Array.isArray(data.downloads)) {
      downloads = data.downloads;
    }

    // Beberapa response API bisa menggunakan url
    if (!downloads.length && Array.isArray(data.url)) {
      downloads = data.url.map((item) => ({
        url: item,
        type: "video"
      }));
    }

    // =========================
    // NORMALISASI DOWNLOAD URL
    // =========================
    const mediaURLs = downloads
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return (
          item?.url ||
          item?.download ||
          item?.link ||
          item?.src ||
          null
        );
      })
      .filter(
        (url) =>
          typeof url === "string" &&
          /^https?:\/\//i.test(url)
      );

    if (!mediaURLs.length) {
      throw new Error(
        "Media Instagram tidak ditemukan dari API Faa."
      );
    }

    // =========================
    // DETEKSI VIDEO / IMAGE
    // =========================
    const firstURL = mediaURLs[0];

    const firstDownload = downloads[0] || {};

    const firstType =
      typeof firstDownload === "object"
        ? String(
            firstDownload.type ||
            firstDownload.mime ||
            firstDownload.format ||
            ""
          ).toLowerCase()
        : "";

    const isVideo =
      firstType.includes("video") ||
      firstType.includes("mp4") ||
      /\.mp4(\?|$)/i.test(firstURL);

    // =========================
    // VIDEO NOWM
    // =========================
    const videoNowm =
      data.video_nowm ||
      data.video ||
      data.nowm ||
      (isVideo ? firstURL : null);

    // =========================
    // COVER
    // =========================
    const cover =
      data.cover ||
      data.thumbnail ||
      data.thumb ||
      data.image ||
      null;

    // =========================
    // METADATA
    // =========================
    const metadata = {
      username:
        data.author?.username ||
        data.username ||
        data.author ||
        "instagram_user",

      caption:
        data.title ||
        data.caption ||
        data.description ||
        "Instagram media",

      like:
        data.statistics?.likes ??
        data.likes ??
        "N/A",

      comment:
        data.statistics?.comments ??
        data.comments ??
        "N/A",

      isVideo
    };

    // =========================
    // FORMAT UNTUK LUTLOAD
    // =========================
    return {
      status: true,

      result: {
        url: mediaURLs,

        metadata,

        // Data tambahan tetap disediakan
        // supaya bisa digunakan backend/frontend
        // lain tanpa merusak struktur lama.
        video_nowm: videoNowm,

        video_wm:
          data.video_wm ||
          data.watermark ||
          null,

        cover,

        author: {
          username:
            data.author?.username ||
            data.username ||
            "instagram_user",

          nickname:
            data.author?.nickname ||
            data.author?.name ||
            "Instagram"
        },

        statistics: {
          likes:
            data.statistics?.likes ??
            data.likes ??
            0,

          comments:
            data.statistics?.comments ??
            data.comments ??
            0,

          shares:
            data.statistics?.shares ??
            data.shares ??
            0,

          views:
            data.statistics?.views ??
            data.views ??
            0
        },

        downloads,

        _meta: {
          original_platform: "instagram",
          source: "api-faa.my.id",
          from_cache: api.from_cache ?? false
        }
      }
    };
  } catch (error) {
    console.error(
      "[Instagram Downloader]",
      error?.response?.data || error.message
    );

    return {
      status: false,
      result: null,
      error:
        error?.response?.data?.message ||
        error?.message ||
        "Gagal mengambil media Instagram."
    };
  }
}

module.exports = {
  downloadInstagram
};
