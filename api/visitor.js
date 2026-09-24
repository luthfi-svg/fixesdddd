const { addVisitorLog, hasControlConfig } = require('./_lib/control');
const {
  sendJson,
  methodNotAllowed,
  handleOptions
} = require('./_lib/http');

function firstForwardedIp(value) {
  return String(value || '')
    .split(',')[0]
    .trim();
}

function getClientIp(req) {
  return (
    firstForwardedIp(req.headers['x-forwarded-for']) ||
    String(req.headers['x-real-ip'] || '').trim() ||
    'unknown'
  );
}

function detectDevice(userAgent) {
  const ua = String(userAgent || '').toLowerCase();

  if (/ipad|tablet|playbook|silk/.test(ua)) return 'Tablet';
  if (/android/.test(ua)) return /mobile/.test(ua) ? 'Android' : 'Android Tablet';
  if (/iphone|ipod/.test(ua)) return 'iPhone';
  if (/windows phone/.test(ua)) return 'Windows Phone';
  if (/mobile/.test(ua)) return 'Mobile';
  if (/windows|macintosh|linux|cros|x11/.test(ua)) return 'Desktop';

  return 'Unknown';
}

function detectOs(userAgent) {
  const ua = String(userAgent || '');

  if (/Windows Phone/i.test(ua)) return 'Windows Phone';
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';

  return 'Unknown';
}

function detectBrowser(userAgent) {
  const ua = String(userAgent || '');

  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/SamsungBrowser\//i.test(ua)) return 'Samsung Internet';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/CriOS\//i.test(ua)) return 'Chrome iOS';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';

  return 'Unknown';
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return methodNotAllowed(res);
  }

  if (!hasControlConfig()) {
    return sendJson(res, 503, {
      status: false,
      message: 'Visitor logger belum dikonfigurasi.'
    });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const userAgent =
      String(req.headers['user-agent'] || '').slice(0, 1000);

    const path =
      typeof body.path === 'string' && body.path.startsWith('/')
        ? body.path.slice(0, 300)
        : '/';

    const entry = await addVisitorLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ip: getClientIp(req),
      device: detectDevice(userAgent),
      os: detectOs(userAgent),
      browser: detectBrowser(userAgent),
      userAgent,
      path,
      timestamp: new Date().toISOString()
    });

    res.setHeader('Cache-Control', 'no-store');

    return sendJson(res, 200, {
      status: true,
      logged: true,
      device: entry.device,
      os: entry.os,
      browser: entry.browser
    });
  } catch (error) {
    console.error('[VISITOR LOGGER]', error);

    return sendJson(res, 500, {
      status: false,
      message: error.message || 'Gagal menyimpan visitor log.'
    });
  }
};
