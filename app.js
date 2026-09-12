/* Strength Wave: a five-day strength log. Vanilla JS, everything in localStorage. */
'use strict';

const APP_VERSION = '2026-09-11.1';
const STORE_KEY = 'wave.v1';
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RPE_OPTS = ['', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];
const DAY_MS = 86400000;

/* ---------- helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const pad2 = (n) => String(n).padStart(2, '0');
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const roundTo = (x, step) => Math.round(x / step) * step;
const loadStep = (unit) => (unit === 'kg' ? 2.5 : 5);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wk = (arr, week) => (arr && arr.length ? arr[Math.min(week, arr.length) - 1] : null);

function dateKey(d = new Date()) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDay(k) { const d = parseKey(k); return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; }
function fmtShort(ms) { const d = new Date(ms); return `${d.getDate()} ${MON[d.getMonth()]}`; }
function fmtTime(ts) { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtSec(s) { return `${Math.floor(s / 60)}:${pad2(s % 60)}`; }
function localDT(ts = Date.now()) { const d = new Date(ts); return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtW(w, unit) { if (w == null) return '–'; const n = w % 1 ? w.toFixed(1) : String(w); return unit === 'kg' ? `${n} kg` : unit === 'lb' ? `${n} lb` : n; }

/* ---------- RPE math (RTS chart: % of 1RM by reps-to-failure) ---------- */
const RTS = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.7, 69.6, 67.6, 65.7];
function pctFor(reps, rpe) {
  const t = clamp(reps + (10 - rpe), 1, RTS.length);
  const lo = Math.floor(t), f = t - lo;
  const a = RTS[lo - 1], b = RTS[Math.min(lo, RTS.length - 1)];
  return (a + (b - a) * f) / 100;
}
function e1rm(w, reps, rpe) { return w / pctFor(reps || 1, rpe ?? 8); }

/* ---------- default program ---------- */
const SWAPS = {
  ex_squat: ['Safety-bar squat', 'High-bar paused squat'],
  ex_dl: ['Trap-bar deadlift'],
  ex_bench: ['Floor press', 'Neutral-grip dumbbell press'],
  ex_ohp: ['Landmine press', 'Double-kettlebell press'],
  ex_pclean: ['Clean pull', 'Hang power clean'],
  ex_psnatch: ['Kettlebell snatch'],
  ex_pullup: ['Neutral-grip lat pulldown'],
  ex_bss: ['Reverse lunge', 'Step-up']
};

function defaultProgram() {
  const main = (id, name, group, o = {}) => ({
    id, name, kind: 'main', unit: 'lb', note: o.note || '',
    main: Object.assign({ group, topReps: [5, 4, 3], topRpe: [8, 8, 8.5], backSets: 2, backPct: 0.9, deloadSets: 3, deloadReps: 3, deloadPct: 0.7, incr: group === 'lower' ? 10 : 5 }, o.main || {})
  });
  const power = (id, name, sets, reps, pct, o = {}) => ({ id, name, kind: 'power', unit: 'lb', note: o.note || '', power: { sets, reps, pct, deloadSets: Math.max(2, sets - 1) } });
  const acc = (id, name, sets, repsLo, repsHi, load, o = {}) => ({ id, name, kind: 'acc', unit: o.unit || 'lb', note: o.note || '', acc: { sets, repsLo, repsHi: repsHi ?? repsLo, repUnit: o.repUnit || 'reps', load: load || '' } });
  return {
    days: [
      {
        id: 'd1', name: 'Squat and clean', weekday: 1, tag: 'Heavy lower',
        warmup: '5 min bike, hip and ankle circles, empty-bar squats ×10, two light ramp sets of the clean, then ramp the squat in 4–5 sets.',
        exercises: [
          acc('ex_boxjump', 'Box jump', 3, 3, 3, 'moderate box, step down', { unit: 'none', note: 'Quiet landing, hips high on the box, step down every rep.' }),
          power('ex_pclean', 'Power clean', 5, 2, ['70–75%', '72–77%', '75–80%', '60–65%'], { note: 'Crisp rack, no press-out. Slow on the day: 3×2 and move on.' }),
          main('ex_squat', 'Back squat', 'lower', { note: 'Back-offs are 90% of the top-set weight, same reps.' }),
          acc('ex_rdl', 'Romanian deadlift', 3, 6, 8, 'RPE 7–8', { note: 'Two-second lowering, bar on the thighs.' }),
          acc('ex_bss', 'Bulgarian split squat', 2, 8, 8, 'per side, dumbbells, RPE 8'),
          acc('ex_hlr', 'Hanging leg raise', 3, 10, 10, 'slow', { unit: 'none' })
        ]
      },
      {
        id: 'd2', name: 'Bench and row', weekday: 2, tag: 'Heavy upper',
        warmup: 'Band pull-aparts ×20, empty bar ×15, then ramp the bench in 4 sets.',
        exercises: [
          main('ex_bench', 'Bench press', 'upper', { main: { backSets: 3 }, note: 'Paused or touch-and-go; pick one for the whole wave.' }),
          acc('ex_row', 'Barbell row', 4, 6, 8, 'RPE 8', { note: 'Strict. Low back tired from Monday: chest-supported row.' }),
          acc('ex_incdb', 'Incline dumbbell press', 3, 8, 10, 'RPE 8, per dumbbell'),
          acc('ex_facepull', 'Face pull', 3, 15, 15, 'light'),
          acc('ex_tri', 'Dips or cable pushdown', 3, 10, 12, 'RPE 8')
        ]
      },
      {
        id: 'd3', name: 'Deadlift and front squat', weekday: 4, tag: 'Heavy lower',
        warmup: '5 min row, two-hand swings 2×10 with a light bell, then ramp the deadlift in 5 sets.',
        exercises: [
          main('ex_dl', 'Deadlift', 'lower', { main: { topReps: [3, 3, 2], topRpe: [8, 8.5, 8.5], backSets: 1, deloadPct: 0.65 }, note: 'Dead-stop reps, full reset each rep. One heavy pull a week.' }),
          acc('ex_fsq', 'Front squat', 3, 5, 5, "60–70% of Monday's top set", { note: 'Positions and bracing, not effort.' }),
          acc('ex_legcurl', 'Leg curl', 3, 10, 10, 'RPE 8'),
          acc('ex_farmer', "Farmer's carry", 4, 40, 40, 'heavy handles or bells', { repUnit: 'm' })
        ]
      },
      {
        id: 'd4', name: 'Press and pull', weekday: 5, tag: 'Heavy upper',
        warmup: 'Turkish get-up 2 per side with a 16 kg bell, slow. Band pull-aparts ×20, then ramp the press in 4 sets.',
        exercises: [
          main('ex_ohp', 'Overhead press, strict', 'upper', { main: { backSets: 3 } }),
          acc('ex_pullup', 'Weighted pull-up or chin-up', 4, 5, 8, 'RPE 8, log added load', { note: 'Add load when 4×8 is clean.' }),
          acc('ex_cgb', 'Close-grip bench press', 3, 5, 5, "70–75% of Tuesday's top set"),
          acc('ex_latraise', 'Dumbbell lateral raise', 3, 12, 15, 'light'),
          acc('ex_curl', 'Barbell or dumbbell curl', 3, 10, 12, 'RPE 8')
        ]
      },
      {
        id: 'd5', name: 'Power and kettlebells', weekday: 6, tag: 'Light and fast',
        warmup: '5 min bike, get-up 1 per side light, hang-position work with the empty bar. Nothing today is heavy.',
        exercises: [
          power('ex_psnatch', 'Power snatch', 6, 2, ['60–70%', '65–72%', '68–75%', '55–60%'], { note: 'The bar should float. Not confident: kettlebell snatch 5×5 per side.' }),
          acc('ex_swing', 'Two-hand kettlebell swing', 8, 10, 10, 'on the minute, 28–32 kg', { unit: 'kg', note: 'End the set the moment the float goes.' }),
          acc('ex_dkbcp', 'Double kettlebell clean and push press', 4, 5, 5, 'pair of 20–24 kg', { unit: 'kg' }),
          acc('ex_tgu', 'Turkish get-up', 3, 1, 1, 'per side, 24 kg working', { unit: 'kg', note: 'Heavier only when 24 kg is boringly clean both sides.' }),
          acc('ex_sarow', 'Single-arm kettlebell row', 3, 10, 10, 'per side', { unit: 'kg' }),
          acc('ex_suitcase', 'Suitcase carry', 3, 40, 40, 'per side, one heavy bell', { unit: 'kg', repUnit: 'm' }),
          acc('ex_z2', 'Optional: zone 2 bike', 1, 15, 20, 'easy', { unit: 'none', repUnit: 'min' })
        ]
      }
    ]
  };
}

