const state = {
  platform: 'tiktok',
  siteOpen: true,
  history: loadHistory(),
  broadcast: null,
  notice: null
};

const els = {
  tabs: [...document.querySelectorAll('.tab')],
  platformBadge: document.getElementById('platformBadge'),
  formTitle: document.getElementById('formTitle'),
  formSubtitle: document.getElementById('formSubtitle'),
  validationHint: document.getElementById('validationHint'),
  urlInput: document.getElementById('urlInput'),
  form: document.getElementById('downloadForm'),
  downloadBtn: document.getElementById('downloadBtn'),
  pasteBtn: document.getElementById('pasteBtn'),
  resultStack: document.getElementById('resultStack'),
  heroPreview: document.getElementById('heroPreview'),
  toast: document.getElementById('toast'),
  siteStatus: document.getElementById('siteStatus'),
  footerStatus: document.getElementById('footerStatus'),
  historyPanel: document.getElementById('historyPanel'),
  historyList: document.getElementById('historyList'),
  historyBtn: document.getElementById('historyBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  closedOverlay: document.getElementById('closedOverlay'),
  closedMessage: document.getElementById('closedMessage'),
  refreshStatusBtn: document.getElementById('refreshStatusBtn'),
  broadcastNotice: document.getElementById('broadcastNotice'),
  broadcastText: document.getElementById('broadcastText'),
  broadcastTime: document.getElementById('broadcastTime'),
  broadcastClose: document.getElementById('broadcastClose'),
  notice: document.getElementById('notice')
};

const platformConfig = {
  tiktok: {
    label: 'TikTok',
    endpoint: '/api/tiktok',
    badge: 'TIKTOK READY',
    placeholder: 'https://www.tiktok.com/@user/video/...',
    title: 'TikTok downloader',
    subtitle: 'Tempel link video / slide TikTok di bawah.',
    hint: 'Dukung link TikTok dari tiktok.com dan subdomain TikTok.'
  },

  stalktt: {
    label: 'TikTok Stalker',
    endpoint: '/api/stalktt',
    badge: 'TIKTOK STALKER',
    placeholder: 'Masukkan username TikTok...',
    title: 'TikTok Stalker',
    subtitle: 'Masukkan username TikTok untuk melihat informasi profil.',
    hint: 'Gunakan username TikTok, misalnya @username atau username.'
  },

  instagram: {
    label: 'Instagram',
    endpoint: '/api/instagram',
    badge: 'INSTAGRAM READY',
    placeholder: 'https://www.instagram.com/reel/...',
    title: 'Instagram downloader',
    subtitle: 'Tempel link Reels, post, atau video Instagram di bawah.',
    hint: 'Dukung link instagram.com/reel/, /p/, dan /tv/.'
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(value) {
  const num = Number(value || 0);

  if (!Number.isFinite(num) || num <= 0) {
    return '0';
  }

  return new Intl.NumberFormat('id-ID', {
    notation: num >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(num);
}

function formatTime(seconds) {
  const value = Number(seconds || 0);

  if (!value) {
    return '';
  }

  const min = Math.floor(value / 60);
  const sec = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');

  return `${min}:${sec}`;
}

async function logVisitor() {
  try {
    if (sessionStorage.getItem('lutload-visitor-logged') === '1') {
      return;
    }

    const response = await fetch('/api/visitor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        path: window.location.pathname
      }),
      keepalive: true
    });

    if (response.ok) {
      sessionStorage.setItem('lutload-visitor-logged', '1');
    }
  } catch {
    // Visitor logging tidak boleh mengganggu fungsi utama website.
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem('lutload-history');

    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(
    'lutload-history',
    JSON.stringify(state.history.slice(0, 12))
  );
}

function addHistory(item) {
  state.history = [
    item,
    ...state.history.filter((x) => x.url !== item.url)
  ].slice(0, 12);

  saveHistory();
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML =
      '<div class="empty-state">Belum ada riwayat. Hasil download sukses akan muncul di sini.</div>';

    return;
  }

  els.historyList.innerHTML = state.history
    .map(
      (item) => `
    <div class="history-item">
      <div>
        <strong>${escapeHtml(item.title || item.platform)}</strong>
        <span>${escapeHtml(item.platform)} • ${escapeHtml(item.time)}</span>
      </div>

      <button
        class="history-clear"
        type="button"
        data-history-url="${escapeHtml(item.url)}"
      >
        OPEN
      </button>
    </div>
  `
    )
    .join('');

  els.historyList
    .querySelectorAll('[data-history-url]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        els.urlInput.value = btn.dataset.historyUrl;

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });

        els.urlInput.focus();
      });
    });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 2600);
}

