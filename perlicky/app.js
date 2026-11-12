/* PERLIČKY ČEŠTINY — herní logika
   Dvě okna: „control" (řídicí panel učitele, zdroj pravdy) a „display" (projekce pro děti),
   propojená přes BroadcastChannel — bez serveru, bez internetu.
   Týmy se střídají, hráči v týmu rotují. Když tým na tahu neví, další tým v pořadí může
   otázku ukrást za polovinu; kdo krade a netrefí, o polovinu přijde. */

const ROLE = new URLSearchParams(location.search).get('role') === 'display' ? 'display' : 'control';
const IS_DISPLAY = ROLE === 'display';
const SAVE_KEY = 'perlicky-v1';
const CHANNEL = 'perlicky-sync';

const TEAM_COLORS = ['#E04116', '#F3960F', '#88C933', '#2FB3AB', '#449EF3', '#9D4DE7', '#D6336C', '#8D6E4A'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const app = document.getElementById('app');

let S = newState();
let timerHandle = null;
let timeLeft = 0;
let ch = null;
let displaySigCache = '';

/* ---------------- body: 10 → 1 000 … 50 → 5 000 ---------------- */

const points = q => q.value * 100;
const halfPoints = q => q.value * 50;

/* ---------------- stav ---------------- */

function newState() {
  return {
    teams: [
      { id: 't1', name: '', players: [], score: 0, p: 0 },
      { id: 't2', name: '', players: [], score: 0, p: 0 }
    ],
    used: {},            // qid → { owner: teamId|null, stolen: bool, penalty: teamId|null }
    turn: 0,
    limit: 30,           // sekundy na odpověď, 0 = bez časomíry
    sound: 'soft',       // 'off' | 'soft' | 'loud'
    timeLeft: 30,        // jen pro projekci
    view: 'setup',
    current: null,
    history: []
  };
}

function qById(id) { return QUESTIONS.find(q => q.id === id); }
function catById(id) { return CATEGORIES.find(c => c.id === id); }
function teamColor(i) { return TEAM_COLORS[i % TEAM_COLORS.length]; }
function teamById(id) { return S.teams.find(t => t.id === id) || null; }
function teamIndexById(id) { return S.teams.findIndex(t => t.id === id); }
function fmt(n) { return Math.round(n).toLocaleString('cs-CZ'); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
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
  if (IS_DISPLAY) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      teams: S.teams, used: S.used, turn: S.turn, limit: S.limit,
      sound: S.sound, view: S.view, current: S.current
    }));
  } catch (e) { /* soukromý režim — hra jede dál, jen se neobnoví */ }
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

/* ---------------- zvuk (WebAudio, žádné soubory) ---------------- */

