// /api/slovnik.js — společný slovník výrazů pro hru „Aktivity pro Ypsilon"
// Serverless funkce pro Vercel. Data leží v Upstash Redis (nebo Vercel KV),
// obojí přes REST API — žádná npm závislost, jen dvě proměnné prostředí:
//
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN      (Upstash přímo)
//   KV_REST_API_URL + KV_REST_API_TOKEN                    (Vercel KV / integrace)
//
// GET    → { ok, counts: {desc, draw, mime, total}, words: [...] }
// POST   → { names, text, tasks[], points{desc,draw,mime}, deviceId }  → nový výraz
// PATCH  → { id, deviceId, …stejné položky }                          → úprava vlastního
// DELETE → { id, deviceId }                                           → smazání vlastního
//
// Obtížnost je pro každou disciplínu zvlášť: points = { desc: 1, draw: 3 }.

const HASH_KEY = 'slovnik:vyrazy';
const MAX_WORDS = 4000;      // strop, aby databáze nevyrostla do neznáma
const MAX_PER_DEVICE = 200;  // kolik výrazů smí přidat jedno zařízení
const MAX_TEXT = 80;
const MAX_NAMES = 60;
const TASKS = ['desc', 'draw', 'mime'];
const TASK_LABEL = { desc: 'Popis', draw: 'Kreslení', mime: 'Pantomima' };

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
      Authorization: 'Bearer ' + cfg.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(body.error || 'Redis HTTP ' + res.status);
  }
  return body.result;
}

// starší záznamy měly jedny body pro všechny disciplíny (`pts`) — srovnáme na `points`
function normalizeWord(w) {
  if (!w || !w.id || !w.text) return null;
  const tasks = Array.isArray(w.tasks) ? w.tasks.filter((t) => TASKS.includes(t)) : [];
  if (!tasks.length) return null;

  const points = {};
  if (w.points && typeof w.points === 'object') {
    tasks.forEach((t) => {
      const v = parseInt(w.points[t], 10);
      if (v >= 1 && v <= 3) points[t] = v;
    });
  }
  const legacy = parseInt(w.pts, 10);
  tasks.forEach((t) => {
    if (!points[t]) points[t] = legacy >= 1 && legacy <= 3 ? legacy : 2;
  });

  return {
    id: w.id,
    text: w.text,
    names: w.names || '',
    tasks: tasks,
    points: points,
    deviceId: w.deviceId || '',
    createdAt: w.createdAt || 0,
    updatedAt: w.updatedAt || w.createdAt || 0,
  };
}

// HGETALL vrací podle formátu odpovědi objekt nebo ploché pole [field, value, ...]
function toWords(raw) {
  if (!raw) return [];
  const out = [];
  const push = (v) => {
    if (!v) return;
    try {
      const w = typeof v === 'string' ? JSON.parse(v) : v;
      const norm = normalizeWord(w);
      if (norm) out.push(norm);
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
      if (w.tasks.includes(t)) counts[t] += 1;
    });
  });
  return counts;
}

// porovnání bez ohledu na diakritiku, velikost písmen, přebytečné mezery a interpunkci
function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "kmen" slova: u slov delších než 4 znaky se odřízne koncovka,
// takže „pneumatika“ a „pneumatiky“ vypadají stejně
function stem(text) {
  return normalize(text)
    .split(' ')
    .map((w) => (w.length > 4 ? w.slice(0, w.length - 2) : w))
    .join(' ');
}

// Levenshteinova vzdálenost s brzkým ukončením (malé výrazy, takže stačí)
function distance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev; prev = cur; cur = tmp;
  }
  return prev[b.length];
}