function getDismissedBroadcastId() {
  try {
    return localStorage.getItem('lutload-dismissed-broadcast') || '';
  } catch {
    return '';
  }
}

function setDismissedBroadcastId(id) {
  try {
    if (id) {
      localStorage.setItem(
        'lutload-dismissed-broadcast',
        String(id)
      );
    } else {
      localStorage.removeItem(
        'lutload-dismissed-broadcast'
      );
    }
  } catch {
    // localStorage bisa dibatasi browser.
  }
}

function formatBroadcastTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `Diperbarui ${date.toLocaleString('id-ID')}`;
}

function hideBroadcast() {
  state.broadcast = null;

  els.broadcastNotice.classList.remove('show');
  els.broadcastNotice.setAttribute(
    'aria-hidden',
    'true'
  );
}

function renderBroadcast(broadcast) {
  if (
    !broadcast ||
    typeof broadcast.text !== 'string' ||
    !broadcast.text.trim()
  ) {
    hideBroadcast();
    return;
  }

  state.broadcast = broadcast;

  const id =
    String(
      broadcast.id ||
      broadcast.updatedAt ||
      ''
    );

  els.broadcastText.textContent =
    broadcast.text.trim();

  els.broadcastTime.textContent =
    formatBroadcastTime(
      broadcast.updatedAt
    );

  els.broadcastNotice.classList.add('show');
  els.broadcastNotice.setAttribute(
    'aria-hidden',
    'false'
  );

  // Jika user sudah menutup broadcast yang sama,
  // jangan paksa muncul lagi setiap polling.
  if (id && getDismissedBroadcastId() === id) {
    els.broadcastNotice.classList.remove('show');
    els.broadcastNotice.setAttribute(
      'aria-hidden',
      'true'
    );
  }
}

function renderNotice(notice) {
  if (!notice || typeof notice.text !== 'string' || !notice.text.trim()) {
    state.notice = null;
    if (els.notice) els.notice.classList.remove('show');
    return;
  }
  state.notice = notice;
  if (!els.notice) return;
  const type = ['info','warning','success'].includes(String(notice.type).toLowerCase()) ? String(notice.type).toLowerCase() : 'info';
  els.notice.className = `site-notice show ${type}`;
  els.notice.querySelector('.notice-label').textContent = type === 'warning' ? '⚠️ PERINGATAN' : type === 'success' ? '✓ BERHASIL' : 'ℹ️ INFORMASI';
  els.notice.querySelector('.notice-text').textContent = notice.text.trim();
}

function setLoading(loading) {
  els.downloadBtn.classList.toggle('loading', loading);

  const btnText = els.downloadBtn.querySelector('.btn-text');

  if (btnText) {
    btnText.textContent = loading
      ? 'PROCESSING...'
      : state.platform === 'stalktt'
        ? 'STALK PROFILE ↗'
        : 'DOWNLOAD ↗';
  }
}

function updatePlatform(platform) {
  state.platform = platform;

  const cfg = platformConfig[platform];

  if (!cfg) {
    return;
  }

  els.tabs.forEach((tab) => {
    tab.classList.toggle(
      'active',
      tab.dataset.platform === platform
    );
  });

  els.platformBadge.textContent = cfg.badge;
  els.formTitle.textContent = cfg.title;
  els.formSubtitle.textContent = cfg.subtitle;
  els.validationHint.textContent = cfg.hint;
  els.urlInput.placeholder = cfg.placeholder;
  els.urlInput.value = '';

  els.resultStack.innerHTML = '';

  resetHeroPreview();

  document.title = `LUTSAVE — ${cfg.label}`;

  if (cfg.disabled) {
    els.urlInput.disabled = true;
    els.downloadBtn.disabled = true;

    const btnText = els.downloadBtn.querySelector('.btn-text');

    if (btnText) {
      btnText.textContent = 'CURRENTLY OFFLINE';
    }
  } else {
    els.urlInput.disabled = false;
    els.downloadBtn.disabled = false;

    const btnText = els.downloadBtn.querySelector('.btn-text');

    if (btnText) {
      btnText.textContent =
        platform === 'stalktt'
          ? 'STALK PROFILE ↗'
          : 'DOWNLOAD ↗';
    }
  }
}

