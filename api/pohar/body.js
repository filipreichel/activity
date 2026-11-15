const SCRIPT = String(process.env.POHAR_SCRIPT || '').replace(/\/+$/, '');
const SECRET = String(process.env.POHAR_SECRET || '');

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// POST /api/pohar/body — zápis bodů z telefonu průvodce.
// Tělo: { k (osobní odkaz), kolej, body, kategorie, zaci, poznamka, eventId }
// Odpovídá až po uložení do tabulky; při chybě 502/503 a klient si zápis podrží.
async function forward(res, payload) {
  if (!SCRIPT) return send(res, 503, { ok: false, error: 'POHAR_SCRIPT není nastavený' });
  payload.secret = SECRET;
  try {
    const r = await fetch(SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(text);
  } catch (err) {
    send(res, 502, { ok: false, error: 'tabulka neodpovídá: ' + String((err && err.message) || err) });
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'jen POST' });
  const b = req.body || {};
  const pts = Math.trunc(Number(b.body));
  if (!pts || Math.abs(pts) > 200) {
    return send(res, 400, { ok: false, error: 'body musí být celé číslo 1–200' });
  }
  return forward(res, {
    action: 'body',
    token: String(b.k || ''),
    jmeno: String(b.jmeno || '').slice(0, 40),
    kolej: String(b.kolej || ''),
    body: pts,
    poznamka: String(b.poznamka || '').slice(0, 200),
    eventId: String(b.eventId || ''),
  });
};

module.exports.forward = forward;
