/* NoNeang cloud sync — Supabase. Local-first: every save goes to localStorage at once,
   then is pushed to Supabase a moment later. On open, whichever copy is newer wins.
   The table keeps one row per user (whole document) + a daily snapshot in noneang_history. */
const Cloud = {
  sb: null, user: null, token: null, state: 'off', lastSync: null, timer: null, busy: false, pending: false,
  get enabled() { const c = window.NONEANG_CLOUD; return !!(c && c.url && c.key && window.supabase); },
  init() {
    if (!this.enabled) { this.state = 'off'; return; }
    const c = window.NONEANG_CLOUD;
    this.sb = window.supabase.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'noneang.auth' } });
    this.state = 'signedout';
    this.sb.auth.getSession().then(({ data }) => { if (data && data.session) { this.user = data.session.user; this.pull(); } else this.refreshUi(); });
    window.addEventListener('online', () => { if (this.user) this.pull(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.user) this.pull(); else if (document.visibilityState === 'hidden' && this.pending) this.push(); });
  },
  refreshUi() { if (typeof S !== 'undefined' && (S.view === 'me' || !db)) render(); else if (typeof renderLayer === 'function' && S.sheet && S.sheet.type === 'cloud') renderLayer(); },
  async login(email, password) {
    let r = await this.sb.auth.signInWithPassword({ email, password });
    if (r.error && /invalid login credentials/i.test(r.error.message)) {
      const su = await this.sb.auth.signUp({ email, password });
      if (su.error) { if (/already registered|exists/i.test(su.error.message)) throw new Error('WRONG_PW'); throw su.error; }
      if (!su.data.session) { if (su.data.user && su.data.user.identities && su.data.user.identities.length === 0) throw new Error('WRONG_PW'); throw new Error('CONFIRM_ON'); }
      r = su;
    } else if (r.error) throw r.error;
    this.user = r.data.user; await this.pull(true); return this.user;
  },
  async signOut() { if (this.pending) await this.push(); await this.sb.auth.signOut(); this.user = null; this.token = null; this.state = 'signedout'; this.refreshUi(); },
  summary() {
    try {
      const k = todayKey(); const t = totals(k); const pT = proteinTarget();
      let sug = null;
      try { const sc = suggestCombos(k, 'all'); const b = sc.combos[0];
        if (b) sug = { items: b.items.map((i) => ({ icon: i.food.icon, q: i.food.kind === 'sized' ? i.grams + 'g' : '×' + i.qty, name: i.food.name })), k: Math.round(b.sum.k), p: Math.round(b.sum.p) }; } catch (e) {}
      return { date: k, name: db.profile.name || '', goal: Math.round(goalOf(k)), eaten: Math.round(t.k), protein: Math.round(t.p), pT, fiber: Math.round(t.f), fT: FIBER, streak: streakInfo().cur, loggedToday: LOGGED(k), sug, at: new Date().toISOString() };
    } catch (e) { return null; }
  },
  queue() {
    if (!this.user) return; this.pending = true; this.state = 'syncing';
    clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 1500);
  },
  async push() {
    if (!this.user || !db) return; if (this.busy) { this.pending = true; return; }
    this.busy = true; this.pending = false; clearTimeout(this.timer);
    try {
      const row = { user_id: this.user.id, doc: db, summary: this.summary(), updated_at: db.updatedAt || new Date().toISOString() };
      const { data, error } = await this.sb.from('noneang_data').upsert(row, { onConflict: 'user_id' }).select('widget_token').single();
      if (error) throw error;
      this.token = data.widget_token; this.lastSync = new Date(); this.state = 'ok';
    } catch (e) { this.state = navigator.onLine === false ? 'offline' : 'error'; this.pending = true; this.err = e && e.message; }
    this.busy = false; if (this.pending && this.state === 'ok') this.queue();
    if (S.view === 'me') render();
  },
  async pull(fromLogin = false) {
    if (!this.user) return; this.state = 'syncing';
    try {
      const { data, error } = await this.sb.from('noneang_data').select('doc, updated_at, widget_token').eq('user_id', this.user.id).maybeSingle();
      if (error) throw error;
      if (!data) { if (db) await this.push(); else this.state = 'ok'; this.refreshUi(); return; }
      this.token = data.widget_token;
      const remote = data.doc; const rAt = remote.updatedAt || data.updated_at; const lAt = db && db.updatedAt;
      if (!db) { this.adopt(remote); }
      else if (fromLogin && db.entries.length && remote.entries.length && db.userId !== remote.userId) { S.sheet = { type: 'cloudPick', remote }; renderLayer(); }
      else if (!lAt || rAt > lAt) this.adopt(remote);
      else if (lAt > rAt) await this.push();
      this.lastSync = new Date(); this.state = 'ok';
    } catch (e) { this.state = navigator.onLine === false ? 'offline' : 'error'; this.err = e && e.message; }
    this.refreshUi();
  },
  adopt(remote) {
    db = remote; db.rewards = db.rewards || []; db.seenRecap = db.seenRecap || {};
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
    if (typeof S !== 'undefined') { if (!['today', 'week', 'me', 'log', 'stickers', 'reward', 'recap'].includes(S.view)) S.view = 'today'; render(); }
  },
  widgetScript() {
    const c = window.NONEANG_CLOUD; const base = location.origin + location.pathname.replace(/[^/]*$/, '') + 'w/';
    return `// NoNeang widget for Scriptable · small = ตัวเลข 2 อย่าง · medium = + กินต่อได้ + streak
const URL = ${JSON.stringify(c.url)};
const KEY = ${JSON.stringify(c.key)};
const TOKEN = ${JSON.stringify(this.token || '')};
const ASSETS = ${JSON.stringify(base)};
const APP = ${JSON.stringify(base.replace(/w\/$/, ''))};
` + WIDGET_BODY;
  },

};

