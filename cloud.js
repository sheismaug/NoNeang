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
      return { date: k, name: db.profile.name || '', goal: Math.round(goalOf(k)), base: Math.round(goalOf(k)), eaten: Math.round(t.k), protein: Math.round(t.p), pT, fiber: Math.round(t.f), fT: FIBER, streak: streakInfo().cur, loggedToday: LOGGED(k), sug, at: new Date().toISOString() };
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
// สีพื้น widget: 'brand' (เหลือง + การ์ดขาว) | 'cream' | 'sand' | 'white' แล้วกดรันใหม่
const THEME = 'brand';
` + WIDGET_BODY;
  },

};

const WIDGET_BODY = String.raw`
const BRAND = THEME === 'brand';
const PAL = { brand: ['#FFD000', '#FFF3B0', '#FFF3B0'], white: ['#FFFFFF', '#FFF3B0', '#FFF3B0'], cream: ['#FFF8E3', '#FFEBA0', '#FFEBA0'], sand: ['#F4EFE4', '#FFE68A', '#FFFFFF'], yellow: ['#FFEFA3', '#FFFFFF', '#FFFFFF'] }[THEME] || ['#FFF8E3', '#FFEBA0', '#FFEBA0'];
const YEL = new Color('#FFD000'), TRACK = new Color(PAL[1]), PILL = new Color(PAL[2]), INK = new Color('#1F1F1F'), GREY = new Color('#857F72'), RED = new Color('#C2522E'), BGC = new Color(PAL[0]), WHITE = BGC;
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
const F = (s) => Font.boldRoundedSystemFont(s), FM = (s) => Font.semiboldRoundedSystemFont(s);
// ring with the three centred lines drawn inside (label / big number / unit)
function ringImg(size, pct, label, num, unit, numColor, rider) {
  const S = 3, s = size * S, lw = 12 * S, ctx = new DrawContext(); ctx.size = new Size(s, s); ctx.opaque = false; ctx.respectScreenScale = false;
  const rs = rider ? 28 * S : 0, m = rider ? rs / 2 - lw / 2 : 0;
  const r = (s - lw) / 2 - m, cx = s / 2, cy = s / 2;
  ctx.setStrokeColor(TRACK); ctx.setLineWidth(lw); ctx.strokeEllipse(new Rect(cx - r, cy - r, 2 * r, 2 * r));
  pct = Math.max(0, Math.min(1, pct));
  if (pct > 0.01) { const path = new Path(); const n = Math.max(2, Math.round(90 * pct)); const pts = [];
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + 2 * Math.PI * pct * i / n; pts.push(new Point(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
    path.addLines(pts); ctx.addPath(path); ctx.setStrokeColor(YEL); ctx.setLineWidth(lw); ctx.strokePath();
    for (const pt of [pts[0], pts[pts.length - 1]]) { ctx.setFillColor(YEL); ctx.fillEllipse(new Rect(pt.x - lw / 2, pt.y - lw / 2, lw, lw)); } }
  if (rider) { const a = -Math.PI / 2 + 2 * Math.PI * pct; const ex = cx + r * Math.cos(a), ey = cy + r * Math.sin(a);
    ctx.setFillColor(new Color('#000000', 0.12)); ctx.fillEllipse(new Rect(ex - rs / 2, ey - rs / 2 + 2 * S, rs, rs));
    ctx.setFillColor(Color.white()); ctx.fillEllipse(new Rect(ex - rs / 2, ey - rs / 2, rs, rs));
    const ri = rs * 0.86; ctx.drawImageInRect(rider, new Rect(ex - ri / 2, ey - ri / 2, ri, ri)); }
  const ns = (num.length > 5 ? 0.25 : 0.3) * size;
  ctx.setTextAlignedCenter();
  ctx.setFont(F(11 * S)); ctx.setTextColor(GREY); ctx.drawTextInRect(label, new Rect(0, cy - ns * S * 0.5 - 18 * S, s, 16 * S));
  ctx.setFont(F(ns * S)); ctx.setTextColor(numColor); ctx.drawTextInRect(num, new Rect(0, cy - ns * S * 0.62, s, ns * S * 1.3));
  ctx.setFont(F(11 * S)); ctx.setTextColor(GREY); ctx.drawTextInRect(unit, new Rect(0, cy + ns * S * 0.55, s, 16 * S));
  return ctx.getImage();
}
function bgImg(w, h, mascot, mx, my, ms) {
  const S = 3, ctx = new DrawContext(); ctx.size = new Size(w * S, h * S); ctx.opaque = true; ctx.respectScreenScale = false;
  ctx.setFillColor(WHITE); ctx.fillRect(new Rect(0, 0, w * S, h * S));
  if (BRAND) { ctx.setFillColor(new Color('#FFE45C')); for (let y = 7; y < h; y += 14) for (let x = (y / 14 % 2 ? 7 : 0); x < w; x += 14) ctx.fillEllipse(new Rect((x - 2) * S, (y - 2) * S, 4 * S, 4 * S)); }
  if (mascot) ctx.drawImageInRect(mascot, new Rect(mx * S, my * S, ms * S, ms * S));
  return ctx.getImage();
}
function t(st, s, font, color = INK) { const x = st.addText(String(s)); x.font = font; x.textColor = color; x.lineLimit = 1; x.minimumScaleFactor = 0.7; return x; }
function stamp(parent) {
  if (!d || !d.at) return; const at = new Date(d.at); const p2 = (n) => String(n).padStart(2, '0');
  const sameDay = at.toDateString() === new Date().toDateString();
  const s = parent.addStack(); s.layoutHorizontally(); s.addSpacer();
  t(s, 'อัปเดต ' + (sameDay ? '' : at.getDate() + '/' + (at.getMonth() + 1) + ' ') + p2(at.getHours()) + ':' + p2(at.getMinutes()), FM(9), GREY);
}
function centered(parent) { const r = parent.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.addSpacer(); return r; }
function proteinRow(parent, need, chick, sz) {
  const r = centered(parent);
  if (chick) { const ci = r.addImage(chick); ci.imageSize = BRAND ? new Size(sz + 9, sz + 9) : new Size(sz + 3, sz + 3); r.addSpacer(5); }
  if (need > 0) { t(r, 'เติมโปรตีนอีก ', FM(sz - 3), GREY); t(r, need, F(sz + 2)); t(r, ' g', FM(sz - 3), GREY); }
  else t(r, 'โปรตีนครบ ✓', F(sz));
  r.addSpacer(); return r;
}

const d = await load(); const now = new Date(); const pad = (n) => String(n).padStart(2, '0');
const tk = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
const fam = config.widgetFamily || 'medium'; const evening = now.getHours() >= 19;
const w = new ListWidget(); w.backgroundColor = WHITE;
let chick = BRAND ? await img('dot-protein') : await img('plain-chicken'); if (!chick) chick = await img('icon-chicken');
const riderImg = BRAND ? await img(evening && !(d && d.loggedToday) ? 'mascot-sleepy' : 'mascot-happy') : null;
if (!d) { w.setPadding(14, 14, 14, 14); t(w, 'NoNeang', F(15)); w.addSpacer(4); t(w, 'เปิดแอปแล้วกดซิงก์ก่อนนะ', FM(12), GREY); }
else {
  const fresh = d.date === tk; const eaten = fresh ? d.eaten : 0; const prot = fresh ? d.protein : 0;
  const goal = fresh ? d.goal : (d.base || d.goal); const left = goal - eaten; const need = Math.max(0, d.pT - prot);
  const over = left < 0;
  const label = over ? 'เกินมา' : 'กินได้อีก'; const num = (over ? '+' : '') + Math.abs(left).toLocaleString('en-US');
  const pct = goal ? eaten / goal : 0;
  // state for the right card / mascot
  let state = 'sug';
  if (!fresh) state = 'empty';
  else if (d.loggedToday) state = 'logged';
  else if (left <= 60 || (need === 0 && left < 150)) state = 'near';
  else if (!(d.sug && d.sug.items && d.sug.items.length)) state = 'more';
  const MSG = { empty: ['ยังไม่ได้จดวันนี้', 'กินอะไรแล้ว\nเปิดแอปจดเลย', 'mascot-wave'],
    logged: ['วันนี้จดครบแล้ว', 'เก่งมาก\nได้สติกเกอร์แล้ว', 'mascot-yay'],
    near: ['เกือบครบเป้าแล้ว', 'ก่อนนอนเปิดแอป\nกดปุ่ม “ครบแล้ว”', evening ? 'mascot-sleepy' : 'mascot-happy'],
    more: ['ยังกินได้อีก', 'เปิดแอปดูว่า\nเติมอะไรดี', 'mascot-wave'] };
  if (fam === 'small') {
    const m = await img(evening && !d.loggedToday ? 'mascot-sleepy' : 'mascot-happy');
    if (BRAND) {
      w.backgroundImage = bgImg(170, 170, null); w.setPadding(8, 8, 8, 8);
      const card = w.addStack(); card.layoutVertically(); card.backgroundColor = Color.white(); card.cornerRadius = 24; card.setPadding(2, 6, 8, 6);
      const top = centered(card); const ri = top.addImage(ringImg(116, pct, label, num, 'kcal', over ? RED : INK, riderImg)); ri.imageSize = new Size(116, 116); top.addSpacer();
      card.addSpacer(); proteinRow(card, need, chick, 14);
    } else {
      w.backgroundImage = bgImg(170, 170, m, 128, 6, 36); w.setPadding(10, 12, 12, 12);
      const top = centered(w); const ri = top.addImage(ringImg(112, pct, label, num, 'kcal', over ? RED : INK)); ri.imageSize = new Size(112, 112); top.addSpacer();
      w.addSpacer(); proteinRow(w, need, chick, 15);
    }
  } else {
    w.backgroundImage = bgImg(364, 170, null); w.setPadding(BRAND ? 8 : 14, BRAND ? 8 : 14, BRAND ? 8 : 14, BRAND ? 8 : 16);
    const body = w.addStack(); body.layoutHorizontally();
    const L = body.addStack(); L.layoutVertically(); L.size = new Size(BRAND ? 140 : 132, 0);
    if (BRAND) { L.backgroundColor = Color.white(); L.cornerRadius = 22; L.setPadding(2, 4, 8, 4); }
    const lt = centered(L); const rsz = BRAND ? 118 : 112; const ri = lt.addImage(ringImg(rsz, pct, label, num, 'kcal', over ? RED : INK, riderImg)); ri.imageSize = new Size(rsz, rsz); lt.addSpacer();
    L.addSpacer(); proteinRow(L, need, chick, 14);
    body.addSpacer(BRAND ? 8 : 14);
    const R = body.addStack(); R.layoutVertically();
    if (BRAND) { R.backgroundColor = Color.white(); R.cornerRadius = 22; R.setPadding(10, 12, 10, 12); }
    const hd = R.addStack(); hd.layoutHorizontally(); hd.centerAlignContent();
    t(hd, state === 'sug' ? 'กินต่อได้' : 'วันนี้', F(15));
    if (BRAND) { const sp = await img('plain-sparkle'); if (sp) { hd.addSpacer(4); const si = hd.addImage(sp); si.imageSize = new Size(13, 13); } }
    hd.addSpacer();
    const pill = hd.addStack(); pill.backgroundColor = BRAND ? new Color('#FFE6E0') : PILL; pill.cornerRadius = 12; pill.setPadding(3, 6, 3, 10); pill.centerAlignContent();
    const fl = await img('plain-flame'); if (fl) { const fi = pill.addImage(fl); fi.imageSize = new Size(15, 15); } pill.addSpacer(2); t(pill, BRAND ? d.streak + ' วัน' : d.streak, F(BRAND ? 13 : 14));
    R.addSpacer(8);
    if (state === 'sug') {
      const items = d.sug.items.slice(0, 3);
      for (let i = 0; i < items.length; i++) {
        const it = items[i]; const row = R.addStack(); row.layoutHorizontally(); row.centerAlignContent();
        const ic = (BRAND && await img('dot-' + it.icon)) || await img('icon-' + it.icon) || await img('icon-snack'); if (ic) { const ii = row.addImage(ic); ii.imageSize = new Size(32, 32); }
        row.addSpacer(9); t(row, it.name || '', F(15)); row.addSpacer();
        if (BRAND) { const qb = row.addStack(); qb.backgroundColor = new Color('#FFF3B0'); qb.cornerRadius = 10; qb.setPadding(2, 8, 2, 8); t(qb, it.q, F(13), new Color('#6B5A00')); }
        else t(row, it.q, F(14), GREY);
        if (i < items.length - 1) R.addSpacer();
      }
      stamp(R);
    } else {
      const [h1, h2, mood] = MSG[state];
      const mr = centered(R); const mi2 = await img(mood); if (mi2) { const mm = mr.addImage(mi2); mm.imageSize = new Size(52, 52); } mr.addSpacer();
      R.addSpacer(2); const a1 = centered(R); const x1 = t(a1, h1, F(16)); x1.centerAlignText(); a1.addSpacer();
      R.addSpacer(2); const a2 = centered(R); const x2 = t(a2, h2, FM(12), GREY); x2.lineLimit = 2; x2.centerAlignText(); a2.addSpacer();
      stamp(R);
    }
  }
}
w.url = APP; w.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else if (fam === 'small') await w.presentSmall(); else await w.presentMedium();
Script.complete();
`;