const Sfx = (function () {
  let ctx = null;

  function ac() {
    try {
      if (!ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function level() {
    if (S.sound === 'off') return 0;
    return S.sound === 'loud' ? 1 : 0.45;
  }

  function blip(freq, dur, gain, type) {
    const c = ac(); if (!c) return;
    const vol = level() * gain;
    if (vol <= 0) return;
    const t = c.currentTime;
    const g = c.createGain();
    const o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  return {
    unlock() { ac(); },
    tick() { blip(880, 0.035, 0.14, 'sine'); },          // tichý tik každou sekundu
    tickUrgent() { blip(1320, 0.07, 0.36, 'triangle'); }, // posledních 10 s
    tickFinal() { blip(1760, 0.05, 0.42, 'square'); },    // poslední 3 s
    gong() {
      const c = ac(); if (!c) return;
      const vol = level(); if (vol <= 0) return;
      const t = c.currentTime;
      const partials = [[196, 0.60, 2.6], [392, 0.34, 2.2], [588, 0.20, 1.8], [784, 0.12, 1.4]];
      partials.forEach(([f, g0, dur]) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.985, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * g0 * 0.55, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + dur + 0.05);
      });
    }
  };
})();

/* ---------------- časomíra ---------------- */

function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function startTimer() {
  stopTimer();
  timeLeft = S.limit;
  S.timeLeft = timeLeft;
  paintTimer();
  broadcast();
  if (!S.limit) return;
  timerHandle = setInterval(() => {
    timeLeft -= 1;
    S.timeLeft = Math.max(0, timeLeft);
    paintTimer();
    broadcast();
    if (timeLeft > 10) Sfx.tick();
    else if (timeLeft > 3) Sfx.tickUrgent();
    else if (timeLeft > 0) Sfx.tickFinal();
    if (timeLeft <= 0) {
      stopTimer();
      Sfx.gong();
      const hint = document.querySelector('[data-timeout-hint]');
      if (hint) hint.textContent = 'Čas vypršel — vyhodnoťte, prosím.';
    }
  }, 1000);
}

function shownSeconds() {
  if (!IS_DISPLAY) return Math.max(0, timeLeft);
  return S.timeLeft == null ? S.limit : Math.max(0, S.timeLeft);
}

function paintTimer() {
  const box = document.querySelector('.timer');
  if (!box) return;
  if (!S.limit) { box.style.display = 'none'; return; }
  const secs = shownSeconds();
  const num = box.querySelector('.tnum');
  if (num) num.textContent = secs;
  const ring = box.querySelector('.ring-fg');
  if (ring) {
    const C = 2 * Math.PI * 20;
    ring.setAttribute('stroke-dasharray', C.toFixed(1));
    ring.setAttribute('stroke-dashoffset', (C * (1 - secs / S.limit)).toFixed(1));
  }
  if (secs <= 5) box.classList.add('warn'); else box.classList.remove('warn');
}

function timerMarkup() {
  if (!S.limit) return '';
  const secs = IS_DISPLAY ? shownSeconds() : S.limit;
  const C = 2 * Math.PI * 20;
  return `<div class="timer ${secs <= 5 ? 'warn' : ''}">
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <circle class="ring-bg" cx="23" cy="23" r="20" fill="none" stroke-width="5"></circle>
      <circle class="ring-fg" cx="23" cy="23" r="20" fill="none" stroke-width="5"
        stroke-linecap="round" transform="rotate(-90 23 23)"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - secs / S.limit)).toFixed(1)}"></circle>
    </svg>
    <span class="tnum">${secs}</span>
  </div>`;
}

/* ---------------- propojení obou oken ---------------- */

function initChannel() {
  if (!('BroadcastChannel' in window)) return;
  try { ch = new BroadcastChannel(CHANNEL); } catch (e) { ch = null; return; }

  if (IS_DISPLAY) {
    ch.onmessage = ev => {
      const msg = ev.data || {};
      if (msg.type === 'state') applyRemote(msg.state);
    };
    ch.postMessage({ type: 'hello' });
  } else {
    ch.onmessage = ev => {
      const msg = ev.data || {};
      if (msg.type === 'hello') broadcast();
    };
  }
}

function applyRemote(st) {
  if (!st) return;
  S.teams = st.teams || S.teams;
  S.used = st.used || {};
  S.turn = st.turn || 0;
  S.limit = st.limit == null ? 30 : st.limit;
  S.current = st.current || null;
  S.timeLeft = st.timeLeft;
  S.view = st.view || 'board';

  const sig = JSON.stringify([
    S.view,
    S.current && S.current.qid, S.current && S.current.phase, S.current && S.current.respondIdx,
    S.current && S.current.offerIdx, S.current && S.current.result,
    S.teams.map(t => [t.name, t.score, t.players.join('|'), t.p]),
    S.used, S.limit
  ]);
  if (sig !== displaySigCache) {
    displaySigCache = sig;
    renderDisplay();
  } else {
    paintTimer();
  }
}

function broadcast() {
  if (!ch || IS_DISPLAY) return;
  ch.postMessage({
    type: 'state',
    state: {
      teams: S.teams, used: S.used, turn: S.turn, limit: S.limit,
      view: S.view, current: S.current, timeLeft: shownSeconds()
    }
  });
}

/* ---------------- akce ---------------- */

function openQuestion(qid) {
  if (S.used[qid]) return;
  snapshot('otevření otázky');
  S.current = { qid, phase: 'ask', respondIdx: S.turn, askerIdx: S.turn, offerIdx: null, stealUsed: false, result: null };
  S.view = 'question';
  render();
  startTimer();
}

function advancePlayer(team) {
  if (team && team.players.length > 1) team.p = (team.p + 1) % team.players.length;
}

function judge(ok) {
  const cur = S.current;
  if (!cur || cur.phase === 'done' || cur.phase === 'offer') return;
  snapshot(ok ? 'správná odpověď' : 'chybná odpověď');

  const q = qById(cur.qid);
  const responder = S.teams[cur.respondIdx];
  const wasSteal = cur.phase === 'steal';
  advancePlayer(responder);

  if (ok) {
    const pts = wasSteal ? halfPoints(q) : points(q);
    responder.score += pts;
    cur.result = { teamId: responder.id, pts, stolen: wasSteal };
    cur.phase = 'done';
    S.used[q.id] = { owner: responder.id, stolen: wasSteal, penalty: null };
    S.view = 'reveal';
    stopTimer();
    save(); render();
    return;
  }

  if (wasSteal) {
    // krádež nevyšla — tým o polovinu přichází
    const pts = halfPoints(q);
    responder.score -= pts;
    cur.result = { teamId: null, pts: -pts, loserId: responder.id, stolen: true };
    cur.phase = 'done';
    S.used[q.id] = { owner: null, stolen: true, penalty: responder.id };
    S.view = 'reveal';
    stopTimer();
    save(); render();
    return;
  }

  // tým na tahu neví → nabídka krádeže dalšímu týmu v pořadí (jen jednou za otázku)
  if (S.teams.length > 1 && !cur.stealUsed) {
    cur.phase = 'offer';
    cur.offerIdx = (cur.askerIdx + 1) % S.teams.length;
    stopTimer();
    save(); render();
    return;
  }

  cur.result = { teamId: null, pts: 0 };
  cur.phase = 'done';
  S.used[q.id] = { owner: null, stolen: false, penalty: null };
  S.view = 'reveal';
  stopTimer();
  save(); render();
}

function offerAccept() {
  const cur = S.current;
  if (!cur || cur.phase !== 'offer') return;
  snapshot('krádež přijata');
  cur.phase = 'steal';
  cur.respondIdx = cur.offerIdx;
  cur.offerIdx = null;
  cur.stealUsed = true;
  save(); render();
  startTimer();
}

function offerDecline() {
  const cur = S.current;
  if (!cur || cur.phase !== 'offer') return;
  snapshot('krádež odmítnuta');
  const q = qById(cur.qid);
  cur.phase = 'done';
  cur.result = { teamId: null, pts: 0, declined: true };
  S.used[q.id] = { owner: null, stolen: false, penalty: null, declined: true };
  S.view = 'reveal';
  stopTimer();
  save(); render();
}

function revealDone() {
  S.turn = (S.turn + 1) % S.teams.length;
  S.current = null;
  S.view = remaining() === 0 ? 'results' : 'board';
  stopTimer();
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
  const teams = sameTeams ? S.teams.map(t => ({ ...t, score: 0, p: 0 })) : newState().teams;
  const limit = S.limit, sound = S.sound;
  S = newState();
  S.teams = teams;
  S.limit = limit;
  S.sound = sound;
  S.view = sameTeams ? 'board' : 'setup';
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  render();
}

/* ---------------- vykreslení ---------------- */

function render() {
  stopTimer();
  if (IS_DISPLAY) { renderDisplay(); return; }
  const v = S.view;
  if (v === 'setup') app.innerHTML = viewSetup();
  else if (v === 'board') app.innerHTML = viewBoard();
  else if (v === 'question') app.innerHTML = viewQuestion();
  else if (v === 'reveal') app.innerHTML = viewReveal();
  else if (v === 'results') app.innerHTML = viewResults();
  window.scrollTo(0, 0);
  save(); broadcast();
}

function renderDisplay() {
  const v = S.view;
  if (v === 'board') app.innerHTML = viewBoard(true);
  else if (v === 'question') app.innerHTML = viewQuestion(true);
  else if (v === 'reveal') app.innerHTML = viewReveal(true);
  else if (v === 'results') app.innerHTML = viewResults(true);
  else app.innerHTML = viewWaiting();
  window.scrollTo(0, 0);
}

function viewWaiting() {
  return `
  <div class="wrap waiting">
    <div class="hero">
      <h1>Perličky češtiny</h1>
      <p>Projekce je připravená. Hru ovládá řídicí okno — tady se jen zobrazuje.</p>
    </div>
    <div class="card">
      <h2>Co udělat</h2>
      <p class="hint">Okno přetáhněte na druhou obrazovku, klikněte na celou obrazovku a pak už na nic nesahejte. Hra běží v řídicím okně.</p>
      <button class="primary" data-act="fullscreen">⛶ Celá obrazovka</button>
    </div>
  </div>`;
}

/* --- nastavení --- */

function viewSetup() {
  const rows = S.teams.map((t, i) => `
    <div class="team-row">
      <span class="swatch" style="background:${teamColor(i)}"></span>
      <input type="text" data-team-name="${t.id}" value="${esc(t.name)}" placeholder="Název týmu ${i + 1}" maxlength="24">
      <input type="text" class="players" data-team-players="${t.id}" value="${esc(t.players.join(', '))}"
             placeholder="Hráči (nepovinné, čárkou)" maxlength="140">
      <button class="ghost" data-act="del-team" data-id="${t.id}" title="Odebrat tým" ${S.teams.length <= 2 ? 'disabled' : ''}>✕</button>
    </div>`).join('');

  const soundBtn = { off: '🔇 Zvuk vypnutý', soft: '🔉 Zvuk tiše', loud: '🔊 Zvuk nahlas' }[S.sound] || '🔉 Zvuk tiše';

  return `
  <div class="wrap setup">
    <div class="hero">
      <h1>Perličky češtiny</h1>
      <p>Interaktivní hra o českém jazyce — 5 kategorií, 25 otázek. Týmy se střídají, kdo neví, může o body přijít ve prospěch soupeře.</p>
    </div>

    <div class="card">
      <h2>Týmy</h2>
      <p class="hint">2 až 8 týmů. Když vypíšete hráče, budou se v týmu postupně střídat.</p>
      ${rows}
      <div class="row-actions">
        <button data-act="add-team" ${S.teams.length >= 8 ? 'disabled' : ''}>+ Přidat tým</button>
        <span style="margin-left:auto;color:var(--ink-2);font-size:13px">${S.teams.length} z 8</span>
      </div>
    </div>

    <div class="card">
      <h2>Čas na odpověď</h2>
      <p class="hint">Odpočet tiká u otázky, posledních 10 s hlasitěji, na nule gong. Po vypršení se nic samo nevyhodnotí.</p>
      <div class="seg" data-act="limit">
        ${[20, 30, 45, 60, 0].map(n => `<button data-limit="${n}" class="${S.limit === n ? 'on' : ''}">${n ? n + ' s' : 'bez časomíry'}</button>`).join('')}
      </div>
      <div class="row-actions">
        <button data-act="sound">${soundBtn}</button>
      </div>
    </div>

    <div class="row-actions" style="justify-content:center;margin-top:22px">
      <button class="primary big" data-act="start">Začít hru →</button>
    </div>
    <p class="save-note">Hra se ukládá do prohlížeče — po obnovení stránky pokračujete tam, kde jste skončili.</p>
  </div>`;
}

/* --- hrací plán --- */

function viewBoard(disp) {
  const heads = CATEGORIES.map(c => `<div class="cat-head" style="--c:${c.color}">${esc(c.name)}</div>`).join('');

  let tiles = '';
  for (const val of [10, 20, 30, 40, 50]) {
    for (const c of CATEGORIES) {
      const q = QUESTIONS.find(x => x.cat === c.id && x.value === val);
      if (!q) { tiles += '<div></div>'; continue; }
      const u = S.used[q.id];
      if (u) {
        const owner = u.owner ? teamById(u.owner) : null;
        const pen = u.penalty ? teamById(u.penalty) : null;
        const oi = owner ? teamIndexById(owner.id) : -1;
        const pi = pen ? teamIndexById(pen.id) : -1;
        const label = owner
          ? `<span class="owner" style="--c:${teamColor(oi)}"><i></i>${esc(owner.name)}</span>`
          : pen
            ? `<span class="owner pen" style="--c:${teamColor(pi)}"><i></i>−${esc(pen.name)}</span>`
            : `<span class="owner">—</span>`;
        tiles += `<button class="tile done ${u.stolen ? 'stolen' : ''}" disabled>
          <span class="val">${fmt(points(q))}</span>${label}
        </button>`;
      } else {
        tiles += `<button class="tile" ${disp ? 'disabled' : `data-act="open" data-qid="${q.id}"`}>${fmt(points(q))}</button>`;
      }
    }
  }

  const chips = S.teams.map((t, i) => `
    <div class="team-chip ${i === S.turn ? 'active' : ''}" style="--c:${teamColor(i)}">
      <div>
        <div class="name">${esc(t.name)}</div>
        ${t.players.length ? `<div class="who">${esc(currentPlayer(t))}</div>` : ''}
      </div>
      <div class="score ${t.score < 0 ? 'neg' : ''}">${fmt(t.score)}</div>
    </div>`).join('');

  const bar = disp ? '' : `
      <button class="ghost" data-act="display-open" title="Otevřít druhé okno na projektor">🖥️ Projekce</button>
      <button class="ghost" data-act="sound" title="Zapnout/vypnout zvuk">${S.sound === 'off' ? '🔇' : S.sound === 'loud' ? '🔊' : '🔉'}</button>
      <button class="ghost" data-act="undo" title="Vrátit poslední krok">↶ Zpět</button>
      <button class="ghost" data-act="results">Výsledky</button>
      <button class="ghost" data-act="new-game">Nová hra</button>`;

  return `
  <div class="wrap">
    <div class="topbar">
      <div class="brand"><span class="dot"></span>Perličky češtiny</div>
      <div class="spacer"></div>
      ${bar}
    </div>

    <div class="scoreboard ${S.teams.length > 5 ? 'many' : ''}">${chips}</div>
    <div class="turn-banner">
      <span class="k">Na řadě</span><b>${esc(turnText(S.turn))}</b>
      <span class="k" style="margin-left:auto">Zbývá ${remaining()} z ${QUESTIONS.length}</span>
    </div>

    <div class="board">${heads}${tiles}</div>

    <div class="board-foot">
      <span>${disp ? 'Otázku čte a vyhodnocuje učitel.' : 'Klikněte na hodnotu a položte otázku nahlas.'}</span>
      <span style="margin-left:auto">Body jsou v tisících · krádež za polovinu</span>
    </div>
  </div>`;
}

/* --- otázka --- */

function viewQuestion(disp) {
  const cur = S.current;
  const q = qById(cur.qid);
  const c = catById(q.cat);
  const stealing = cur.phase === 'steal';
  const offering = cur.phase === 'offer';

  const opts = q.options ? `<ul class="options">${q.options.map((o, i) => {
    const isRight = !disp && q.correct === i;
    return `<li class="${isRight ? 'right' : ''}"><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></li>`;
  }).join('')}</ul>`
    : `<div class="open-note">✍️ Odpověď se říká nahlas — správnou variantu uvidíte po vyhodnocení.</div>`;

  const img = q.img ? `<figure class="qimg"><img src="${q.img}" alt="obrázek k otázce"></figure>` : '';

  let box;
  if (offering) {
    const ci = cur.offerIdx;
    box = `<div class="turnbox steal" style="--c:${teamColor(ci)}">
      <div>
        <div class="lbl">Krádež za ${fmt(halfPoints(q))} — rozhoduje se</div>
        <div class="who">${esc(turnText(ci))}</div>
      </div>
      ${disp ? '' : `<div class="actions">
        <button class="good" data-act="steal-yes">Krade →</button>
        <button class="bad" data-act="steal-no">Nekrade ✕</button>
      </div>`}
    </div>`;
  } else {
    box = `<div class="turnbox ${stealing ? 'steal' : ''}" style="--c:${teamColor(cur.respondIdx)}">
      <div>
        <div class="lbl">${stealing ? `Krádež za ${fmt(halfPoints(q))} — odpovídá` : 'Odpovídá'}</div>
        <div class="who">${esc(turnText(cur.respondIdx))}</div>
      </div>
      ${disp ? '' : `<div class="actions">
        <button class="good" data-act="right">✔ Věděl</button>
        <button class="bad" data-act="wrong">✘ Nevěděl</button>
      </div>`}
    </div>`;
  }

  const teacher = disp ? '' : `
    <div class="teacher">
      <div class="t-label">Pro tebe · správná odpověď</div>
      <div class="t-answer">${esc(q.answer || (q.options ? q.options[q.correct] : '') || '')}</div>
      ${q.explain ? `<div class="t-explain">${esc(q.explain)}</div>` : ''}
    </div>`;

  const topbarRight = disp
    ? '<button class="ghost" data-act="fullscreen" title="Celá obrazovka">⛶</button>'
    : `<button class="ghost" data-act="sound" title="Zapnout/vypnout zvuk">${S.sound === 'off' ? '🔇' : S.sound === 'loud' ? '🔊' : '🔉'}</button>
       <button class="ghost" data-act="cancel">✕ Zavřít otázku</button>`;

  return `
  <div class="wrap qview">
    <div class="topbar">
      <div class="brand"><span class="dot"></span>Perličky češtiny</div>
      <div class="spacer"></div>
      ${topbarRight}
    </div>

    <div class="qhead">
      <span class="qcat" style="--c:${c.color}">${esc(c.name)}</span>
      <span class="qval">${fmt(points(q))}</span>
      ${timerMarkup()}
    </div>

    ${box}

    ${teacher}

    <div class="qbody">
      <p class="qtext">${esc(q.q)}</p>
      ${img}
      ${opts}
    </div>

    ${disp ? '' : `<div class="foot-actions">
      <span class="kbd">S</span> správně &nbsp;·&nbsp; <span class="kbd">N</span> nevěděl &nbsp;·&nbsp;
      <span class="kbd">K</span> krádež &nbsp;·&nbsp; <span class="kbd">Esc</span> zavřít
      <span data-timeout-hint style="margin-left:auto;color:var(--ink-2);font-size:13px"></span>
    </div>`}
  </div>`;
}

/* --- odhalení --- */

function viewReveal(disp) {
  const cur = S.current;
  const q = qById(cur.qid);
  const c = catById(q.cat);
  const res = cur.result || { teamId: null, pts: 0 };

  let award;
  if (res.teamId) {
    const w = teamById(res.teamId);
    award = `<div class="award win">🏅 +${fmt(res.pts)} pro tým <b>${esc(w.name)}</b>${res.stolen ? ' (ukradeno)' : ''}</div>`;
  } else if (res.loserId) {
    const l = teamById(res.loserId);
    award = `<div class="award lose">💸 ${fmt(res.pts)} pro tým <b>${esc(l.name)}</b> — krádež nevyšla</div>`;
  } else if (res.declined) {
    award = `<div class="award none">🚫 Krádež odmítnuta — bez bodu</div>`;
  } else {
    award = `<div class="award none">😬 Bez bodu — otázku nikdo nezvládl</div>`;
  }

  const opts = q.options ? `<ul class="options compact">${q.options.map((o, i) => `
      <li class="${i === q.correct ? 'right' : ''}"><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></li>`).join('')}</ul>`
    : `<div class="open-note" style="margin-top:16px">Správná odpověď je nahoře — posuďte, kdo ji řekl.</div>`;

  const imgs = q.imgs || [];
  const gallery = imgs.length
    ? `<div class="gallery ${imgs.length === 1 ? 'single' : ''}">${imgs.map(src => `<img src="${src}" alt="ilustrace k odpovědi" loading="lazy">`).join('')}</div>`
    : '';

  return `
  <div class="wrap qview">
    <div class="topbar">
      <div class="brand"><span class="dot"></span>Perličky češtiny</div>
      <div class="spacer"></div>
      <span class="qcat" style="--c:${c.color}">${esc(c.name)}</span>
      <span class="qval">${fmt(points(q))}</span>
    </div>

    <div class="qbody">
      ${award}
      <p class="qtext" style="font-size:clamp(15px,1.5vw,20px);font-weight:600;color:var(--ink-2);margin-bottom:14px">${esc(q.q.split('\n')[0])}</p>
      <div class="answer-line"><span class="tick">✔</span><span>${esc(q.answer || (q.options && q.options[q.correct]) || '')}</span></div>
      ${q.explain ? `<p class="explain">${esc(q.explain)}</p>` : ''}
      ${opts}
      ${gallery}
    </div>

    ${disp ? '' : `<div class="foot-actions">
      <button class="primary big" data-act="next">Pokračovat na plán →</button>
      <button class="ghost" data-act="undo">↶ Vrátit vyhodnocení</button>
    </div>`}
  </div>`;
}

/* --- výsledky --- */

function viewResults(disp) {
  const sorted = S.teams.map((t, i) => ({ t, i })).sort((a, b) => b.t.score - a.t.score);
  const medals = ['🥇', '🥈', '🥉'];

  const rows = sorted.map((r, rank) => `
    <div class="rank-row ${rank === 0 ? 'first' : ''}" style="--c:${teamColor(r.i)}">
      <span class="place">${medals[rank] || (rank + 1) + '.'}</span>
      <div>
        <div class="nm">${esc(r.t.name)}</div>
        ${r.t.players.length ? `<div class="sub">${esc(r.t.players.join(', '))}</div>` : ''}
      </div>
      <span class="pts ${r.t.score < 0 ? 'neg' : ''}">${fmt(r.t.score)}</span>
    </div>`).join('');

  return `
  <div class="wrap results">
    <div class="hero" style="text-align:center">
      <h1>Konec hry</h1>
      <p style="max-width:none">Odehráno ${QUESTIONS.length - remaining()} z ${QUESTIONS.length} otázek.</p>
    </div>
    <div class="card">
      <h2>Pořadí</h2>
      <div class="rank">${rows}</div>
      ${disp ? '' : `<div class="row-actions" style="margin-top:20px">
        <button class="primary" data-act="again">Hrát znovu se stejnými týmy</button>
        <button data-act="new-setup">Nové týmy</button>
        ${remaining() > 0 ? '<button class="ghost" data-act="back-board">Zpět na plán</button>' : ''}
      </div>`}
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
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === 'fullscreen') {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen();
    return;
  }

  if (IS_DISPLAY) return;   // projekce nic neovládá

  if (act === 'limit') {
    const b = e.target.closest('[data-limit]');
    if (b) { S.limit = Number(b.dataset.limit); render(); }
    return;
  }
  if (act === 'sound') {
    S.sound = S.sound === 'off' ? 'soft' : S.sound === 'soft' ? 'loud' : 'off';
    Sfx.unlock();
    if (S.sound !== 'off') Sfx.tick();
    render();
    toast(S.sound === 'off' ? 'Zvuk vypnutý' : S.sound === 'soft' ? 'Zvuk tiše' : 'Zvuk nahlas');
    return;
  }
  if (act === 'add-team') {
    if (S.teams.length >= 8) return;
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
    Sfx.unlock();
    S.teams.forEach((t, i) => { if (!t.name.trim()) t.name = 'Tým ' + (i + 1); });
    S.turn = 0;
    S.view = 'board';
    render();
    toast('Na řadě je ' + turnText(0));
    return;
  }
  if (act === 'display-open') {
    const url = location.pathname + '?role=display';
    const w = window.open(url, 'perlicky-projekce', 'width=1280,height=760');
    if (!w) toast('Prohlížeč zablokoval nové okno — povolte vyskakovací okna.');
    else setTimeout(broadcast, 400);
    return;
  }
  if (act === 'open') { Sfx.unlock(); openQuestion(btn.dataset.qid); return; }
  if (act === 'right') { judge(true); return; }
  if (act === 'wrong') { judge(false); return; }
  if (act === 'steal-yes') { offerAccept(); return; }
  if (act === 'steal-no') { offerDecline(); return; }
  if (act === 'cancel') { cancelQuestion(); return; }
  if (act === 'next') { revealDone(); return; }
  if (act === 'undo') { undo(); return; }
  if (act === 'results') { S.view = 'results'; render(); return; }
  if (act === 'back-board') { S.view = 'board'; render(); return; }
  if (act === 'new-game') { if (confirm('Nová hra se stejnými týmy a nulovým skóre?')) newGame(true); return; }
  if (act === 'again') { newGame(true); return; }
  if (act === 'new-setup') { S.view = 'setup'; render(); return; }
});

document.addEventListener('input', e => {
  if (IS_DISPLAY) return;
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
  if (IS_DISPLAY || S.view !== 'question' || !S.current) return;
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  const phase = S.current.phase;
  if (k === 's' || k === 'arrowright') { e.preventDefault(); if (phase !== 'offer') judge(true); }
  else if (k === 'n' || k === 'arrowleft') { e.preventDefault(); if (phase !== 'offer') judge(false); }
  else if (k === 'k') { e.preventDefault(); if (phase === 'offer') offerAccept(); }
  else if (e.key === 'Escape') { e.preventDefault(); cancelQuestion(); }
});

window.addEventListener('beforeunload', stopTimer);

/* ---------------- start ---------------- */

(function boot() {
  if (IS_DISPLAY) {
    document.body.classList.add('display-mode');
    S = newState();
    S.view = 'waiting';
    initChannel();
    renderDisplay();
    // když řídicí okno mlčí (ještě není otevřené), přihlas se znovu
    setInterval(() => {
      if (document.querySelector('.waiting') && ch) { try { ch.postMessage({ type: 'hello' }); } catch (e) {} }
    }, 2500);
    return;
  }

  const saved = load();
  if (saved) {
    S.teams = saved.teams;
    S.used = saved.used || {};
    S.turn = saved.turn || 0;
    S.limit = saved.limit == null ? 30 : saved.limit;
    S.sound = saved.sound || 'soft';
    S.current = saved.current || null;
    S.view = saved.view || 'setup';
    if (S.view === 'question' && !S.current) S.view = 'board';
  }
  initChannel();
  render();
  // první klik odemkne zvuk (pravidlo prohlížeče)
  document.addEventListener('click', () => Sfx.unlock(), { once: true });
})();
