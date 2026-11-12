/* PERLIČKY ČEŠTINY — herní logika
   Týmy se střídají, hráči v týmu rotují. Když tým neví, může otázku „ukrást“
   další tým v pořadí a body (celá hodnota) získává on. */

const SAVE_KEY = 'perlicky-v1';
const TEAM_COLORS = ['#E04116', '#449EF3', '#9D4DE7', '#2FB3AB', '#F3960F', '#88C933'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const app = document.getElementById('app');

let S = newState();
let SAVE = null;       // poslední odeslaná verze do localStorage
let timeLeft = 0;
let timerHandle = null;

/* ---------------- stav ---------------- */

function newState() {
  return {
    teams: [
      { id: 't1', name: '', players: [], score: 0, p: 0 },
      { id: 't2', name: '', players: [], score: 0, p: 0 }
    ],
    used: {},          // qid → { owner: teamId|null, stolen: bool }
    turn: 0,
    limit: 30,         // sekundy na odpověď, 0 = bez časomíry
    view: 'setup',
    current: null,
    history: []
  };
}

function qById(id) { return QUESTIONS.find(q => q.id === id); }
function catById(id) { return CATEGORIES.find(c => c.id === id); }
function catColor(id) { return (catById(id) || {}).color || '#999'; }
function teamColor(i) { return TEAM_COLORS[i % TEAM_COLORS.length]; }
function fmt(n) { return Math.round(n).toLocaleString('cs-CZ'); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function teamById(id) { return S.teams.find(t => t.id === id) || null; }
function teamIndexById(id) { return S.teams.findIndex(t => t.id === id); }
function remaining() { return QUESTIONS.filter(q => !S.used[q.id]).length; }
function currentPlayer(team) {
  if (!team || !team.players.length) return '';
  return team.players[team.p % team.players.length];
}
function turnText(i) {
  const t = S.teams[i];
  if (!t) return '';
  const pl = currentPlayer(t);
  return pl ? `${t.name} — ${pl}` : t.name;
}

/* ---------------- ukládání ---------------- */

function snapshot(label) {
  S.history.push({ label, state: JSON.parse(JSON.stringify({ teams: S.teams, used: S.used, turn: S.turn, current: S.current, view: S.view })) });
  if (S.history.length > 40) S.history.shift();
}

function save() {
  try {
    const copy = { teams: S.teams, used: S.used, turn: S.turn, limit: S.limit, view: S.view, current: S.current };
    SAVE = JSON.stringify(copy);
    localStorage.setItem(SAVE_KEY, SAVE);
  } catch (e) { /* soukromý režim — hra funguje dál, jen se neobnoví */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.teams) || !d.teams.length) return null;
    return d;
  } catch (e) { return null; }
}

/* ---------------- časomíra ---------------- */

function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function startTimer() {
  stopTimer();
  timeLeft = S.limit;
  paintTimer();
  if (!S.limit) return;
  timerHandle = setInterval(() => {
    timeLeft -= 1;
    paintTimer();
    if (timeLeft <= 0) {
      stopTimer();
      const el = document.querySelector('.timer');
      if (el) el.classList.add('warn');
      const hint = document.querySelector('[data-timeout-hint]');
      if (hint) hint.textContent = 'Čas vypršel — vyhodnoťte, prosím.';
    }
  }, 1000);
}

function paintTimer() {
  const box = document.querySelector('.timer');
  if (!box) return;
  if (!S.limit) { box.style.display = 'none'; return; }
  const num = box.querySelector('.tnum');
  if (num) num.textContent = Math.max(0, timeLeft);
  const ring = box.querySelector('.ring-fg');
  if (ring) {
    const C = 2 * Math.PI * 20;
    const frac = Math.max(0, timeLeft) / S.limit;
    ring.setAttribute('stroke-dasharray', C.toFixed(1));
    ring.setAttribute('stroke-dashoffset', (C * (1 - frac)).toFixed(1));
  }
  if (timeLeft <= 5) box.classList.add('warn'); else box.classList.remove('warn');
}

function timerMarkup() {
  if (!S.limit) return '';
  return `<div class="timer">
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <circle class="ring-bg" cx="23" cy="23" r="20" fill="none" stroke-width="5"></circle>
      <circle class="ring-fg" cx="23" cy="23" r="20" fill="none" stroke-width="5"
        stroke-linecap="round" transform="rotate(-90 23 23)"
        stroke-dasharray="125.7" stroke-dashoffset="0"></circle>
    </svg>
    <span class="tnum">${S.limit}</span>
  </div>`;
}