const WIDGET_BODY = String.raw`
const Y = new Color('#FFD000'), Y2 = new Color('#FFE04D'), YL = new Color('#FFF3B0'), CREAM = new Color('#FFF8D6');
const INK = new Color('#1F1F1F'), MUT = new Color('#6B6B6B'), WHITE = Color.white(), LINE = new Color('#F1EEE6');
const fm = FileManager.local(); const dir = fm.joinPath(fm.cacheDirectory(), 'noneang'); if (!fm.fileExists(dir)) fm.createDirectory(dir);
async function img(name) {
  const p = fm.joinPath(dir, name + '.png');
  if (fm.fileExists(p)) return fm.readImage(p);
  try { const i = await new Request(ASSETS + name + '.png').loadImage(); fm.writeImage(p, i); return i; } catch (e) { return null; }
}
async function load() {
  const r = new Request(URL + '/rest/v1/rpc/get_widget'); r.method = 'POST';
  r.headers = { apikey: KEY, 'Content-Type': 'application/json' }; r.body = JSON.stringify({ p_token: TOKEN });
  try { const d = await r.loadJSON(); if (d && d.date) { fm.writeString(fm.joinPath(dir, 'last.json'), JSON.stringify(d)); return d; } } catch (e) {}
  const lp = fm.joinPath(dir, 'last.json'); return fm.fileExists(lp) ? JSON.parse(fm.readString(lp)) : null;
}
function ring(size, pct) {
  const s = size * 3, lw = s * 0.17, ctx = new DrawContext(); ctx.size = new Size(s, s); ctx.opaque = false; ctx.respectScreenScale = false;
  const r = (s - lw) / 2, cx = s / 2, cy = s / 2;
  ctx.setStrokeColor(YL); ctx.setLineWidth(lw); ctx.strokeEllipse(new Rect(lw / 2, lw / 2, s - lw, s - lw));
  pct = Math.max(0, Math.min(1, pct));
  if (pct > 0.01) { const path = new Path(); const n = Math.max(2, Math.round(80 * pct)); const pts = [];
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + 2 * Math.PI * pct * i / n; pts.push(new Point(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
    path.addLines(pts); ctx.addPath(path); ctx.setStrokeColor(Y); ctx.setLineWidth(lw); ctx.strokePath();
    for (const pt of [pts[0], pts[pts.length - 1]]) { ctx.setFillColor(Y); ctx.fillEllipse(new Rect(pt.x - lw / 2, pt.y - lw / 2, lw, lw)); } }
  return ctx.getImage();
}
function tile(size, pct, chick) {
  const s = size * 3, ctx = new DrawContext(); ctx.size = new Size(s, s); ctx.opaque = false; ctx.respectScreenScale = false; const rr = s * 0.32;
  let p = new Path(); p.addRoundedRect(new Rect(0, 0, s, s), rr, rr); ctx.addPath(p); ctx.setFillColor(new Color('#FFF1EA')); ctx.fillPath();
  pct = Math.max(0, Math.min(1, pct)); if (pct > 0.02) { const h = s * pct; p = new Path(); p.addRoundedRect(new Rect(0, s - h, s, h), Math.min(rr, h / 2), Math.min(rr, h / 2)); ctx.addPath(p); ctx.setFillColor(new Color('#FFC4A3')); ctx.fillPath(); }
  if (chick) ctx.drawImageInRect(chick, new Rect(s * 0.19, s * 0.19, s * 0.62, s * 0.62));
  return ctx.getImage();
}
function bg(w, h, cx, cy, r) {
  const ctx = new DrawContext(); ctx.size = new Size(w, h); ctx.opaque = true; ctx.setFillColor(Y); ctx.fillRect(new Rect(0, 0, w, h));
  ctx.setFillColor(Y2); ctx.fillEllipse(new Rect(cx - r, cy - r, 2 * r, 2 * r)); return ctx.getImage();
}
function text(st, s, size, color = INK, bold = true) { const t = st.addText(String(s)); t.font = bold ? Font.boldRoundedSystemFont(size) : Font.semiboldRoundedSystemFont(size); t.textColor = color; t.lineLimit = 1; t.minimumScaleFactor = 0.6; return t; }
function numRow(st, icon, num, unit, isz, nsz) {
  const r = st.addStack(); r.layoutHorizontally(); r.centerAlignContent();
  const im = r.addImage(icon); im.imageSize = new Size(isz, isz); r.addSpacer(8);
  text(r, num, nsz); r.addSpacer(3); const u = r.addStack(); u.layoutVertically(); u.addSpacer(nsz * 0.28); text(u, unit, nsz * 0.48, MUT); r.addSpacer();
}
function divider(st) { const d = st.addStack(); d.size = new Size(0, 1); d.backgroundColor = LINE; d.addSpacer(); }

const d = await load(); const now = new Date(); const pad = (n) => String(n).padStart(2, '0');
const tk = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
const fam = config.widgetFamily || 'medium';
const w = new ListWidget(); w.setPadding(10, 12, 12, 12);
let chick = await img('plain-chicken'); if (!chick) chick = await img('icon-chicken'); if (!chick) { const sf = SFSymbol.named('fork.knife'); sf.applyBoldWeight(); chick = sf.image; }
if (!d) { w.backgroundColor = Y; text(w, 'NoNeang', 14); w.addSpacer(4); text(w, 'เปิดแอปแล้วกดซิงก์ก่อนนะ', 12, MUT, false); }
else {
  const fresh = d.date === tk; const eaten = fresh ? d.eaten : 0; const prot = fresh ? d.protein : 0;
  const left = d.goal - eaten; const need = Math.max(0, d.pT - prot);
  const kTxt = left >= 0 ? left.toLocaleString('en-US') : '+' + (-left).toLocaleString('en-US');
  const kUnit = left >= 0 ? 'kcal' : 'เกิน';
  const pTxt = need > 0 ? String(need) : 'ครบ'; const pUnit = need > 0 ? 'g' : '✓';
  const evening = now.getHours() >= 19;
  if (fam === 'small') {
    w.backgroundImage = bg(170, 170, 150, 10, 56);
    const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent(); top.size = new Size(0, 46);
    top.addSpacer(4); text(top, 'วันนี้เหลือ', 13); top.addSpacer();
    const m = await img(evening && !d.loggedToday ? 'mascot-sleepy' : 'mascot-happy'); if (m) { const mi = top.addImage(m); mi.imageSize = new Size(46, 46); }
    w.addSpacer();
    const card = w.addStack(); card.layoutVertically(); card.backgroundColor = WHITE; card.cornerRadius = 22; card.setPadding(10, 12, 10, 12);
    numRow(card, ring(34, eaten / d.goal), kTxt, kUnit, 32, 25); card.addSpacer(7); divider(card); card.addSpacer(7);
    numRow(card, tile(34, prot / d.pT, chick), pTxt, pUnit, 32, 25);
  } else {
    w.backgroundImage = bg(364, 170, 350, 0, 70);
    const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
    const m = await img(evening && !d.loggedToday ? 'mascot-sleepy' : 'mascot-wave'); if (m) { const mi = top.addImage(m); mi.imageSize = new Size(36, 36); }
    top.addSpacer(6); text(top, 'วันนี้เหลือ', 14); top.addSpacer();
    const pill = top.addStack(); pill.backgroundColor = WHITE; pill.cornerRadius = 11; pill.setPadding(3, 6, 3, 9); pill.centerAlignContent();
    const fl = await img('plain-flame'); if (fl) { const fi = pill.addImage(fl); fi.imageSize = new Size(15, 15); } pill.addSpacer(2); text(pill, d.streak + ' วัน', 12);
    w.addSpacer(6);
    const body = w.addStack(); body.layoutHorizontally();
    const L = body.addStack(); L.layoutVertically(); L.backgroundColor = WHITE; L.cornerRadius = 22; L.setPadding(10, 12, 10, 8); L.size = new Size(150, 0);
    L.addSpacer(); numRow(L, ring(34, eaten / d.goal), kTxt, kUnit, 32, 26); L.addSpacer(); divider(L); L.addSpacer(); numRow(L, tile(34, prot / d.pT, chick), pTxt, pUnit, 32, 26); L.addSpacer();
    body.addSpacer(8);
    const R = body.addStack(); R.layoutVertically(); R.backgroundColor = CREAM; R.cornerRadius = 22; R.setPadding(10, 12, 10, 10);
    if (fresh && d.sug && d.sug.items && d.sug.items.length && left > 60) {
      text(R, 'กินต่อได้ ≈', 12); R.addSpacer(6);
      const row = R.addStack(); row.layoutHorizontally();
      for (const it of d.sug.items.slice(0, 3)) {
        const col = row.addStack(); col.layoutVertically(); col.centerAlignContent();
        const ic = await img('icon-' + it.icon) || await img('icon-snack'); if (ic) { const ii = col.addImage(ic); ii.imageSize = new Size(36, 36); }
        col.addSpacer(2); text(col, it.q, 10); row.addSpacer(6);
      }
      row.addSpacer(); R.addSpacer(); text(R, '≈ ' + d.sug.k + ' kcal · P +' + d.sug.p + ' g', 10, new Color('#5E4A00'), false);
    } else {
      const done = !fresh ? false : (left <= 60 || (need === 0 && left < 150));
      const msg = !fresh ? 'ยังไม่ได้จดวันนี้' : done ? (d.loggedToday ? 'วันนี้ครบแล้ว\nเก่งมาก' : 'วันนี้พอแล้ว\nกดจดครบนะ') : 'ยังกินได้อีก\nเปิดแอปดูว่าเติมอะไรดี';
      const mood = done ? (evening ? 'mascot-sleepy' : 'mascot-happy') : 'mascot-wave';
      R.addSpacer(); const c = R.addStack(); c.layoutHorizontally(); c.addSpacer();
      const m2 = await img(mood); if (m2) { const mi = c.addImage(m2); mi.imageSize = new Size(48, 48); } c.addSpacer();
      R.addSpacer(6); const tr = R.addStack(); tr.layoutHorizontally(); tr.addSpacer();
      const t1 = text(tr, msg, done || !fresh ? 15 : 13); t1.lineLimit = 2; t1.centerAlignText(); tr.addSpacer(); R.addSpacer();
    }
  }
}
w.url = APP; w.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else if (fam === 'small') await w.presentSmall(); else await w.presentMedium();
Script.complete();
`;
