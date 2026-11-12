// /api/stav.js — živý stav rozehrané hry pro učitelský dashboard.
// Hra sama sem posílá snapshot (POST), dashboard ho čte (GET).
// Data jsou v Upstash Redis pod jedním klíčem `stav:hra` s TTL 6 h,
// takže po skončení hry se stav sám uklidí.

const KEY = 'stav:hra';
const TTL_SECONDS = 6 * 60 * 60;
const MAX_BYTES = 8192;

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token: token };
}

async function redis(command) {
  const cfg = redisConfig();
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || 'Redis HTTP ' + res.status);
  return body.result;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (!redisConfig()) {
    return send(res, 503, { ok: false, error: 'Databáze není připojená (chybí KV_REST_API_URL/TOKEN).' });
  }

  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      if (!raw) return send(res, 200, { ok: true, state: null });
      let state = null;
      try { state = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { state = null; }
      const ageMs = state && state.sentAt ? Date.now() - state.sentAt : null;
      return send(res, 200, { ok: true, state: state, ageMs: ageMs });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      const state = body && body.state;
      if (!state || typeof state !== 'object') {
        return send(res, 400, { ok: false, error: 'Chybí stav hry.' });
      }
      const payload = JSON.stringify(state);
      if (payload.length > MAX_BYTES) {
        return send(res, 413, { ok: false, error: 'Stav je moc velký.' });
      }
      await redis(['SET', KEY, payload, 'EX', String(TTL_SECONDS)]);
      return send(res, 200, { ok: true, saved: true });
    }

    if (req.method === 'DELETE') {
      await redis(['DEL', KEY]);
      return send(res, 200, { ok: true, cleared: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { ok: false, error: 'Povolené metody jsou GET, POST a DELETE.' });
  } catch (err) {
    return send(res, 502, {
      ok: false,
      error: 'Stav hry se nepodařilo načíst nebo uložit.',
      detail: String((err && err.message) || err).slice(0, 200),
    });
  }
};