// najde stejný nebo velmi podobný výraz: překlepy, chybějící diakritika, jiná koncovka
function findSimilar(text, words, excludeId) {
  const norm = normalize(text);
  const base = stem(text);
  const limit = norm.length < 8 ? 1 : norm.length < 16 ? 2 : 3;
  let nearest = null;
  let nearestDist = Infinity;

  for (const w of words) {
    if (excludeId && w.id === excludeId) continue;
    const other = normalize(w.text);
    if (other === norm) return { kind: 'same', word: w };
    if (stem(w.text) === base) return { kind: 'ending', word: w };
    const d = distance(norm, other);
    const ratio = d / Math.max(norm.length, other.length);
    if (d <= limit && ratio <= 0.25 && d < nearestDist) { nearest = w; nearestDist = d; }
  }
  if (nearest) return { kind: 'typo', word: nearest, distance: nearestDist };
  return null;
}

function duplicateMessage(found, typed) {
  const who = found.word.names ? ' (přidal ' + found.word.names + ')' : '';
  if (found.kind === 'same') return 'Výraz „' + found.word.text + '“ už ve slovníku je' + who + '.';
  if (found.kind === 'ending') {
    return 'Už tam je velmi podobný výraz „' + found.word.text + '“' + who + ' — liší se jen koncovkou.';
  }
  return 'Možná je to stejný výraz jako „' + found.word.text + '“' + who + ' — překlep nebo chybějící diakritika?';
}


function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(payload));
}

