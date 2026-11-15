const SCRIPT = String(process.env.POHAR_SCRIPT || '').replace(/\/+$/, '');
const SECRET = String(process.env.POHAR_SECRET || '');

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// POST /api/pohar/undo — vrácení vlastního zápisu do 15 minut.
// Tělo: { k, eventId } → přidá opačný řádek.
const { forward } = require('./body');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'jen POST' });
  const b = req.body || {};
  if (!b.eventId) return send(res, 400, { ok: false, error: 'chybí eventId' });
  return forward(res, {
    action: 'undo',
    token: String(b.k || ''),
    jmeno: String(b.jmeno || '').slice(0, 40),
    eventId: String(b.eventId),
  });
};
