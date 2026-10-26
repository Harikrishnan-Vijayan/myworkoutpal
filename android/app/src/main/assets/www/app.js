/* myWorkoutPal — app logic. Data is saved per user on the Railway backend and cached on the device. */
(function () {
  'use strict';
  const API = window.MWP_API;
  const root = document.getElementById('app');

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DOWL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const dowIdx = d => (d.getDay() + 6) % 7;
  const fmtDay = d => DOW[dowIdx(d)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
  const fmtNum = n => Math.round(n).toLocaleString('en-IN');
  const wLabel = w => w === 0 ? 'BW' : String(w);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  function weekStart(d) { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()); s.setDate(s.getDate() - dowIdx(s)); return s; }
  function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

  const ICON = {
    sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    plan: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    lift: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h3M19 12h3M5 8v8M19 8v8M8 6v12M16 6v12M8 12h8"/></svg>',
    hist: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>'
  };

  const DEFAULT_TEMPLATES = [
    { id: 'push', name: 'Push', custom: false, exercises: [
      { name: 'Bench Press', sets: 4, reps: 8, weight: 40 }, { name: 'Incline DB Press', sets: 3, reps: 10, weight: 14 }, { name: 'Dips', sets: 3, reps: 10, weight: 0 }] },
    { id: 'pull', name: 'Pull', custom: false, exercises: [
      { name: 'Deadlift', sets: 3, reps: 5, weight: 60 }, { name: 'Pull-ups', sets: 3, reps: 8, weight: 0 }, { name: 'Barbell Curl', sets: 3, reps: 12, weight: 10 }] },
    { id: 'legs', name: 'Legs', custom: false, exercises: [
      { name: 'Back Squat', sets: 4, reps: 5, weight: 50 }, { name: 'Romanian Deadlift', sets: 3, reps: 8, weight: 40 }, { name: 'Leg Press', sets: 3, reps: 10, weight: 80 }] },
    { id: 'upper', name: 'Upper Body', custom: false, exercises: [
      { name: 'Bench Press', sets: 3, reps: 8, weight: 40 }, { name: 'Barbell Row', sets: 3, reps: 8, weight: 35 }, { name: 'Overhead Press', sets: 3, reps: 10, weight: 25 }, { name: 'Lat Pulldown', sets: 3, reps: 12, weight: 35 }] },
    { id: 'full', name: 'Full Body', custom: false, exercises: [
      { name: 'Back Squat', sets: 3, reps: 8, weight: 50 }, { name: 'Bench Press', sets: 3, reps: 8, weight: 40 }, { name: 'Barbell Row', sets: 3, reps: 8, weight: 35 }] }
  ];
  const QUICK = ['Squat', 'Deadlift', 'Bench Press', 'Pull-ups', 'Shoulder Press', 'Lunges', 'Bicep Curl', 'Plank'];
  function freshData() {
    return { v: 1, templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)), schedule: [null, null, null, null, null, null, null], history: [], lastPerf: {}, log: null, settings: { unit: 'kg' } };
  }
  function normalize(d) {
    const f = freshData();
    if (!d || typeof d !== 'object') return f;
    return {
      v: 1,
      templates: Array.isArray(d.templates) ? d.templates : f.templates,
      schedule: Array.isArray(d.schedule) && d.schedule.length === 7 ? d.schedule : f.schedule,
      history: Array.isArray(d.history) ? d.history : [],
      lastPerf: d.lastPerf && typeof d.lastPerf === 'object' ? d.lastPerf : {},
      log: d.log || null,
      settings: Object.assign({ unit: 'kg' }, d.settings || {})
    };
  }

  // ---------- state ----------
  const S = {
    boot: true,
    token: ls.get('mwp_token'),
    user: ls.get('mwp_user'),
    data: null,
    dark: ls.get('mwp_dark') === true,
    sync: 'saved', // saved | saving | offline
    tab: 'today', selDay: dowIdx(today()), sheet: null, sheetDay: 0,
    authMode: 'login', aName: '', aEmail: '', aPass: '', aError: '', busy: false,
    bName: '', bEx: [],
    toast: ''
  };

  // ---------- API ----------
  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    const res = await fetch(API + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let json = {};
    try { json = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok) { const err = new Error(json.error || ('Request failed (' + res.status + ')')); err.status = res.status; throw err; }
    return json;
  }
  const cacheKey = () => 'mwp_cache_' + (S.user ? S.user.email : 'none');
  function saveCache(dirty) { ls.set(cacheKey(), { data: S.data, dirty: !!dirty }); }

  let saveTimer = null;
  function persist() {
    saveCache(true);
    S.sync = 'saving';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushNow, 700);
  }
  async function pushNow() {
    if (!S.token || !S.data) return;
    try {
      await api('/api/data', { method: 'PUT', body: { data: S.data } });
      saveCache(false);
      S.sync = 'saved';
    } catch (e) {
      if (e.status === 401) return forceLogout('Your session expired. Please log in again.');
      S.sync = 'offline';
    }
    renderHeaderSync();
  }
  window.addEventListener('online', () => { if (S.sync === 'offline') pushNow(); });

  async function bootstrap() {
    if (!S.token || !S.user) { S.boot = false; return render(); }
    const cached = ls.get(cacheKey());
    if (cached && cached.data) { S.data = normalize(cached.data); S.boot = false; render(); }
    try {
      const me = await api('/api/me');
      S.user = me.user; ls.set('mwp_user', me.user);
      if (cached && cached.dirty && cached.data) { S.data = normalize(cached.data); pushNow(); }
      else { S.data = normalize(me.data); saveCache(false); S.sync = 'saved'; }
    } catch (e) {
      if (e.status === 401) return forceLogout('Please log in again.');
      if (!S.data) S.data = normalize(cached && cached.data);
      S.sync = 'offline';
    }
    S.boot = false; render();
  }

  async function submitAuth() {
    if (S.busy) return;
    const email = S.aEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { S.aError = 'Enter a valid email address.'; return render(); }
    if (S.authMode === 'signup') {
      if (!S.aName.trim()) { S.aError = 'Tell us your name.'; return render(); }
      if (S.aPass.length < 6) { S.aError = 'Password needs at least 6 characters.'; return render(); }
    } else if (!S.aPass) { S.aError = 'Enter your password.'; return render(); }
    S.busy = true; S.aError = ''; render();
    try {
      const r = S.authMode === 'signup'
        ? await api('/api/signup', { method: 'POST', body: { name: S.aName.trim(), email, password: S.aPass, data: freshData() } })
        : await api('/api/login', { method: 'POST', body: { email, password: S.aPass } });
      S.token = r.token; S.user = r.user;
      ls.set('mwp_token', r.token); ls.set('mwp_user', r.user);
      S.data = normalize(r.data); saveCache(false); S.sync = 'saved';
      Object.assign(S, { aName: '', aEmail: '', aPass: '', tab: 'today', selDay: dowIdx(today()), sheet: null });
    } catch (e) {
      S.aError = e.status ? e.message : 'Can’t reach the server. Check your internet connection.';
    }
    S.busy = false; render();
  }

  async function logout() {
    clearTimeout(saveTimer);
    if (S.sync !== 'saved') { try { await api('/api/data', { method: 'PUT', body: { data: S.data } }); } catch (e) { /* keep cache */ } }
    try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    forceLogout('');
  }
  function forceLogout(msg) {
    ls.del('mwp_token'); ls.del('mwp_user');
    Object.assign(S, { token: null, user: null, data: null, sheet: null, authMode: 'login', aError: msg || '', aPass: '', boot: false });
    render();
  }

  // ---------- domain ----------
  const D = () => S.data;
  const unit = () => D().settings.unit || 'kg';
  const step = () => unit() === 'lb' ? 5 : 2.5;
  const tpl = id => D().templates.find(t => t.id === id) || null;
  const summary = t => t.exercises.length + ' exercises · ' + t.exercises.reduce((a, e) => a + e.sets, 0) + ' sets';
  function buildLog(t) {
    return { date: keyOf(today()), tplId: t ? t.id : null, exercises: t ? t.exercises.map(ex => ({
      name: ex.name, target: ex.sets + ' × ' + ex.reps + (ex.weight ? ' @ ' + ex.weight : ''),
      sets: Array.from({ length: ex.sets }, () => ({ reps: ex.reps, weight: ex.weight, done: false }))
    })) : [] };
  }
  function todayLog() {
    const d = D(); const tid = d.schedule[dowIdx(today())];
    if (!d.log || d.log.date !== keyOf(today()) || d.log.tplId !== tid) { d.log = buildLog(tpl(tid)); }
    return d.log;
  }
  function assign(day, id) {
    D().schedule[day] = id;
    if (day === dowIdx(today())) D().log = buildLog(tpl(id));
    S.sheet = null; S.selDay = day; persist(); render();
  }
  function finishWorkout() {
    const d = D(); const log = todayLog();
    let sets = 0, reps = 0, vol = 0;
    log.exercises.forEach(ex => ex.sets.forEach(s => { if (s.done) { sets++; reps += s.reps; vol += s.reps * s.weight; } }));
    if (!sets) { toast('Tick off at least one set first.'); return; }
    const top = log.exercises.map(ex => {
      const dn = ex.sets.filter(s => s.done); if (!dn.length) return null;
      const b = dn.reduce((a, x) => (x.weight > a.weight || (x.weight === a.weight && x.reps > a.reps)) ? x : a);
      return ex.name + ' ' + wLabel(b.weight) + ' × ' + b.reps;
    }).filter(Boolean).join(' · ');
    const t = tpl(log.tplId);
    const best = Math.max(0, ...d.history.map(h => h.vol || 0));
    d.history.unshift({ id: uid(), date: keyOf(today()), name: t ? t.name : 'Workout', sets, reps, vol, pr: vol > best && d.history.length > 0, top, unit: unit() });
    log.exercises.forEach(ex => {
      const dn = ex.sets.filter(s => s.done);
      if (dn.length) d.lastPerf[ex.name] = { date: keyOf(today()), sets: dn.map(s => [s.weight, s.reps]) };
    });
    d.log = buildLog(t);
    S.tab = 'history'; persist(); render(); toast('Workout saved.');
  }
  function saveBuilt() {
    const exs = S.bEx.filter(b => b.name.trim());
    if (!exs.length) { toast('Add at least one exercise with a name.'); return; }
    const t = { id: 'c' + uid(), name: S.bName.trim() || 'My Workout', custom: true,
      exercises: exs.map(b => ({ name: b.name.trim(), sets: b.sets, reps: b.reps, weight: b.weight })) };
    D().templates.push(t);
    assign(S.sheetDay, t.id);
    toast('“' + t.name + '” saved to My workouts.');
  }
  function deleteTemplate(id) {
    const d = D();
    d.templates = d.templates.filter(t => t.id !== id);
    d.schedule = d.schedule.map(s => s === id ? null : s);
    if (d.log && d.log.tplId === id) d.log = null;
    persist(); render();
  }

  let toastTimer = null;
  function toast(msg) { S.toast = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2400); }

  // ---------- views ----------
  function themeBtn() {
    return '<button class="iconbtn" data-act="theme" aria-label="' + (S.dark ? 'Switch to light mode' : 'Switch to dark mode') + '">' + (S.dark ? ICON.sun : ICON.moon) + '</button>';
  }
  function syncHtml() {
    const t = { saved: 'Saved', saving: 'Saving…', offline: 'Offline · will sync' }[S.sync];
    return '<span class="sync ' + S.sync + '" id="sync"><span class="dot"></span>' + t + '</span>';
  }
  function renderHeaderSync() { const el = document.getElementById('sync'); if (el) el.outerHTML = syncHtml(); }

  function viewAuth() {
    const signup = S.authMode === 'signup';
    return '<div class="content" style="padding:12px 24px 32px;display:flex;flex-direction:column;gap:20px">' +
      '<div class="row"><div class="brand cond">myWorkoutPal</div>' + themeBtn() + '</div>' +
      '<div style="margin-top:28px;display:flex;flex-direction:column;gap:12px">' +
        '<h1 class="authhero cond"><span>Plan it.</span><span>Lift it.</span><span>Log it.</span></h1>' +
        '<p style="margin:0;font-size:16px;line-height:1.5" class="text2">Schedule your workouts, follow your plan and track every set, rep and kilo.</p></div>' +
      '<div class="seg"><button data-act="mode" data-v="login" class="' + (signup ? '' : 'on') + '" aria-pressed="' + !signup + '">Log in</button>' +
        '<button data-act="mode" data-v="signup" class="' + (signup ? 'on' : '') + '" aria-pressed="' + signup + '">Create account</button></div>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' +
        (signup ? '<div class="field"><label for="a-name">Your name</label><input class="input" id="a-name" data-field="aName" autocomplete="name" value="' + esc(S.aName) + '" placeholder="e.g. Hari"></div>' : '') +
        '<div class="field"><label for="a-email">Email</label><input class="input" id="a-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" data-field="aEmail" value="' + esc(S.aEmail) + '" placeholder="you@example.com"></div>' +
        '<div class="field"><label for="a-pass">Password</label><input class="input" id="a-pass" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" data-field="aPass" value="' + esc(S.aPass) + '" placeholder="' + (signup ? 'At least 6 characters' : 'Your password') + '"></div>' +
        (S.aError ? '<div class="error" role="alert">' + esc(S.aError) + '</div>' : '') +
        '<button class="btn-primary" data-act="auth"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Please wait…' : (signup ? 'Create account' : 'Log in')) + '</button>' +
        '<p style="margin:0;font-size:13px;line-height:1.5;text-align:center" class="muted">Your workouts are saved to your account, so you can log in on any phone and get them back.</p>' +
      '</div></div>';
  }

  function viewHeader() {
    const initials = S.user.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    return '<header class="header"><div class="brand cond">myWorkoutPal ' + syncHtml() + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center"><button class="avatar" data-act="sheet" data-v="profile" aria-label="Your account">' + esc(initials) + '</button>' + themeBtn() + '</div></header>';
  }

  function viewToday() {
    const d = D(); const t = tpl(d.schedule[dowIdx(today())]); const log = todayLog(); const u = unit();
    const first = esc(S.user.name.split(' ')[0]);
    let h = '<div class="stack"><div class="row" style="align-items:flex-end"><div style="min-width:0"><div class="eyebrow">Hi ' + first + ' · ' + fmtDay(today()) + '</div>' +
      '<h1 class="h1 cond">' + esc(t ? t.name : 'Rest Day') + '</h1></div><button class="pill" data-act="picker" data-v="' + dowIdx(today()) + '">Change</button></div>';
    if (!t) {
      return h + '<div class="card" style="padding:24px;gap:14px;align-items:flex-start"><div style="font-weight:700;font-size:18px">No workout scheduled</div>' +
        '<div class="text2" style="font-size:15px;line-height:1.5">Pick one of your saved workouts, or build a new one to follow today.</div>' +
        '<button class="btn-primary" data-act="picker" data-v="' + dowIdx(today()) + '">Choose a workout</button></div></div>';
    }
    let done = 0, total = 0, vol = 0, reps = 0;
    log.exercises.forEach(ex => ex.sets.forEach(s => { total++; if (s.done) { done++; vol += s.reps * s.weight; reps += s.reps; } }));
    const pct = total ? Math.round(done / total * 100) : 0;
    h += '<div class="row"><div class="progress"><div style="width:' + pct + '%"></div></div><div class="text2" style="font-size:13px;font-weight:600">' + done + '/' + total + ' sets</div></div>' +
      '<div class="grid3"><div class="stat"><div class="label">Volume</div><div class="v cond">' + fmtNum(vol) + '</div></div>' +
      '<div class="stat"><div class="label">Reps</div><div class="v cond">' + reps + '</div></div>' +
      '<div class="stat"><div class="label">Exercises</div><div class="v cond">' + log.exercises.length + '</div></div></div>';
    log.exercises.forEach((ex, ei) => {
      const last = d.lastPerf[ex.name];
      let lastSum = 'First time';
      if (last && last.sets.length) {
        const b = last.sets.reduce((a, x) => (x[0] > a[0] || (x[0] === a[0] && x[1] > a[1])) ? x : a);
        lastSum = last.sets.length + ' sets · best ' + (b[0] === 0 ? 'BW' : b[0] + ' ' + u) + ' × ' + b[1];
      }
      h += '<div class="card"><div class="ex-head"><div style="min-width:0"><h2 class="ex-name">' + esc(ex.name) + '</h2><div class="muted" style="font-size:12px;margin-top:2px">Target ' + esc(ex.target) + '</div></div>' +
        '<div style="text-align:right;flex:0 0 auto"><div class="label">' + (last ? 'Last · ' + fmtDay(parseKey(last.date)) : 'No history') + '</div><div class="text2" style="font-size:13px;font-weight:700;margin-top:2px">' + esc(lastSum) + '</div></div></div>' +
        '<div class="setgrid label"><div>Set</div><div style="text-align:center">Prev</div><div style="text-align:center">' + u + '</div><div style="text-align:center">Reps</div><div style="text-align:center">Done</div></div>';
      ex.sets.forEach((s, si) => {
        const p = last ? last.sets[si] : null;
        const beat = p && s.done && (s.weight > p[0] || (s.weight === p[0] && s.reps > p[1]));
        const a = ' data-e="' + ei + '" data-s="' + si + '"';
        h += '<div class="setgrid setrow' + (s.done ? ' done' : '') + '"><div class="setnum cond">' + (si + 1) + '</div>' +
          '<button class="prev' + (p ? '' : ' none') + '" data-act="useprev"' + a + ' aria-label="' + (p ? 'Previous ' + wLabel(p[0]) + ' × ' + p[1] + ', tap to copy' : 'No previous set') + '">' +
            '<span>' + (p ? wLabel(p[0]) + ' × ' + p[1] : '—') + '</span>' + (beat ? '<span class="up" aria-hidden="true">↑</span>' : '') + '</button>' +
          '<div class="stepper"><button data-act="w-"' + a + ' aria-label="Decrease weight">−</button><div class="val">' + wLabel(s.weight) + '</div><button data-act="w+"' + a + ' aria-label="Increase weight">+</button></div>' +
          '<div class="stepper"><button data-act="r-"' + a + ' aria-label="Decrease reps">−</button><div class="val">' + s.reps + '</div><button data-act="r+"' + a + ' aria-label="Increase reps">+</button></div>' +
          '<button class="check' + (s.done ? ' on' : '') + '" data-act="done"' + a + ' aria-label="' + (s.done ? 'Undo set ' : 'Mark set ') + (si + 1) + ' done">' + ICON.check + '</button></div>';
      });
      h += '<button class="btn-dashed sm" data-act="addset" data-e="' + ei + '">+ Add set</button></div>';
    });
    h += '<button class="btn-primary" style="min-height:56px;font-size:17px" data-act="finish"' + (done ? '' : ' disabled') + '>Finish workout</button></div>';
    return h;
  }

  function viewPlan() {
    const d = D(); const ws = weekStart(today()); const ti = dowIdx(today()); const u = unit();
    const doneKeys = new Set(d.history.map(h => h.date));
    const dates = DOW.map((_, i) => { const x = new Date(ws); x.setDate(ws.getDate() + i); return x; });
    const status = i => {
      const t = tpl(d.schedule[i]);
      if (i < ti) return doneKeys.has(keyOf(dates[i])) ? 'Done' : (t ? 'Missed' : 'Rest');
      if (i === ti) return doneKeys.has(keyOf(dates[i])) ? 'Done' : 'Today';
      return t ? 'Planned' : 'Rest';
    };
    const end = dates[6];
    let h = '<div class="stack"><div><div class="eyebrow">' + dates[0].getDate() + ' ' + MON[dates[0].getMonth()] + ' – ' + end.getDate() + ' ' + MON[end.getMonth()] + '</div><h1 class="h1 cond">This Week</h1></div><div class="days">';
    dates.forEach((x, i) => {
      const st = status(i); const t = tpl(d.schedule[i]);
      const dot = st === 'Done' ? 'done' : (t ? 'planned' : '');
      h += '<button class="day' + (i === ti ? ' today' : '') + (i === S.selDay ? ' sel' : '') + '" data-act="selday" data-v="' + i + '" aria-label="' + DOW[i] + ' ' + x.getDate() + ' ' + MON[x.getMonth()] + ' · ' + esc(t ? t.name : 'Rest') + '">' +
        '<span class="dow">' + DOW[i] + '</span><span class="num cond">' + x.getDate() + '</span><span class="dot ' + dot + '"></span></button>';
    });
    const st = tpl(d.schedule[S.selDay]);
    h += '</div><div class="card" style="padding:18px;gap:12px"><div class="row"><div style="min-width:0"><div class="label" style="font-size:12px">' + fmtDay(dates[S.selDay]) + ' · ' + status(S.selDay) + '</div>' +
      '<h2 class="h2c cond">' + esc(st ? st.name : 'Rest') + '</h2></div><button class="pill" data-act="picker" data-v="' + S.selDay + '">' + (st ? 'Change' : 'Choose') + '</button></div>';
    if (st) st.exercises.forEach(x => { h += '<div class="planitem"><div style="font-weight:600;font-size:15px">' + esc(x.name) + '</div><div class="text2" style="font-size:14px">' + x.sets + ' × ' + x.reps + (x.weight ? ' · ' + x.weight + ' ' + u : '') + '</div></div>'; });
    else h += '<div class="planitem text2" style="font-size:15px">Rest day — no workout assigned.</div>';
    if (st && S.selDay === ti) h += '<button class="btn-ink" data-act="tab" data-v="today">Start today’s workout</button>';
    h += '<div class="muted" style="font-size:12px">Your plan repeats every week.</div></div>';
    h += '<div class="row" style="align-items:baseline;margin-top:8px"><h2 class="cond upper" style="margin:0;font-weight:800;font-size:26px">My workouts</h2><div class="muted" style="font-size:13px">' + d.templates.length + ' saved</div></div>';
    d.templates.forEach(t => {
      h += '<div class="lib"><div style="min-width:0"><div style="font-weight:700;font-size:15px">' + esc(t.name) + '</div><div class="muted" style="font-size:13px">' + summary(t) + '</div></div>' +
        (t.custom ? '<div style="display:flex;align-items:center;gap:4px"><span class="chip">Custom</span><button class="mini-del" data-act="deltpl" data-v="' + esc(t.id) + '" aria-label="Delete ' + esc(t.name) + '">' + ICON.trash + '</button></div>' : '') + '</div>';
    });
    h += '<button class="btn-dashed" data-act="builder" data-v="' + S.selDay + '">+ Create new workout</button></div>';
    return h;
  }

  function viewHistory() {
    const d = D(); const ws = weekStart(today());
    const weeks = [];
    for (let i = 5; i >= 0; i--) { const s = new Date(ws); s.setDate(ws.getDate() - i * 7); weeks.push({ start: s, vol: 0 }); }
    d.history.forEach(hh => {
      const k = weekStart(parseKey(hh.date)).getTime();
      const w = weeks.find(x => x.start.getTime() === k); if (w) w.vol += hh.vol || 0;
    });
    const max = Math.max(1, ...weeks.map(w => w.vol));
    let h = '<div class="stack"><div><div class="eyebrow">Your log</div><h1 class="h1 cond">History</h1></div>' +
      '<div class="hero"><div class="row" style="align-items:baseline"><div class="label" style="font-size:12px">Weekly volume (' + unit() + ')</div><div class="cond" style="font-weight:700;font-size:22px">' + fmtNum(weeks[5].vol) + '</div></div><div class="bars">';
    weeks.forEach((w, i) => { h += '<div class="bar' + (i === 5 ? ' cur' : '') + '"><div style="height:' + Math.max(6, Math.round(w.vol / max * 64)) + 'px"></div><span>' + w.start.getDate() + ' ' + MON[w.start.getMonth()] + '</span></div>'; });
    h += '</div></div>';
    if (!d.history.length) h += '<div class="card" style="padding:24px"><div style="font-weight:700;font-size:17px">No workouts logged yet</div><div class="text2" style="font-size:15px;line-height:1.5">Finish your first workout on the Today tab and it will show up here.</div></div>';
    d.history.slice(0, 100).forEach(hh => {
      h += '<div class="card"><div class="row"><div><div class="muted" style="font-size:12px">' + fmtDay(parseKey(hh.date)) + '</div><div style="font-weight:700;font-size:17px">' + esc(hh.name) + '</div></div>' + (hh.pr ? '<span class="chip accent" style="font-size:12px">PR</span>' : '') + '</div>' +
        '<div class="grid3"><div><div class="label">Sets</div><div style="font-weight:700">' + hh.sets + '</div></div><div><div class="label">Reps</div><div style="font-weight:700">' + hh.reps + '</div></div><div><div class="label">Volume</div><div style="font-weight:700">' + fmtNum(hh.vol) + ' ' + esc(hh.unit || unit()) + '</div></div></div>' +
        '<div class="text2" style="font-size:13px;line-height:1.5">' + esc(hh.top) + '</div></div>';
    });
    return h + '</div>';
  }

  function viewTabbar() {
    const tb = (id, label, icon) => '<button class="tab' + (S.tab === id ? ' on' : '') + '" data-act="tab" data-v="' + id + '"' + (S.tab === id ? ' aria-current="page"' : '') + '>' + icon + '<span>' + label + '</span></button>';
    return '<nav class="tabbar" aria-label="Main">' + tb('plan', 'Plan', ICON.plan) + tb('today', 'Today', ICON.lift) + tb('history', 'History', ICON.hist) + '</nav>';
  }

  function viewPicker() {
    const d = D(); const day = S.sheetDay; const ws = weekStart(today()); const x = new Date(ws); x.setDate(ws.getDate() + day);
    let h = '<div class="overlay" data-act="overlay"><div class="sheet" role="dialog" aria-label="Choose a workout">' +
      '<div class="row" style="margin-bottom:6px"><div><div class="label" style="font-size:12px">' + 'Every ' + DOWL[day] + ' · from ' + fmtDay(x) + '</div><h2 class="h2c cond">Choose a workout</h2></div><button class="closebtn" data-act="close" aria-label="Close">' + ICON.close + '</button></div>';
    d.templates.forEach(t => {
      const cur = d.schedule[day] === t.id;
      h += '<button class="pick' + (cur ? ' cur' : '') + '" data-act="assign" data-v="' + esc(t.id) + '"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:700;font-size:16px">' + esc(t.name) + '</span><span class="muted" style="font-size:13px">' + summary(t) + '</span></span>' + (cur ? '<span class="chip accent">Selected</span>' : '') + '</button>';
    });
    return h + '<button class="btn-outline" data-act="assign" data-v="">Make it a rest day</button><button class="btn-primary" data-act="builder" data-v="' + day + '">+ Create new workout</button></div></div>';
  }

  function viewBuilder() {
    const u = unit();
    let h = '<div class="full" role="dialog" aria-label="Create workout"><div class="row" style="padding:20px 20px 8px"><button class="linkbtn" style="text-decoration:none" data-act="close">Cancel</button>' +
      '<div style="font-weight:700;font-size:16px">New workout</div><button class="avatar" style="width:auto;height:40px;padding:0 16px;border-radius:999px;font-size:15px" data-act="savebuilt">Save</button></div>' +
      '<div class="content" style="padding:8px 20px 32px;display:flex;flex-direction:column;gap:14px">' +
      '<div class="field"><label for="b-name">Workout name</label><input class="input" id="b-name" data-field="bName" value="' + esc(S.bName) + '" placeholder="e.g. Full Body A" style="font-size:18px;font-weight:600"></div>' +
      '<div class="text2" style="font-size:13px">Scheduled every ' + DOWL[S.sheetDay] + ' · also saved to My workouts</div>';
    S.bEx.forEach((b, i) => {
      const a = ' data-i="' + i + '"';
      const st = (k, lbl, val) => '<div style="display:flex;flex-direction:column;gap:4px"><div class="label" style="text-align:center">' + lbl + '</div><div class="stepper"><button data-act="b' + k + '-"' + a + ' aria-label="Less ' + lbl + '">−</button><div class="val">' + val + '</div><button data-act="b' + k + '+"' + a + ' aria-label="More ' + lbl + '">+</button></div></div>';
      h += '<div class="card" style="padding:14px"><div style="display:flex;gap:8px;align-items:center"><label for="bx-' + b.key + '" class="cond" style="font-weight:700;font-size:20px;width:20px">' + (i + 1) + '</label>' +
        '<input class="input sm" id="bx-' + b.key + '" data-field="bex" data-i="' + i + '" value="' + esc(b.name) + '" placeholder="Exercise name">' +
        '<button class="iconbtn" style="border:0;background:transparent;color:var(--muted)" data-act="brm"' + a + ' aria-label="Remove exercise">' + ICON.trash + '</button></div>' +
        '<div class="grid3">' + st('s', 'Sets', b.sets) + st('r', 'Reps', b.reps) + st('w', u, wLabel(b.weight)) + '</div></div>';
    });
    h += '<button class="btn-dashed" data-act="badd" data-v="">+ Add exercise</button><div style="display:flex;flex-direction:column;gap:8px"><div class="label" style="font-size:12px">Quick add</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
    QUICK.forEach(q => { h += '<button class="qchip" data-act="badd" data-v="' + esc(q) + '">+ ' + esc(q) + '</button>'; });
    return h + '</div></div></div></div>';
  }

  function viewProfile() {
    const initials = S.user.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const syncText = { saved: 'All changes saved to your account.', saving: 'Saving your latest changes…', offline: 'You’re offline. Changes are kept on this phone and will sync when you reconnect.' }[S.sync];
    return '<div class="overlay" data-act="overlay"><div class="sheet" role="dialog" aria-label="Your account" style="gap:16px">' +
      '<div class="row"><h2 class="h2c cond" style="margin:0">Your account</h2><button class="closebtn" data-act="close" aria-label="Close">' + ICON.close + '</button></div>' +
      '<div class="card" style="flex-direction:row;align-items:center;gap:14px"><div class="avatar" style="width:56px;height:56px;border-radius:28px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 auto">' + esc(initials) + '</div>' +
      '<div style="min-width:0"><div style="font-weight:700;font-size:17px">' + esc(S.user.name) + '</div><div class="muted" style="font-size:14px;overflow:hidden;text-overflow:ellipsis">' + esc(S.user.email) + '</div></div></div>' +
      '<div class="grid2"><div class="stat"><div class="label">Workouts logged</div><div class="v cond">' + D().history.length + '</div></div><div class="stat"><div class="label">Saved workouts</div><div class="v cond">' + D().templates.length + '</div></div></div>' +
      '<div class="field"><label>Weight unit</label><div class="seg"><button data-act="unit" data-v="kg" class="' + (unit() === 'kg' ? 'on' : '') + '">kg</button><button data-act="unit" data-v="lb" class="' + (unit() === 'lb' ? 'on' : '') + '">lb</button></div></div>' +
      '<div class="text2" style="font-size:13px;line-height:1.5">' + syncText + '</div>' +
      '<button class="btn-danger" data-act="logout">Log out</button></div></div>';
  }

  function render() {
    document.body.classList.toggle('dark', S.dark);
    root.classList.toggle('dark', S.dark);
    if (window.MWPAndroid && render.lastDark !== S.dark) { try { window.MWPAndroid.setDark(S.dark); } catch (e) { /* ignore */ } render.lastDark = S.dark; }
    const scrollEl = root.querySelector('.content');
    const prevScroll = scrollEl ? scrollEl.scrollTop : 0;
    const prevTab = root.dataset.view;
    const focused = document.activeElement && document.activeElement.id;
    let html, view;
    if (S.boot) { html = '<div class="splash cond">myWorkoutPal</div>'; view = 'boot'; }
    else if (!S.token || !S.data) { html = viewAuth(); view = 'auth'; }
    else {
      view = S.tab;
      html = viewHeader() + '<main class="content">' + (S.tab === 'today' ? viewToday() : S.tab === 'plan' ? viewPlan() : viewHistory()) + '</main>' + viewTabbar();
      if (S.sheet === 'picker') html += viewPicker();
      if (S.sheet === 'builder') html += viewBuilder();
      if (S.sheet === 'profile') html += viewProfile();
    }
    if (S.toast) html += '<div class="toast" role="status">' + esc(S.toast) + '</div>';
    root.innerHTML = html;
    root.dataset.view = view;
    const sc = root.querySelector('main.content');
    if (sc && prevTab === view) sc.scrollTop = prevScroll;
    if (focused) { const f = document.getElementById(focused); if (f && f.tagName === 'INPUT') { f.focus(); try { const l = f.value.length; f.setSelectionRange(l, l); } catch (e) { /* email inputs */ } } }
  }

  // ---------- events ----------
  root.addEventListener('input', e => {
    const el = e.target; const f = el.dataset.field; if (!f) return;
    if (f === 'bex') { S.bEx[+el.dataset.i].name = el.value; return; }
    S[f] = el.value;
    if (f[0] === 'a' && S.aError) { S.aError = ''; const er = root.querySelector('.error'); if (er) er.remove(); }
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.dataset && /^a/.test(e.target.dataset.field || '')) submitAuth();
  });
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, v = el.dataset.v;
    if (act === 'overlay' && e.target !== el) return; // clicks inside the sheet
    const ei = +el.dataset.e, si = +el.dataset.s, bi = +el.dataset.i;
    const setOf = () => todayLog().exercises[ei].sets[si];
    switch (act) {
      case 'theme': S.dark = !S.dark; ls.set('mwp_dark', S.dark); render(); return;
      case 'mode': S.authMode = v; S.aError = ''; render(); return;
      case 'auth': submitAuth(); return;
      case 'tab': S.tab = v; S.sheet = null; render(); root.querySelector('main.content') && (root.querySelector('main.content').scrollTop = 0); return;
      case 'sheet': S.sheet = v; render(); return;
      case 'overlay': case 'close': S.sheet = null; render(); return;
      case 'logout': logout(); return;
      case 'unit': D().settings.unit = v; persist(); render(); return;
      case 'selday': S.selDay = +v; render(); return;
      case 'picker': S.sheet = 'picker'; S.sheetDay = +v; render(); return;
      case 'assign': assign(S.sheetDay, v || null); return;
      case 'builder': S.sheet = 'builder'; S.sheetDay = +v; S.bName = ''; S.bEx = []; render(); return;
      case 'deltpl': deleteTemplate(v); return;
      case 'badd': S.bEx.push({ key: uid(), name: v || '', sets: 3, reps: 10, weight: 20 }); render(); if (!v) { const ins = root.querySelectorAll('[data-field="bex"]'); ins[ins.length - 1].focus(); } return;
      case 'brm': S.bEx.splice(bi, 1); render(); return;
      case 'bs+': S.bEx[bi].sets++; render(); return;
      case 'bs-': S.bEx[bi].sets = Math.max(1, S.bEx[bi].sets - 1); render(); return;
      case 'br+': S.bEx[bi].reps++; render(); return;
      case 'br-': S.bEx[bi].reps = Math.max(1, S.bEx[bi].reps - 1); render(); return;
      case 'bw+': S.bEx[bi].weight += step(); render(); return;
      case 'bw-': S.bEx[bi].weight = Math.max(0, S.bEx[bi].weight - step()); render(); return;
      case 'savebuilt': saveBuilt(); return;
      case 'w+': setOf().weight += step(); break;
      case 'w-': setOf().weight = Math.max(0, setOf().weight - step()); break;
      case 'r+': setOf().reps++; break;
      case 'r-': setOf().reps = Math.max(0, setOf().reps - 1); break;
      case 'done': setOf().done = !setOf().done; break;
      case 'useprev': {
        const ex = todayLog().exercises[ei]; const last = D().lastPerf[ex.name]; const p = last && last.sets[si];
        if (!p) return; setOf().weight = p[0]; setOf().reps = p[1]; break;
      }
      case 'addset': {
        const sets = todayLog().exercises[ei].sets; const pv = sets[sets.length - 1] || { reps: 8, weight: 20 };
        sets.push({ reps: pv.reps, weight: pv.weight, done: false }); break;
      }
      case 'finish': finishWorkout(); return;
      default: return;
    }
    persist(); render();
  });

  // Android back button (called from MainActivity). Returns true when handled.
  window.mwpBack = function () {
    if (S.sheet) { S.sheet = null; render(); return true; }
    if (S.token && S.tab !== 'today') { S.tab = 'today'; render(); return true; }
    return false;
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S.sync !== 'saved') pushNow(); });

  render();
  bootstrap();
})();
