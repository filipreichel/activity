const SCRIPT = String(process.env.POHAR_SCRIPT || '').replace(/\/+$/, '');
const SECRET = String(process.env.POHAR_SECRET || '');

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// GET /api/pohar/score — součty kolejí pro obrazovku na TV.
// Drží se 1 s na hraně sítě: televize se ptá každých 1,5 s, do tabulky jde
// maximálně jeden dotaz za sekundu a ruční přepis v listu je vidět do ~3 s.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'jen GET' });
  if (!SCRIPT) return send(res, 503, { ok: false, error: 'POHAR_SCRIPT není nastavený' });
  try {
    const r = await fetch(SCRIPT + '?action=score', { headers: { 'cache-control': 'no-cache' } });
    const text = await r.text();
    res.statusCode = r.ok ? 200 : 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1, stale-while-revalidate=3');
    res.end(text);
  } catch (err) {
    send(res, 502, { ok: false, error: String((err && err.message) || err) });
  }
};