function defaults() {
  return {
    version: 1,
    settings: { restTop: 210, restBack: 150, restPower: 120, restAcc: 90 },
    program: defaultProgram(),
    wave: { number: 1, week: 1, startDate: dateKey() },
    planned: {},
    sessions: {},
    checkins: {},
    compounds: [
      { id: 'c_reta', name: 'Retatrutide', unit: 'mg', defaultDose: null, days: [1, 4], time: '20:00' },
      { id: 'c_motsc', name: 'MOTS-c', unit: 'mg', defaultDose: null, days: [], time: '08:00' }
    ],
    doses: [],
    timer: null,
    ui: { tab: 'today', openEx: null, sessionKey: null, viewSession: null, editEx: null, chartEx: null, doseFor: null, proposals: null }
  };
}

/* ---------- store ---------- */
let S = load();
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { console.warn('load failed', e); }
  return defaults();
}
function migrate(o) {
  const d = defaults();
  for (const k of Object.keys(d)) if (o[k] === undefined) o[k] = d[k];
  o.ui = Object.assign(d.ui, o.ui || {});
  o.ui.proposals = null;
  o.settings = Object.assign(d.settings, o.settings || {});
  return o;
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { toast('Could not save. Storage full or blocked.'); }
}
function setPath(path, value) {
  const parts = path.split('.');
  let o = S;
  for (let i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
  o[parts[parts.length - 1]] = value;
}
function coerce(el) {
  const t = el.dataset.type;
  if (el.type === 'checkbox') return el.checked;
  if (t === 'num') return num(el.value);
  if (t === 'int') return int(el.value);
  if (t === 'pct') { const n = num(el.value); return n == null ? null : n / 100; }
  if (t === 'list') return el.value.split(',').map((s) => s.trim()).filter(Boolean);
  if (t === 'numlist') return el.value.split(',').map((s) => parseFloat(s)).filter(Number.isFinite);
  return el.value;
}

/* ---------- program logic ---------- */
function dayById(id) { return S.program.days.find((d) => d.id === id) || null; }
function findEx(exId) { for (const d of S.program.days) for (const e of d.exercises) if (e.id === exId) return { day: d, ex: e }; return null; }
function allExercises() { return S.program.days.flatMap((d) => d.exercises); }

function rx(ex, week) {
  if (ex.kind === 'main' && ex.main) {
    const m = ex.main;
    if (week === 4) return `${m.deloadSets}×${m.deloadReps} @ ${Math.round(m.deloadPct * 100)}% of last week's top`;
    const r = wk(m.topReps, week), p = wk(m.topRpe, week);
    return `Top 1×${r} @ RPE ${p}` + (m.backSets ? ` · then ${m.backSets}×${r} @ ${Math.round(m.backPct * 100)}%` : '');
  }
  if (ex.kind === 'power' && ex.power) {
    const p = ex.power;
    const sets = week === 4 ? p.deloadSets : p.sets;
    return `${sets}×${p.reps} @ ${wk(p.pct, week) || ''}`.trim();
  }
  const a = ex.acc || { sets: 3, repsLo: 8, repsHi: 10, repUnit: 'reps', load: '' };
  const sets = week === 4 ? Math.max(1, Math.ceil(a.sets / 2)) : a.sets;
  const reps = a.repsHi && a.repsHi !== a.repsLo ? `${a.repsLo}–${a.repsHi}` : `${a.repsLo}`;
  const unit = a.repUnit && a.repUnit !== 'reps' ? ` ${a.repUnit}` : '';
  return `${sets}×${reps}${unit}${a.load ? ' · ' + a.load : ''}${week === 4 ? ' (deload)' : ''}`;
}
function plannedSets(ex, week) {
  if (ex.kind === 'main' && ex.main) return week === 4 ? ex.main.deloadSets : 1 + (ex.main.backSets || 0);
  if (ex.kind === 'power' && ex.power) return week === 4 ? ex.power.deloadSets : ex.power.sets;
  const a = ex.acc || { sets: 3 };
  return week === 4 ? Math.max(1, Math.ceil(a.sets / 2)) : a.sets;
}
function restFor(ex, nLogged) {
  if (ex.restSec) return ex.restSec;
  const s = S.settings;
  if (ex.kind === 'main') return nLogged === 1 ? s.restTop : s.restBack;
  if (ex.kind === 'power') return s.restPower;
  return s.restAcc;
}
function weekLine(k) {
  return {
    1: 'Top sets of 5 at RPE 8, back-offs at 90% of the top set, full accessory volume.',
    2: 'Top sets of 4 at RPE 8, the weight up about 3%. Same back-off rule.',
    3: 'Top sets of 3 at RPE 8.5, the heaviest week. A top set that reaches RPE 9 ends there: drop one back-off.',
    4: "Deload. Main lifts 3×3 at 70% of last week's top (deadlift 65%), accessories at half the sets, power work light and fast."
  }[k] || '';
}

/* ---------- sessions ---------- */
function allSessionsSorted() { return Object.values(S.sessions).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); }
function currentSessionKey() {
  const d = dateKey();
  if (S.ui.sessionKey && S.ui.sessionKey.startsWith(d + '_')) return S.ui.sessionKey;
  const existing = Object.keys(S.sessions).find((k) => k.startsWith(d + '_'));
  if (existing) return existing;
  const day = S.program.days.find((x) => x.weekday === new Date().getDay());
  return day ? `${d}_${day.id}` : null;
}
function keyDayId(key) { return key.slice(key.indexOf('_') + 1); }
function ensureSession(key) {
  if (!S.sessions[key]) {
    S.sessions[key] = { key, date: key.slice(0, key.indexOf('_')), dayId: keyDayId(key), wave: S.wave.number, week: S.wave.week, sets: {}, note: '', started: Date.now(), finished: null };
  }
  return S.sessions[key];
}
function topSetsFor(exId) {
  const out = [];
  for (const s of allSessionsSorted()) {
    const sets = (s.sets && s.sets[exId]) || [];
    if (!sets.length) continue;
    let top = null;
    for (const st of sets) if (st.w != null && (top == null || st.w > top.w)) top = st;
    if (!top) continue;
    out.push({ date: s.date, wave: s.wave, week: s.week, w: top.w, r: top.r, rpe: top.rpe });
  }
  return out; // newest first
}
function lastSetsFor(exId, excludeKey) {
  for (const s of allSessionsSorted()) {
    if (s.key === excludeKey) continue;
    const sets = s.sets && s.sets[exId];
    if (sets && sets.length) return { date: s.date, sets };
  }
  return null;
}
function suggestTop(ex) {
  const m = ex.main; if (!m) return null;
  const step = loadStep(ex.unit), week = S.wave.week;
  if (week === 1 && S.planned && S.planned[ex.id] != null) return { w: S.planned[ex.id], why: 'planned for this wave' };
  const tops = topSetsFor(ex.id);
  if (!tops.length) return null;
  const last = tops[0];
  if (week === 4) return { w: roundTo(last.w * m.deloadPct, step), why: `${Math.round(m.deloadPct * 100)}% of ${last.w}` };
  const est = e1rm(last.w, last.r || 1, last.rpe ?? 8);
  return { w: roundTo(est * pctFor(wk(m.topReps, week), wk(m.topRpe, week)), step), why: `from ${last.w}×${last.r}${last.rpe != null ? ' @' + last.rpe : ''} on ${fmtDay(last.date)}` };
}
function prefill(ex, sets, week, last) {
  const n = sets.length, step = loadStep(ex.unit);
  const lastW = (i) => (last && last.sets.length ? last.sets[Math.min(i, last.sets.length - 1)].w : null);
  if (ex.kind === 'main' && ex.main) {
    const m = ex.main;
    if (week === 4) { const s = suggestTop(ex); return { w: s ? s.w : n ? sets[n - 1].w : lastW(0), r: m.deloadReps, rpe: '' }; }
    const reps = wk(m.topReps, week);
    if (n === 0) { const s = suggestTop(ex); return { w: s ? s.w : lastW(0), r: reps, rpe: wk(m.topRpe, week) }; }
    const top = sets[0];
    return { w: top.w != null ? roundTo(top.w * m.backPct, step) : null, r: reps, rpe: '' };
  }
  if (ex.kind === 'power' && ex.power) return { w: n ? sets[n - 1].w : lastW(0), r: ex.power.reps, rpe: '' };
  const a = ex.acc || { repsLo: 8 };
  return { w: n ? sets[n - 1].w : lastW(n), r: n ? sets[n - 1].r : a.repsLo, rpe: '' };
}
function setStr(s, unit) {
  const w = s.w != null ? `${s.w}` : '';
  const r = s.r != null ? `${s.r}` : '';
  return `${w ? w + '×' : ''}${r}${s.rpe != null ? ' @' + s.rpe : ''}`;
}
function proposeNextWave() {
  const out = [];
  for (const ex of allExercises()) {
    if (ex.kind !== 'main' || !ex.main) continue;
    const step = loadStep(ex.unit);
    const tops = topSetsFor(ex.id);
    const w1 = tops.find((t) => t.wave === S.wave.number && t.week === 1);
    const w3 = tops.find((t) => t.wave === S.wave.number && t.week === 3);
    let proposed = null, reason = 'no top sets logged yet';
    if (w1 && w3 && w3.rpe != null) {
      if (w3.rpe <= 8.5) { proposed = w1.w + ex.main.incr; reason = `week 3 was RPE ${w3.rpe}: +${ex.main.incr}`; }
      else if (w3.rpe <= 9) { proposed = w1.w; reason = 'week 3 was RPE 9: repeat'; }
      else { proposed = roundTo(w1.w * 0.95, step); reason = 'week 3 was a grind: −5%'; }
    } else if (tops[0]) {
      proposed = roundTo(e1rm(tops[0].w, tops[0].r, tops[0].rpe ?? 8) * pctFor(wk(ex.main.topReps, 1), wk(ex.main.topRpe, 1)), step);
      reason = `from the last top set, ${tops[0].w}×${tops[0].r}`;
    }
    out.push({ exId: ex.id, name: ex.name, proposed, reason });
  }
  return out;
}

