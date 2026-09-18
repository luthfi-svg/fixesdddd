function sendJson(res, statusCode, payload) {
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  return res.json(payload);
}

function methodNotAllowed(res) {
  return sendJson(res, 405, {
    status: false,
    message: 'Method tidak didukung.'
  });
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204);
    return res.end();
  }
  return false;
}

module.exports = {
  sendJson,
  methodNotAllowed,
  handleOptions
};
