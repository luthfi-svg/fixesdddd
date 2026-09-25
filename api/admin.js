const config = require('../config');
const { getDashboardData, clearLogs } = require('./_lib/analytics');
const { sendJson, methodNotAllowed, handleOptions } = require('./_lib/http');

function authorized(req) {
  const key = config.telegram?.setupKey || '';
  const incoming = req.headers['x-admin-key'] || req.query?.key || '';
  return Boolean(key && incoming && String(incoming) === String(key));
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'DELETE') return methodNotAllowed(res);
  if (!authorized(req)) return sendJson(res, 401, { status: false, message: 'Unauthorized.' });

  try {
    if (req.method === 'DELETE') {
      await clearLogs();
      return sendJson(res, 200, { status: true, message: 'Visitor dan error logs berhasil dihapus.' });
    }
    return sendJson(res, 200, { status: true, ...(await getDashboardData()) });
  } catch (error) {
    return sendJson(res, 500, { status: false, message: error.message || 'Dashboard error.' });
  }
};