/* ---------- timer ---------- */
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* no audio */ }
}
function beep() {
  try {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach((t) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.3, now + t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.18);
      o.start(now + t); o.stop(now + t + 0.2);
    });
  } catch (e) { /* no audio */ }
}
function startTimer(sec, label) { S.timer = { endsAt: Date.now() + sec * 1000, total: sec, label, fired: false }; save(); renderTimer(); }
function renderTimer() {
  const el = $('#timer'), t = S.timer;
  if (!t) { el.hidden = true; return; }
  const left = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
  el.hidden = false;
  el.innerHTML = `<div class="timer-in"><div><div class="timer-label">${esc(t.label)}</div><div class="timer-num${left === 0 ? ' done' : ''}">${left === 0 ? 'Go' : fmtSec(left)}</div></div>
    <div class="timer-btns"><button type="button" data-act="timer-add">+30 s</button><button type="button" data-act="timer-stop">${left === 0 ? 'Clear' : 'Skip'}</button></div></div>`;
  if (left === 0 && !t.fired) { t.fired = true; save(); beep(); }
}
setInterval(() => { if (S.timer) renderTimer(); }, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderTimer(); });

/* ---------- rendering ---------- */
function render() {
  renderTabs();
  const tab = S.ui.tab || 'today';
  const views = { today: renderToday, history: renderHistory, peptides: renderPeptides, program: renderProgram, data: renderData };
  $('#app').innerHTML = (views[tab] || renderToday)();
  renderTimer();
}
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }
function renderTabs() {
  const tabs = [['today', 'Today', '●'], ['history', 'History', '∿'], ['peptides', 'Peptides', '✚'], ['program', 'Program', '≡'], ['data', 'Data', '⇅']];
  $('#tabs').innerHTML = tabs.map(([id, label, g]) => `<button type="button" class="tab" data-act="tab" data-tab="${id}" ${S.ui.tab === id ? 'aria-current="page"' : ''}><span class="glyph" aria-hidden="true">${g}</span>${label}</button>`).join('');
}
function header(title, sub) {
  return `<header class="head"><div><p class="eyebrow">${esc(sub)}</p><h1>${esc(title)}</h1></div><button type="button" class="chip" data-act="tab" data-tab="program">Wave ${S.wave.number} · Wk ${S.wave.week}</button></header>`;
}

