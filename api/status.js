const { getSiteState } = require('./_lib/control');
const {
  sendJson,
  methodNotAllowed,
  handleOptions
} = require('./_lib/http');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  try {
    const state =
      await getSiteState();

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );

    return sendJson(
      res,
      200,
      {
        status: true,
        open: state.open,
        message: state.message,
        broadcast: state.broadcast || null,
        notice: state.notice || null,
        aio: state.aio || null,
        updatedAt: state.updatedAt,
        source: state.source || 'github-gist'
      }
    );
  } catch (error) {
    console.error(
      '[STATUS]',
      error
    );

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );

    return sendJson(
      res,
      503,
      {
        status: false,
        open: null,
        broadcast: null,
        notice: null,
        aio: null,
        message:
          error.message ||
          'Gagal membaca status website.',
        error: 'CONTROL_READ_FAILED'
      }
    );
  }
};