function resetHeroPreview() {
  if (state.platform === 'stalktt') {
    els.heroPreview.innerHTML = `
      <div class="preview-placeholder reveal">
        <div class="big-icon">◎</div>
        <strong>TikTok profile</strong>
        <span>Profil TikTok yang berhasil ditemukan akan tampil di sini.</span>
      </div>
    `;

    return;
  }

  els.heroPreview.innerHTML = `
    <div class="preview-placeholder reveal">
      <div class="big-icon">▶</div>
      <strong>Paste a social link</strong>
      <span>Video yang berhasil ditemukan akan tampil di player ini.</span>
    </div>
  `;
}

function normalizeResult(data) {
  const root = data?.data || {};

  return {
    title: root.title || 'Untitled media',
    cover: root.cover || null,
    author: root.author || {},
    statistics: root.statistics || {},
    duration: root.duration_seconds || 0,
    video: root.video_nowm || root.video_wm || null,
    audio: root.music?.url || root.audio || null,
    images: Array.isArray(root.images)
      ? root.images
      : [],
    downloads: Array.isArray(root.downloads)
      ? root.downloads
      : [],
    platform: data.platform || state.platform
  };
}

function renderHeroVideo(result) {
  if (result.video) {
    els.heroPreview.innerHTML = `
      <video
        controls
        playsinline
        preload="metadata"
        poster="${escapeHtml(result.cover || '')}"
        src="${escapeHtml(result.video)}"
      ></video>
    `;

    return;
  }

  resetHeroPreview();
}

function renderStalkerResult(data) {
  const profile = data?.data || {};
  const stats = profile.stats || {};

  const avatarHtml = profile.avatar
    ? `
      <img
        src="${escapeHtml(profile.avatar)}"
        alt="Avatar TikTok"
        loading="lazy"
      >
    `
    : `
      <div class="cover-fallback">◎</div>
    `;

  const verifiedHtml = profile.verified
    ? `
      <span class="meta" title="Verified">
        ✓ VERIFIED
      </span>
    `
    : '';

  const signatureHtml = profile.signature
    ? `
      <p
        style="
          margin:10px 0 0;
          color:var(--muted);
          line-height:1.6;
          white-space:pre-wrap;
        "
      >${escapeHtml(profile.signature)}</p>
    `
    : `
      <p
        style="
          margin:10px 0 0;
          color:var(--muted);
          line-height:1.6;
        "
      >Tidak ada bio.</p>
    `;

  const statsHtml = [
    ['FOLLOWERS', stats.followers],
    ['FOLLOWING', stats.following],
    ['LIKES', stats.likes],
    ['VIDEOS', stats.video_upload],
    ['FRIENDS', stats.friends]
  ]
    .map(
      ([label, value]) => `
        <span class="stat">
          ${label} ${formatNumber(value)}
        </span>
      `
    )
    .join('');

  const username = profile.username || '';

  const profileUrl =
    profile.profile_url ||
    `https://www.tiktok.com/@${encodeURIComponent(username)}`;

  els.resultStack.innerHTML = `
    <article class="result-card reveal">

      <div class="result-main">

        <div class="cover">
          ${avatarHtml}
        </div>

        <div class="result-info">

          <h3>
            ${escapeHtml(
              profile.nickname ||
              profile.username ||
              'TikTok Profile'
            )}
          </h3>

          <div class="meta-line">

            <span class="meta">
              @${escapeHtml(username)}
            </span>

            ${verifiedHtml}

          </div>

          ${signatureHtml}

          <div
            class="stats"
            style="margin-top:14px;"
          >
            ${statsHtml}
          </div>

          <div style="margin-top:16px;">

            <a
              class="open-link"
              href="${escapeHtml(profileUrl)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              OPEN PROFILE ↗
            </a>

          </div>

        </div>

      </div>

    </article>
  `;

  els.heroPreview.innerHTML = `
    <div
      class="preview-placeholder reveal"
      style="text-align:center;"
    >

      ${
        profile.avatar
          ? `
            <img
              src="${escapeHtml(profile.avatar)}"
              alt="Avatar TikTok"
              loading="lazy"
              style="
                width:100px;
                height:100px;
                object-fit:cover;
                border-radius:50%;
                display:block;
                margin:0 auto 12px;
              "
            >
          `
          : `
            <div class="big-icon">◎</div>
          `
      }

      <strong>
        @${escapeHtml(username)}
      </strong>

      <span>
        Profil TikTok berhasil ditemukan.
      </span>

    </div>
  `;
}

