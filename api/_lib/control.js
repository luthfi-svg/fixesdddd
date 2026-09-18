const axios = require('axios');
const config = require('../../config');

const GITHUB_API = 'https://api.github.com';

function isPlaceholder(value) {
  return (
    !value ||
    /^(PASTE_|CHANGE_THIS|YOUR_|REPLACE_|<|\[)/i.test(String(value).trim())
  );
}

function hasControlConfig() {
  const control = config.control || {};
  return (
    control.provider === 'github-gist' &&
    !isPlaceholder(control.gistId) &&
    !isPlaceholder(control.githubToken) &&
    !isPlaceholder(control.stateFileName)
  );
}

function githubHeaders() {
  return {
    Authorization: `Bearer ${config.control.githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'LUTLOAD-Control/1.0'
  };
}

function githubError(error, action = 'mengakses') {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const message = data?.message || error?.message || 'Unknown error';

  if (status === 401) {
    return new Error(
      'GitHub menolak credential (401 Bad credentials). Pastikan GITHUB_TOKEN valid, belum expired/revoked, dan memiliki izin Gist. Jika token lama pernah tersebar, revoke token tersebut dan gunakan token baru.'
    );
  }

  if (status === 403) {
    return new Error(
      `GitHub menolak izin saat ${action} Gist (403). Pastikan token memiliki akses Gist dan rate limit GitHub tidak habis.`
    );
  }

  if (status === 404) {
    return new Error(
      'GitHub Gist tidak ditemukan (404). Periksa GITHUB_GIST_ID dan pastikan token memiliki akses ke Gist tersebut.'
    );
  }

  if (status) {
    return new Error(`GitHub Gist error (${status}): ${message}`);
  }

  return new Error(`GitHub Gist error: ${message}`);
}

function assertConfigured() {
  if (!hasControlConfig()) {
    throw new Error(
      'GitHub Gist control belum dikonfigurasi. Isi GITHUB_TOKEN, GITHUB_GIST_ID, dan GITHUB_GIST_STATE_FILE di environment variables.'
    );
  }
}

function parseState(content) {
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Isi site-state.json bukan JSON yang valid.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Format site-state.json harus berupa object JSON.');
  }

  return {
    open: parsed.open !== false,
    message:
      typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : parsed.open === false
          ? 'Website sedang ditutup sementara.'
          : 'Website aktif kembali.',
    updatedAt: parsed.updatedAt || null,
    source: parsed.source || 'github-gist'
  };
}

async function getGist() {
  assertConfigured();

  const apiUrl = `${GITHUB_API}/gists/${encodeURIComponent(config.control.gistId)}`;

  try {
    const response = await axios.get(apiUrl, {
      headers: githubHeaders(),
      timeout: 12000,
      validateStatus: () => true
    });

    if (response.status < 200 || response.status >= 300) {
      throw githubError({ response }, 'membaca');
    }

    return response.data;
  } catch (error) {
    if (error?.message?.startsWith('GitHub ')) throw error;
    throw githubError(error, 'membaca');
  }
}

async function getSiteState() {
  const gist = await getGist();
  const fileName = config.control.stateFileName;
  const file = gist?.files?.[fileName];

  if (!file) {
    const available = Object.keys(gist?.files || {});
    throw new Error(
      `File "${fileName}" tidak ditemukan di GitHub Gist.${
        available.length ? ` File yang tersedia: ${available.join(', ')}` : ''
      }`
    );
  }

  if (typeof file.content !== 'string' || !file.content.trim()) {
    throw new Error(`File "${fileName}" di GitHub Gist kosong.`);
  }

  return parseState(file.content);
}

async function setSiteState(open, message = '') {
  assertConfigured();

  const payload = {
    open: Boolean(open),
    message:
      String(message || '').trim() ||
      (open ? 'Website aktif kembali.' : 'Website sedang ditutup sementara.'),
    updatedAt: new Date().toISOString(),
    source: 'telegram'
  };

  const apiUrl = `${GITHUB_API}/gists/${encodeURIComponent(config.control.gistId)}`;

  try {
    const response = await axios.patch(
      apiUrl,
      {
        files: {
          [config.control.stateFileName]: {
            content: JSON.stringify(payload, null, 2)
          }
        }
      },
      {
        headers: {
          ...githubHeaders(),
          'Content-Type': 'application/json'
        },
        timeout: 15000,
        validateStatus: () => true
      }
    );

    if (response.status < 200 || response.status >= 300) {
      throw githubError({ response }, 'mengubah');
    }

    return payload;
  } catch (error) {
    if (error?.message?.startsWith('GitHub ')) throw error;
    throw githubError(error, 'mengubah');
  }
}

async function assertSiteOpen() {
  const state = await getSiteState();

  if (!state.open) {
    const error = new Error(state.message || 'Website sedang ditutup sementara.');
    error.code = 'SITE_CLOSED';
    error.statusCode = 503;
    throw error;
  }

  return state;
}

module.exports = {
  getSiteState,
  setSiteState,
  assertSiteOpen,
  hasControlConfig
};
