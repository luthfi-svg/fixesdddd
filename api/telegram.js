const axios = require('axios');
const config = require('../config');
const {
  setSiteState,
  getSiteState,
  setBroadcast,
  clearBroadcast,
  setNotice,
  clearNotice,
  setAioFeature,
  setAioEnabled
} = require('./_lib/control');
const { getDashboardData, clearLogs, checkHealth } = require('./_lib/analytics');
const {
  sendJson,
  methodNotAllowed,
  handleOptions
} = require('./_lib/http');

function isConfigured() {
  const token = config.telegram?.botToken;
  const adminIds = config.telegram?.adminIds || [];

  return Boolean(
    token &&
      adminIds.length &&
      !/PASTE_|CHANGE_THIS|HERE/i.test(String(token))
  );
}

function isAdmin(userId) {
  return (config.telegram?.adminIds || [])
    .map(String)
    .includes(String(userId));
}

async function telegramApi(method, payload) {
  const token = config.telegram.botToken;
  const url =
    `https://api.telegram.org/bot${token}/${method}`;

  const response = await axios.post(
    url,
    payload,
    {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  return response.data;
}

async function reply(chatId, text) {
  return telegramApi(
    'sendMessage',
    {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    }
  );
}

function getCommand(text = '') {
  const first =
    text.trim().split(/\s+/)[0] || '';

  return first
    .replace(/^\/+/, '')
    .split('@')[0]
    .toLowerCase();
}

function getCommandArguments(text = '') {
  return text
    .trim()
    .split(/\s+/)
    .slice(1)
    .join(' ')
    .trim();
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') {
    return methodNotAllowed(res);
  }

  try {
    if (!isConfigured()) {
      return sendJson(
        res,
        503,
        {
          status: false,
          message:
            'Telegram belum dikonfigurasi di environment variables.'
        }
      );
    }

    const expectedSecret =
      config.telegram.webhookSecret;

    const incomingSecret =
      req.headers[
        'x-telegram-bot-api-secret-token'
      ];

    if (
      expectedSecret &&
      !/CHANGE_THIS/i.test(
        String(expectedSecret)
      ) &&
      incomingSecret !== expectedSecret
    ) {
      return sendJson(
        res,
        401,
        {
          status: false,
          message:
            'Webhook secret tidak valid.'
        }
      );
    }

    const update =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const message =
      update.message ||
      update.edited_message;

    const text =
      message?.text || '';

    const chatId =
      message?.chat?.id;

    const fromId =
      message?.from?.id;

    if (!chatId || !text) {
      return sendJson(
        res,
        200,
        {
          status: true,
          ignored: true
        }
      );
    }

    const command =
      getCommand(text);

    if (['start', 'help'].includes(command)) {
      await reply(
        chatId,
        [
          'LUTLOAD CONTROL',
          '',
          '/open - buka website',
          '/close - tutup website',
          '/status - cek status',
          '',
          '/broadcast <teks>',
          '/broadcast clear',
          '/broadcast chek',
          '',
          '/notice <teks>',
          '/notice info <teks>',
          '/notice warning <teks>',
          '/notice success <teks>',
          '/notice clear',
          '/notice check',
          '',
          '/dashboard - ringkasan analytics',
          '/health - cek kesehatan API',
          '/logs - visitor & error terbaru',
          '/logs clear - hapus log',
          '',
          '/aio status - status AIO',
          '/aio <platform> on|off - toggle AIO',
          '/aio all on|off - toggle semua AIO',
          '',
          isAdmin(fromId)
            ? 'Akses admin: AKTIF'
            : 'Akses admin: TIDAK DIIZINKAN'
        ].join('\n')
      );

      return sendJson(
        res,
        200,
        {
          status: true
        }
      );
    }

    const allowedCommands = [
      'open',
      'close',
      'status',
      'broadcast',
      'notice',
      'dashboard',
      'health',
      'logs',
      'aio'
    ];

    if (!allowedCommands.includes(command)) {
      return sendJson(
        res,
        200,
        {
          status: true,
          ignored: true
        }
      );
    }

    if (!isAdmin(fromId)) {
      await reply(
        chatId,
        'Akses ditolak. Akun Telegram ini bukan admin LUTLOAD.'
      );

      return sendJson(
        res,
        200,
        {
          status: true,
          authorized: false
        }
      );
    }

    if (command === 'maintenance') {
      const message = getCommandArguments(text) || 'Website sedang dalam maintenance. Silakan kembali beberapa saat lagi.';
      const state = await setSiteState(false, message);
      await reply(chatId, ['MAINTENANCE MODE 🔧', '', state.message].join('\n'));
      return sendJson(res, 200, { status: true, open: false, message: state.message });
    }

    if (command === 'dashboard') {
      const data = await getDashboardData();
      const a = data.analytics;
      const today = data.today;
      const devices = Object.entries(a.byDevice || {})
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5)
        .map(([name, count]) => `• ${name}: ${count}`)
        .join('\n') || '• Belum ada data';
      const platforms = Object.entries(a.byPlatform || {})
        .map(([name, value]) => `• ${name}: ${value.successes || 0} sukses / ${value.failures || 0} gagal`)
        .join('\n') || '• Belum ada data';
      const rate = a.totals.requests ? ((a.totals.successes / a.totals.requests) * 100).toFixed(1) : '0.0';
      await reply(chatId, [
        'LUTLOAD DASHBOARD 📊', '',
        `Hari ini: ${today.requests} request`,
        `Sukses: ${today.successes} | Gagal: ${today.failures}`,
        `Total request: ${a.totals.requests}`,
        `Success rate: ${rate}%`, '',
        'DEVICE:', devices, '',
        'PLATFORM:', platforms, '',
        `Visitor tersimpan: ${data.recentVisitors.length}`,
        `Error tersimpan: ${data.errorCount}`
      ].join('\n'));
      return sendJson(res, 200, { status: true, dashboard: data });
    }

    if (command === 'health') {
      const health = await checkHealth();
      const lines = health.checks.map(item => `${item.ok ? '🟢' : '🔴'} ${item.name}: ${item.ok ? 'OK' : 'ERROR'}${item.status ? ` (${item.status})` : ''} • ${item.latencyMs}ms`);
      await reply(chatId, ['LUTLOAD API HEALTH', '', ...lines, '', `Overall: ${health.healthy ? 'HEALTHY 🟢' : 'DEGRADED 🔴'}`].join('\n'));
      return sendJson(res, health.healthy ? 200 : 503, { status: health.healthy, health });
    }

    if (command === 'logs') {
      const args = getCommandArguments(text).toLowerCase();
      if (args === 'clear') {
        await clearLogs();
        await reply(chatId, 'Visitor log dan error log berhasil dibersihkan. 🗑️');
        return sendJson(res, 200, { status: true, cleared: true });
      }
      const data = await getDashboardData();
      const visitorLines = data.recentVisitors.length
        ? data.recentVisitors.slice(0, 10).map((v, i) => `${i + 1}. ${v.ip} • ${v.device}/${v.os} • ${v.time}`)
        : ['Belum ada visitor.'];
      const errorLines = data.recentErrors.length
        ? data.recentErrors.slice(0, 10).map((e, i) => `${i + 1}. [${e.platform}] ${e.message}`)
        : ['Belum ada error.'];
      await reply(chatId, ['VISITOR TERBARU 👤', '', ...visitorLines, '', 'ERROR TERBARU ⚠️', '', ...errorLines].join('\n'));
      return sendJson(res, 200, { status: true, visitors: data.recentVisitors, errors: data.recentErrors });
    }

    if (command === 'aio') {
      const args = getCommandArguments(text);
      const parts = args.split(/\s+/).filter(Boolean);
      const target = String(parts[0] || '').toLowerCase();
      const action = String(parts[1] || '').toLowerCase();

      if (!target || target === 'status') {
        const state = await getSiteState();
        const features = state.aio?.features || {};
        const lines = Object.entries(features).map(
          ([name, enabled]) => `• ${name}: ${enabled ? 'ON 🟢' : 'OFF 🔴'}`
        );

        await reply(chatId, [
          'LUTLOAD AIO DOWNLOADER',
          '',
          `Global: ${state.aio?.enabled === false ? 'OFF 🔴' : 'ON 🟢'}`,
          '',
          ...lines,
          '',
          'TikTok Stalker: INDEPENDENT (tidak dikontrol AIO)'
        ].join('\n'));

        return sendJson(res, 200, { status: true, aio: state.aio || null });
      }

      if (target === 'stalktt' || target === 'stalker') {
        await reply(chatId, 'TikTok Stalker tidak termasuk kontrol AIO dan tetap berjalan mandiri.');
        return sendJson(res, 400, { status: false, message: 'TikTok Stalker tidak termasuk kontrol AIO.' });
      }

      if (target === 'all') {
        if (!['on', 'off'].includes(action)) {
          await reply(chatId, 'Format: /aio all on atau /aio all off');
          return sendJson(res, 200, { status: true });
        }

        const state = await setAioEnabled(action === 'on');
        await reply(chatId, `Semua fitur AIO sekarang: ${state.aio.enabled ? 'ON 🟢' : 'OFF 🔴'}`);
        return sendJson(res, 200, { status: true, aio: state.aio });
      }

      if (!['on', 'off'].includes(action)) {
        await reply(chatId, [
          'Format AIO:',
          '/aio status',
          '/aio tiktok on',
          '/aio tiktok off',
          '/aio instagram on',
          '/aio instagram off',
          '/aio youtube on',
          '/aio youtube off',
          '/aio all on',
          '/aio all off'
        ].join('\n'));
        return sendJson(res, 200, { status: true });
      }

      const state = await setAioFeature(target, action === 'on');
      await reply(
        chatId,
        `AIO ${target.toUpperCase()}: ${state.aio.features[target] ? 'ON 🟢' : 'OFF 🔴'}`
      );

      return sendJson(res, 200, {
        status: true,
        platform: target,
        enabled: state.aio.features[target],
        aio: state.aio
      });
    }

    if (command === 'status') {
      const state =
        await getSiteState();

      await reply(
        chatId,
        [
          `Status LUTLOAD: ${state.open ? 'OPEN 🟢' : 'CLOSED 🔴'}`,
          state.message || '',
          '',
          state.broadcast
            ? `Broadcast: AKTIF 📢\n${state.broadcast.text}`
            : 'Broadcast: TIDAK ADA'
        ].join('\n')
      );

      return sendJson(
        res,
        200,
        {
          status: true,
          open: state.open,
          broadcast: state.broadcast
        }
      );
    }

    if (command === 'broadcast') {
      const args =
        getCommandArguments(text);

      const firstArg =
        args.split(/\s+/)[0]?.toLowerCase() || '';

      if (firstArg === 'clear') {
        const state =
          await clearBroadcast();

        await reply(
          chatId,
          'Broadcast website berhasil dihapus. 🗑️'
        );

        return sendJson(
          res,
          200,
          {
            status: true,
            broadcast: state.broadcast
          }
        );
      }

      if (
        firstArg === 'chek' ||
        firstArg === 'check'
      ) {
        const state =
          await getSiteState();

        await reply(
          chatId,
          state.broadcast
            ? [
                'BROADCAST AKTIF 📢',
                '',
                state.broadcast.text,
                '',
                `Diperbarui: ${state.broadcast.updatedAt || '-'}`
              ].join('\n')
            : 'Tidak ada broadcast yang terpasang di website.'
        );

        return sendJson(
          res,
          200,
          {
            status: true,
            broadcast: state.broadcast
          }
        );
      }

      if (!args) {
        await reply(
          chatId,
          [
            'Format broadcast:',
            '/broadcast <teks>',
            '',
            'Hapus:',
            '/broadcast clear',
            '',
            'Cek:',
            '/broadcast chek'
          ].join('\n')
        );

        return sendJson(
          res,
          200,
          {
            status: true,
            broadcast: null
          }
        );
      }

      const state =
        await setBroadcast(args);

      await reply(
        chatId,
        [
          'Broadcast berhasil dipasang. 📢',
          '',
          state.broadcast.text
        ].join('\n')
      );

      return sendJson(
        res,
        200,
        {
          status: true,
          broadcast: state.broadcast
        }
      );
    }

    if (command === 'notice') {
      const args = getCommandArguments(text);
      const parts = args.split(/\s+/);
      const action = (parts[0] || '').toLowerCase();

      if (action === 'clear') {
        const state = await clearNotice();
        await reply(chatId, 'Notice website berhasil dihapus. 🗑️');
        return sendJson(res, 200, { status: true, notice: state.notice });
      }

      if (action === 'check' || action === 'chek') {
        const state = await getSiteState();
        await reply(chatId, state.notice
          ? ['NOTICE AKTIF 🔔', '', `Tipe: ${state.notice.type.toUpperCase()}`, state.notice.text, '', `Diperbarui: ${state.notice.updatedAt || '-'}`].join('\n')
          : 'Tidak ada notice yang terpasang di website.');
        return sendJson(res, 200, { status: true, notice: state.notice });
      }

      let type = 'info';
      let noticeText = args;
      if (['info', 'warning', 'success'].includes(action)) {
        type = action;
        noticeText = parts.slice(1).join(' ').trim();
      }

      if (!noticeText) {
        await reply(chatId, ['Format notice:', '/notice <teks>', '/notice info <teks>', '/notice warning <teks>', '/notice success <teks>', '', 'Hapus: /notice clear', 'Cek: /notice check'].join('\n'));
        return sendJson(res, 200, { status: true, notice: null });
      }

      const state = await setNotice(noticeText, type);
      await reply(chatId, ['Notice berhasil dipasang. 🔔', '', `Tipe: ${state.notice.type.toUpperCase()}`, state.notice.text].join('\n'));
      return sendJson(res, 200, { status: true, notice: state.notice });
    }

    const open = command === 'open';
    const customMessage = getCommandArguments(text);
    const state = await setSiteState(
      open,
      customMessage || (open ? 'Website aktif kembali.' : 'Website sedang ditutup sementara.')
    );

    await reply(
      chatId,
      `LUTLOAD sekarang: ${open ? 'OPEN 🟢' : 'CLOSED 🔴'}`
    );

    return sendJson(
      res,
      200,
      {
        status: true,
        open: state.open,
        updatedAt: state.updatedAt
      }
    );
  } catch (error) {
    const detail =
      error?.response?.data?.description ||
      error?.response?.data?.message ||
      error?.message ||
      'Telegram handler error.';

    console.error(
      '[TELEGRAM]',
      detail
    );

    return sendJson(
      res,
      500,
      {
        status: false,
        message: detail
      }
    );
  }
};