/* ----- Today ----- */
function renderToday() {
  const d = dateKey(), now = new Date();
  S.checkins[d] = S.checkins[d] || {};
  const ci = S.checkins[d];
  const key = currentSessionKey();
  const session = key ? S.sessions[key] : null;
  const day = key ? dayById(keyDayId(key)) : null;
  const week = session ? session.week : S.wave.week;

  let h = header(WD_LONG[now.getDay()], `${now.getDate()} ${MON[now.getMonth()]} ${now.getFullYear()}`);
  h += shotBanners(d, now.getDay());
  h += `<section class="sec"><div class="sec-head"><h2>Check-in</h2></div>
    <div class="card stack">
      <div class="row between"><span class="lbl">Energy</span><span class="energy-out" id="energy-out">${ci.energy ?? '–'}</span></div>
      <input type="range" min="0" max="10" step="0.5" value="${ci.energy ?? 5}" data-bind="checkins.${d}.energy" data-type="num" data-live="#energy-out" aria-label="Energy, 0 to 10">
      <div class="energy-ends"><span>0 flat</span><span>10 on fire</span></div>
      <div class="grid2">
        <div class="field"><label for="ci-w">Body weight, lb</label><input id="ci-w" type="number" inputmode="decimal" step="0.1" value="${ci.weight ?? ''}" data-bind="checkins.${d}.weight" data-type="num" placeholder="213.0"></div>
        <div class="field"><label for="ci-n">Note</label><input id="ci-n" type="text" value="${esc(ci.note ?? '')}" data-bind="checkins.${d}.note" placeholder="sleep, nausea, anything"></div>
      </div>
    </div></section>`;

  if (day) {
    const logged = session ? Object.values(session.sets).reduce((a, s) => a + s.length, 0) : 0;
    h += `<section class="sec"><div class="sec-head"><div><p class="eyebrow">${esc(day.tag || '')}${session && session.finished ? ' · finished' : ''}</p><h2>${esc(day.name)}</h2></div><span class="chip ${week === 4 ? '' : 'calm'}">${week === 4 ? 'Deload' : 'Week ' + week}</span></div>
      ${day.warmup ? `<p class="hint" style="margin-top:8px"><b>Warm-up.</b> ${esc(day.warmup)}</p>` : ''}
      <div class="card" style="padding:0 14px">${day.exercises.map((ex) => exerciseRow(ex, session, week)).join('') || '<p class="hint" style="padding:12px 0">No exercises on this day. Add some in Program.</p>'}</div>
      <div class="stack" style="margin-top:12px">
        <div class="field"><label for="s-note">Session note</label><input id="s-note" type="text" value="${esc(session ? session.note : '')}" data-onchange="session-note" placeholder="how it went"></div>
        ${session && !session.finished ? `<button type="button" class="btn primary block" data-act="finish-session">Finish session · ${logged} sets</button>` : ''}
        ${session && session.finished ? `<button type="button" class="btn ghost block" data-act="reopen-session">Reopen session</button>` : ''}
      </div>
      ${dayChooser(day.id)}
    </section>`;
  } else {
    h += `<section class="sec"><div class="sec-head"><h2>Rest day</h2></div><p class="hint" style="margin-top:8px">Nothing scheduled. Check in above, eat the protein.</p>${dayChooser(null)}</section>`;
  }
  return h;
}
function dayChooser(currentId) {
  const others = S.program.days.filter((d) => d.id !== currentId);
  if (!others.length) return '';
  return `<details style="margin-top:14px"><summary class="linkish">Do a different session today</summary><div class="row" style="margin-top:8px">${others.map((d) => `<button type="button" class="btn small" data-act="pick-day" data-day="${d.id}">${esc(d.name)}</button>`).join('')}</div></details>`;
}
function shotBanners(d, wd) {
  return S.compounds
    .filter((c) => (c.days || []).includes(wd) && !S.doses.some((x) => x.compoundId === c.id && dateKey(new Date(x.ts)) === d))
    .map((c) => `<div class="banner"><span>${esc(c.name)} due today${c.time ? ' · ' + esc(c.time) : ''}</span><button type="button" class="btn small" data-act="quick-dose" data-c="${c.id}">Log it</button></div>`)
    .join('');
}
function exerciseRow(ex, session, week) {
  const sets = (session && session.sets[ex.id]) || [];
  const planned = plannedSets(ex, week);
  const open = S.ui.openEx === ex.id;
  let h = `<div class="ex"><button type="button" class="ex-head" data-act="toggle-ex" data-ex="${ex.id}" aria-expanded="${open}">
    <span class="ex-name">${esc(ex.name)}</span><span class="ex-prog ${sets.length >= planned ? 'done' : ''}">${sets.length}/${planned}</span>
    <span class="ex-rx ${ex.kind === 'main' ? 'main' : ''}">${esc(rx(ex, week))}</span></button>`;
  if (open) h += exerciseBody(ex, session, sets, week);
  return h + '</div>';
}
function exerciseBody(ex, session, sets, week) {
  const unit = ex.unit === 'none' ? '' : ex.unit;
  const last = lastSetsFor(ex.id, session && session.key);
  let h = '<div class="ex-body">';
  if (ex.note) h += `<p class="hint">${esc(ex.note)}</p>`;
  if (ex.kind === 'main') { const s = suggestTop(ex); if (s) h += `<p class="hint">Suggested top set <b class="mono">${fmtW(s.w, ex.unit)}</b> <span class="muted">· ${esc(s.why)}</span></p>`; }
  if (last) h += `<p class="hint">Last time, ${fmtDay(last.date)}: <span class="mono">${last.sets.map((s) => setStr(s, unit)).join(', ')}</span></p>`;
  if (sets.length) h += `<div class="sets">${sets.map((s, i) => `<div class="set ${ex.kind === 'main' && i === 0 && week < 4 ? 'top' : ''}"><span class="n">${i + 1}</span><span>${setStr(s, unit)}</span><button type="button" class="icon-btn" data-act="del-set" data-ex="${ex.id}" data-set="${s.id}" aria-label="Delete set ${i + 1}">×</button></div>`).join('')}</div>`;
  const pre = prefill(ex, sets, week, last);
  const repLabel = ex.kind === 'acc' && ex.acc && ex.acc.repUnit !== 'reps' ? ex.acc.repUnit : 'reps';
  h += `<div class="setrow">
    ${ex.unit === 'none' ? '' : `<div class="field"><label>${unit}</label><input type="number" inputmode="decimal" step="any" name="w" value="${pre.w ?? ''}" aria-label="Load"></div>`}
    <div class="field"><label>${esc(repLabel)}</label><input type="number" inputmode="numeric" name="r" value="${pre.r ?? ''}" aria-label="Reps"></div>
    <div class="field"><label>RPE</label><select name="rpe" aria-label="RPE">${RPE_OPTS.map((o) => `<option value="${o}" ${String(pre.rpe ?? '') === o ? 'selected' : ''}>${o || '–'}</option>`).join('')}</select></div>
    <button type="button" class="btn primary" data-act="save-set" data-ex="${ex.id}">Save</button>
  </div>`;
  const swaps = SWAPS[ex.id];
  if (swaps || (ex.baseName && ex.baseName !== ex.name)) {
    const opts = (swaps || []).filter((n) => n !== ex.name).map((n) => `<button type="button" class="linkish" data-act="swap-ex" data-ex="${ex.id}" data-name="${esc(n)}">${esc(n)}</button>`);
    if (ex.baseName && ex.baseName !== ex.name) opts.push(`<button type="button" class="linkish" data-act="swap-ex" data-ex="${ex.id}" data-name="${esc(ex.baseName)}">back to ${esc(ex.baseName)}</button>`);
    h += `<p class="hint">Joint complaining? Swap: ${opts.join(' · ')}</p>`;
  }
  h += `<button type="button" class="btn ghost small" data-act="toggle-ex" data-ex="${ex.id}">Close</button></div>`;
  return h;
}

