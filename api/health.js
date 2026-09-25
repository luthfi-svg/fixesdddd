const { checkHealth } = require('./_lib/analytics');
const { sendJson, methodNotAllowed, handleOptions } = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  try {
    const health = await checkHealth();
    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, health.healthy ? 200 : 503, { status: health.healthy, ...health });
  } catch (error) {
    return sendJson(res, 503, { status: false, message: error.message || 'Health check gagal.' });
  }
};
