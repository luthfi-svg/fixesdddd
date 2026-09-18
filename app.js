const state = {
  platform: 'tiktok',
  siteOpen: true,
  history: loadHistory()
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
  refreshStatusBtn: document.getElementById('refreshStatusBtn')
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
instagram: {
  label: 'Instagram',
  endpoint: '/api/instagram',
  badge: 'INSTAGRAM OFFLINE',
  placeholder: 'https://www.instagram.com/reel/...',
  title: 'Instagram downloader',
  subtitle: 'Layanan Instagram sementara tidak tersedia.',
  hint: 'Instagram Downloader sedang mengalami gangguan.',
  disabled: true,
  disabledMessage:
    'Instagram Downloader sedang mengalami gangguan dan sementara tidak dapat digunakan. Silakan coba kembali nanti.'
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
  if (!Number.isFinite(num) || num <= 0) return '0';
  return new Intl.NumberFormat('id-ID', {
    notation: num >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(num);
}

function formatTime(seconds) {
  const value = Number(seconds || 0);
  if (!value) return '';
  const min = Math.floor(value / 60);
  const sec = Math.floor(value % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
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
  localStorage.setItem('lutload-history', JSON.stringify(state.history.slice(0, 12)));
}

function addHistory(item) {
  state.history = [item, ...state.history.filter((x) => x.url !== item.url)].slice(0, 12);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML =
      '<div class="empty-state">Belum ada riwayat. Hasil download sukses akan muncul di sini.</div>';
    return;
  }

  els.historyList.innerHTML = state.history.map((item) => `
    <div class="history-item">
      <div>
        <strong>${escapeHtml(item.title || item.platform)}</strong>
        <span>${escapeHtml(item.platform)} • ${escapeHtml(item.time)}</span>
      </div>
      <button class="history-clear" type="button" data-history-url="${escapeHtml(item.url)}">OPEN</button>
    </div>
  `).join('');

  els.historyList.querySelectorAll('[data-history-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.urlInput.value = btn.dataset.historyUrl;
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

function setLoading(loading) {
  els.downloadBtn.classList.toggle('loading', loading);
  els.downloadBtn.querySelector('.btn-text').textContent = loading
    ? 'PROCESSING...'
    : 'DOWNLOAD ↗';
}

function updatePlatform(platform) {
  state.platform = platform;
  const cfg = platformConfig[platform];

  els.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.platform === platform));
  els.platformBadge.textContent = cfg.badge;
  els.formTitle.textContent = cfg.title;
  els.formSubtitle.textContent = cfg.subtitle;
  els.validationHint.textContent = cfg.hint;
  els.urlInput.placeholder = cfg.placeholder;
  els.urlInput.value = '';
  els.resultStack.innerHTML = '';
  resetHeroPreview();

  document.title = `LUTLOAD — ${cfg.label} Downloader`;
}

function resetHeroPreview() {
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
    images: Array.isArray(root.images) ? root.images : [],
    downloads: Array.isArray(root.downloads) ? root.downloads : [],
    platform: data.platform || state.platform
  };
}

function renderHeroVideo(result) {
  if (result.video) {
    els.heroPreview.innerHTML = `
      <video controls playsinline preload="metadata" poster="${escapeHtml(result.cover || '')}" src="${escapeHtml(result.video)}"></video>
    `;
    return;
  }

  resetHeroPreview();
}

function renderResult(data) {
  const result = normalizeResult(data);

  const stats = result.statistics || {};
  const author = result.author || {};

  const coverHtml = result.cover
    ? `<img src="${escapeHtml(result.cover)}" alt="Media cover" loading="lazy">`
    : `<div class="cover-fallback">✦</div>`;

  const metaBits = [
    result.platform,
    author.username ? `@${author.username}` : author.nickname || '',
    result.duration ? formatTime(result.duration) : '',
    result.downloads.length ? `${result.downloads.length} FILE` : ''
  ].filter(Boolean);

  const statsHtml = [
    ['VIEWS', stats.views],
    ['LIKES', stats.likes],
    ['COMMENTS', stats.comments],
    ['SHARES', stats.shares]
  ].map(([label, value]) => `<span class="stat">${label} ${formatNumber(value)}</span>`).join('');

  const videoHtml = result.video
    ? `
      <div class="media-player">
        <video controls playsinline preload="metadata" poster="${escapeHtml(result.cover || '')}" src="${escapeHtml(result.video)}"></video>
      </div>
    `
    : '';

  const audioHtml = result.audio
    ? `
      <div class="media-player">
        <audio controls preload="metadata" src="${escapeHtml(result.audio)}"></audio>
      </div>
    `
    : '';

  const downloadsHtml = result.downloads.length
    ? result.downloads.map((item) => `
      <div class="download-option">
        <div>
          <strong>${escapeHtml(item.quality || 'Media')}</strong>
          <span>${escapeHtml([item.format, item.resolution, item.size].filter(Boolean).join(' • '))}</span>
        </div>
        <a
          class="open-link"
          href="${escapeHtml(item.url)}"
          target="_blank"
          rel="noopener noreferrer"
          download
        >OPEN ↗</a>
      </div>
    `).join('')
    : '<div class="empty-state">Tidak ada opsi download.</div>';

  const imagesHtml = result.images.length
    ? `
      <div class="images-grid">
        ${result.images.slice(0, 12).map((src) => `
          <a href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer">
            <img src="${escapeHtml(src)}" alt="Slide image" loading="lazy">
          </a>
        `).join('')}
      </div>
    `
    : '';

  els.resultStack.innerHTML = `
    <article class="result-card reveal">
      <div class="result-main">
        <div class="cover">${coverHtml}</div>

        <div class="result-info">
          <h3>${escapeHtml(result.title)}</h3>

          <div class="meta-line">
            ${metaBits.map((item) => `<span class="meta">${escapeHtml(item)}</span>`).join('')}
          </div>

          <div class="stats">${statsHtml || '<span class="stat">MEDIA READY</span>'}</div>

          ${videoHtml}
          ${audioHtml}
          ${imagesHtml}
        </div>
      </div>

      <div class="downloads">
        <h4>DOWNLOAD OPTIONS</h4>
        <div class="download-options">${downloadsHtml}</div>
      </div>
    </article>
  `;

  renderHeroVideo(result);
}

async function fetchStatus() {
  try {
    const response = await fetch('/api/status', {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    const data = await response.json();

    if (!response.ok || data.status !== true || typeof data.open !== 'boolean') {
      throw new Error(data.message || 'Status website tidak dapat diverifikasi.');
    }

    setSiteOpen(data.open, data.message);
  } catch (error) {
    // Jangan menampilkan OPEN jika kontrol backend tidak dapat diverifikasi.
    setSiteOpen(false, 'Status website tidak dapat diverifikasi. Silakan coba lagi beberapa saat.');
    showToast(error.message || 'Status website tidak dapat diverifikasi.');
  }
}

function setSiteOpen(open, message = '') {
  state.siteOpen = open !== false;

  els.siteStatus.textContent = state.siteOpen
    ? 'SYSTEM: OPEN 🟢'
    : 'SYSTEM: CLOSED 🔴';

  els.siteStatus.style.background = state.siteOpen ? 'var(--lime)' : 'var(--coral)';
  els.footerStatus.textContent = state.siteOpen
    ? 'LUTLOAD ONLINE • CLIENT READY'
    : 'LUTLOAD PAUSED • CONTROLLED BY TELEGRAM';

  els.closedOverlay.classList.toggle('show', !state.siteOpen);
  els.closedOverlay.setAttribute('aria-hidden', String(state.siteOpen));

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

  const url = els.urlInput.value.trim();
  if (!url) {
    showToast('Masukkan URL terlebih dahulu.');
    els.urlInput.focus();
    return;
  }

  setLoading(true);
  els.resultStack.innerHTML = '';

  try {
    const cfg = platformConfig[state.platform];

    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok || data.status === false) {
      throw new Error(data.message || 'Gagal mengambil media.');
    }

    renderResult(data);

    addHistory({
      platform: cfg.label,
      title: data.data?.title || cfg.label,
      url,
      time: new Date().toLocaleString('id-ID')
    });

    showToast('Media berhasil diproses.');
  } catch (error) {
    els.resultStack.innerHTML = `
      <article class="result-card reveal">
        <div class="empty-state">
          <strong style="display:block;font-size:15px;margin-bottom:5px;">REQUEST FAILED</strong>
          ${escapeHtml(error.message || 'Terjadi kesalahan.')}
        </div>
      </article>
    `;
    showToast(error.message || 'Terjadi kesalahan.');
  } finally {
    setLoading(false);
  }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      showToast('Clipboard kosong.');
      return;
    }

    els.urlInput.value = text.trim();
    els.urlInput.focus();
    showToast('Link ditempel.');
  } catch {
    showToast('Browser tidak mengizinkan akses clipboard.');
  }
}

els.tabs.forEach((tab) => {
  tab.addEventListener('click', () => updatePlatform(tab.dataset.platform));
});

els.form.addEventListener('submit', submitDownload);
els.pasteBtn.addEventListener('click', pasteFromClipboard);
els.historyBtn.addEventListener('click', () => {
  els.historyPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
els.clearHistoryBtn.addEventListener('click', () => {
  state.history = [];
  saveHistory();
  renderHistory();
  showToast('Riwayat dibersihkan.');
});
els.refreshStatusBtn.addEventListener('click', fetchStatus);

renderHistory();
updatePlatform('tiktok');
fetchStatus();
setInterval(fetchStatus, 15000);
