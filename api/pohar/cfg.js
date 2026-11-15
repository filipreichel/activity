const SCRIPT = String(process.env.POHAR_SCRIPT || '').replace(/\/+$/, '');
const SECRET = String(process.env.POHAR_SECRET || '');

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// GET /api/pohar/cfg — koleje, kategorie, období. Mění se zřídka, drží se 60 s.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'jen GET' });
  if (!SCRIPT) return send(res, 503, { ok: false, error: 'POHAR_SCRIPT není nastavený' });
  try {
    const r = await fetch(SCRIPT + '?action=cfg');
    const text = await r.text();
    res.statusCode = r.ok ? 200 : 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(text);
  } catch (err) {
    send(res, 502, { ok: false, error: String((err && err.message) || err) });
  }
};