/* ----- History ----- */
function lineChart(series, opts = {}) {
  const W = 360, H = 170, L = 40, R = 12, T = 10, B = 24;
  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return '<p class="hint">Nothing logged yet.</p>';
  let xmin = Math.min(...pts.map((p) => p.x)), xmax = Math.max(...pts.map((p) => p.x));
  if (xmax === xmin) { xmin -= DAY_MS; xmax += DAY_MS; }
  let ymin = Math.min(...pts.map((p) => p.y)), ymax = Math.max(...pts.map((p) => p.y));
  if (opts.ymin != null) ymin = Math.min(ymin, opts.ymin);
  if (opts.ymax != null) ymax = Math.max(ymax, opts.ymax);
  const span = ymax - ymin || 1;
  if (opts.ymin == null) ymin -= span * 0.1;
  if (opts.ymax == null) ymax += span * 0.1;
  const X = (x) => L + ((x - xmin) / (xmax - xmin)) * (W - L - R);
  const Y = (y) => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
  const fmt = opts.yFmt || ((v) => Math.round(v));
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const v = ymin + ((ymax - ymin) * i) / 3, y = Y(v).toFixed(1);
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 6}" y="${(+y + 4).toFixed(1)}" class="tick" text-anchor="end">${fmt(v)}</text>`;
  }
  g += `<text x="${L}" y="${H - 6}" class="tick">${fmtShort(xmin)}</text><text x="${W - R}" y="${H - 6}" class="tick" text-anchor="end">${fmtShort(xmax)}</text>`;
  for (const s of series) {
    const ps = s.points.slice().sort((a, b) => a.x - b.x);
    if (s.line !== false && ps.length > 1) g += `<path d="${ps.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ')}" class="line ${s.cls || ''}"/>`;
    if (s.dots) g += ps.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" class="dot ${s.cls || ''}"/>`).join('');
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(opts.label || 'chart')}">${g}</svg>`;
}
function stat(v, k) { return `<div class="stat"><div class="v mono">${v}</div><div class="k">${k}</div></div>`; }
function renderHistory() {
  let h = header('History', 'Body, energy, lifts');
  const now = Date.now();

  const wpts = Object.entries(S.checkins).filter(([, c]) => c.weight != null).map(([k, c]) => ({ x: parseKey(k).getTime(), y: c.weight })).sort((a, b) => a.x - b.x);
  const recent = wpts.filter((p) => p.x >= now - 120 * DAY_MS);
  const avg = recent.map((p) => { const win = wpts.filter((q) => q.x <= p.x && q.x > p.x - 7 * DAY_MS); return { x: p.x, y: win.reduce((a, q) => a + q.y, 0) / win.length }; });
  const lastW = wpts[wpts.length - 1], firstW = wpts[0];
  const monthAgo = wpts.filter((p) => p.x <= now - 30 * DAY_MS).pop();
  h += `<section class="sec"><div class="sec-head"><h2>Body weight</h2><span class="small muted">lb · last 120 days</span></div><div class="card">
    ${lineChart([{ points: recent, dots: true, line: false, cls: 'faint' }, { points: avg, cls: 'avg' }], { yFmt: (v) => v.toFixed(0), label: 'Body weight' })}
    <div class="stats">${stat(lastW ? lastW.y.toFixed(1) : '–', 'latest')}${stat(avg.length ? avg[avg.length - 1].y.toFixed(1) : '–', '7-day avg')}${stat(monthAgo && lastW ? (lastW.y - monthAgo.y).toFixed(1) : '–', '30-day change')}${stat(firstW && lastW && firstW !== lastW ? (lastW.y - firstW.y).toFixed(1) : '–', 'since first entry')}</div></div></section>`;

  const epts = Object.entries(S.checkins).filter(([, c]) => c.energy != null).map(([k, c]) => ({ x: parseKey(k).getTime(), y: c.energy })).sort((a, b) => a.x - b.x).filter((p) => p.x >= now - 60 * DAY_MS);
  h += `<section class="sec"><div class="sec-head"><h2>Energy</h2><span class="small muted">0–10 · last 60 days</span></div><div class="card">${lineChart([{ points: epts, dots: true }], { ymin: 0, ymax: 10, yFmt: (v) => v.toFixed(0), label: 'Energy' })}</div></section>`;

  const lifts = allExercises();
  const chartEx = S.ui.chartEx && findEx(S.ui.chartEx) ? S.ui.chartEx : (lifts.find((e) => e.kind === 'main') || lifts[0] || {}).id;
  const ex = chartEx ? findEx(chartEx).ex : null;
  let liftHtml = '';
  if (ex) {
    const tops = topSetsFor(ex.id).slice().reverse();
    const pts = tops.map((t) => ({ x: parseKey(t.date).getTime(), y: t.w }));
    const est = ex.kind === 'main' ? tops.filter((t) => t.r).map((t) => ({ x: parseKey(t.date).getTime(), y: Math.round(e1rm(t.w, t.r, t.rpe)) })) : [];
    liftHtml = lineChart([{ points: pts, dots: true }].concat(est.length > 1 ? [{ points: est, cls: 'avg' }] : []), { yFmt: (v) => v.toFixed(0), label: ex.name });
    const best = tops.reduce((a, t) => (!a || t.w > a.w ? t : a), null);
    const lt = tops[tops.length - 1];
    liftHtml += `<div class="stats">${stat(lt ? fmtW(lt.w, ex.unit) : '–', 'last top set')}${stat(best ? fmtW(best.w, ex.unit) : '–', 'best top set')}${ex.kind === 'main' && lt && lt.r ? stat(Math.round(e1rm(lt.w, lt.r, lt.rpe)), 'est. max') : ''}</div>`;
  }
  h += `<section class="sec"><div class="sec-head"><h2>Lifts</h2></div><div class="card stack"><select data-onchange="chart-ex" aria-label="Lift">${lifts.map((e) => `<option value="${e.id}" ${e.id === chartEx ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>${liftHtml}<p class="hint">Dots: heaviest set each session. Dashed line: estimated max from reps and RPE.</p></div></section>`;

  if (S.ui.viewSession && S.sessions[S.ui.viewSession]) h += sessionView(S.sessions[S.ui.viewSession]);
  const sessions = allSessionsSorted();
  h += `<section class="sec"><div class="sec-head"><h2>Sessions</h2><span class="small muted">${sessions.length}</span></div><div class="card list" style="padding:0 14px">${sessions.length ? sessions.slice(0, 80).map((s) => {
    const day = dayById(s.dayId); const n = Object.values(s.sets).reduce((a, x) => a + x.length, 0);
    return `<button type="button" class="list-item" data-act="view-session" data-key="${esc(s.key)}"><span><b>${fmtDay(s.date)}</b> · ${esc(day ? day.name : s.dayId)}</span><span class="mono muted">${n} sets</span><span class="sub">Wave ${s.wave} wk ${s.week}${s.note ? ' · ' + esc(s.note) : ''}</span></button>`;
  }).join('') : '<p class="hint" style="padding:12px 0">No sessions yet.</p>'}</div></section>`;
  return h;
}
function sessionView(s) {
  const day = dayById(s.dayId);
  const exIds = Object.keys(s.sets).filter((k) => s.sets[k].length);
  return `<section class="sec"><div class="sec-head"><div><p class="eyebrow">Wave ${s.wave} · week ${s.week}</p><h2>${fmtDay(s.date)} · ${esc(day ? day.name : s.dayId)}</h2></div><button type="button" class="linkish" data-act="close-session">Close</button></div><div class="card stack">
    ${exIds.length ? exIds.map((id) => { const f = findEx(id); const name = f ? f.ex.name : id; const unit = f && f.ex.unit !== 'none' ? f.ex.unit : '';
      return `<div><b>${esc(name)}</b><div class="sets" style="margin-top:4px">${s.sets[id].map((st, i) => `<div class="set"><span class="n">${i + 1}</span><span>${setStr(st, unit)}</span><button type="button" class="icon-btn" data-act="del-set-in" data-key="${esc(s.key)}" data-ex="${id}" data-set="${st.id}" aria-label="Delete set">×</button></div>`).join('')}</div></div>`; }).join('') : '<p class="hint">No sets in this session.</p>'}
    ${s.note ? `<p class="hint">${esc(s.note)}</p>` : ''}
    <button type="button" class="btn ghost small" data-act="del-session" data-key="${esc(s.key)}">Delete session</button></div></section>`;
}

/* ----- Peptides ----- */
function renderPeptides() {
  let h = header('Peptides', 'Doses and schedule');
  const sel = S.ui.doseFor && S.compounds.some((c) => c.id === S.ui.doseFor) ? S.ui.doseFor : (S.compounds[0] || {}).id;
  const c = S.compounds.find((x) => x.id === sel);
  const unitOpts = (u) => ['mg', 'mcg', 'IU', 'units'].map((o) => `<option value="${o}" ${u === o ? 'selected' : ''}>${o}</option>`).join('');
  h += `<section class="sec"><div class="sec-head"><h2>Log a dose</h2></div><div class="card stack" id="dose-form">
    ${S.compounds.length ? `<div class="field"><label>Compound</label><select name="compound" data-onchange="dose-compound">${S.compounds.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="grid2"><div class="field"><label>Dose</label><input type="number" inputmode="decimal" step="any" name="dose" value="${c && c.defaultDose != null ? c.defaultDose : ''}"></div><div class="field"><label>Unit</label><select name="unit">${unitOpts(c ? c.unit : 'mg')}</select></div></div>
    <div class="field"><label>When</label><input type="datetime-local" name="when" value="${localDT()}"></div>
    <div class="field"><label>Note</label><input type="text" name="note" placeholder="site, batch, how you felt"></div>
    <button type="button" class="btn primary block" data-act="log-dose">Save dose</button>` : '<p class="hint">Add a compound below first.</p>'}</div></section>`;

  h += `<section class="sec"><div class="sec-head"><h2>Compounds and schedule</h2><button type="button" class="linkish" data-act="add-compound">+ Add</button></div>`;
  S.compounds.forEach((cc, i) => { h += compoundEditor(cc, i, unitOpts); });
  h += `<p class="hint" style="margin-top:12px">iOS does not let a web app schedule notifications by itself. This adds a repeating Calendar event with an alert for each compound that has shot days; the Calendar does the reminding. The banner on Today also shows what is due.</p>
    <button type="button" class="btn block" style="margin-top:8px" data-act="ics">Add reminders to Calendar</button></section>`;

  const doses = S.doses.slice().sort((a, b) => b.ts - a.ts);
  h += `<section class="sec"><div class="sec-head"><h2>Dose log</h2><span class="small muted">${doses.length}</span></div><div class="card list" style="padding:0 14px">${doses.length ? doses.slice(0, 120).map((d) => {
    const cc = S.compounds.find((x) => x.id === d.compoundId);
    return `<div class="list-item"><span><b>${esc(cc ? cc.name : 'Removed compound')}</b> <span class="mono">${d.dose != null ? d.dose + ' ' + esc(d.unit || '') : ''}</span></span><span class="row" style="gap:6px"><span class="mono muted small">${fmtDay(dateKey(new Date(d.ts)))} ${fmtTime(d.ts)}</span><button type="button" class="icon-btn" data-act="del-dose" data-id="${d.id}" aria-label="Delete dose">×</button></span>${d.note ? `<span class="sub">${esc(d.note)}</span>` : ''}</div>`;
  }).join('') : '<p class="hint" style="padding:12px 0">No doses logged yet.</p>'}</div></section>`;
  return h;
}
function compoundEditor(c, i, unitOpts) {
  const p = `compounds.${i}`;
  return `<div class="editor">
    <div class="grid2"><div class="field"><label>Name</label><input type="text" value="${esc(c.name)}" data-bind="${p}.name" data-rerender="1"></div>
    <div class="field"><label>Default dose</label><div class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" inputmode="decimal" step="any" value="${c.defaultDose ?? ''}" data-bind="${p}.defaultDose" data-type="num" style="flex:1;min-width:0"><select data-bind="${p}.unit" style="width:96px">${unitOpts(c.unit)}</select></div></div></div>
    <div class="field"><span class="lbl">Shot days</span><div class="days7">${WD.map((n, wd) => `<button type="button" data-act="toggle-day" data-i="${i}" data-wd="${wd}" aria-pressed="${(c.days || []).includes(wd)}">${n}</button>`).join('')}</div></div>
    <div class="grid2"><div class="field"><label>Time</label><input type="time" value="${esc(c.time || '')}" data-bind="${p}.time"></div><div class="field"><label>&nbsp;</label><button type="button" class="btn ghost small" data-act="del-compound" data-i="${i}">Remove</button></div></div></div>`;
}
function buildIcs() {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Strength Wave//EN', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  let n = 0;
  for (const c of S.compounds) {
    const days = (c.days || []).slice().sort((a, b) => a - b);
    if (!days.length) continue;
    const [hh, mm] = (c.time || '08:00').split(':').map(Number);
    const start = new Date(); start.setHours(hh || 0, mm || 0, 0, 0);
    let guard = 0;
    while ((!days.includes(start.getDay()) || start.getTime() < Date.now()) && guard++ < 14) start.setDate(start.getDate() + 1);
    const dt = `${dateKey(start).replace(/-/g, '')}T${pad2(hh || 0)}${pad2(mm || 0)}00`;
    const summary = `${c.name} shot${c.defaultDose != null ? ` ${c.defaultDose} ${c.unit}` : ''}`;
    lines.push('BEGIN:VEVENT', `UID:wave-${c.id}@strength-wave`, `DTSTAMP:${stamp}`, `DTSTART:${dt}`, 'DURATION:PT15M',
      `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BY[d]).join(',')}`, `SUMMARY:${summary}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT');
    n++;
  }
  lines.push('END:VCALENDAR');
  return n ? lines.join('\r\n') + '\r\n' : null;
}