/* zkontroluje vstup; vrací { error } nebo hotové položky */
function readInput(body) {
  const text = String(body.text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT);
  const names = String(body.names || '').trim().slice(0, MAX_NAMES);
  const tasks = Array.isArray(body.tasks) ? TASKS.filter((t) => body.tasks.includes(t)) : [];

  if (!names) return { error: 'Chybí „Vaše jména“.' };
  if (text.length < 2) return { error: 'Výraz musí mít aspoň 2 znaky.' };
  if (!tasks.length) return { error: 'Zaškrtněte alespoň jednu disciplínu.' };

  const points = {};
  const raw = body.points && typeof body.points === 'object' ? body.points : {};
  for (const t of tasks) {
    const v = parseInt(raw[t], 10);
    if (!(v >= 1 && v <= 3)) {
      return { error: 'U disciplíny „' + TASK_LABEL[t] + '“ chybí obtížnost (1–3 body).' };
    }
    points[t] = v;
  }

  return { text: text, names: names, tasks: tasks, points: points };
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
      words.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return send(res, 200, { ok: true, counts: countByTask(words), words: words });
    }

    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      if (!body || typeof body !== 'object') {
        return send(res, 400, { ok: false, error: 'Neplatný požadavek.' });
      }

      const deviceId = String(body.deviceId || '').trim().slice(0, 64);
      if (!deviceId) return send(res, 400, { ok: false, error: 'Chybí ID zařízení.' });

      const words = toWords(await redis(['HGETALL', HASH_KEY]));

      if (req.method === 'POST') {
        const parsed = readInput(body);
        if (parsed.error) return send(res, 400, { ok: false, error: parsed.error });

        if (words.length >= MAX_WORDS) {
          return send(res, 429, { ok: false, error: 'Slovník je plný, další výrazy už nepřijímá.' });
        }
        const mine = words.filter((w) => w.deviceId === deviceId);
        if (mine.length >= MAX_PER_DEVICE) {
          return send(res, 429, {
            ok: false,
            error: 'Z tohoto zařízení už je ve slovníku ' + MAX_PER_DEVICE + ' výrazů — to je strop.',
          });
        }
        const found = findSimilar(parsed.text, words, null);
        if (found) {
          return send(res, 409, {
            ok: false,
            error: found.kind === 'same' ? duplicateMessage(found, parsed.text) : duplicateMessage(found, parsed.text) + ' Zkus jiný výraz.',
            existing: found.word,
            similar: found.kind !== 'same',
          });
        }

        const now = Date.now();
        const word = {
          id: now.toString(36) + '-' + Math.random().toString(36).slice(2, 8),
          text: parsed.text,
          names: parsed.names,
          tasks: parsed.tasks,
          points: parsed.points,
          deviceId: deviceId,
          createdAt: now,
          updatedAt: now,
        };

        await redis(['HSET', HASH_KEY, word.id, JSON.stringify(word)]);
        return send(res, 201, { ok: true, word: word, counts: countByTask(words.concat([word])) });
      }

      // DELETE — smazání existujícího výrazu, jen z téhož zařízení
      if (req.method === 'DELETE') {
        const id = String(body.id || '').trim();
        const target = words.find((w) => w.id === id);
        if (!target) {
          return send(res, 404, { ok: false, error: 'Takový výraz ve slovníku není (mohl ho mezitím někdo smazat).' });
        }
        if (target.deviceId !== deviceId) {
          return send(res, 403, { ok: false, error: 'Mazat lze jen výrazy přidané z tohoto zařízení.' });
        }
        await redis(['HDEL', HASH_KEY, id]);
        const next = words.filter((w) => w.id !== id);
        return send(res, 200, { ok: true, removed: target, counts: countByTask(next) });
      }

      // PATCH — úprava existujícího výrazu, jen z téhož zařízení
      const id = String(body.id || '').trim();
      const target = words.find((w) => w.id === id);
      if (!target) {
        return send(res, 404, { ok: false, error: 'Takový výraz ve slovníku není (mohl ho mezitím někdo smazat).' });
      }
      if (target.deviceId !== deviceId) {
        return send(res, 403, { ok: false, error: 'Upravovat lze jen výrazy přidané z tohoto zařízení.' });
      }

      const parsed = readInput(body);
      if (parsed.error) return send(res, 400, { ok: false, error: parsed.error });

      const found = findSimilar(parsed.text, words, id);
      if (found) {
        return send(res, 409, { ok: false, error: duplicateMessage(found, parsed.text), existing: found.word, similar: found.kind !== 'same' });
      }

      const updated = Object.assign({}, target, {
        text: parsed.text,
        names: parsed.names,
        tasks: parsed.tasks,
        points: parsed.points,
        updatedAt: Date.now(),
      });
      await redis(['HSET', HASH_KEY, id, JSON.stringify(updated)]);
      const next = words.map((w) => (w.id === id ? updated : w));
      return send(res, 200, { ok: true, word: updated, counts: countByTask(next) });
    }

    if (req.method === 'DELETE') {
      // Maže buď samo zařízení (musí poslat své deviceId), nebo učitel z přehledu
      // na neveřejné adrese (bez deviceId).
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      const url = new URL(req.url || '/', 'http://x');
      const id = String((body && body.id) || url.searchParams.get('id') || '').trim();
      const deviceId = String((body && body.deviceId) || '').trim().slice(0, 64);
      if (!id) return send(res, 400, { ok: false, error: 'Chybí ID výrazu, který se má smazat.' });

      const words = toWords(await redis(['HGETALL', HASH_KEY]));
      const target = words.find((w) => w.id === id);
      if (!target) {
        return send(res, 404, { ok: false, error: 'Takový výraz už ve slovníku není (mohl ho mezitím někdo smazat).' });
      }
      if (deviceId && target.deviceId !== deviceId) {
        return send(res, 403, { ok: false, error: 'Mazat lze jen výrazy přidané z tohoto zařízení.' });
      }

      await redis(['HDEL', HASH_KEY, id]);
      const next = words.filter((w) => w.id !== id);
      return send(res, 200, { ok: true, removed: target, deleted: { id: target.id, text: target.text }, counts: countByTask(next) });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return send(res, 405, { ok: false, error: 'Povolené metody jsou GET, POST, PATCH a DELETE.' });
  } catch (err) {
    return send(res, 502, {
      ok: false,
      error: 'Databáze výrazů neodpovídá.',
      detail: String((err && err.message) || err).slice(0, 200),
    });
  }
};

// pro testy (na chod API to nemá vliv)
module.exports.normalize = normalize;
module.exports.stem = stem;
module.exports.distance = distance;
module.exports.findSimilar = findSimilar;