/* ---------------- akce ---------------- */

function openQuestion(qid) {
  if (S.used[qid]) return;
  snapshot('otevření otázky');
  S.current = { qid, phase: 'ask', respondIdx: S.turn, tried: [S.turn], result: null };
  S.view = 'question';
  render();
  startTimer();
}

function judge(ok) {
  const cur = S.current;
  if (!cur || cur.phase === 'done') return;
  snapshot(ok ? 'správná odpověď' : 'chybná odpověď');

  const q = qById(cur.qid);
  const responder = S.teams[cur.respondIdx];
  const wasSteal = cur.phase === 'steal';

  // hráč, který právě odpovídal, jde na konec řady
  if (responder && responder.players.length > 1) responder.p = (responder.p + 1) % responder.players.length;

  if (ok) {
    const pts = q.value * 1000;
    responder.score += pts;
    cur.result = { teamId: responder.id, pts, stolen: wasSteal };
    S.used[cur.qid] = { owner: responder.id, stolen: wasSteal };
    cur.phase = 'done';
    stopTimer();
    S.view = 'reveal';
    save(); render();
    return;
  }

  // kdo ještě může krást
  const nextIdx = nextStealer(cur);
  if (nextIdx === -1) {
    cur.result = { teamId: null, pts: 0 };
    cur.phase = 'done';
    S.used[cur.qid] = { owner: null, stolen: false };
    stopTimer();
    S.view = 'reveal';
    save(); render();
    return;
  }
  cur.tried.push(nextIdx);
  cur.respondIdx = nextIdx;
  cur.phase = 'steal';
  save(); render();
  startTimer();
}

function nextStealer(cur) {
  const n = S.teams.length;
  for (let step = 1; step <= n; step++) {
    const idx = (cur.tried[0] + step) % n;
    if (!cur.tried.includes(idx)) return idx;
  }
  return -1;
}

function revealDone() {
  // posun na další tým v pořadí
  S.turn = (S.turn + 1) % S.teams.length;
  S.current = null;
  S.view = remaining() === 0 ? 'results' : 'board';
  save(); render();
}

function cancelQuestion() {
  if (!confirm('Zavřít otázku bez bodů? Otázka zůstane na plánu.')) return;
  stopTimer();
  undo(true);
}

function undo(silent) {
  const last = S.history.pop();
  if (!last) { if (!silent) toast('Není co vrátit'); return; }
  const st = last.state;
  S.teams = st.teams; S.used = st.used; S.turn = st.turn; S.current = st.current;
  S.view = st.view;
  stopTimer();
  save(); render();
  if (S.view === 'question' && S.current) startTimer();
}

function newGame(sameTeams) {
  stopTimer();
  if (!sameTeams && !confirm('Začít novou hru a smazat postup?')) return;
  const teams = sameTeams
    ? S.teams.map(t => ({ ...t, score: 0, p: 0 }))
    : newState().teams;
  S = newState();
  S.teams = teams;
  S.view = sameTeams ? 'board' : 'setup';
  SAVE = null;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  save(); render();
  if (S.view === 'board') startFromSetupState();
}

/* ---------------- vykreslení ---------------- */

function render() {
  stopTimer();
  const v = S.view;
  if (v === 'setup') app.innerHTML = viewSetup();
  else if (v === 'board') { app.innerHTML = viewBoard(); }
  else if (v === 'question') app.innerHTML = viewQuestion();
  else if (v === 'reveal') app.innerHTML = viewReveal();
  else if (v === 'results') app.innerHTML = viewResults();
  window.scrollTo(0, 0);
  save();
}

/* --- nastavení --- */

