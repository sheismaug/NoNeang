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
      const k = todayKey(); const t = totals(k);
      return { date: k, name: db.profile.name || '', goal: Math.round(goalOf(k)), eaten: Math.round(t.k), protein: Math.round(t.p), pT: proteinTarget(), fiber: Math.round(t.f), fT: FIBER, streak: streakInfo().cur, loggedToday: LOGGED(k), at: new Date().toISOString() };
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
    const c = window.NONEANG_CLOUD;
    return `// NoNeang widget for Scriptable — paste whole script, then add a Scriptable widget and pick this script.
const URL = ${JSON.stringify(c.url)};
const KEY = ${JSON.stringify(c.key)};
const TOKEN = ${JSON.stringify(this.token || '')};
const Y = new Color('#FFD000'), INK = new Color('#1F1F1F'), MUT = new Color('#5E4A00'), W = new Color('#FFFFFF');
async function load() {
  const r = new Request(URL + '/rest/v1/rpc/get_widget'); r.method = 'POST';
  r.headers = { apikey: KEY, 'Content-Type': 'application/json' }; r.body = JSON.stringify({ p_token: TOKEN });
  try { const d = await r.loadJSON(); Keychain.set('noneang_last', JSON.stringify(d)); return d; }
  catch (e) { return Keychain.contains('noneang_last') ? JSON.parse(Keychain.get('noneang_last')) : null; }
}
const d = await load(); const now = new Date();
const pad = (n) => String(n).padStart(2, '0'); const tk = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
const w = new ListWidget(); w.backgroundColor = Y; w.setPadding(14, 14, 14, 14);
const fam = config.widgetFamily || 'small';
function txt(s, size, color = INK, weight = 'bold') { const t = w.addText(s); t.font = weight === 'bold' ? Font.boldRoundedSystemFont(size) : Font.mediumRoundedSystemFont(size); t.textColor = color; return t; }
if (!d || !d.date) { txt('NoNeang', 13); w.addSpacer(6); txt('เปิดแอปแล้วกดซิงก์ก่อนนะ', 12, MUT, 'm'); }
else {
  const fresh = d.date === tk; const left = fresh ? d.goal - d.eaten : d.goal; const prot = fresh ? d.protein : 0;
  const top = w.addStack(); top.centerAlignContent();
  const f = top.addImage(SFSymbol.named('flame.fill').image); f.imageSize = new Size(14, 14); f.tintColor = new Color('#FF7A59');
  top.addSpacer(3); const st = top.addText(String(d.streak) + ' วัน'); st.font = Font.boldRoundedSystemFont(12); st.textColor = INK;
  top.addSpacer(); const nm = top.addText('NoNeang'); nm.font = Font.mediumRoundedSystemFont(10); nm.textColor = MUT;
  w.addSpacer(6);
  if (left >= 0) { txt(left.toLocaleString('en-US'), fam === 'small' ? 34 : 40); txt('kcal เหลือวันนี้', 11, MUT, 'm'); }
  else { txt('+' + (-left).toLocaleString('en-US'), 30, new Color('#A33A1E')); txt('kcal เกินเป้า · ไม่เป็นไรนะ', 11, MUT, 'm'); }
  w.addSpacer(8);
  const bar = w.addStack(); bar.size = new Size(fam === 'small' ? 120 : 280, 8); bar.cornerRadius = 4; bar.backgroundColor = new Color('#FFF3B0');
  const pct = Math.max(0, Math.min(1, prot / d.pT)); const fill = bar.addStack(); fill.size = new Size(Math.max(1, (fam === 'small' ? 120 : 280) * pct), 8); fill.backgroundColor = new Color('#FF9B5E'); fill.cornerRadius = 4; bar.addSpacer();
  w.addSpacer(4); txt('Protein ' + prot + '/' + d.pT + ' g', 11, INK, 'm');
  if (!fresh) { w.addSpacer(4); txt('ยังไม่ได้จดวันนี้', 11, new Color('#A33A1E')); }
  else if (!d.loggedToday && now.getHours() >= 19) { w.addSpacer(4); txt('อย่าลืมกดจดครบนะ', 11, new Color('#A33A1E')); }
}
w.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentSmall();
Script.complete();
`;
  },
};