function renderResult(data) {
  if (
    state.platform === 'stalktt' ||
    data?.platform === 'tiktok-stalker'
  ) {
    renderStalkerResult(data);
    return;
  }

  const result = normalizeResult(data);

  const stats = result.statistics || {};
  const author = result.author || {};

  const coverHtml = result.cover
    ? `
      <img
        src="${escapeHtml(result.cover)}"
        alt="Media cover"
        loading="lazy"
      >
    `
    : `
      <div class="cover-fallback">✦</div>
    `;

  const metaBits = [
    result.platform,
    author.username
      ? `@${author.username}`
      : author.nickname || '',
    result.duration
      ? formatTime(result.duration)
      : '',
    result.downloads.length
      ? `${result.downloads.length} FILE`
      : ''
  ].filter(Boolean);

  const statsHtml = [
    ['VIEWS', stats.views],
    ['LIKES', stats.likes],
    ['COMMENTS', stats.comments],
    ['SHARES', stats.shares]
  ]
    .map(
      ([label, value]) =>
        `<span class="stat">${label} ${formatNumber(value)}</span>`
    )
    .join('');

  const videoHtml = result.video
    ? `
      <div class="media-player">
        <video
          controls
          playsinline
          preload="metadata"
          poster="${escapeHtml(result.cover || '')}"
          src="${escapeHtml(result.video)}"
        ></video>
      </div>
    `
    : '';

  const audioHtml = result.audio
    ? `
      <div class="media-player">
        <audio
          controls
          preload="metadata"
          src="${escapeHtml(result.audio)}"
        ></audio>
      </div>
    `
    : '';

  const downloadsHtml = result.downloads.length
    ? result.downloads
        .map(
          (item) => `
      <div class="download-option">

        <div>
          <strong>
            ${escapeHtml(item.quality || 'Media')}
          </strong>

          <span>
            ${escapeHtml(
              [
                item.format,
                item.resolution,
                item.size
              ]
                .filter(Boolean)
                .join(' • ')
            )}
          </span>
        </div>

        <a
          class="open-link"
          href="${escapeHtml(item.url)}"
          target="_blank"
          rel="noopener noreferrer"
          download
        >
          OPEN ↗
        </a>

      </div>
    `
        )
        .join('')
    : `
      <div class="empty-state">
        Tidak ada opsi download.
      </div>
    `;

  const imagesHtml = result.images.length
    ? `
      <div class="images-grid">

        ${result.images
          .slice(0, 12)
          .map(
            (src) => `
          <a
            href="${escapeHtml(src)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="${escapeHtml(src)}"
              alt="Slide image"
              loading="lazy"
            >
          </a>
        `
          )
          .join('')}

      </div>
    `
    : '';

  els.resultStack.innerHTML = `
    <article class="result-card reveal">

      <div class="result-main">

        <div class="cover">
          ${coverHtml}
        </div>

        <div class="result-info">

          <h3>
            ${escapeHtml(result.title)}
          </h3>

          <div class="meta-line">

            ${metaBits
              .map(
                (item) =>
                  `<span class="meta">${escapeHtml(item)}</span>`
              )
              .join('')}

          </div>

          <div class="stats">

            ${
              statsHtml ||
              '<span class="stat">MEDIA READY</span>'
            }

          </div>

          ${videoHtml}

          ${audioHtml}

          ${imagesHtml}

        </div>

      </div>

      <div class="downloads">

        <h4>
          DOWNLOAD OPTIONS
        </h4>

        <div class="download-options">
          ${downloadsHtml}
        </div>

      </div>

    </article>
  `;

  renderHeroVideo(result);
}