function viewSetup() {
  const rows = S.teams.map((t, i) => `
    <div class="team-row">
      <span class="swatch" style="background:${teamColor(i)}"></span>
      <input type="text" data-team-name="${t.id}" value="${esc(t.name)}" placeholder="Název týmu ${i + 1}" maxlength="24">
      <input type="text" class="players" data-team-players="${t.id}" value="${esc(t.players.join(', '))}"
             placeholder="Hráči (nepovinné, čárkou)" maxlength="120">
      <button class="ghost" data-act="del-team" data-id="${t.id}" title="Odebrat tým" ${S.teams.length <= 2 ? 'disabled' : ''}>✕</button>
    </div>`).join('');

  return `
  <div class="wrap setup">
    <div class="hero">
      <h1>Perličky češtiny</h1>
      <p>Interaktivní hra o českém jazyce — 5 kategorií, 25 otázek. Týmy se střídají, kdo neví, může o body přijít ve prospěch soupeře.</p>
    </div>

    <div class="card">
      <h2>Týmy</h2>
      <p class="hint">2 až 6 týmů. Když vypíšete hráče, budou se v týmu postupně střídat.</p>
      ${rows}
      <div class="row-actions">
        <button data-act="add-team" ${S.teams.length >= 6 ? 'disabled' : ''}>+ Přidat tým</button>
      </div>
    </div>

    <div class="card">
      <h2>Čas na odpověď</h2>
      <p class="hint">Odpočet běží u otázky; po vypršení se nic neděje samo, jen se to rozsvítí.</p>
      <div class="seg" data-act="limit">
        ${[20, 30, 45, 60, 0].map(n => `<button data-limit="${n}" class="${S.limit === n ? 'on' : ''}">${n ? n + ' s' : 'bez časomíry'}</button>`).join('')}
      </div>
    </div>

    <div class="row-actions" style="justify-content:center;margin-top:22px">
      <button class="primary big" data-act="start">Začít hru →</button>
    </div>
    <p class="save-note">Hra se ukládá do prohlížeče — po obnovení stránky pokračujete tam, kde jste skončili.</p>
  </div>`;
}

function startFromSetupState() {
  if (remaining() === QUESTIONS.length && S.turn === 0) toast('Na řadě je ' + turnText(0));
}

/* --- hrací plán --- */

function viewBoard() {
  const heads = CATEGORIES.map(c => `<div class="cat-head" style="--c:${c.color}">${esc(c.name)}</div>`).join('');

  let tiles = '';
  const values = [10, 20, 30, 40, 50];
  for (const val of values) {
    for (const c of CATEGORIES) {
      const q = QUESTIONS.find(x => x.cat === c.id && x.value === val);
      if (!q) { tiles += `<div></div>`; continue; }
      const u = S.used[q.id];
      if (u) {
        const owner = u.owner ? teamById(u.owner) : null;
        const oi = owner ? teamIndexById(owner.id) : -1;
        tiles += `<button class="tile done ${u.stolen ? 'stolen' : ''}" disabled>
          <span class="val">${fmt(q.value * 1000)}</span>
          ${owner ? `<span class="owner" style="--c:${teamColor(oi)}"><i></i>${esc(owner.name)}</span>` : `<span class="owner">—</span>`}
        </button>`;
      } else {
        tiles += `<button class="tile" data-act="open" data-qid="${q.id}">${fmt(q.value * 1000)}</button>`;
      }
    }
  }

  const chips = S.teams.map((t, i) => `
    <div class="team-chip ${i === S.turn ? 'active' : ''}" style="--c:${teamColor(i)}">
      <div>
        <div class="name">${esc(t.name)}</div>
        ${t.players.length ? `<div class="who">${esc(currentPlayer(t))}</div>` : ''}
      </div>
      <div class="score">${fmt(t.score)}</div>
    </div>`).join('');

  return `
  <div class="wrap">
    <div class="topbar">
      <div class="brand"><span class="dot"></span>Perličky češtiny</div>
      <div class="spacer"></div>
      <button class="ghost" data-act="undo" title="Vrátit poslední krok">↶ Zpět</button>
      <button class="ghost" data-act="results">Výsledky</button>
      <button class="ghost" data-act="new-game">Nová hra</button>
    </div>

    <div class="scoreboard">${chips}</div>
    <div class="turn-banner">
      <span class="k">Na řadě</span><b>${esc(turnText(S.turn))}</b>
      <span class="k" style="margin-left:auto">Zbývá ${remaining()} z ${QUESTIONS.length}</span>
    </div>

    <div class="board">${heads}${tiles}</div>

    <div class="board-foot">
      <span>Klikněte na hodnotu a položte otázku nahlas.</span>
      <span style="margin-left:auto">Počet bodů je v tisících.</span>
    </div>
  </div>`;
}

/* --- otázka --- */