/* ----- Program ----- */
function renderProgram() {
  let h = header('Program', 'Wave and exercises');
  const w = S.wave;
  h += `<section class="sec"><div class="sec-head"><h2>Wave ${w.number} · Week ${w.week}${w.week === 4 ? ' · deload' : ''}</h2></div><div class="card stack">
    <p class="hint">${esc(weekLine(w.week))}</p>
    <div class="row"><button type="button" class="btn small" data-act="week-prev" ${w.week <= 1 ? 'disabled' : ''}>← Week</button><button type="button" class="btn small" data-act="week-next" ${w.week >= 4 ? 'disabled' : ''}>Week →</button><button type="button" class="btn small primary" data-act="propose-wave">Start wave ${w.number + 1}</button></div>
    ${S.ui.proposals ? proposalsPanel() : ''}
    <p class="hint">Advance the week yourself each Monday. Starting a new wave proposes week-1 top sets from what you logged.</p></div></section>`;
  S.program.days.forEach((day, di) => { h += dayEditor(day, di); });
  h += `<div class="row" style="margin-top:16px"><button type="button" class="btn small" data-act="add-day">+ Add a day</button><button type="button" class="btn small ghost" data-act="reset-program">Reset to the default program</button></div>`;
  return h;
}
function proposalsPanel() {
  const P = S.ui.proposals;
  return `<div class="card accent stack"><b>Proposed week-1 top sets for wave ${S.wave.number + 1}</b>
    ${P.length ? P.map((p, i) => `<div class="row between" style="flex-wrap:nowrap"><span class="grow">${esc(p.name)}<br><span class="small muted">${esc(p.reason)}</span></span><input type="number" inputmode="decimal" step="any" value="${p.proposed ?? ''}" data-onchange="proposal" data-i="${i}" style="width:110px" aria-label="Proposed load for ${esc(p.name)}"></div>`).join('') : '<p class="hint">No main lifts in the program.</p>'}
    <p class="hint">Edit any number, then apply. The week resets to 1.</p>
    <div class="row"><button type="button" class="btn primary" data-act="apply-wave">Apply, start wave ${S.wave.number + 1}</button><button type="button" class="btn ghost" data-act="cancel-wave">Cancel</button></div></div>`;
}
function dayEditor(day, di) {
  const p = `program.days.${di}`;
  let h = `<section class="day-block">
    <div class="grid2"><div class="field"><label>Day name</label><input type="text" value="${esc(day.name)}" data-bind="${p}.name"></div>
    <div class="field"><label>Weekday</label><select data-bind="${p}.weekday" data-type="int" data-rerender="1"><option value="">Unscheduled</option>${WD_LONG.map((n, i) => `<option value="${i}" ${day.weekday === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="grid2" style="margin-top:10px"><div class="field"><label>Tag</label><input type="text" value="${esc(day.tag || '')}" data-bind="${p}.tag"></div><div class="field"><label>&nbsp;</label><button type="button" class="btn ghost small" data-act="del-day" data-di="${di}">Remove day</button></div></div>
    <div class="field" style="margin-top:10px"><label>Warm-up</label><input type="text" value="${esc(day.warmup || '')}" data-bind="${p}.warmup"></div>
    <div class="card list" style="padding:0 14px;margin-top:12px">`;
  day.exercises.forEach((ex, ei) => {
    const editing = S.ui.editEx === ex.id;
    h += `<div class="ex"><div class="ex-head"><span class="ex-name">${esc(ex.name)}</span><span class="row" style="gap:4px;flex-wrap:nowrap">
      <button type="button" class="icon-btn" data-act="move-ex" data-di="${di}" data-ei="${ei}" data-dir="-1" aria-label="Move up">↑</button>
      <button type="button" class="icon-btn" data-act="move-ex" data-di="${di}" data-ei="${ei}" data-dir="1" aria-label="Move down">↓</button>
      <button type="button" class="icon-btn" data-act="edit-ex" data-ex="${ex.id}" aria-label="Edit">${editing ? '–' : '✎'}</button></span>
      <span class="ex-rx ${ex.kind === 'main' ? 'main' : ''}">${esc(rx(ex, S.wave.week))}</span></div>${editing ? exEditor(ex, di, ei) : ''}</div>`;
  });
  h += `</div><button type="button" class="btn small" style="margin-top:10px" data-act="add-ex" data-di="${di}">+ Add exercise</button></section>`;
  return h;
}
function exEditor(ex, di, ei) {
  const p = `program.days.${di}.exercises.${ei}`;
  let h = `<div class="editor">
    <div class="grid2"><div class="field"><label>Name</label><input type="text" value="${esc(ex.name)}" data-bind="${p}.name" data-rerender="1"></div>
    <div class="field"><label>Type</label><select data-bind="${p}.kind" data-onchange="ex-kind" data-ex="${ex.id}"><option value="main" ${ex.kind === 'main' ? 'selected' : ''}>Main lift: top set + back-offs</option><option value="power" ${ex.kind === 'power' ? 'selected' : ''}>Power: sets × reps at %</option><option value="acc" ${ex.kind === 'acc' ? 'selected' : ''}>Accessory</option></select></div></div>
    <div class="grid2"><div class="field"><label>Load unit</label><select data-bind="${p}.unit"><option value="lb" ${ex.unit === 'lb' ? 'selected' : ''}>lb</option><option value="kg" ${ex.unit === 'kg' ? 'selected' : ''}>kg</option><option value="none" ${ex.unit === 'none' ? 'selected' : ''}>no load</option></select></div>
    <div class="field"><label>Rest, s (blank = default)</label><input type="number" inputmode="numeric" value="${ex.restSec ?? ''}" data-bind="${p}.restSec" data-type="int"></div></div>`;
  if (ex.kind === 'main' && ex.main) {
    const m = ex.main;
    h += `<div class="grid3"><div class="field"><label>Top reps wk 1–3</label><input type="text" value="${m.topReps.join(', ')}" data-bind="${p}.main.topReps" data-type="numlist"></div><div class="field"><label>Top RPE wk 1–3</label><input type="text" value="${m.topRpe.join(', ')}" data-bind="${p}.main.topRpe" data-type="numlist"></div><div class="field"><label>Back-off sets</label><input type="number" inputmode="numeric" value="${m.backSets}" data-bind="${p}.main.backSets" data-type="int"></div></div>
      <div class="grid3"><div class="field"><label>Back-off %</label><input type="number" inputmode="numeric" value="${Math.round(m.backPct * 100)}" data-bind="${p}.main.backPct" data-type="pct"></div><div class="field"><label>Deload %</label><input type="number" inputmode="numeric" value="${Math.round(m.deloadPct * 100)}" data-bind="${p}.main.deloadPct" data-type="pct"></div><div class="field"><label>+ per wave</label><input type="number" inputmode="decimal" step="any" value="${m.incr}" data-bind="${p}.main.incr" data-type="num"></div></div>`;
  } else if (ex.kind === 'power' && ex.power) {
    const pw = ex.power;
    h += `<div class="grid3"><div class="field"><label>Sets</label><input type="number" inputmode="numeric" value="${pw.sets}" data-bind="${p}.power.sets" data-type="int"></div><div class="field"><label>Reps</label><input type="number" inputmode="numeric" value="${pw.reps}" data-bind="${p}.power.reps" data-type="int"></div><div class="field"><label>Deload sets</label><input type="number" inputmode="numeric" value="${pw.deloadSets}" data-bind="${p}.power.deloadSets" data-type="int"></div></div>
      <div class="field"><label>% by week, four values</label><input type="text" value="${esc(pw.pct.join(', '))}" data-bind="${p}.power.pct" data-type="list"></div>`;
  } else {
    const a = ex.acc || { sets: 3, repsLo: 8, repsHi: 10, repUnit: 'reps', load: '' };
    h += `<div class="grid3"><div class="field"><label>Sets</label><input type="number" inputmode="numeric" value="${a.sets}" data-bind="${p}.acc.sets" data-type="int"></div><div class="field"><label>Reps from</label><input type="number" inputmode="numeric" value="${a.repsLo}" data-bind="${p}.acc.repsLo" data-type="int"></div><div class="field"><label>Reps to</label><input type="number" inputmode="numeric" value="${a.repsHi}" data-bind="${p}.acc.repsHi" data-type="int"></div></div>
      <div class="grid2"><div class="field"><label>Rep unit</label><select data-bind="${p}.acc.repUnit">${['reps', 'm', 's', 'min'].map((u) => `<option value="${u}" ${a.repUnit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div><div class="field"><label>Load or effort</label><input type="text" value="${esc(a.load)}" data-bind="${p}.acc.load"></div></div>`;
  }
  h += `<div class="field"><label>Note</label><input type="text" value="${esc(ex.note || '')}" data-bind="${p}.note"></div>
    <div class="row between"><button type="button" class="btn small" data-act="edit-ex" data-ex="${ex.id}">Done</button><button type="button" class="btn ghost small" data-act="del-ex" data-di="${di}" data-ei="${ei}">Delete exercise</button></div></div>`;
  return h;
}

/* ----- Data ----- */
function countSummary() {
  const sess = Object.values(S.sessions);
  const sets = sess.reduce((a, s) => a + Object.values(s.sets).reduce((b, x) => b + x.length, 0), 0);
  let kb = 0; try { kb = Math.round((localStorage.getItem(STORE_KEY) || '').length / 1024); } catch (e) { /* ignore */ }
  return `${sess.length} sessions · ${sets} sets · ${Object.keys(S.checkins).length} check-ins · ${S.doses.length} doses · ${kb} KB`;
}
function exportText() {
  const { ui, timer, ...rest } = S;
  return JSON.stringify(Object.assign({ exportedAt: new Date().toISOString(), app: APP_VERSION }, rest), null, 1);
}
async function shareText(name, text, type) {
  try {
    const file = new File([text], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  } catch (e) { return 'failed'; }
}
function renderData() {
  const s = S.settings;
  const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  let h = header('Data', 'Backup and settings');
  h += `<section class="sec"><div class="sec-head"><h2>Backup</h2></div><div class="card stack">
    <p class="hint">Everything lives on this phone. Export writes one JSON file; save it to OneDrive so it syncs to the PC. Import replaces everything with the file's contents.</p>
    <button type="button" class="btn primary block" data-act="export">Export to a file</button>
    <button type="button" class="btn block" data-act="copy-json">Copy as text</button>
    <label class="btn block" style="display:flex;align-items:center;justify-content:center">Import from a file<input type="file" accept="application/json,.json" data-onchange="import" style="display:none"></label>
    <p class="hint mono small">${countSummary()}</p></div></section>`;
  h += `<section class="sec"><div class="sec-head"><h2>Rest timer</h2><span class="small muted">seconds</span></div><div class="card grid2">
    ${[['restTop', 'Top set'], ['restBack', 'Back-off'], ['restPower', 'Power'], ['restAcc', 'Accessory']].map(([k, l]) => `<div class="field"><label>${l}</label><input type="number" inputmode="numeric" value="${s[k]}" data-bind="settings.${k}" data-type="int"></div>`).join('')}</div></section>`;
  h += `<section class="sec"><div class="sec-head"><h2>App</h2><span class="small muted mono">${APP_VERSION}</span></div><div class="card stack">
    ${standalone ? '<p class="hint">Installed on the home screen. Works offline.</p>' : '<p class="hint">Not installed yet. In Safari tap Share, then <b>Add to Home Screen</b>. The home-screen copy keeps its own data, so install first, then start logging.</p>'}
    <button type="button" class="btn block" data-act="reload">Reload to pick up updates</button>
    <button type="button" class="btn danger block" data-act="reset-all">Erase everything on this phone</button></div></section>`;
  return h;
}

/* ---------- actions ---------- */
const ACTIONS = {
  tab: (d) => { S.ui.tab = d.tab; S.ui.viewSession = null; S.ui.proposals = null; save(); render(); window.scrollTo(0, 0); },
  'toggle-ex': (d) => { S.ui.openEx = S.ui.openEx === d.ex ? null : d.ex; save(); rerender(); },
  'pick-day': (d) => { S.ui.sessionKey = `${dateKey()}_${d.day}`; S.ui.openEx = null; save(); rerender(); },
  'save-set': (d, b) => {
    unlockAudio();
    const row = b.closest('.setrow');
    const wEl = row.querySelector('[name=w]');
    const w = wEl ? num(wEl.value) : null;
    const r = int(row.querySelector('[name=r]').value);
    const rpe = num(row.querySelector('[name=rpe]').value);
    if (r == null || r <= 0) return toast('Enter reps');
    const f = findEx(d.ex); if (!f) return;
    const key = currentSessionKey(); if (!key) return toast('Pick a session first');
    const s = ensureSession(key);
    (s.sets[f.ex.id] = s.sets[f.ex.id] || []).push({ id: uid(), w, r, rpe, ts: Date.now() });
    save();
    startTimer(restFor(f.ex, s.sets[f.ex.id].length), f.ex.name);
    rerender();
  },
  'del-set': (d) => { const key = currentSessionKey(); const s = key && S.sessions[key]; if (!s || !s.sets[d.ex]) return; s.sets[d.ex] = s.sets[d.ex].filter((x) => x.id !== d.set); save(); rerender(); },
  'finish-session': () => { const key = currentSessionKey(); const s = key && S.sessions[key]; if (!s) return toast('Nothing logged yet'); s.finished = Date.now(); S.ui.openEx = null; S.timer = null; save(); rerender(); toast('Session saved'); },
  'reopen-session': () => { const key = currentSessionKey(); const s = key && S.sessions[key]; if (s) { s.finished = null; save(); rerender(); } },
  'swap-ex': (d) => { const f = findEx(d.ex); if (!f) return; if (!f.ex.baseName) f.ex.baseName = f.ex.name; f.ex.name = d.name; save(); rerender(); toast(`Now ${d.name}`); },
  'timer-add': () => { if (S.timer) { S.timer.endsAt = Math.max(S.timer.endsAt, Date.now()) + 30000; S.timer.fired = false; save(); renderTimer(); } },
  'timer-stop': () => { S.timer = null; save(); renderTimer(); },
  'quick-dose': (d) => {
    const c = S.compounds.find((x) => x.id === d.c); if (!c) return;
    if (c.defaultDose != null) { S.doses.push({ id: uid(), compoundId: c.id, ts: Date.now(), dose: c.defaultDose, unit: c.unit, note: '' }); save(); rerender(); toast(`${c.name} logged`); }
    else { S.ui.doseFor = c.id; S.ui.tab = 'peptides'; save(); render(); window.scrollTo(0, 0); toast('Enter the dose'); }
  },
  'log-dose': () => {
    const f = $('#dose-form'); if (!f) return;
    const cid = f.querySelector('[name=compound]').value;
    const dose = num(f.querySelector('[name=dose]').value);
    const unit = f.querySelector('[name=unit]').value;
    const when = f.querySelector('[name=when]').value;
    const note = f.querySelector('[name=note]').value.trim();
    const ts = when ? new Date(when).getTime() : Date.now();
    if (!Number.isFinite(ts)) return toast('Check the date');
    S.doses.push({ id: uid(), compoundId: cid, ts, dose, unit, note });
    save(); rerender(); toast('Dose saved');
  },
  'del-dose': (d) => { if (!confirm('Delete this dose?')) return; S.doses = S.doses.filter((x) => x.id !== d.id); save(); rerender(); },
  'add-compound': () => { S.compounds.push({ id: 'c_' + uid(), name: 'New compound', unit: 'mg', defaultDose: null, days: [], time: '08:00' }); save(); rerender(); },
  'del-compound': (d) => { const c = S.compounds[+d.i]; if (!c) return; if (!confirm(`Remove ${c.name}? Its logged doses stay.`)) return; S.compounds.splice(+d.i, 1); if (S.ui.doseFor === c.id) S.ui.doseFor = null; save(); rerender(); },
  'toggle-day': (d) => { const c = S.compounds[+d.i]; if (!c) return; const wd = +d.wd; const days = c.days || []; c.days = days.includes(wd) ? days.filter((x) => x !== wd) : days.concat(wd).sort((a, b) => a - b); save(); rerender(); },
  ics: async () => { const ics = buildIcs(); if (!ics) return toast('No compound has shot days set'); const r = await shareText('shots.ics', ics, 'text/calendar'); if (r === 'shared' || r === 'downloaded') toast('Open the file, then tap Add All'); },
  'week-prev': () => { S.wave.week = Math.max(1, S.wave.week - 1); save(); rerender(); },
  'week-next': () => { S.wave.week = Math.min(4, S.wave.week + 1); save(); rerender(); },
  'propose-wave': () => { S.ui.proposals = proposeNextWave(); rerender(); },
  'cancel-wave': () => { S.ui.proposals = null; rerender(); },
  'apply-wave': () => {
    const P = S.ui.proposals || []; S.planned = {};
    for (const p of P) if (p.proposed != null) S.planned[p.exId] = p.proposed;
    S.wave.number += 1; S.wave.week = 1; S.wave.startDate = dateKey(); S.ui.proposals = null;
    save(); rerender(); toast(`Wave ${S.wave.number} started`);
  },
  'edit-ex': (d) => { S.ui.editEx = S.ui.editEx === d.ex ? null : d.ex; save(); rerender(); },
  'move-ex': (d) => { const day = S.program.days[+d.di]; const i = +d.ei, j = i + +d.dir; if (!day || j < 0 || j >= day.exercises.length) return; [day.exercises[i], day.exercises[j]] = [day.exercises[j], day.exercises[i]]; save(); rerender(); },
  'del-ex': (d) => { const day = S.program.days[+d.di]; const ex = day && day.exercises[+d.ei]; if (!ex) return; if (!confirm(`Delete ${ex.name} from ${day.name}? Logged sets stay in history.`)) return; day.exercises.splice(+d.ei, 1); S.ui.editEx = null; save(); rerender(); },
  'add-ex': (d) => { const day = S.program.days[+d.di]; if (!day) return; const ex = { id: 'ex_' + uid(), name: 'New exercise', kind: 'acc', unit: 'lb', note: '', acc: { sets: 3, repsLo: 8, repsHi: 10, repUnit: 'reps', load: '' } }; day.exercises.push(ex); S.ui.editEx = ex.id; save(); rerender(); },
  'add-day': () => { S.program.days.push({ id: 'd_' + uid(), name: 'New day', weekday: null, tag: '', warmup: '', exercises: [] }); save(); rerender(); },
  'del-day': (d) => { const day = S.program.days[+d.di]; if (!day) return; if (!confirm(`Remove ${day.name} and its ${day.exercises.length} exercises? History stays.`)) return; S.program.days.splice(+d.di, 1); save(); rerender(); },
  'reset-program': () => { if (!confirm('Replace the program with the default five days? History, doses and check-ins stay.')) return; S.program = defaultProgram(); S.ui.editEx = null; save(); rerender(); toast('Default program restored'); },
  'view-session': (d) => { S.ui.viewSession = d.key; save(); rerender(); },
  'close-session': () => { S.ui.viewSession = null; save(); rerender(); },
  'del-session': (d) => { if (!confirm('Delete this whole session?')) return; delete S.sessions[d.key]; S.ui.viewSession = null; save(); rerender(); },
  'del-set-in': (d) => { const s = S.sessions[d.key]; if (!s || !s.sets[d.ex]) return; s.sets[d.ex] = s.sets[d.ex].filter((x) => x.id !== d.set); save(); rerender(); },
  export: async () => { const r = await shareText(`wave-${dateKey()}.json`, exportText(), 'application/json'); toast({ shared: 'Shared', downloaded: 'Downloaded', cancelled: 'Cancelled', failed: 'Export failed' }[r]); },
  'copy-json': async () => { try { await navigator.clipboard.writeText(exportText()); toast('Copied'); } catch (e) { toast('Copy blocked here; use Export'); } },
  reload: () => { location.reload(); },
  'reset-all': () => {
    if (!confirm('Erase every session, dose, check-in and setting on this phone?')) return;
    if (!confirm('Last chance. Export first if you want it back.')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    S = defaults(); save(); render(); toast('Erased');
  }
};
const CHANGE = {
  'session-note': (d, el) => { const key = currentSessionKey(); if (!key) return; ensureSession(key).note = el.value; save(); },
  'dose-compound': (d, el) => { S.ui.doseFor = el.value; save(); rerender(); },
  'chart-ex': (d, el) => { S.ui.chartEx = el.value; save(); rerender(); },
  'ex-kind': (d) => {
    const f = findEx(d.ex); if (!f) return; const ex = f.ex;
    if (ex.kind === 'main' && !ex.main) ex.main = { group: 'upper', topReps: [5, 4, 3], topRpe: [8, 8, 8.5], backSets: 2, backPct: 0.9, deloadSets: 3, deloadReps: 3, deloadPct: 0.7, incr: 5 };
    if (ex.kind === 'power' && !ex.power) ex.power = { sets: 5, reps: 2, pct: ['70–75%', '72–77%', '75–80%', '60–65%'], deloadSets: 4 };
    if (ex.kind === 'acc' && !ex.acc) ex.acc = { sets: 3, repsLo: 8, repsHi: 10, repUnit: 'reps', load: '' };
    save(); rerender();
  },
  proposal: (d, el) => { const p = S.ui.proposals && S.ui.proposals[+d.i]; if (p) p.proposed = num(el.value); },
  import: (d, el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(r.result);
        if (!o || !o.program || !o.sessions) throw new Error('not a Strength Wave export');
        if (!confirm(`Replace everything on this phone with ${f.name}? It holds ${Object.keys(o.sessions).length} sessions and ${(o.doses || []).length} doses.`)) { el.value = ''; return; }
        delete o.exportedAt; delete o.app;
        S = migrate(o); save(); render(); toast('Imported');
      } catch (e) { toast('Import failed: ' + e.message); }
    };
    r.readAsText(f);
  }
};

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const h = ACTIONS[b.dataset.act]; if (!h) return;
  e.preventDefault(); h(b.dataset, b, e);
});
document.addEventListener('change', (e) => {
  const el = e.target; if (!(el instanceof Element) || !el.dataset) return;
  if (el.dataset.bind) { setPath(el.dataset.bind, coerce(el)); save(); }
  if (el.dataset.onchange && CHANGE[el.dataset.onchange]) CHANGE[el.dataset.onchange](el.dataset, el, e);
  else if (el.dataset.bind && el.dataset.rerender) rerender();
});
document.addEventListener('input', (e) => {
  const el = e.target; if (!el || !el.dataset || !el.dataset.live) return;
  const out = $(el.dataset.live); if (out) out.textContent = el.value;
});
document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });

let toastT = null;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2200); }

/* ---------- boot ---------- */
render();
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable */ }); });
