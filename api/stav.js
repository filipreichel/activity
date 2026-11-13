// /api/stav.js — živé stavy VŠECH rozehraných her pro učitelský dashboard.
// Každé zařízení, které hraje, posílá snapshot (POST) pod svým gameId;
// dashboard čte všechny najednou (GET) a kreslí je na jednu obrazovku.
//
// GET    → { ok, games: [ { ...state, ageMs } ], count }
// POST   → { state: { gameId, … } }   → uloží/aktualizuje jeden běh hry
// DELETE → ?gameId=… smaže jeden běh, bez parametru vyčistí všechny

const PREFIX = 'stav:hra:';
const INDEX = 'stav:hry:index';
const TTL_SECONDS = 6 * 60 * 60;
const STALE_MS = 3 * 60 * 1000;     // hra bez aktualizace 3 min = už neběží
const MAX_GAMES = 60;
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

function parseState(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
}

function sanitizeGameId(value) {
  return String(value || '').trim().replace(/[^\w\-.]/g, '').slice(0, 48);
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
      const now = Date.now();
      const ids = (await redis(['ZRANGEBYSCORE', INDEX, String(now - STALE_MS), '+inf'])) || [];
      const list = Array.isArray(ids) ? ids : [];

      let games = [];
      if (list.length) {
        const keys = list.map((id) => PREFIX + id);
        const values = (await redis(['MGET'].concat(keys))) || [];
        games = values
          .map((raw, i) => {
            const st = parseState(raw);
            if (!st) return null;
            const sentAt = st.sentAt || 0;
            return Object.assign({}, st, { gameId: st.gameId || list[i], ageMs: sentAt ? now - sentAt : null });
          })
          .filter(Boolean);
      }

      games.sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'cs'));
      redis(['ZREMRANGEBYSCORE', INDEX, '-inf', String(now - TTL_SECONDS * 1000)]).catch(() => {});
      return send(res, 200, { ok: true, games: games, count: games.length });
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

      const gameId = sanitizeGameId(state.gameId || state.deviceId);
      if (!gameId) return send(res, 400, { ok: false, error: 'Chybí gameId (ID zařízení, které hraje).' });

      const count = (await redis(['ZCARD', INDEX])) || 0;
      if (count >= MAX_GAMES) {
        return send(res, 429, { ok: false, error: 'Příliš mnoho běžících her (' + MAX_GAMES + ').' });
      }

      const clean = Object.assign({}, state, { gameId: gameId, sentAt: state.sentAt || Date.now() });
      const payload = JSON.stringify(clean);
      if (payload.length > MAX_BYTES) {
        return send(res, 413, { ok: false, error: 'Stav je moc velký.' });
      }

      await redis(['SET', PREFIX + gameId, payload, 'EX', String(TTL_SECONDS)]);
      await redis(['ZADD', INDEX, String(Date.now()), gameId]);
      return send(res, 200, { ok: true, saved: true, gameId: gameId });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url || '/', 'http://x');
      const gameId = sanitizeGameId(url.searchParams.get('gameId') || '');
      if (gameId) {
        await redis(['DEL', PREFIX + gameId]);
        await redis(['ZREM', INDEX, gameId]);
        return send(res, 200, { ok: true, cleared: gameId });
      }
      const ids = (await redis(['ZRANGE', INDEX, '0', '-1'])) || [];
      if (ids.length) await redis(['DEL'].concat(ids.map((id) => PREFIX + id)));
      await redis(['DEL', INDEX]);
      return send(res, 200, { ok: true, cleared: 'all' });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { ok: false, error: 'Povolené metody jsou GET, POST a DELETE.' });
  } catch (err) {
    return send(res, 502, {
      ok: false,
      error: 'Stavy her se nepodařilo načíst nebo uložit.',
      detail: String((err && err.message) || err).slice(0, 200),
    });
  }
};