function viewQuestion() {
  const cur = S.current;
  const q = qById(cur.qid);
  const c = catById(q.cat);
  const responder = S.teams[cur.respondIdx];
  const stealing = cur.phase === 'steal';

  const opts = q.options ? `<ul class="options">${q.options.map((o, i) => `
      <li><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></li>`).join('')}</ul>`
    : `<div class="open-note">✍️ Odpověď se říká nahlas — správnou variantu uvidíte po vyhodnocení.</div>`;

  const img = q.img ? `<figure class="qimg"><img src="${q.img}" alt="obrázek k otázce"></figure>` : '';

  return `
  <div class="wrap qview">
    <div class="topbar">
      <div class="brand"><span class="dot"></span>Perličky češtiny</div>
      <div class="spacer"></div>
      <button class="ghost" data-act="cancel">✕ Zavřít otázku</button>
    </div>

    <div class="qhead">
      <span class="qcat" style="--c:${c.color}">${esc(c.name)}</span>
      <span class="qval">${fmt(q.value * 1000)}</span>
      ${timerMarkup()}
    </div>

    <div class="turnbox ${stealing ? 'steal' : ''}" style="--c:${teamColor(cur.respondIdx)}">
      <div>
        <div class="lbl">${stealing ? 'Krádež — odpovídá' : 'Odpovídá'}</div>
        <div class="who">${esc(turnText(cur.respondIdx))}</div>
      </div>
      <div class="actions">
        <button class="good" data-act="right">✔ Věděl</button>
        <button class="bad" data-act="wrong">✘ Nevěděl</button>
      </div>
    </div>

    <div class="qbody">
      <p class="qtext">${esc(q.q)}</p>
      ${img}
      ${opts}
    </div>

    <div class="foot-actions">
      <span class="kbd">S</span> správně &nbsp;·&nbsp; <span class="kbd">N</span> nevěděl &nbsp;·&nbsp; <span class="kbd">Esc</span> zavřít
      <span data-timeout-hint style="margin-left:auto;color:var(--ink-2);font-size:13px"></span>
    </div>
  </div>`;
}

/* --- odhalení --- */

function viewReveal() {
  const cur = S.current;
  const q = qById(cur.qid);
  const c = catById(q.cat);
  const res = cur.result || { teamId: null, pts: 0 };
  const winner = res.teamId ? teamById(res.teamId) : null;
  const wi = winner ? teamIndexById(winner.id) : -1;

  const opts = q.options ? `<ul class="options compact">${q.options.map((o, i) => `
      <li class="${i === q.correct ? 'right' : ''}"><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></li>`).join('')}</ul>`
    : `<div class="open-note" style="margin-top:16px">Správná odpověď je nahoře — posuďte, kdo ji řekl.</div>`;

  const award = winner
    ? `<div class="award win" style="--c:${teamColor(wi)}">🏅 +${fmt(res.pts)} pro tým <b>${esc(winner.name)}</b>${res.stolen ? ' (ukradeno)' : ''}</div>`
    : `<div class="award none">😬 Bez bodu — otázku nikdo nezvládl</div>`;

  const imgs = (q.imgs || []);
  const gallery = imgs.length
    ? `<div class="gallery ${imgs.length === 1 ? 'single' : ''}">${imgs.map(src => `<img src="${src}" alt="ilustrace k odpovědi" loading="lazy">`).join('')}</div>`
    : '';

  return `
  <div class="wrap qview">
    <div class="topbar">
      <div class="brand"><span class="dot"></span>Perličky češtiny</div>
      <div class="spacer"></div>
      <span class="qcat" style="--c:${c.color}">${esc(c.name)}</span>
      <span class="qval">${fmt(q.value * 1000)}</span>
    </div>

    <div class="qbody">
      ${award}
      <p class="qtext" style="font-size:clamp(15px,1.5vw,20px);font-weight:600;color:var(--ink-2);margin-bottom:14px">${esc(q.q.split('\n')[0])}</p>
      <div class="answer-line"><span class="tick">✔</span><span>${esc(q.answer || (q.options && q.options[q.correct]) || '')}</span></div>
      ${q.explain ? `<p class="explain">${esc(q.explain)}</p>` : ''}
      ${opts}
      ${gallery}
    </div>

    <div class="foot-actions">
      <button class="primary big" data-act="next">Pokračovat na plán →</button>
      <button class="ghost" data-act="undo">↶ Vrátit vyhodnocení</button>
    </div>
  </div>`;
}

/* --- výsledky --- */

