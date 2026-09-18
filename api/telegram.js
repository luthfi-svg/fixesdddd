const axios = require('axios');
const config = require('../config');
const {
  setSiteState,
  getSiteState,
  setBroadcast,
  clearBroadcast
} = require('./_lib/control');
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
      'broadcast'
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

    const open =
      command === 'open';

    const state =
      await setSiteState(
        open,
        open
          ? 'Website aktif kembali.'
          : 'Website sedang ditutup sementara.'
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
