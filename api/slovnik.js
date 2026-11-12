// /api/slovnik.js — společný slovník výrazů pro hru „Aktivity pro Ypsilon"
// Serverless funkce pro Vercel. Data leží v Upstash Redis (nebo Vercel KV),
// obojí přes REST API — žádná npm závislost, jen dvě proměnné prostředí:
//
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN      (Upstash přímo)
//   KV_REST_API_URL + KV_REST_API_TOKEN                    (Vercel KV / integrace)
//
// GET  → { ok, counts: {desc, draw, mime, total}, words: [...] }
// POST → { names, text, tasks[], pts, deviceId }  →  { ok, word, counts }

const HASH_KEY = 'slovnik:vyrazy';
const MAX_WORDS = 4000;      // strop, aby databáze nevyrostla do neznáma
const MAX_PER_DEVICE = 60;   // kolik výrazů smí přidat jedno zařízení
const MAX_TEXT = 80;
const MAX_NAMES = 60;
const TASKS = ['desc', 'draw', 'mime'];

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
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(body.error || `Redis HTTP ${res.status}`);
  }
  return body.result;
}

// HGETALL vrací podle formátu odpovědi objekt nebo ploché pole [field, value, ...]
function toWords(raw) {
  if (!raw) return [];
  const out = [];
  const push = (v) => {
    if (!v) return;
    try {
      const w = typeof v === 'string' ? JSON.parse(v) : v;
      if (w && w.id && w.text) out.push(w);
    } catch (e) {
      /* poškozený záznam přeskočíme */
    }
  };
  if (Array.isArray(raw)) {
    for (let i = 1; i < raw.length; i += 2) push(raw[i]);
  } else if (typeof raw === 'object') {
    Object.values(raw).forEach(push);
  }
  return out;
}

function countByTask(words) {
  const counts = { desc: 0, draw: 0, mime: 0, total: words.length };
  words.forEach((w) => {
    TASKS.forEach((t) => {
      if (Array.isArray(w.tasks) && w.tasks.includes(t)) counts[t] += 1;
    });
  });
  return counts;
}

// porovnání bez ohledu na diakritiku, velikost písmen a přebytečné mezery
function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (!redisConfig()) {
    return send(res, 503, {
      ok: false,
      error: 'Společný slovník není připojený — chybí UPSTASH_REDIS_REST_URL/TOKEN (nebo KV_REST_API_URL/TOKEN).',
      detail: 'Připojte Upstash Redis (Vercel → Storage) a nasaďte znovu.',
    });
  }

  try {
    if (req.method === 'GET') {
      const words = toWords(await redis(['HGETALL', HASH_KEY]));
      return send(res, 200, { ok: true, counts: countByTask(words), words });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      if (!body || typeof body !== 'object') {
        return send(res, 400, { ok: false, error: 'Neplatný požadavek.' });
      }

      const names = String(body.names || '').trim().slice(0, MAX_NAMES);
      const text = String(body.text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT);
      const deviceId = String(body.deviceId || '').trim().slice(0, 64);
      const pts = Math.min(3, Math.max(1, parseInt(body.pts, 10) || 2));
      const tasks = Array.isArray(body.tasks)
        ? TASKS.filter((t) => body.tasks.includes(t))
        : [];

      if (!names) return send(res, 400, { ok: false, error: 'Chybí „Vaše jména“.' });
      if (text.length < 2) return send(res, 400, { ok: false, error: 'Výraz je moc krátký.' });
      if (!tasks.length) return send(res, 400, { ok: false, error: 'Vyberte alespoň jednu disciplínu.' });
      if (!deviceId) return send(res, 400, { ok: false, error: 'Chybí ID zařízení.' });

      const words = toWords(await redis(['HGETALL', HASH_KEY]));

      if (words.length >= MAX_WORDS) {
        return send(res, 429, { ok: false, error: 'Slovník je plný, další výrazy už nepřijímá.' });
      }
      const mine = words.filter((w) => w.deviceId === deviceId);
      if (mine.length >= MAX_PER_DEVICE) {
        return send(res, 429, {
          ok: false,
          error: `Z tohoto zařízení už je ve slovníku ${MAX_PER_DEVICE} výrazů — to je strop.`,
        });
      }
      const norm = normalize(text);
      if (words.some((w) => normalize(w.text) === norm)) {
        return send(res, 409, { ok: false, error: `Výraz „${text}“ už ve slovníku je.` });
      }

      const word = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        names,
        tasks,
        pts,
        deviceId,
        createdAt: Date.now(),
      };

      await redis(['HSET', HASH_KEY, word.id, JSON.stringify(word)]);

      const nextWords = words.concat([word]);
      return send(res, 201, { ok: true, word, counts: countByTask(nextWords) });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { ok: false, error: 'Povolené metody jsou GET a POST.' });
  } catch (err) {
    return send(res, 502, {
      ok: false,
      error: 'Databáze výrazů neodpovídá.',
      detail: String((err && err.message) || err).slice(0, 200),
    });
  }
};