function viewResults() {
  const sorted = S.teams
    .map((t, i) => ({ t, i, score: t.score }))
    .sort((a, b) => b.score - a.score);
  const medals = ['🥇', '🥈', '🥉'];

  const rows = sorted.map((r, rank) => `
    <div class="rank-row ${rank === 0 ? 'first' : ''}" style="--c:${teamColor(r.i)}">
      <span class="place">${medals[rank] || (rank + 1) + '.'}</span>
      <div>
        <div class="nm">${esc(r.t.name)}</div>
        ${r.t.players.length ? `<div class="sub">${esc(r.t.players.join(', '))}</div>` : ''}
      </div>
      <span class="pts">${fmt(r.score)}</span>
    </div>`).join('');

  const usedCount = QUESTIONS.length - remaining();

  return `
  <div class="wrap results">
    <div class="hero" style="text-align:center">
      <h1>Konec hry</h1>
      <p style="max-width:none">Odehráno ${usedCount} z ${QUESTIONS.length} otázek.</p>
    </div>
    <div class="card">
      <h2>Pořadí</h2>
      <div class="rank">${rows}</div>
      <div class="row-actions" style="margin-top:20px">
        <button class="primary" data-act="again">Hrát znovu se stejnými týmy</button>
        <button data-act="new-setup">Nové týmy</button>
        ${remaining() > 0 ? '<button class="ghost" data-act="back-board">Zpět na plán</button>' : ''}
      </div>
    </div>
  </div>`;
}

/* ---------------- interakce ---------------- */

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (btn) {
    const act = btn.dataset.act;
    if (act === 'limit') {
      const b = e.target.closest('[data-limit]');
      if (b) { S.limit = Number(b.dataset.limit); render(); }
      return;
    }
    if (act === 'add-team') {
      if (S.teams.length >= 6) return;
      S.teams.push({ id: 't' + (Date.now() % 100000), name: '', players: [], score: 0, p: 0 });
      render(); return;
    }
    if (act === 'del-team') {
      const id = btn.dataset.id;
      if (S.teams.length <= 2) return;
      S.teams = S.teams.filter(t => t.id !== id);
      render(); return;
    }
    if (act === 'start') {
      const empty = S.teams.some(t => !t.name.trim());
      if (empty) {
        S.teams.forEach((t, i) => { if (!t.name.trim()) t.name = 'Tým ' + (i + 1); });
      }
      S.turn = 0;
      S.view = 'board';
      render();
      toast('Na řadě je ' + turnText(0));
      return;
    }
    if (act === 'open') { openQuestion(btn.dataset.qid); return; }
    if (act === 'right') { judge(true); return; }
    if (act === 'wrong') { judge(false); return; }
    if (act === 'cancel') { cancelQuestion(); return; }
    if (act === 'next') { revealDone(); return; }
    if (act === 'undo') { undo(); return; }
    if (act === 'results') { S.view = 'results'; render(); return; }
    if (act === 'back-board') { S.view = 'board'; render(); return; }
    if (act === 'new-game') { if (confirm('Nová hra se stejnými týmy a nulovým skóre?')) newGame(true); return; }
    if (act === 'again') { newGame(true); return; }
    if (act === 'new-setup') { S.view = 'setup'; render(); return; }
  }
});

document.addEventListener('input', e => {
  const name = e.target.closest('[data-team-name]');
  if (name) {
    const t = teamById(name.dataset.teamName);
    if (t) { t.name = name.value; save(); }
    return;
  }
  const players = e.target.closest('[data-team-players]');
  if (players) {
    const t = teamById(players.dataset.teamPlayers);
    if (t) {
      t.players = players.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);
      save();
    }
  }
});

document.addEventListener('keydown', e => {
  if (S.view !== 'question') return;
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 's' || k === 'arrowright') { e.preventDefault(); judge(true); }
  else if (k === 'n' || k === 'arrowleft') { e.preventDefault(); judge(false); }
  else if (e.key === 'Escape') { e.preventDefault(); cancelQuestion(); }
});

window.addEventListener('beforeunload', stopTimer);

/* ---------------- start ---------------- */

(function boot() {
  const saved = load();
  if (saved) {
    S.teams = saved.teams;
    S.used = saved.used || {};
    S.turn = saved.turn || 0;
    S.limit = saved.limit == null ? 30 : saved.limit;
    S.current = saved.current || null;
    S.view = saved.view || 'setup';
    if (S.view === 'question' && !S.current) S.view = 'board';
  }
  render();
})();