async function fetchStatus() {
  try {
    const response = await fetch('/api/status', {
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    const data = await response.json();

    if (
      !response.ok ||
      data.status !== true ||
      typeof data.open !== 'boolean'
    ) {
      throw new Error(
        data.message ||
        'Status website tidak dapat diverifikasi.'
      );
    }

    setSiteOpen(
      data.open,
      data.message
    );

    renderBroadcast(
      data.broadcast || null
    );
    renderNotice(data.notice || null);

  } catch (error) {
    // Jangan menampilkan OPEN jika kontrol backend
    // tidak dapat diverifikasi.
    setSiteOpen(
      false,
      'Status website tidak dapat diverifikasi. Silakan coba lagi beberapa saat.'
    );

    showToast(
      error.message ||
      'Status website tidak dapat diverifikasi.'
    );
  }
}

function setSiteOpen(open, message = '') {
  state.siteOpen = open !== false;

  els.siteStatus.textContent = state.siteOpen
    ? 'SYSTEM: OPEN 🟢'
    : 'SYSTEM: CLOSED 🔴';

  els.siteStatus.style.background =
    state.siteOpen
      ? 'var(--lime)'
      : 'var(--coral)';

  els.footerStatus.textContent =
    state.siteOpen
      ? 'LUTSAVE ONLINE • CLIENT READY'
      : 'LUTSAVE PAUSED • CONTROLLED BY TELEGRAM';

  els.closedOverlay.classList.toggle(
    'show',
    !state.siteOpen
  );

  els.closedOverlay.setAttribute(
    'aria-hidden',
    String(state.siteOpen)
  );

  if (!state.siteOpen && message) {
    els.closedMessage.textContent = message;
  }
}

async function submitDownload(event) {
  event.preventDefault();

  if (!state.siteOpen) {
    showToast('Website sedang ditutup.');
    return;
  }

  const cfg = platformConfig[state.platform];

  if (!cfg) {
    showToast('Platform tidak ditemukan.');
    return;
  }

  if (cfg.disabled) {
    showToast(
      'Instagram Downloader sedang offline.'
    );

    return;
  }

  const inputValue =
    els.urlInput.value.trim();

  if (!inputValue) {
    showToast(
      state.platform === 'stalktt'
        ? 'Masukkan username TikTok terlebih dahulu.'
        : 'Masukkan URL terlebih dahulu.'
    );

    els.urlInput.focus();

    return;
  }

  setLoading(true);

  els.resultStack.innerHTML = '';

  try {
    const requestBody =
      state.platform === 'stalktt'
        ? {
            username: inputValue
          }
        : {
            url: inputValue
          };

    const response = await fetch(
      cfg.endpoint,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },

        body: JSON.stringify(
          requestBody
        )
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        'Server mengembalikan respons yang tidak valid.'
      );
    }

    if (
      !response.ok ||
      data.status === false
    ) {
      throw new Error(
        data.message ||
        (
          state.platform === 'stalktt'
            ? 'Gagal mengambil profil TikTok.'
            : 'Gagal mengambil media.'
        )
      );
    }

    renderResult(data);

    addHistory({
      platform: cfg.label,

      title:
        state.platform === 'stalktt'
          ? `@${
              data.data?.username ||
              inputValue.replace(/^@/, '')
            }`
          : (
              data.data?.title ||
              cfg.label
            ),

      url: inputValue,

      time:
        new Date().toLocaleString('id-ID')
    });

    showToast(
      state.platform === 'stalktt'
        ? 'Profil TikTok berhasil ditemukan.'
        : 'Media berhasil diproses.'
    );

  } catch (error) {
    els.resultStack.innerHTML = `
      <article class="result-card reveal">

        <div class="empty-state">

          <strong
            style="
              display:block;
              font-size:15px;
              margin-bottom:5px;
            "
          >
            REQUEST FAILED
          </strong>

          ${escapeHtml(
            error.message ||
            'Terjadi kesalahan.'
          )}

        </div>

      </article>
    `;

    showToast(
      error.message ||
      'Terjadi kesalahan.'
    );

  } finally {
    setLoading(false);
  }
}

async function pasteFromClipboard() {
  try {
    const text =
      await navigator.clipboard.readText();

    if (!text) {
      showToast(
        'Clipboard kosong.'
      );

      return;
    }

    els.urlInput.value =
      text.trim();

    els.urlInput.focus();

    showToast(
      'Link ditempel.'
    );

  } catch {
    showToast(
      'Browser tidak mengizinkan akses clipboard.'
    );
  }
}

els.tabs.forEach((tab) => {
  tab.addEventListener(
    'click',
    () => {
      updatePlatform(
        tab.dataset.platform
      );
    }
  );
});

els.form.addEventListener(
  'submit',
  submitDownload
);

els.pasteBtn.addEventListener(
  'click',
  pasteFromClipboard
);

els.historyBtn.addEventListener(
  'click',
  () => {
    els.historyPanel.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
);

els.clearHistoryBtn.addEventListener(
  'click',
  () => {
    state.history = [];

    saveHistory();

    renderHistory();

    showToast(
      'Riwayat dibersihkan.'
    );
  }
);

els.refreshStatusBtn.addEventListener(
  'click',
  fetchStatus
);

els.broadcastClose.addEventListener(
  'click',
  () => {
    const id =
      state.broadcast?.id ||
      state.broadcast?.updatedAt ||
      '';

    if (id) {
      setDismissedBroadcastId(id);
    }

    hideBroadcast();
  }
);

logVisitor();

renderHistory();

updatePlatform(
  'tiktok'
);

fetchStatus();

setInterval(
  fetchStatus,
  15000
);
