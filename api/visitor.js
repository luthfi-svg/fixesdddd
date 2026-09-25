const { recordVisitor, checkRateLimit } = require('./_lib/analytics');
const { sendJson, methodNotAllowed, handleOptions } = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    checkRateLimit(req, 'visitor');
    const result = await recordVisitor(req);
    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, 200, { status: true, device: result.device });
  } catch (error) {
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    return sendJson(res, error.statusCode || 500, { status: false, message: 'Gagal mencatat visitor.' });
  }
};
