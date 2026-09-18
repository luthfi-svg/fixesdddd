const axios = require('axios');
const config = require('../config');
const { sendJson, methodNotAllowed, handleOptions } = require('./_lib/http');

function validSetupKey(key) {
  return (
    key &&
    !/CHANGE_THIS|PASTE_/i.test(String(config.telegram.setupKey || '')) &&
    String(key) === String(config.telegram.setupKey)
  );
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  try {
    const key = req.query?.key;
    if (!validSetupKey(key)) {
      return sendJson(res, 401, {
        status: false,
        message: 'Setup key tidak valid.'
      });
    }

    const token = config.telegram.botToken;
    if (!token || /PASTE_|CHANGE_THIS|HERE/i.test(String(token))) {
      return sendJson(res, 400, {
        status: false,
        message: 'Bot token Telegram belum diisi di config.js.'
      });
    }

    const baseUrl = String(req.query?.url || '')
      .trim()
      .replace(/\/+$/, '');

    if (!/^https:\/\/[^/]+/i.test(baseUrl)) {
      return sendJson(res, 400, {
        status: false,
        message:
          'Parameter url wajib berupa HTTPS, contoh: https://lutload.vercel.app'
      });
    }

    const webhookUrl = `${baseUrl}/api/telegram`;

    const response = await axios.post(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        url: webhookUrl,
        secret_token: config.telegram.webhookSecret,
        allowed_updates: ['message'],
        drop_pending_updates: true
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    return sendJson(res, 200, {
      status: Boolean(response.data?.ok),
      webhookUrl,
      telegram: response.data
    });
  } catch (error) {
    console.error('[SETUP TELEGRAM]', error.message);

    return sendJson(res, 500, {
      status: false,
      message: error.response?.data?.description || error.message
    });
  }
};
