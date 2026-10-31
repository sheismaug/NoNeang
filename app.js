/* NoNeang v1 — personal food & waist tracker (PWA, localStorage)
   หลักการ: เก็บข้อเท็จจริงดิบ แล้วคำนวณทุกอย่างทีหลังเสมอ */
'use strict';

/* ================= utils ================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const r1 = (n) => Math.round(n * 10) / 10;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const todayKey = () => dkey(new Date());
const TH_DAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thDate = (k) => { const d = parseKey(k); return TH_DAY[d.getDay()] + ' ' + d.getDate() + ' ' + TH_MON[d.getMonth()]; };
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const mondayOf = (k) => { const d = parseKey(k); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return dkey(d); };

const svgI = (key, px = 24) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" aria-hidden="true">${(ICONS[key] || ICONS.main)[1]}</svg>`;
const iconBox = (key, px = 26, box = 44, r = null) => `<span class="ic" style="width:${box}px;height:${box}px;border-radius:${r ?? box / 2}px;background:${(ICONS[key] || ICONS.main)[0]}">${svgI(key, px)}</span>`;
const slotSvg = (id, px = 22) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${SLOT_ICONS[id]}</svg>`;
const chev = (dir = 'l', px = 20) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir === 'l' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'}"/></svg>`;
const xIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const pencil = (c = '#5E5E5E') => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`;

/* ================= storage adapter ================= */
const KEY = 'noneang.v1';
const Store = {
  load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
  save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { toast('บันทึกลงเครื่องไม่ได้ (พื้นที่เต็มหรือโหมดส่วนตัว)'); } }
};
let db = Store.load();
const save = () => Store.save(db);

/* ================= calculations ================= */
const PACE = { slow: { def: 250, name: 'สบายๆ', kg: 0.25 }, rec: { def: 500, name: 'แนะนำ', kg: 0.5 }, fast: { def: 750, name: 'เร่ง', kg: 0.75 } };
function ageOf(birth) { const b = parseKey(birth); const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a; }
function bmr(p) { return 10 * p.startWeight + 6.25 * p.height - 5 * ageOf(p.birth) + (p.sex === 'm' ? 5 : -161); }
function baseTDEE(p) { return bmr(p) * 1.2; }
function targetBase(p) { const raw = baseTDEE(p) - PACE[p.pace].def; return { value: Math.max(p.sex === 'm' ? 1500 : 1200, Math.round(raw)), raw: Math.round(raw) }; }
const activeOf = (k) => db.activity[k] || 0;
const watchCredit = (k) => Math.round(activeOf(k) * db.profile.watchPct);
const goalOf = (k) => targetBase(db.profile).value + watchCredit(k);
const proteinTarget = () => Math.round(1.2 * db.profile.startWeight);
const FIBER = 25;
const entriesOn = (k) => db.entries.filter((e) => e.date === k);
function totals(k) { return entriesOn(k).reduce((a, e) => ({ k: a.k + e.k, p: a.p + e.p, f: a.f + e.f }), { k: 0, p: 0, f: 0 }); }
const foodById = (id) => db.foods.find((f) => f.id === id);
function nutr(food, opt = {}) {
  if (food.kind === 'sized') { const g = opt.grams || food.def; const m = g / 100 * (opt.qty || 1); return { k: food.per100.k * m, p: food.per100.p * m, f: food.per100.f * m }; }
  if (!food.n) return null;
  const q = opt.qty || 1; return { k: food.n.k * q, p: food.n.p * q, f: food.n.f * q };
}
function slotNow() { const h = new Date().getHours(); const hh = h < 5 ? h + 24 : h; return (SLOTS.find((s) => hh >= s.from && hh < s.to) || SLOTS[4]).id; }
function mealFoods() {
  const p = db.profile;
  return p.meats.map((m) => { const mt = MEATS[m]; const k = mt.per100.k * p.meatG / 100 + RICE100.k * p.riceG / 100; const pr = mt.per100.p * p.meatG / 100 + RICE100.p * p.riceG / 100; const f = RICE100.f * p.riceG / 100;
    return { id: 'meal-' + m, name: 'ข้าว+' + mt.name.replace('อก', ''), full: mt.name + ' ' + p.meatG + ' g + ข้าว ' + p.riceG + ' g', icon: mt.icon, kind: 'item', unit: 'มื้อ', n: { k, p: pr, f }, src: 'dict' }; });
}

/* chin level: waist (3-measure average) with fallback to weight % */
function bodySeries(field) { return db.body.filter((b) => b[field] != null).sort((a, b) => a.date.localeCompare(b.date)); }
function chinCompute() {
  const p = db.profile; const w = bodySeries('waist');
  if (w.length) {
    const start = w[0].waist; const last3 = w.slice(-3); const avg = last3.reduce((a, b) => a + b.waist, 0) / last3.length; const drop = start - avg;
    const target = p.height * 0.5;
    let lv = drop >= 6 || avg < target ? 3 : drop >= 4 ? 2 : drop >= 2 ? 1 : 0;
    return { lv, mode: 'waist', start, avg, cur: w[w.length - 1].waist, drop, target };
  }
  const wt = bodySeries('weight');
  if (!wt.length) return { lv: 0, mode: 'none' };
  const start = wt[0].weight; const last3 = wt.slice(-3); const avg = last3.reduce((a, b) => a + b.weight, 0) / last3.length; const pct = (start - avg) / start * 100;
  return { lv: pct >= 7.5 ? 3 : pct >= 5 ? 2 : pct >= 2.5 ? 1 : 0, mode: 'weight', start, avg, cur: wt[wt.length - 1].weight, pct };
}
function updateChin() {
  const c = chinCompute(); const s = db.chin || { level: 0, lower: 0 };
  if (c.lv >= s.level) { s.level = c.lv; s.lower = 0; } else { s.lower++; if (s.lower >= 3) { s.level = c.lv; s.lower = 0; } }
  db.chin = s;
}
const chinLevel = () => (db.chin ? db.chin.level : 0);

/* period → predicted pre-menstrual windows */
function lutealDays() {
  const ps = [...db.periods].sort(); const set = new Set();
  const mark = (start) => { for (let i = 1; i <= 7; i++) set.add(addDays(start, -i)); };
  ps.slice(1).forEach(mark);
  if (ps.length) {
    let len = 28; if (ps.length >= 2) { const gaps = []; for (let i = 1; i < ps.length; i++) gaps.push(daysBetween(ps[i - 1], ps[i])); len = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length); if (len < 21 || len > 40) len = 28; }
    mark(addDays(ps[ps.length - 1], len));
  }
  return set;
}

/* suggestion engine */
function suggestCombos(dateK, store) {
  const t = totals(dateK); const rem = goalOf(dateK) - t.k; const Pg = Math.max(0, proteinTarget() - t.p); const Fg = Math.max(0, FIBER - t.f);
  if (rem < 60) return { rem, Pg, Fg, combos: [] };
  const cands = [];
  db.foods.filter((f) => f.addon && !f.hidden && (store === 'all' || (f.stores || []).includes(store))).forEach((f) => {
    if (f.kind === 'sized') cands.push({ food: f, grams: f.def, qty: 1, n: nutr(f, { grams: f.def }) });
    else if (f.n) { cands.push({ food: f, qty: 1, n: nutr(f) }); if (f.n.k <= 120) cands.push({ food: f, qty: 2, n: nutr(f, { qty: 2 }) }); }
  });
  const res = []; const L = cands.length;
  const score = (items) => { const s = items.reduce((a, i) => ({ k: a.k + i.n.k, p: a.p + i.n.p, f: a.f + i.n.f }), { k: 0, p: 0, f: 0 }); if (s.k > rem) return null;
    const wp = Pg > 0 ? (Fg > 0 ? 0.55 : 0.9) : 0; const wf = Fg > 0 ? (Pg > 0 ? 0.35 : 0.9) : 0;
    const sc = (Pg > 0 ? wp * Math.min(1, s.p / Pg) : 0) + (Fg > 0 ? wf * Math.min(1, s.f / Fg) : 0) + 0.1 * (s.k / rem) - 0.02 * items.length; return { items, sum: s, sc }; };
  for (let a = 0; a < L; a++) { let r = score([cands[a]]); if (r) res.push(r);
    for (let b = a + 1; b < L; b++) { if (cands[b].food === cands[a].food) continue; r = score([cands[a], cands[b]]); if (r) res.push(r);
      for (let c = b + 1; c < L; c++) { if (cands[c].food === cands[a].food || cands[c].food === cands[b].food) continue; r = score([cands[a], cands[b], cands[c]]); if (r) res.push(r); } } }
  res.sort((x, y) => y.sc - x.sc);
  const seen = new Set(); const combos = res.filter((r) => { const k = r.items.map((i) => i.food.id).sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
  return { rem, Pg, Fg, combos };
}

/* ================= app state ================= */
const S = { view: 'today', obStep: 1, ob: null, date: null, logDate: null, ctx: null, q: '', store: 'all', comboIdx: 0, pick: {}, sheet: null, weekOff: 0, wsel: null, dsel: null, toast: null, comp: null, checked: false };

function go(view, extra = {}) { Object.assign(S, { view, sheet: null }, extra); if (!['today', 'log'].includes(view)) S.toast = null; render(); window.scrollTo(0, 0); }
function openSheet(sheet) { S.sheet = sheet; renderLayer(); }
function closeSheet() { S.sheet = null; renderLayer(); }

let toastTimer = null;
function toast(msg, undoId = null, mood = 'yay') {
  S.toast = { msg, undoId, mood }; renderToast();
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = null; renderToast(); }, 4500);
}

/* ================= logging ================= */
function addEntry(food, opt = {}) {
  const n = opt.n || nutr(food, opt);
  if (!n) { openSheet({ type: 'label', foodId: food.id, then: opt }); return null; }
  const date = opt.date || (S.ctx && S.ctx.date) || todayKey(); const slot = opt.slot || (S.ctx && S.ctx.slot) || slotNow();
  const qty = opt.qty || 1;
  const unit = food.kind === 'sized' ? (opt.grams || food.def) + ' g' : qty + ' ' + (food.unit || 'หน่วย');
  const e = { id: uid(), userId: db.userId, date, slot, foodId: food.id, name: food.name, icon: food.icon, cat: food.cat, qty, grams: opt.grams || null, unitLabel: unit, k: r1(n.k), p: r1(n.p), f: r1(n.f), src: opt.src || food.src || 'dict', createdAt: new Date().toISOString(), schemaVersion: 1 };
  db.entries.push(e); food.lastUsed = e.createdAt; food.uses = (food.uses || 0) + 1; save();
  return e;
}
function afterLog(entries) {
  if (!entries.length) return;
  const date = entries[0].date; const left = goalOf(date) - totals(date).k;
  const label = entries.length === 1 ? entries[0].name + ' · ' + fmt(entries[0].k) + ' kcal' : entries.length + ' อย่าง · ' + fmt(entries.reduce((a, e) => a + e.k, 0)) + ' kcal';
  const ret = S.ctx && S.ctx.ret ? S.ctx.ret : 'today';
  S.ctx = ret === 'log' ? S.ctx : null;
  go(ret === 'log' ? 'log' : 'today');
  toast(label + (left >= 0 ? ' · เหลือ ' + fmt(left) : ' · เกินมา ' + fmt(-left)), entries.map((e) => e.id), left < 0 ? 'calm' : 'yay');
}
function undo(ids) { db.entries = db.entries.filter((e) => !ids.includes(e.id)); save(); S.toast = null; renderToast(); render(); }

/* ================= components ================= */
function hero(title, sub, opts = {}) {
  const back = opts.back ? `<button class="back" data-act="back" data-to="${opts.back}" aria-label="กลับ">${chev('l')}</button>` : '';
  return `<div class="hero" style="padding-bottom:${opts.pb ?? 70}px">
    <span class="blob" style="width:160px;height:160px;right:-40px;top:-56px"></span><span class="blob" style="width:80px;height:80px;left:150px;bottom:-34px"></span>
    <div class="row">${back}<div style="flex:1;min-width:0"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${opts.right || ''}</div></div>`;
}
function topBar(title, sub, back) { return `<div class="top"><button class="back" data-act="back" data-to="${back}" aria-label="กลับ">${chev('l')}</button><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>`; }
function nav() {
  const b = (v, label, d) => `<button class="${S.view === v ? 'on' : ''}" data-act="nav" data-to="${v}"><span class="pill"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${d}</svg></span>${label}</button>`;
  return `<nav class="nav">${b('today', 'วันนี้', '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>')}${b('week', 'สัปดาห์', '<path d="M5 20V10M12 20V4M19 20v-7"/>')}${b('me', 'ฉัน', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>')}</nav>`;
}
function ring(pct, size, stroke, col, track, over = 0) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const d = Math.max(0, Math.min(1, pct)) * c;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>${d > 0.5 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${d} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}${over > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#FF8A65" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${Math.min(1, over) * c} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}</svg>`;
}
const fillTile = (key, pct, col, tint) => `<span class="ic" style="width:46px;height:46px;border-radius:15px;background:linear-gradient(to top,${col} ${pct}%,${tint} ${pct}%)">${svgI(key, 28)}</span>`;

/* ================= views ================= */
function vToday() {
  const k = todayKey(); const t = totals(k); const goal = goalOf(k); const rem = goal - t.k; const over = rem < 0;
  const pT = proteinTarget(); const h = new Date().getHours();
  let mood = 'happy'; if (over) mood = 'calm'; else if (h >= 22 || h < 4) mood = 'sleepy'; else if (h < 10 && !entriesOn(k).length) mood = 'morning'; else if (t.p >= pT) mood = 'proud';
  const greet = h >= 22 || h < 4 ? 'ดึกแล้วนะ' : h < 11 ? 'อรุณสวัสดิ์' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const sug = suggestCombos(k, S.store);
  const best = sug.combos[0];
  const eq = !over && best ? `<button class="card" data-act="nav" data-to="suggest" style="border:none;width:calc(100% - 32px);margin-top:10px;background:var(--yll);box-shadow:none;padding:8px 12px;display:flex;align-items:center;gap:8px;text-align:left">
      <span style="font-size:13px;font-weight:700;white-space:nowrap">ยังกินได้ ≈</span>
      <span class="row" style="gap:4px;flex:1;flex-wrap:wrap">${best.items.map((i) => iconBox(i.food.icon, 20, 32) + `<span style="font-size:12px;font-weight:700">${i.food.kind === 'sized' ? i.grams + 'g' : '×' + i.qty}</span>`).join('')}</span>${chev('r', 16)}</button>`
    : over ? `<div class="card" style="margin-top:10px;background:var(--greenL);box-shadow:none;padding:10px 14px;display:flex;align-items:center;gap:10px">${mascot('calm', 40)}<div><div style="font-size:14px;font-weight:700">ไม่เป็นไร พรุ่งนี้ค่อยว่ากัน</div><div class="small mut">วันเดียวไม่เปลี่ยนแนวโน้มรายสัปดาห์</div></div></div>` : '';
  const meals = mealFoods().map((m) => `<button data-act="logMeal" data-id="${m.id}" aria-label="บันทึก ${esc(m.full)}" style="border:none;border-radius:24px;background:#fff;box-shadow:0 6px 18px rgba(31,31,31,.07);padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:4px">${iconBox(m.icon, 30, 48, 18).replace(/background:[^;"]+/, 'background:#FFF3B0')}<span style="font-size:14px;font-weight:700">${esc(m.name)}</span><span class="small mut">${fmt(m.n.k)} kcal</span></button>`).join('');
  const cnt = entriesOn(k).length;
  return hero('<span style="font-size:15px;font-weight:600;display:block">' + greet + '</span><span style="font-size:32px">' + esc(db.profile.name || 'สวัสดี') + '</span>', thDate(k), { pb: 120, right: `<span style="transform:rotate(-6deg);display:block">${mascot(mood, 108, chinLevel(), 'มาสคอต NoNeang')}</span>` }) +
    `<div class="card" style="margin-top:-104px;position:relative;padding:16px">
      <div class="row" style="gap:14px">
        <div style="position:relative;width:138px;height:138px;flex-shrink:0">${ring(t.k / goal, 138, 16, '#FFD000', '#FFF3B0', over ? (t.k - goal) / goal : 0)}
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">${over ? `<span class="small mut" style="font-weight:600">เกินมา</span><span style="font-size:32px;font-weight:700;color:#C2522E">${fmt(-rem)}</span><span class="small mut" style="font-weight:600">kcal</span>` : `<span style="font-size:34px;font-weight:700;line-height:1.05">${fmt(rem)}</span><span class="small mut" style="font-weight:600">kcal เหลือ</span>`}</div></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:10px">
          <div class="row">${fillTile('chicken', Math.min(100, t.p / pT * 100), '#FFC4A3', '#FFF1EA')}<div><div style="font-size:13px;font-weight:700">Protein <span class="mut" style="font-weight:500">${Math.round(t.p)}/${pT}</span></div><div class="small mut">${t.p >= pT ? 'ครบแล้ว ✓' : 'ขาด ' + Math.round(pT - t.p) + ' g'}</div></div></div>
          <div class="row">${fillTile('veg', Math.min(100, t.f / FIBER * 100), '#B7E0C2', '#F1F8F2')}<div><div style="font-size:13px;font-weight:700">Fiber <span class="mut" style="font-weight:500">${Math.round(t.f)}/${FIBER}</span></div><div class="small mut">${t.f >= FIBER ? 'ครบแล้ว ✓' : 'ขาด ' + Math.round(FIBER - t.f) + ' g'}</div></div></div>
        </div></div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button data-act="sheet" data-type="watch" style="flex:1;min-height:40px;border-radius:20px;border:none;background:var(--lav);display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:700"><span class="ic" style="width:26px;height:26px;border-radius:13px;background:#fff">${svgI('watch', 16)}</span>Watch +${watchCredit(k)} ${pencil('#5B4FCF')}</button>
        <span class="small mut" style="min-height:40px;border-radius:20px;background:var(--g);padding:0 12px;display:flex;align-items:center">กินแล้ว ${fmt(t.k)} / ${fmt(goal)}</span>
      </div></div>` + eq +
    `<div class="h2" style="margin-top:16px">กินอะไรมา?</div>
    <div class="grid3" style="margin:0 18px">${meals}</div>
    <div class="grid2" style="margin:12px 18px 0">
      <button class="btn" data-act="nav" data-to="suggest"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 5 2.5 7.4 8 8-5.5.6-7.4 3-8 8-.6-5-2.5-7.4-8-8 5.5-.6 7.4-3 8-8z" fill="#fff" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/></svg>เติมอะไรดี?</button>
      <button class="btn w" data-act="nav" data-to="other"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>อย่างอื่น</button>
    </div>
    <button data-act="openLog" data-date="${k}" style="margin:12px 18px 0;width:calc(100% - 36px);border:none;background:var(--g);border-radius:22px;min-height:54px;padding:0 16px;display:flex;align-items:center;gap:10px;text-align:left"><span style="flex:1;font-size:14px;font-weight:600">${cnt ? 'วันนี้กิน ' + cnt + ' ครั้ง · ' + fmt(t.k) + ' kcal' : 'ยังไม่ได้บันทึกวันนี้'}</span>${chev('r', 18)}</button>` + nav();
}

function vSuggest() {
  const k = (S.ctx && S.ctx.date) || todayKey(); const s = suggestCombos(k, S.store); const back = S.ctx && S.ctx.ret === 'log' ? 'log' : 'today';
  const stores = ['all', '7-11', 'Lotus', 'ยิม'];
  const seg = `<div class="seg" style="margin:0 16px;margin-top:-30px;position:relative;background:#fff;box-shadow:0 10px 24px rgba(31,31,31,.10);padding:6px">${stores.map((x) => `<button class="${S.store === x ? 'on' : ''}" style="${S.store === x ? 'background:var(--yl)' : ''}" data-act="store" data-v="${x}">${x === 'all' ? 'ทุกที่' : x}</button>`).join('')}</div>`;
  let body = '';
  const missing = db.foods.filter((f) => f.addon && !f.hidden && f.kind !== 'sized' && !f.n);
  const miss = missing.length ? `<button class="card" data-act="sheet" data-type="label" data-id="${missing[0].id}" style="border:none;width:calc(100% - 32px);background:var(--g);box-shadow:none;display:flex;align-items:center;gap:10px;text-align:left">${iconBox(missing[0].icon, 22, 36)}<span style="flex:1;font-size:13px"><b>${esc(missing[0].name)}</b> ยังไม่มีค่าจากฉลาก กรอกครั้งเดียวจะได้ถูกแนะนำด้วย</span>${chev('r', 16)}</button>` : '';
  if (s.rem < 60) body = `<div class="empty">${mascot(s.rem < 0 ? 'calm' : 'proud', 140)}<b style="font-size:18px">${s.rem < 0 ? 'วันนี้เกินเป้าแล้ว' : 'วันนี้พอดีแล้ว!'}</b><span class="mut">${s.rem < 0 ? 'ไม่เป็นไร พรุ่งนี้ค่อยว่ากัน' : 'ไม่ต้องเติมอะไรแล้ว'}</span></div>`;
  else if (!s.combos.length) body = `<div class="empty">${mascot('huh', 140)}<b style="font-size:18px">ยังไม่มีของเติมที่ลงตัว</b><span class="mut">ลองเปลี่ยนร้าน หรือเพิ่มของเติมใน ฉัน → รายการอาหารของฉัน</span></div>`;
  else {
    const c = s.combos[S.comboIdx % s.combos.length];
    const rows = c.items.map((i, idx) => { const f = i.food; const size = f.kind === 'sized' ? (f.sizes.find((z) => z[0] === i.grams) || [])[2] : null;
      return `<button data-act="comboEdit" data-i="${idx}" style="border:none;background:none;padding:6px 0;display:flex;align-items:center;gap:12px;text-align:left;width:100%">${iconBox(f.icon, 34, 58, 20)}<span style="flex:1"><span style="display:block;font-size:16px;font-weight:700">${esc(f.name)}</span><span class="small mut">${f.kind === 'sized' ? i.grams + ' g' : i.qty + ' ' + esc(f.unit)}${size ? ` <span class="badge" style="background:var(--yl);color:var(--ink)">${size}</span>` : ''} ${(f.stores || []).length ? '· ' + esc(f.stores.join('/')) : ''}</span></span><span style="font-size:15px;font-weight:700">${fmt(i.n.k)}</span></button>`; }).join('');
    const gauge = (pct, col, track, key, label) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="position:relative;width:52px;height:52px">${ring(pct, 52, 6, col, track)}<span class="ic" style="position:absolute;inset:0">${svgI(key, 18)}</span></span><span style="font-size:12px;font-weight:700">${label}</span></div>`;
    const pg = s.Pg ? Math.min(1, c.sum.p / s.Pg) : 1; const fg = s.Fg ? Math.min(1, c.sum.f / s.Fg) : 1;
    body = `<div class="card" style="margin-top:14px;display:flex;flex-direction:column;gap:6px">${rows}
      <div style="margin-top:8px;background:var(--g);border-radius:20px;padding:12px 8px" class="grid3">
        ${gauge(c.sum.k / s.rem, '#FFD000', '#FFF3B0', 'flame', fmt(c.sum.k) + '/' + fmt(s.rem))}
        ${gauge(pg, '#FF7A59', '#FFE6E0', 'chicken', s.Pg ? (pg >= 1 ? 'ครบ ✓' : r1(c.sum.p) + '/' + Math.round(s.Pg)) : 'ครบแล้ว')}
        ${gauge(fg, '#4FA374', '#D6EEDC', 'veg', s.Fg ? (fg >= 1 ? 'ครบ ✓' : r1(c.sum.f) + '/' + Math.round(s.Fg)) : 'ครบแล้ว')}
      </div></div>
      <div style="margin:14px 16px 0;display:grid;grid-template-columns:1fr 2fr;gap:10px"><button class="btn w" data-act="comboNext">↻ ชุดอื่น</button><button class="btn" data-act="comboEat">กินชุดนี้</button></div>`;
  }
  return hero('เติมอะไรดี?', s.rem >= 0 ? 'เหลือ ' + fmt(s.rem) + ' kcal' + (s.Pg || s.Fg ? ' · ยังขาด ' + [s.Pg ? 'protein' : '', s.Fg ? 'fiber' : ''].filter(Boolean).join(' และ ') : '') : 'เกินเป้าแล้ว', { back, pb: 56 }) + seg + miss + body + `<button class="link" data-act="nav" data-to="pick" style="margin-top:10px">หรือเลือกเองทีละอย่าง ›</button>`;
}

function vPick() {
  const k = (S.ctx && S.ctx.date) || todayKey(); const t = totals(k); const goal = goalOf(k); const pT = proteinTarget();
  const list = db.foods.filter((f) => f.addon && !f.hidden && (S.store === 'all' || (f.stores || []).includes(S.store)));
  const picked = Object.entries(S.pick).filter(([, q]) => q > 0).map(([id, q]) => { const f = foodById(id); const n = f.kind === 'sized' ? nutr(f, { grams: ((S.pickG || {})[id] || f.def) * q }) : nutr(f, { qty: q }); return { f, q, n: n || { k: 0, p: 0, f: 0 } }; });
  const sum = picked.reduce((a, x) => ({ k: a.k + x.n.k, p: a.p + x.n.p, f: a.f + x.n.f }), { k: 0, p: 0, f: 0 });
  const rem = goal - t.k; const Pg = Math.max(0, pT - t.p); const Fg = Math.max(0, FIBER - t.f);
  const sorted = list.map((f) => { const n = nutr(f); const sc = !n ? -1 : (n.k > rem ? -0.5 : (Pg ? Math.min(1, n.p / Math.max(Pg, 1)) * 0.6 : 0) + (Fg ? Math.min(1, n.f / Math.max(Fg, 1)) * 0.4 : 0)); return { f, n, sc }; }).sort((a, b) => b.sc - a.sc);
  const mini = (pct, col, track, label, val) => `<span class="row" style="gap:8px">${ring(pct, 38, 5, col, track)}<span><span class="small mut" style="display:block">${label}</span><b style="font-size:13px">${val}</b></span></span>`;
  const cards = sorted.map(({ f, n }) => { const q = S.pick[f.id] || 0; const tag = n ? (n.f >= 3 && n.f * 2 >= n.p ? `<span class="badge" style="background:var(--greenL)">Fb ${Math.round(n.f)}</span>` : n.p >= 5 ? `<span class="badge" style="background:var(--coralL)">P ${Math.round(n.p)}</span>` : '') : '';
    return `<div data-hold="${f.id}" style="border-radius:22px;padding:12px;${q ? 'background:#FFFBE6;box-shadow:0 0 0 2.5px #FFD000' : 'background:#fff;box-shadow:0 4px 14px rgba(31,31,31,.07)'};display:flex;flex-direction:column;gap:8px">
      <button data-act="${f.kind === 'sized' ? 'sizeSheet' : 'noop'}" data-id="${f.id}" style="border:none;background:none;padding:0;display:flex;align-items:center;gap:10px;text-align:left">${iconBox(f.icon, 30, 48, 16)}<span style="min-width:0"><span style="display:block;font-size:15px;font-weight:700">${esc(f.name)}</span><span class="small mut">${f.kind === 'sized' ? f.def + ' g' : '1 ' + esc(f.unit)}${(f.stores || []).length ? ' · ' + esc(f.stores[0]) : ''}</span></span></button>
      <div class="row" style="justify-content:space-between"><span class="row" style="gap:6px"><b style="font-size:15px;white-space:nowrap">${n ? fmt(n.k) : '?'} <span class="small mut" style="font-weight:600">kcal</span></b>${tag}</span>${q ? '' : `<button class="step" data-act="pickAdd" data-id="${f.id}" aria-label="เพิ่ม ${esc(f.name)}" style="width:34px;height:34px">+</button>`}</div>
      ${q ? `<div class="row" style="justify-content:space-between;background:#fff;border-radius:16px;padding:4px"><button class="step" data-act="pickDec" data-id="${f.id}" aria-label="ลด" style="width:36px;height:36px;border-radius:12px">−</button><b>${q}</b><button class="step y" data-act="pickAdd" data-id="${f.id}" aria-label="เพิ่ม" style="width:36px;height:36px;border-radius:12px">+</button></div>` : ''}
    </div>`; }).join('');
  return topBar('เลือกเติมเอง', 'เรียงจากที่ช่วยปิดช่องว่างได้มากสุด · กดค้างเพื่อจัดการ', 'suggest') +
    `<div class="card" style="display:flex;justify-content:space-between;padding:10px 14px">${mini((t.k + sum.k) / goal, '#FFD000', '#FFF3B0', 'kcal', fmt(t.k + sum.k) + '/' + fmt(goal))}${mini((t.p + sum.p) / pT, '#FF7A59', '#FFE6E0', 'Protein', Math.round(t.p + sum.p) + '/' + pT)}${mini((t.f + sum.f) / FIBER, '#4FA374', '#D6EEDC', 'Fiber', Math.round(t.f + sum.f) + '/' + FIBER)}</div>
    <div class="row" style="margin:12px 16px 0;gap:6px">${['all', '7-11', 'Lotus', 'ยิม'].map((x) => `<button class="chip ${S.store === x ? 'on' : ''}" data-act="store" data-v="${x}">${x === 'all' ? 'ทุกที่' : x}</button>`).join('')}</div>
    <div class="grid2" style="margin:12px 16px 0">${cards || '<span class="mut">ยังไม่มีของเติม</span>'}</div>
    <div style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:#fff;border-radius:28px 28px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:12px;box-shadow:0 -6px 20px rgba(31,31,31,.08);z-index:20">
      <span style="flex:1"><span class="small mut" style="display:block">เลือกแล้ว ${picked.length} อย่าง</span><b style="font-size:17px">${fmt(sum.k)} kcal</b> <span class="small mut">· เหลืออีก ${fmt(rem - sum.k)}</span></span>
      <button class="btn" style="width:auto;padding:0 26px" data-act="pickSave" ${picked.length ? '' : 'disabled style="opacity:.4"'}>บันทึก</button></div>`;
}

/* search & composite */
function parseComposite(q) {
  const s = q.replace(/\s+/g, ''); const qty = Number((q.match(/(\d+(?:\.\d+)?)\s*(ชิ้น|อัน|จาน|ถ้วย|ลูก|ฟอง|กล่อง|แก้ว)?/) || [])[1]) || 1;
  const base = BASES.find((b) => b.key.some((kk) => s.includes(kk)));
  const tops = TOPPINGS.filter((t) => t.key.some((kk) => s.includes(kk)));
  if (!base && !tops.length) return null;
  return { name: q.replace(/\d+(\.\d+)?\s*(ชิ้น|อัน|จาน|ถ้วย|ลูก|ฟอง|กล่อง|แก้ว)?/g, '').trim() || q.trim(), qty, parts: [...(base ? [{ ...base, base: true, q: 1 }] : []), ...tops.map((t) => ({ ...t, q: 1 }))] };
}
function searchFoods(q) {
  const s = q.trim().toLowerCase(); if (!s) return [];
  return db.foods.filter((f) => !f.deleted && (f.name.toLowerCase().includes(s) || (f.aliases || []).some((a) => s.includes(a) || a.includes(s)))).sort((a, b) => (b.uses || 0) - (a.uses || 0));
}
function vOther() {
  const q = S.q; const back = S.ctx && S.ctx.ret === 'log' ? 'log' : 'today';
  const head = hero('กินอะไรมา?', S.ctx && S.ctx.date && S.ctx.date !== todayKey() ? 'บันทึกลง ' + thDate(S.ctx.date) + ' · ' + SLOTS.find((x) => x.id === S.ctx.slot).name : 'พิมพ์ชื่อ หรือแตะของที่เคยกิน', { back, pb: 58 }) +
    `<div style="margin:-32px 16px 0;position:relative"><label class="sr" for="q">ค้นหาอาหาร</label><input id="q" class="search" placeholder="เช่น วาฟเฟิลไส้กรอกเนย 1 ชิ้น" value="${esc(q)}" autocomplete="off" data-input="q"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" stroke-width="2.2" stroke-linecap="round" style="position:absolute;left:18px;top:19px" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg></div>`;
  return head + `<div id="results">${otherResults()}</div>`;
}
function otherResults() {
  const q = S.q.trim();
  const footer = (name) => `<div style="margin:22px 16px 0;display:flex;flex-direction:column;gap:6px"><button class="btn ghost" data-act="addFood" data-name="${esc(name || '')}">+ ${name ? 'เพิ่ม "' + esc(name) + '" เป็นเมนูของฉัน' : 'เพิ่มเมนูของฉัน'}</button><button class="link" data-act="sheet" data-type="bucket">ไม่รู้ว่ากี่ kcal? เลือกจานเล็ก/กลาง/ใหญ่ ›</button></div>`;
  if (!q) {
    const now = slotNow(); const recent = db.foods.filter((f) => !f.deleted && f.uses).map((f) => { const sameSlot = db.entries.filter((e) => e.foodId === f.id && e.slot === now).length; const days = f.lastUsed ? (Date.now() - new Date(f.lastUsed)) / 864e5 : 99; return { f, sc: (f.uses || 0) + sameSlot * 2 - days * 0.1, days }; }).filter((x) => x.days <= 30).sort((a, b) => b.sc - a.sc).slice(0, 6);
    const chips = recent.map(({ f }) => { const n = nutr(f); return `<button data-act="quickLog" data-id="${f.id}" style="height:52px;border:none;border-radius:26px;background:#fff;box-shadow:0 4px 14px rgba(31,31,31,.08);padding:0 14px 0 10px;display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:600">${iconBox(f.icon, 20, 32)}<span>${esc(f.name)}</span><span class="mut" style="font-size:13px;font-weight:700;${f.src === 'est' ? 'border-bottom:1.5px dashed #BDBDBD' : ''}">${n ? fmt(n.k) : '[ฉลาก]'}</span></button>`; }).join('');
    return `<div style="margin:24px 20px 0;display:flex;justify-content:space-between;align-items:baseline"><span><b style="font-size:18px">กินบ่อยช่วงนี้</b><span class="small mut" style="display:block">โชว์แค่ 6 อย่าง · เรียงตามที่กินบ่อย + เวลานี้</span></span></div>
      <div style="margin:12px 16px 0;display:flex;flex-wrap:wrap;gap:10px">${chips || '<span class="mut small">ยังไม่มี · บันทึกไปสักพักจะขึ้นตรงนี้</span>'}</div>` + footer('');
  }
  const found = searchFoods(q);
  if (found.length) {
    const rows = found.slice(0, 8).map((f) => { const n = nutr(f); return `<button data-act="${f.kind === 'sized' ? 'sizeSheet' : 'quickLog'}" data-id="${f.id}" style="border:none;background:#fff;width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #F2EEE6;text-align:left">${iconBox(f.icon, 30, 50, 17)}<span style="flex:1"><b style="display:block;font-size:16px">${esc(f.name)}</b><span class="small mut">${f.kind === 'sized' ? fmt(f.per100.k) + ' kcal ต่อ 100 g' : (n ? fmt(n.k) + ' kcal · 1 ' + esc(f.unit) : 'ยังไม่มีค่าฉลาก')}${f.src === 'est' ? ' · ค่าประมาณ' : ''}</span></span>${f.kind === 'sized' ? '<span class="badge" style="background:var(--greenL)">เลือกขนาด ›</span>' : '<span class="ic" style="width:40px;height:40px;border-radius:20px;background:var(--y);font-size:20px;font-weight:700">+</span>'}</button>`; }).join('');
    return `<div class="small mut" style="margin:18px 20px 8px;font-weight:700">เจอ ${found.length} รายการ</div><div class="card" style="padding:0;overflow:hidden">${rows}</div>` + footer(q);
  }
  const comp = S.comp && S.comp.src === q ? S.comp : (() => { const c = parseComposite(q); if (c) S.comp = { ...c, src: q }; else S.comp = null; return S.comp; })();
  if (comp) {
    const sumOf = (c) => c.parts.reduce((a, p) => ({ k: a.k + p.n.k * p.q, p: a.p + p.n.p * p.q, f: a.f + p.n.f * p.q }), { k: 0, p: 0, f: 0 });
    const tot = sumOf(comp); const kk = S.comp.override ?? tot.k * comp.qty;
    const rows = comp.parts.map((p, i) => `<div class="row" style="border-radius:18px;padding:8px;${p.q ? 'background:#F6F6F4' : 'background:#fff;opacity:.55;border:1.5px dashed #E0E0DC'}">${iconBox(p.icon, 26, 42, 14)}<span style="flex:1;min-width:0"><b style="font-size:15px;${p.q ? '' : 'text-decoration:line-through'}">${esc(p.name)}</b><span class="small mut" style="display:block">${p.q ? (p.base ? 'ฐาน' : p.extra ? 'เพิ่มเอง' : 'ไส้') + ' · ' + p.n.k + ' × ' + p.q + ' = ' + p.n.k * p.q + ' kcal' : 'เอาออกแล้ว · แตะ + เพื่อใส่คืน'}</span></span><button class="step" style="width:34px;height:34px;background:#fff" data-act="compQ" data-i="${i}" data-d="-1" aria-label="ลด ${esc(p.name)}">−</button><b style="width:16px;text-align:center">${p.q}</b><button class="step y" style="width:34px;height:34px" data-act="compQ" data-i="${i}" data-d="1" aria-label="เพิ่ม ${esc(p.name)}">+</button></div>`).join('');
    const addable = TOPPINGS.filter((t) => !comp.parts.some((p) => p.name === t.name)).slice(0, 5).map((t) => `<button class="chip" style="background:#fff;border:1.5px dashed #D9D2BC;height:32px" data-act="compAdd" data-name="${esc(t.name)}">${esc(t.name)} +${t.n.k}</button>`).join('');
    return `<div class="row" style="margin:16px 20px 0;justify-content:space-between"><span class="small" style="font-weight:700;color:var(--mut)">แยกส่วนจากพจนานุกรม</span><span class="small mut">แตะ − + เพื่อแก้</span></div>
      <div class="card" style="margin-top:8px;display:flex;flex-direction:column;gap:8px">${rows}
        <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small" style="font-weight:700;color:var(--mut)">+ เพิ่มส่วน</span>${addable}</div>
        <div class="row" style="justify-content:space-between;background:var(--yll);border-radius:18px;padding:10px 14px"><span style="font-size:13px;font-weight:600">${S.comp.override != null ? 'แก้เป็น' : 'รวม'} × ${comp.qty}</span><span><b style="font-size:30px">~${fmt(kk)}</b> <span class="small mut">kcal</span></span></div>
        ${S.comp.editing ? `<div class="row"><div class="inp" style="flex:1;height:50px"><label class="sr" for="comp-ov">ยอดรวมที่ถูกต้อง</label><input id="comp-ov" inputmode="numeric" placeholder="kcal ที่ถูกต้อง"><span class="small mut">kcal</span></div><button class="btn" style="width:auto;padding:0 20px;height:50px" data-act="compOvOk">ตกลง</button></div>` : ''}<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px"><button class="btn g" style="height:50px" data-act="compOverride">แก้เลขรวม</button><button class="btn" style="height:50px" data-act="compSave">บันทึก + จำไว้</button></div>
      </div>` + footer(q);
  }
  return `<div class="empty">${mascot('huh', 150, -1, 'มาสคอตสงสัย')}<b style="font-size:19px">ยังไม่รู้จัก "${esc(q)}"</b><span class="mut" style="font-size:14px">เพิ่มเป็นเมนูของฉันครั้งเดียว ครั้งหน้าพิมพ์หาเจอเลย</span></div>` + footer(q);
}

function vAddFood() {
  const a = S.af; const cats = [['main', 'จานหลัก'], ['veg', 'ผัก/ผลไม้'], ['snack', 'ขนม'], ['drink', 'เครื่องดื่ม']];
  const units = ['ชิ้น', 'จาน', 'ถ้วย', 'กล่อง', 'แก้ว', 'ลูก'];
  const num = (k, label, req) => `<div class="field"><label for="af-${k}" style="${req ? 'color:var(--ink)' : ''}">${label}${req ? ' <span style="color:#8A6D00">· ต้องใส่</span>' : ''}</label><input id="af-${k}" inputmode="decimal" data-input="af.${k}" value="${a[k] ?? ''}" placeholder="${req ? '0' : 'ถ้ารู้'}" style="height:52px;border-radius:16px;text-align:center;font-size:19px;font-weight:700;min-width:0;${req ? 'border:2px solid #FFD000;background:#FFFBE6' : 'border:1.5px dashed #CFCFCF;background:#fff'}"></div>`;
  const card = (n, title, inner, extra = '') => `<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="row"><span class="ic" style="width:26px;height:26px;border-radius:13px;background:var(--y);font-size:13px;font-weight:700">${n}</span><b style="font-size:16px">${title}</b>${extra}</div>${inner}</div>`;
  return `<div style="background:var(--g);min-height:100vh;padding-bottom:30px">` + topBar(a.id ? 'แก้เมนู' : 'เพิ่มเมนูของฉัน', 'กรอกครั้งเดียว ครั้งหน้าพิมพ์หาเจอเลย', a.back || 'other').replace('class="back"', 'class="back" style="background:#fff"') +
    card(1, 'ชื่อเมนู', `<input data-input="af.name" value="${esc(a.name)}" aria-label="ชื่อเมนู" style="height:52px;border-radius:16px;border:2px solid #FFD000;padding:0 14px;font-size:17px;font-weight:600">`) +
    card(2, 'ประเภท', `<div class="grid2" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${cats.map(([k, l]) => `<button data-act="afSet" data-k="cat" data-v="${k}" style="border:none;border-radius:18px;padding:10px 2px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:${a.cat === k ? 700 : 600};background:${a.cat === k ? '#FFF3B0;box-shadow:0 0 0 2px #FFD000' : 'var(--g)'}">${iconBox(CAT_ICON[k], 24, 40)}${l}</button>`).join('')}</div>`, '<span class="small mut">· ใช้เป็นไอคอน</span>') +
    card(3, 'นับเป็น', `<div class="row" style="gap:6px;flex-wrap:wrap">${units.map((u) => `<button class="chip ${a.unit === u ? 'on' : ''}" data-act="afSet" data-k="unit" data-v="${u}">${u}</button>`).join('')}</div>`) +
    card(4, 'ค่าต่อ 1 ' + esc(a.unit), `<div class="grid3" style="gap:8px">${num('k', 'kcal', true)}${num('p', 'Protein g')}${num('f', 'Fiber g')}</div>
      <div class="seg"><button class="${a.src === 'label' ? 'on' : ''}" data-act="afSet" data-k="src" data-v="label">จากฉลาก</button><button class="${a.src === 'est' ? 'on' : ''}" data-act="afSet" data-k="src" data-v="est">ประมาณเอา</button></div>
      <span class="small mut">ไม่รู้ตัวเลข? ถามในแชทก่อน แล้วกรอกครั้งเดียว</span>`) +
    card(5, 'ใช้เป็นของเติม', `<span class="small mut">ขึ้นในชุดแนะนำและหน้าเลือกเติมเอง</span>${a.addon ? `<div class="row" style="gap:6px;flex-wrap:wrap"><span class="small" style="font-weight:700;color:var(--mut)">ซื้อได้ที่</span>${['7-11', 'Lotus', 'ยิม'].map((x) => `<button class="chip ${a.stores.includes(x) ? 'on' : ''}" data-act="afStore" data-v="${x}">${a.stores.includes(x) ? '✓ ' : ''}${x}</button>`).join('')}</div>` : ''}`,
      `<button role="switch" aria-checked="${a.addon}" aria-label="ใช้เป็นของเติม" data-act="afToggle" style="margin-left:auto;width:52px;height:32px;border-radius:16px;border:none;background:${a.addon ? '#FFD000' : '#DDD'};position:relative"><span style="position:absolute;${a.addon ? 'right' : 'left'}:3px;top:3px;width:26px;height:26px;border-radius:13px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)"></span></button>`) +
    `<div id="af-err" class="small" style="color:#B3261E;margin:10px 20px 0;min-height:16px"></div><div style="margin:6px 16px 0;display:flex;flex-direction:column;gap:6px"><button class="btn" data-act="afSave" data-eat="1">${a.id ? 'บันทึกการแก้ไข' : 'บันทึกเมนู + กินเลย 1 ' + esc(a.unit)}</button>${a.id ? '' : '<button class="link" data-act="afSave" data-eat="0">บันทึกเมนูอย่างเดียว ยังไม่กิน</button>'}</div></div>`;
}

function vLog() {
  const k = S.logDate || todayKey(); const t = totals(k); const goal = goalOf(k); const min = addDays(todayKey(), -7);
  const st = db.dayStatus[k];
  const items = SLOTS.map((s) => { const es = entriesOn(k).filter((e) => e.slot === s.id);
    const head = `<div class="row" style="position:relative"><span class="ic" style="width:34px;height:34px;border-radius:17px;background:#fff;box-shadow:0 3px 10px rgba(31,31,31,.1)">${slotSvg(s.id)}</span><span class="badge" style="background:var(--g);color:var(--ink);font-size:12px">${s.name}</span><span class="small mut">${pad(s.from % 24)}:00–${s.to >= 24 ? 'ดึก' : pad(s.to) + ':00'}</span><span style="flex:1"></span><button class="step" style="background:var(--yl);width:36px;height:36px" data-act="logAdd" data-slot="${s.id}" aria-label="เพิ่มช่วง${s.name}">+</button></div>`;
    const rows = es.map((e) => `<button data-act="sheet" data-type="edit" data-id="${e.id}" style="margin-left:44px;border:none;background:#fff;border-radius:18px;box-shadow:0 6px 16px rgba(31,31,31,.08);min-height:56px;padding:0 14px 0 9px;display:flex;align-items:center;gap:10px;text-align:left;width:calc(100% - 44px)">${iconBox(e.icon, 22, 38, 13)}<span style="flex:1"><b style="font-size:15px">${esc(e.name)}</b><span class="small mut" style="display:block">${esc(e.unitLabel)}${e.src === 'est' ? ' · ค่าประมาณ' : ''}</span></span><b>${fmt(e.k)}</b><span class="small mut">kcal</span>${pencil()}</button>`).join('');
    return head + rows; }).join('');
  return topBar('บันทึกการกิน', '', 'today') +
    `<div class="card row" style="padding:6px"><button class="back" data-act="logDay" data-d="-1" ${k <= min ? 'disabled style="opacity:.3"' : ''} aria-label="วันก่อนหน้า">${chev('l', 18)}</button><div style="flex:1;text-align:center"><b style="font-size:17px">${k === todayKey() ? 'วันนี้' : k === addDays(todayKey(), -1) ? 'เมื่อวาน' : thDate(k)}</b><span class="small mut" style="display:block">${thDate(k)} · ย้อนได้ 7 วัน</span></div><button class="back" data-act="logDay" data-d="1" ${k >= todayKey() ? 'disabled style="opacity:.3"' : ''} aria-label="วันถัดไป">${chev('r', 18)}</button></div>
    <div class="row" style="margin:14px 20px 0;justify-content:space-between"><span class="mut">รวม <b style="color:var(--ink);font-size:18px">${fmt(t.k)}</b> / ${fmt(goal)} kcal</span>${st ? `<span class="badge" style="background:${st === 'done' ? 'var(--greenL)' : 'var(--g)'}">${st === 'done' ? 'ครบแล้ว ✓' : 'ข้าม'}</span>` : ''}</div>
    <div style="margin:14px 16px 0;position:relative;display:flex;flex-direction:column;gap:10px"><div style="position:absolute;left:16px;top:18px;bottom:18px;width:2px;background:#EFEFEC"></div>${items}</div>
    ${k !== todayKey() ? `<div style="margin:18px 16px 0"><button class="btn w" data-act="dayDone" data-date="${k}">${k === addDays(todayKey(), -1) ? 'เมื่อวาน' : thDate(k)} บันทึกครบแล้ว ✓</button></div>` : ''}` + nav();
}

function vWeek() {
  const mon = addDays(mondayOf(todayKey()), S.weekOff * 7); const days = [...Array(7)].map((_, i) => addDays(mon, i)); const today = todayKey();
  const lut = lutealDays();
  const dsel = S.dsel && days.includes(S.dsel) ? S.dsel : (days.includes(today) ? today : days[0]);
  const complete = days.filter((d) => d < today && entriesOn(d).length && db.dayStatus[d] !== 'skip');
  const avg = complete.length ? complete.reduce((a, d) => a + totals(d).k, 0) / complete.length : 0;
  const onT = complete.filter((d) => totals(d).k <= goalOf(d)).length;
  const dots = days.map((d) => { const tt = totals(d).k; const sty = d > today || !entriesOn(d).length ? 'border:1.5px dashed #BDBDBD' : (d === today ? 'background:#FFE88A' : tt > goalOf(d) ? 'background:#FF8A65' : 'background:#FFD000'); return `<span style="width:12px;height:12px;border-radius:6px;${sty};box-sizing:border-box"></span>`; }).join('');
  const chin = chinCompute(); const lv = chinLevel(); const p = db.profile;
  let progress = '';
  if (chin.mode === 'waist') {
    const total = chin.start - chin.target; const done = chin.start - chin.cur; const pct = total > 0 ? Math.max(0, Math.min(100, done / total * 100)) : 100;
    progress = `<div style="background:var(--g);border-radius:18px;padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px" role="img" aria-label="รอบเอวลดมาแล้ว ${r1(done)} จาก ${r1(total)} เซนติเมตร">
      <div class="row" style="justify-content:space-between;font-size:12px"><b>ทางไปเป้า</b><span class="mut">มาแล้ว <b style="color:var(--ink);font-size:14px">${r1(Math.max(0, done))}</b> จาก ${r1(Math.max(0, total))} cm</span></div>
      <div style="position:relative;height:14px;border-radius:7px;background:#fff"><span style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;border-radius:7px;background:#FFD000"></span><span style="position:absolute;left:calc(${pct}% - 10px);top:-3px;width:20px;height:20px;border-radius:10px;background:#1F1F1F;border:3px solid #fff;box-sizing:border-box"></span></div>
      <div class="row small mut" style="justify-content:space-between;font-size:11px"><span>เริ่ม ${r1(chin.start)}</span><b style="color:var(--ink)">ตอนนี้ ${r1(chin.cur)}</b><b style="color:#2F6B45">เป้า ${r1(chin.target)}</b></div>
      <span class="small mut" style="font-size:11px">เป้า = ส่วนสูง ${p.height} × 0.5 · เอวไม่เกินครึ่งหนึ่งของส่วนสูง</span></div>`;
  } else progress = `<button class="btn g" data-act="nav" data-to="weighin" style="height:48px;font-size:14px">วัดรอบเอวครั้งแรกเพื่อเริ่มดูเหนียง</button>`;
  const lvBars = [0, 1, 2, 3].map((i) => `<span style="flex:1;height:6px;border-radius:3px;background:${i <= lv ? '#FFD000' : '#EFEFEC'}"></span>`).join('');
  const chinCard = `<div class="card lift" style="display:flex;flex-direction:column;gap:10px">
    <div class="row" style="gap:12px"><span class="ic" style="width:84px;height:84px;border-radius:26px;background:var(--yll)">${mascot('happy', 76, lv, 'มาสคอตเหนียงระดับ ' + (lv + 1) + ' จาก 4')}</span>
      <div style="flex:1;display:flex;flex-direction:column;gap:4px"><span class="small" style="font-weight:700;color:var(--mut)">${chin.mode === 'weight' ? 'น้ำหนัก (ยังไม่มีรอบเอว)' : 'รอบเอว · ตัวแทนเหนียง'}</span>
        <span class="row" style="gap:6px;align-items:baseline"><b style="font-size:30px;line-height:1">${chin.mode === 'none' ? '–' : r1(chin.cur)}</b><span class="small mut">${chin.mode === 'weight' ? 'kg' : 'cm'}</span>${chin.mode !== 'none' && chin.start - chin.cur > 0 ? `<span class="badge" style="background:var(--greenL);color:#2F6B45">▼ ${r1(chin.start - chin.cur)}</span>` : ''}</span>
        <span class="row" style="gap:4px"><span class="small" style="font-weight:700;margin-right:4px;font-size:11px">เหนียง ${lv + 1}/4</span>${lvBars}</span></div></div>${progress}</div>`;
  // waist chart
  const wser = bodySeries(chin.mode === 'weight' ? 'weight' : 'waist'); const fld = chin.mode === 'weight' ? 'weight' : 'waist';
  const weeks = {}; wser.forEach((b) => { const m = mondayOf(b.date); (weeks[m] = weeks[m] || []).push(b[fld]); });
  const wk = Object.keys(weeks).sort().slice(-8).map((m) => ({ m, v: weeks[m].reduce((a, b) => a + b, 0) / weeks[m].length, lut: [...Array(7)].some((_, i) => lut.has(addDays(m, i))) }));
  let chart = '';
  if (wk.length >= 2) {
    const W = 330, H = 104; const vs = wk.map((x) => x.v); const mn = Math.min(...vs) - 0.5, mx = Math.max(...vs) + 0.5; const xs = wk.map((_, i) => 18 + i * (W - 36) / (wk.length - 1)); const ys = vs.map((v) => 12 + (mx - v) / (mx - mn) * (H - 28));
    const path = xs.map((x, i) => (i ? 'L' : 'M') + x.toFixed(1) + ',' + ys[i].toFixed(1)).join(' ');
    const ws = S.wsel != null && S.wsel < wk.length ? S.wsel : wk.length - 1; const sel = wk[ws]; const prev = ws > 0 ? wk[ws - 1].v : null;
    chart = `<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="row" style="justify-content:space-between"><b style="font-size:15px">${fld === 'waist' ? 'รอบเอว' : 'น้ำหนัก'} ${wk.length} สัปดาห์</b><span class="small mut">แตะจุดเพื่อดู</span></div>
      <div class="row" style="justify-content:space-between;background:var(--yll);border-radius:14px;padding:8px 12px;font-size:13px"><b>สัปดาห์ ${thDate(sel.m)}</b><span><b style="font-size:16px">${r1(sel.v)}</b> ${fld === 'waist' ? 'cm' : 'kg'} <span class="mut">${prev == null ? '' : (sel.v - prev > 0 ? '+' : '') + r1(sel.v - prev)}</span></span></div>
      ${sel.lut ? '<span class="small mut">ช่วงก่อนมีประจำเดือน บวมน้ำชั่วคราวได้ ไม่ต้องกังวล</span>' : ''}
      <div style="position:relative;width:${W}px;max-width:100%;height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟ${fld === 'waist' ? 'รอบเอว' : 'น้ำหนัก'}">${wk.map((x, i) => x.lut ? `<rect x="${xs[i] - 18}" y="0" width="36" height="${H - 8}" rx="10" fill="#F6EEF1"/>` : '').join('')}<path d="${path} L${xs[xs.length - 1]},${H - 8} L${xs[0]},${H - 8} Z" fill="#FFD000" opacity=".18"/><path d="${path}" fill="none" stroke="#E8B800" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      ${wk.map((x, i) => `<button data-act="wsel" data-i="${i}" aria-label="สัปดาห์ ${thDate(x.m)} ${r1(x.v)}" style="position:absolute;left:${xs[i] - (i === ws ? 10 : 6)}px;top:${ys[i] - (i === ws ? 10 : 6)}px;width:${i === ws ? 20 : 12}px;height:${i === ws ? 20 : 12}px;border-radius:50%;padding:0;border:3px solid #fff;background:${i === ws ? '#1F1F1F' : x.lut ? '#E89AB0' : '#E8B800'};box-shadow:0 1px 4px rgba(31,31,31,.25)"></button>`).join('')}</div>
      <div class="row small mut" style="gap:12px;font-size:11px"><span class="row" style="gap:4px"><span style="width:12px;height:10px;border-radius:3px;background:#F6EEF1"></span>ก่อนมีประจำเดือน</span></div></div>`;
  }
  // kcal bars
  const N = Object.fromEntries(SLOTS.map((s) => [s.id, s.name]));
  const st = totals(dsel); const diff = st.k - goalOf(dsel); const isToday = dsel === today;
  const segs = SLOTS.map((s) => [s.name, entriesOn(dsel).filter((e) => e.slot === s.id).reduce((a, e) => a + e.k, 0)]).filter((x) => x[1] > 0);
  const maxK = Math.max(2000, ...days.map((d) => totals(d).k));
  const bars = days.map((d) => { const tt = totals(d).k; const h = Math.max(6, Math.round(tt / maxK * 112)); const col = d === today ? '#FFE88A' : !tt ? '#EFEFEC' : tt > goalOf(d) ? '#FF8A65' : '#FFD000';
    return `<button data-act="dsel" data-d="${d}" aria-label="${thDate(d)} ${fmt(tt)} kcal" style="border:none;padding:0;width:100%;height:${h}px;border-radius:10px 10px 4px 4px;background:${col};${d === dsel ? 'box-shadow:0 0 0 2.5px #fff,0 0 0 4.5px #1F1F1F' : ''}"></button>`; }).join('');
  const tg = Math.round(targetBase(p).value / maxK * 112);
  const kcalCard = `<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="row" style="justify-content:space-between"><b style="font-size:15px">กินต่อวัน</b><span class="small mut">เฉลี่ย <b style="color:var(--ink)">${avg ? fmt(avg) : '–'}</b> kcal</span></div>
    <div style="background:var(--g);border-radius:14px;padding:8px 12px;display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between;font-size:13px"><b>${TH_DAYS[parseKey(dsel).getDay()]} ${thDate(dsel).split(' ').slice(1).join(' ')}${isToday ? ' (วันนี้)' : ''}</b><span><b style="font-size:16px">${fmt(st.k)}</b> kcal <span class="badge" style="${!st.k ? 'background:var(--g)' : isToday ? 'background:#FFF3B0;color:#5C4700' : diff > 0 ? 'background:#FFE6E0;color:#A33A1E' : 'background:#FFF3B0;color:#5C4700'}">${!st.k ? 'ยังไม่มี' : isToday ? 'ยังไม่จบวัน' : diff > 0 ? 'เกิน ' + fmt(diff) : 'ตามเป้า ✓'}</span></span></div>
      ${segs.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${segs.map(([n, v]) => `<span style="font-size:11px;background:#fff;border-radius:8px;padding:2px 8px">${n} ${fmt(v)}</span>`).join('')}</div>` : ''}</div>
    <div style="position:relative;height:144px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;align-items:end;padding-bottom:22px"><div style="position:absolute;left:0;right:0;bottom:${22 + tg}px;border-top:2px dashed #BDBDBD"></div>${bars}
      <div style="position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;font-size:12px;text-align:center">${days.map((d) => `<span style="${d === dsel ? 'font-weight:700' : 'color:var(--mut)'}">${TH_DAY[parseKey(d).getDay()].replace('.', '')}</span>`).join('')}</div></div>
    <div class="row small mut" style="gap:12px;font-size:11px"><span class="row" style="gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#FFD000"></span>ตามเป้า</span><span class="row" style="gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#FF8A65"></span>เกินเป้า</span><span class="row" style="gap:4px"><span style="width:14px;border-top:2px dashed #BDBDBD"></span>เป้า</span></div></div>`;
  const wt = bodySeries('weight'); const wtNow = wt.length ? wt[wt.length - 1].weight : p.startWeight;
  const spark = wt.length >= 2 ? (() => { const v = wt.slice(-8).map((b) => b.weight); const mn = Math.min(...v), mx = Math.max(...v) || 1; return `<svg width="120" height="34" viewBox="0 0 120 34" aria-hidden="true" style="margin-left:auto"><polyline points="${v.map((x, i) => (4 + i * 112 / Math.max(1, v.length - 1)).toFixed(1) + ',' + (4 + (mx - x) / Math.max(0.1, mx - mn) * 26).toFixed(1)).join(' ')}" fill="none" stroke="#BDBDBD" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`; })() : '';
  return hero('สัปดาห์นี้', thDate(days[0]) + ' – ' + thDate(days[6]), { pb: 62, right: `<span class="row" style="gap:6px"><button class="back" data-act="weekOff" data-d="-1" aria-label="สัปดาห์ก่อน" style="width:36px;height:36px">${chev('l', 16)}</button><span role="img" aria-label="ตามเป้า ${onT} จาก ${complete.length} วัน" style="background:#fff;border-radius:16px;padding:8px 10px;display:flex;gap:4px;box-shadow:0 6px 14px rgba(140,100,0,.15)">${dots}</span>${S.weekOff < 0 ? `<button class="back" data-act="weekOff" data-d="1" aria-label="สัปดาห์ถัดไป" style="width:36px;height:36px">${chev('r', 16)}</button>` : ''}</span>` }) +
    chinCard + chart + kcalCard +
    `<div class="card row" style="background:var(--g);box-shadow:none"><span><span class="small mut" style="display:block">น้ำหนัก (ดูประกอบ)</span><b style="font-size:16px">${r1(wtNow)} kg</b> ${wtNow < p.startWeight ? `<span class="small" style="font-weight:600;color:#2F6B45">▼ ${r1(p.startWeight - wtNow)}</span>` : ''}</span>${spark}</div>
    <div style="margin:12px 16px 0"><button class="btn" data-act="nav" data-to="weighin">วัดรอบเอว + ชั่งน้ำหนัก</button></div>` + nav();
}

function vWeighIn() {
  const w = S.wi; const lastP = [...db.periods].sort().pop();
  return hero('บันทึกสัปดาห์นี้', thDate(todayKey()), { back: 'week', pb: 62 }) +
    `<div class="card lift" style="display:flex;flex-direction:column;gap:10px"><label for="wi-w" style="font-size:15px;font-weight:700">น้ำหนัก</label><div class="inp" style="background:var(--yll)"><input id="wi-w" inputmode="decimal" data-input="wi.weight" value="${w.weight ?? ''}" placeholder="${db.profile.startWeight}" style="text-align:center;font-size:30px"><span class="mut">kg</span></div><span class="small mut">ชั่งตอนเช้า หลังเข้าห้องน้ำ ก่อนกินอะไร</span></div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px"><label for="wi-ws" style="font-size:15px;font-weight:700">รอบเอว <span class="small mut" style="font-weight:500">(สำคัญสุด · ใช้วัดเหนียง)</span></label><div class="inp" style="background:var(--yll)"><input id="wi-ws" inputmode="decimal" data-input="wi.waist" value="${w.waist ?? ''}" placeholder="เช่น 88" style="text-align:center;font-size:30px"><span class="mut">cm</span></div>
      <div class="row" style="background:var(--g);border-radius:18px;padding:10px 12px"><svg width="54" height="62" viewBox="0 0 54 62" aria-hidden="true"><path d="M17 4c0 8-3 12-3 20 0 6 2 9 2 14 0 6-2 12-2 20M37 4c0 8 3 12 3 20 0 6-2 9-2 14 0 6 2 12 2 20" fill="none" stroke="#1F1F1F" stroke-width="1.6" stroke-linecap="round"/><circle cx="27" cy="30" r="1.4" fill="#1F1F1F"/><ellipse cx="27" cy="30" rx="13.5" ry="3.2" fill="none" stroke="#4FA374" stroke-width="2.4"/></svg><span class="small" style="line-height:1.55">วัด <b>ระดับสะดือ</b> ยืนตรง หายใจออกตามปกติ สายวัดแนบ ไม่รัด · <b>วัดจุดเดิมทุกครั้ง</b></span></div></div>
    <div class="card row" style="gap:12px"><span class="ic" style="width:40px;height:40px;border-radius:20px;background:#FBE3EA"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 4.5 6 8 6 11.5a6 6 0 0 1-12 0C6 11 9 7.5 12 3z" fill="#E89AB0" stroke="#1F1F1F" stroke-width="1.5" stroke-linejoin="round"/></svg></span><span style="flex:1"><b style="font-size:14px">ประจำเดือน</b><span class="small mut" style="display:block">${lastP ? 'ครั้งล่าสุด ' + thDate(lastP) : 'แตะวันแรกที่มา · ใช้แรเงาช่วงบวมน้ำในกราฟ'}</span></span><button class="chip ${lastP === todayKey() ? 'on' : ''}" data-act="period">${lastP === todayKey() ? 'บันทึกแล้ว ✓' : 'มาวันนี้'}</button></div>
    <div id="wi-err" class="small" style="color:#B3261E;margin:10px 20px 0;min-height:16px"></div>
    <div style="margin:4px 16px 0"><button class="btn" data-act="wiSave">บันทึก</button></div>`;
}

function vMe() {
  const p = db.profile; const tb = targetBase(p);
  const paceBtn = (k, label, icon) => `<button data-act="pace" data-v="${k}" style="border:none;border-radius:24px;padding:14px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;background:${p.pace === k ? '#FFF3B0;box-shadow:0 0 0 2.5px #E8B800' : 'var(--g)'}">${icon}<b style="font-size:15px">${label}</b><span class="small mut">${PACE[k].kg} kg/สัปดาห์</span></button>`;
  const stack = `<div role="img" aria-label="ใช้ต่อวัน ${fmt(baseTDEE(p))} กินได้ ${fmt(tb.value)}" style="align-self:stretch;display:flex;flex-direction:column;gap:6px;margin-top:4px"><div style="display:flex;height:16px;border-radius:8px;overflow:hidden"><span style="flex:${tb.value};background:#FFD000"></span><span style="flex:${Math.max(0, baseTDEE(p) - tb.value)};background:repeating-linear-gradient(135deg,#FFE6E0 0 5px,#fff 5px 10px);border:1.5px dashed #FF8A65;border-radius:0 8px 8px 0"></span></div><div class="row small mut" style="justify-content:space-between;font-size:11px"><span>กินได้ ${fmt(tb.value)}</span><span>ลด ${fmt(baseTDEE(p) - tb.value)}</span><span>ใช้ต่อวัน ${fmt(baseTDEE(p))}</span></div></div>`;
  return hero(esc(p.name || 'ฉัน'), (p.sex === 'm' ? 'ชาย' : 'หญิง') + ' · ' + ageOf(p.birth) + ' ปี · ' + p.height + ' cm · เริ่ม ' + p.startWeight + ' kg', { pb: 70, right: mascot('happy', 90, chinLevel()) }) +
    `<div class="card lift" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px"><span class="mut" style="font-size:14px">เป้ากินต่อวัน</span><span><b style="font-size:46px">${fmt(tb.value)}</b> <span class="mut">kcal</span></span><span class="small mut">+ ${Math.round(p.watchPct * 100)}% ของที่เผาผลาญจาก Watch ในแต่ละวัน</span>${stack}
      <button class="link" data-act="sheet" data-type="formula" style="font-weight:700;color:var(--ink)">ตัวเลขนี้มาจากไหน ›</button>${tb.raw < tb.value ? '<span class="small" style="color:#A33A1E">ใช้ขั้นต่ำ ' + fmt(tb.value) + ' kcal เพื่อความปลอดภัย</span>' : ''}</div>
    <div class="h2">อยากลดเร็วแค่ไหน</div>
    <div class="grid3" style="margin:0 16px">${paceBtn('slow', 'สบายๆ', '<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17c0-4 3-7 7-7s6 3 6 5-1.5 3-3 3H4z" fill="#8FCB9F" stroke="#1F1F1F" stroke-width="1.3" stroke-linejoin="round"/><circle cx="11" cy="14" r="2.6" fill="#FFF3B0" stroke="#1F1F1F" stroke-width="1.2"/></svg>')}${paceBtn('rec', 'แนะนำ', '<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="#FF7A59" stroke="#1F1F1F" stroke-width="1.3"/><circle cx="12" cy="12" r="4.5" fill="#FFF4E8" stroke="#1F1F1F" stroke-width="1.2"/><circle cx="12" cy="12" r="1.5" fill="#1F1F1F"/></svg>')}${paceBtn('fast', 'เร่ง', '<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L5 14h6l-1 8 8-12h-6z" fill="#FFC75A" stroke="#1F1F1F" stroke-width="1.3" stroke-linejoin="round"/></svg>')}</div>
    <div class="h2">เป้าย่อยต่อวัน</div>
    <div class="grid3" style="margin:0 16px">${[['chicken', proteinTarget() + ' g', 'Protein'], ['veg', FIBER + ' g', 'Fiber'], ['watch', Math.round(p.watchPct * 100) + '%', 'นับจาก Watch']].map(([i, v, l]) => `<div style="background:var(--g);border-radius:20px;padding:12px">${svgI(i, 22)}<b style="display:block;font-size:19px">${v}</b><span class="small mut">${l}</span></div>`).join('')}</div>
    <div class="card" style="padding:4px 0;margin-top:14px">${[['foods', 'รายการอาหารของฉัน'], ['meals', 'มื้อประจำ (เนื้อสัตว์ + ปริมาณ)'], ['profileEdit', 'แก้ข้อมูลร่างกาย']].map(([a, l]) => `<button data-act="sheet" data-type="${a}" style="width:100%;border:none;background:none;min-height:54px;padding:0 16px;display:flex;align-items:center;font-size:15px;font-weight:600;border-bottom:1px solid #F2EEE6;text-align:left"><span style="flex:1">${l}</span>${chev('r', 18)}</button>`).join('')}
      <button data-act="exportJson" style="width:100%;border:none;background:none;min-height:54px;padding:0 16px;display:flex;align-items:center;font-size:15px;font-weight:600;border-bottom:1px solid #F2EEE6"><span style="flex:1;text-align:left">สำรองข้อมูล (JSON)</span>${chev('r', 18)}</button>
      <button data-act="exportCsv" style="width:100%;border:none;background:none;min-height:54px;padding:0 16px;display:flex;align-items:center;font-size:15px;font-weight:600;border-bottom:1px solid #F2EEE6"><span style="flex:1;text-align:left">Export CSV (ไว้วิเคราะห์ต่อ)</span>${chev('r', 18)}</button>
      <label style="width:100%;min-height:54px;padding:0 16px;display:flex;align-items:center;font-size:15px;font-weight:600;cursor:pointer"><span style="flex:1">นำเข้าข้อมูลสำรอง</span><input type="file" accept="application/json" data-input="import" class="sr">${chev('r', 18)}</label></div>
    <p class="small mut" style="margin:14px 20px;line-height:1.6">ข้อมูลเก็บในเครื่องนี้เท่านั้น ถ้าลบแอปหรือล้างข้อมูลเบราว์เซอร์จะหาย · สำรองไว้เป็นระยะ<br>ค่าโภชนาการเป็นค่าประมาณ ไม่ใช่คำแนะนำทางการแพทย์</p>` + nav();
}

/* onboarding */
function vOnboard() {
  const o = S.ob; const st = S.obStep;
  const dots = `<div class="row" style="gap:6px;justify-content:center;position:relative">${[1, 2, 3].map((i) => `<span style="width:${i === st ? 22 : 8}px;height:8px;border-radius:4px;background:${i === st ? '#1F1F1F' : '#E0D9C4'}"></span>`).join('')}</div>`;
  const head = (mood, t, s) => `<div class="hero" style="padding-bottom:24px;text-align:center"><span class="blob" style="width:160px;height:160px;right:-40px;top:-56px"></span>${dots}<div style="position:relative;display:flex;justify-content:center">${mascot(mood, 120)}</div><h1 style="position:relative">${t}</h1><div class="sub" style="position:relative">${s}</div></div>`;
  const f = (lbl, k, unit, ph = '', type = 'decimal') => `<div class="field"><label for="ob-${k}">${lbl}</label><div class="inp"><input id="ob-${k}" ${type === 'date' ? 'type="date"' : `inputmode="${type}"`} data-input="ob.${k}" value="${esc(o[k] ?? '')}" placeholder="${ph}"><span class="small mut">${unit}</span></div></div>`;
  let body = '';
  if (st === 1) body = head('wave', 'สวัสดี! เราคือเหนียง', 'บอกข้อมูลนิดหน่อย จะคำนวณเป้าให้') + `<div style="margin:18px;display:flex;flex-direction:column;gap:12px">
      <div class="field"><label for="ob-name">ชื่อเล่น</label><div class="inp"><input id="ob-name" data-input="ob.name" value="${esc(o.name || '')}" placeholder="เช่น Cheese"></div></div>
      <div class="grid2"><button class="btn ${o.sex === 'f' ? '' : 'g'}" style="height:50px" data-act="obSet" data-k="sex" data-v="f">หญิง</button><button class="btn ${o.sex === 'm' ? '' : 'g'}" style="height:50px" data-act="obSet" data-k="sex" data-v="m">ชาย</button></div>
      <div class="grid2">${f('วันเกิด', 'birth', '', '', 'date')}${f('ส่วนสูง', 'height', 'cm', '169')}</div>
      <div class="grid2">${f('น้ำหนัก', 'weight', 'kg', '77')}${f('รอบเอว (ไม่บังคับ)', 'waist', 'cm', '')}</div>
      <div id="ob-err" class="small" style="color:#B3261E;min-height:16px"></div><button class="btn" data-act="obNext">ถัดไป</button></div>`;
  if (st === 2) body = head('happy', 'มื้อประจำของเธอ', 'เลือกที่กินบ่อย จะกลายเป็นปุ่มแตะเดียว') + `<div style="margin:18px;display:flex;flex-direction:column;gap:14px">
      <div class="grid2" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${Object.entries(MEATS).map(([k, m]) => `<button data-act="obMeat" data-v="${k}" style="border:none;border-radius:22px;padding:12px 4px;display:flex;flex-direction:column;align-items:center;gap:6px;background:${o.meats.includes(k) ? '#FFF8D6;box-shadow:0 0 0 2px #FFD000' : 'var(--g)'}">${iconBox(m.icon, 30, 50, 18)}<b style="font-size:14px">${m.name}</b></button>`).join('')}</div>
      <div class="card" style="margin:0;display:flex;flex-direction:column;gap:10px"><span class="small" style="font-weight:700;color:var(--mut)">1 มื้อกินประมาณ</span>
        ${[['meatG', 'เนื้อสุก', 10], ['riceG', 'ข้าวสวย', 25]].map(([k, l, step]) => `<div class="row"><b style="flex:1;font-size:14px">${l}</b><button class="step" data-act="obStep" data-k="${k}" data-d="-${step}" aria-label="ลด${l}">−</button><b style="width:64px;text-align:center">${o[k]} g</b><button class="step" data-act="obStep" data-k="${k}" data-d="${step}" aria-label="เพิ่ม${l}">+</button></div>`).join('')}</div>
      <div id="ob-err" class="small" style="color:#B3261E;min-height:16px"></div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px"><button class="btn g" data-act="obBack">ย้อน</button><button class="btn" data-act="obNext">ถัดไป</button></div></div>`;
  if (st === 3) body = head('yay', 'ของที่เติมได้', 'วันที่คิดไม่ออก เราจะเลือกจากพวกนี้ให้') + `<div style="margin:18px;display:flex;flex-direction:column;gap:10px">
      <div class="grid2" style="gap:8px">${STARTER_FOODS.map((x) => `<button data-act="obAddon" data-v="${x.id}" style="border:none;border-radius:20px;padding:10px;display:flex;align-items:center;gap:10px;text-align:left;background:${o.addons.includes(x.id) ? '#FFF8D6;box-shadow:0 0 0 2px #FFD000' : 'var(--g)'}">${iconBox(x.icon, 24, 40, 14)}<span style="flex:1"><b style="display:block;font-size:14px">${x.name}</b><span class="small mut">${x.stores.join('/') || '–'}</span></span><span class="ic" style="width:22px;height:22px;border-radius:11px;${o.addons.includes(x.id) ? 'background:#FFD000' : 'border:2px solid #CFCFCF'};font-size:12px;font-weight:700">${o.addons.includes(x.id) ? '✓' : ''}</span></button>`).join('')}</div>
      <span class="small mut">ของแพ็กเกจ เช่น นมโปรตีน จะให้กรอกจากฉลากตอนใช้ครั้งแรก</span>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:8px"><button class="btn g" data-act="obBack">ย้อน</button><button class="btn" data-act="obFinish">เริ่มใช้เลย</button></div></div>`;
  return body;
}

/* ================= sheets ================= */
function sheetHtml() {
  const s = S.sheet; if (!s) return '';
  const wrap = (inner, center = false) => `<div class="overlay ${center ? 'center' : ''}" data-act="overlay"><div class="${center ? 'modal' : 'sheet'}" role="dialog" aria-modal="true" data-stop="1">${center ? '' : '<span class="handle"></span>'}${inner}</div></div>`;
  const closeBtn = '<button class="back" data-act="close" aria-label="ปิด" style="width:40px;height:40px">' + xIcon + '</button>';
  if (s.type === 'size') {
    const f = foodById(s.id); const g = s.grams ?? f.def; const q = s.qty ?? 1; const n = nutr(f, { grams: g, qty: q });
    const maxG = Math.max(...f.sizes.map((z) => z[0]));
    return wrap(`<div class="row">${iconBox(f.icon, 30, 48, 16)}<span style="flex:1"><b style="font-size:19px">${esc(f.name)} ขนาดไหน?</b><span class="small mut" style="display:block">${f.per100.k} kcal · fiber ${f.per100.f} g ต่อ 100 g</span></span>${closeBtn}</div>
      <div class="grid3">${f.sizes.map(([gg, l, ref]) => `<button class="size ${gg === g ? 'on' : ''}" data-act="sizePick" data-g="${gg}"><span style="width:${20 + gg / maxG * 36}px;height:${20 + gg / maxG * 36}px;border-radius:50%;background:${(ICONS[f.icon] || ICONS.veg)[0] === '#E7F4EA' ? '#A9D98B' : '#FFC75A'};border:1.5px solid #1F1F1F"></span><span style="flex:1"></span><b style="font-size:15px">${l}</b><span class="small mut" style="font-size:11px">${ref}</span><span style="font-size:12px;font-weight:600">${gg} g · ${fmt(f.per100.k * gg / 100)}</span></button>`).join('')}</div>
      <div class="row"><b style="flex:1;font-size:15px">จำนวน</b><button class="step" data-act="sizeQ" data-d="-1" aria-label="ลด">−</button><b style="width:36px;text-align:center;font-size:19px">${q}</b><button class="step" data-act="sizeQ" data-d="1" aria-label="เพิ่ม">+</button></div>
      <div class="row" style="gap:8px"><label class="small mut" for="sz-g" style="flex:1">รู้น้ำหนักจากแพ็ก? กรอกกรัมเอง</label><div class="inp" style="height:44px;width:120px"><input id="sz-g" inputmode="numeric" data-input="sizeG" placeholder="${g}"><span class="small mut">g</span></div></div>
      <button class="btn" data-act="sizeSave">เพิ่ม · ${fmt(n.k)} kcal · fiber ${r1(n.f)} g</button>`);
  }
  if (s.type === 'watch') {
    const k = s.date || todayKey(); const v = s.v ?? String(activeOf(k) || '');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((x) => x ? `<button data-act="key" data-v="${x}" style="height:52px;border-radius:18px;border:none;background:var(--g);font-size:22px;font-weight:600" aria-label="${x === '⌫' ? 'ลบ' : x}">${x}</button>` : '<span></span>').join('');
    const credit = Math.round((Number(v) || 0) * db.profile.watchPct);
    return wrap(`<div class="row">${iconBox('watch', 28, 48, 16)}<span style="flex:1"><b style="font-size:19px">เผาผลาญจาก Watch วันนี้</b><span class="small mut" style="display:block">ดูตัวเลข Active ในแอป Fitness แล้วกรอก</span></span>${closeBtn}</div>
      <div style="text-align:center"><b style="font-size:52px">${v || '0'}</b> <span class="mut">kcal</span></div>
      <div><div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--g)"><span style="width:${db.profile.watchPct * 100}%;background:var(--y)"></span></div><div class="row small mut" style="justify-content:space-between;margin-top:6px"><span><b style="color:var(--ink)">+${credit}</b> เข้าโควต้าวันนี้ (${Math.round(db.profile.watchPct * 100)}%)</span><span>เผื่อ Watch นับเกิน</span></div></div>
      <div class="grid3" style="gap:8px">${keys}</div><button class="btn" data-act="watchSave">บันทึก</button>`);
  }
  if (s.type === 'edit') {
    const e = db.entries.find((x) => x.id === s.id); if (!e) return '';
    const q = s.qty ?? e.qty; const slot = s.slot ?? e.slot;
    return wrap(`<div class="row">${iconBox(e.icon, 30, 52, 18)}<span style="flex:1"><b style="font-size:19px">${esc(e.name)}</b><span class="small mut" style="display:block">${esc(e.unitLabel)} · ${fmt(e.k)} kcal</span></span>${closeBtn}</div>
      <div class="row"><b style="flex:1;font-size:15px">จำนวน</b><button class="step" data-act="editQ" data-d="-0.5" aria-label="ลด">−</button><b style="width:44px;text-align:center;font-size:19px">${q}</b><button class="step" data-act="editQ" data-d="0.5" aria-label="เพิ่ม">+</button></div>
      <div><b style="font-size:15px">ช่วงเวลา</b><div class="grid3" style="grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:8px">${SLOTS.map((x) => `<button data-act="editSlot" data-v="${x.id}" style="border:none;border-radius:16px;padding:8px 0;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:${slot === x.id ? 700 : 600};background:${slot === x.id ? '#FFF3B0;box-shadow:0 0 0 2px #FFD000' : 'var(--g)'}">${slotSvg(x.id)}${x.name}</button>`).join('')}</div></div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px"><button class="btn danger" data-act="editDel">ลบ</button><button class="btn" data-act="editSave">บันทึกการแก้ไข</button></div>`);
  }
  if (s.type === 'bucket') {
    return wrap(`<div class="row"><b style="flex:1;font-size:19px">ไม่รู้ kcal · เลือกขนาด</b>${closeBtn}</div><span class="small mut">ตั้งสูงไว้เล็กน้อย เพราะคนมักประเมินอาหารร้านต่ำกว่าจริง · บันทึกเป็นค่าประมาณ</span>
      ${[['out', 'มื้อนอกบ้าน', 'main'], ['snack', 'ขนม / ของว่าง', 'snack']].map(([k, l, ic]) => `<b style="font-size:14px">${l}</b><div class="grid3">${BUCKETS[k].map(([n, v], i) => `<button data-act="bucketLog" data-k="${k}" data-v="${v}" data-n="${n}" style="border:none;border-radius:18px;background:${['#FFF8D6', '#FFF3B0', '#FFE88A'][i]};padding:12px 4px;display:flex;flex-direction:column;align-items:center;gap:4px">${svgI(ic, 22 + i * 6)}<b>${n}</b><span class="small">${v}</span></button>`).join('')}</div>`).join('')}`);
  }
  if (s.type === 'label') {
    const f = foodById(s.id || s.foodId);
    return wrap(`<div class="row">${iconBox(f.icon, 28, 48, 16)}<span style="flex:1"><b style="font-size:19px">${esc(f.name)}</b><span class="small mut" style="display:block">กรอกจากฉลาก ต่อ 1 ${esc(f.unit)} · ครั้งเดียว</span></span>${closeBtn}</div>
      <div class="grid3" style="gap:8px">${[['k', 'kcal'], ['p', 'Protein g'], ['f', 'Fiber g']].map(([k, l]) => `<div class="field"><label for="lb-${k}">${l}</label><input id="lb-${k}" inputmode="decimal" data-input="lb.${k}" value="${s[k] ?? ''}" style="height:52px;border-radius:16px;border:2px solid ${k === 'k' ? '#FFD000' : '#EFEFEC'};text-align:center;font-size:19px;font-weight:700;min-width:0"></div>`).join('')}</div>
      <div id="lb-err" class="small" style="color:#B3261E;min-height:16px"></div><button class="btn" data-act="labelSave">บันทึกค่าฉลาก${s.then ? ' + กินเลย' : ''}</button>`);
  }
  if (s.type === 'check') {
    const y = s.date; const t = totals(y); const has = (id) => entriesOn(y).some((e) => e.slot === id);
    return wrap(`<div style="background:var(--y);padding:24px 20px 20px;display:flex;flex-direction:column;align-items:center;gap:8px">${mascot('happy', 90)}<b style="font-size:21px">เมื่อวานบันทึกครบไหม?</b></div>
      <div style="padding:16px 18px 20px;display:flex;flex-direction:column;gap:12px"><div style="background:var(--g);border-radius:20px;padding:12px 14px"><div class="row small mut" style="justify-content:space-between"><span>${thDate(y)}</span><span><b style="color:var(--ink)">${fmt(t.k)}</b> / ${fmt(goalOf(y))} kcal</span></div>
        <div class="grid3" style="grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-top:8px;font-size:11px;font-weight:600;text-align:center">${SLOTS.map((x) => `<span style="border-radius:10px;padding:6px 0;background:${has(x.id) ? '#FFF3B0' : '#fff'};color:${has(x.id) ? 'var(--ink)' : 'var(--mut)'}">${x.name} ${has(x.id) ? '✓' : '–'}</span>`).join('')}</div></div>
        <button class="btn" data-act="checkFill">ยังไม่ครบ · เติมย้อนหลัง</button><button class="btn w" data-act="checkDone">ครบแล้ว กินแค่นี้จริง</button><button class="link" data-act="checkSkip">ไม่ครบ ข้ามไป (ไม่นับเข้าค่าเฉลี่ย)</button></div>`, true);
  }
  if (s.type === 'formula') {
    const p = db.profile; const tb = targetBase(p);
    return wrap(`<div class="row"><b style="flex:1;font-size:19px">เป้ามาจากไหน</b>${closeBtn}</div>
      ${[['BMR (Mifflin-St Jeor)', fmt(bmr(p))], ['× 1.2 นั่งทำงาน = ใช้ต่อวัน', fmt(baseTDEE(p))], ['− ' + PACE[p.pace].def + ' เพื่อลด ' + PACE[p.pace].kg + ' kg/สัปดาห์', fmt(tb.raw)], ['ขั้นต่ำเพื่อความปลอดภัย', p.sex === 'm' ? '1,500' : '1,200'], ['เป้าฐานต่อวัน', fmt(tb.value)]].map(([l, v], i) => `<div class="row" style="${i === 4 ? 'background:var(--y);border-radius:16px;padding:10px 12px' : 'padding:0 4px'}"><span style="flex:1;font-size:14px">${l}</span><b style="font-size:${i === 4 ? 22 : 17}px">${v}</b></div>`).join('')}
      <span class="small mut" style="line-height:1.6">บวก ${Math.round(p.watchPct * 100)}% ของ active kcal จาก Watch ทุกวัน · ใช้ ×1.2 เป็นฐานเพื่อไม่นับการออกกำลังซ้ำ · protein 1.2 g/kg = ${proteinTarget()} g</span>
      <div class="row"><b style="flex:1;font-size:14px">นับจาก Watch</b>${[0.5, 0.6, 0.7, 0.8].map((v) => `<button class="chip ${p.watchPct === v ? 'on' : ''}" data-act="watchPct" data-v="${v}">${v * 100}%</button>`).join('')}</div>`);
  }
  if (s.type === 'foods') {
    const list = db.foods.filter((f) => !f.deleted).sort((a, b) => (b.addon - a.addon) || a.name.localeCompare(b.name, 'th'));
    return wrap(`<div class="row"><b style="flex:1;font-size:19px">รายการอาหารของฉัน</b>${closeBtn}</div><button class="btn g" data-act="addFood" data-name="" style="height:48px">+ เพิ่มเมนูใหม่</button>
      ${list.map((f) => { const n = nutr(f); return `<div class="row" style="padding:6px 0;border-bottom:1px solid #F2EEE6">${iconBox(f.icon, 22, 38, 13)}<span style="flex:1;min-width:0"><b style="font-size:14px">${esc(f.name)}</b><span class="small mut" style="display:block">${f.kind === 'sized' ? f.per100.k + ' kcal/100 g' : n ? fmt(n.k) + ' kcal/' + esc(f.unit) : 'ยังไม่มีค่าฉลาก'}${f.addon ? ' · ของเติม ' + (f.hidden ? '(ซ่อน)' : '') : ''}</span></span><button class="chip" style="height:34px" data-act="sheet" data-type="foodMenu" data-id="${f.id}">จัดการ</button></div>`; }).join('')}`);
  }
  if (s.type === 'foodMenu') {
    const f = foodById(s.id);
    return wrap(`<div class="row">${iconBox(f.icon, 26, 44, 15)}<b style="flex:1;font-size:18px">${esc(f.name)}</b>${closeBtn}</div>
      ${f.addon ? `<button class="btn g" data-act="foodHide" data-id="${f.id}">${f.hidden ? 'แสดงในของเติมอีกครั้ง' : 'ไม่แสดงในของเติม · ยังพิมพ์หาได้'}</button>` : `<button class="btn g" data-act="foodAddon" data-id="${f.id}">ใช้เป็นของเติม</button>`}
      ${f.kind !== 'sized' ? `<button class="btn g" data-act="foodEdit" data-id="${f.id}">แก้ไข</button>` : ''}
      <button class="btn danger" data-act="foodDel" data-id="${f.id}">ลบเมนูนี้ · บันทึกเก่ายังอยู่ครบ</button>`);
  }
  if (s.type === 'meals') {
    const p = db.profile;
    return wrap(`<div class="row"><b style="flex:1;font-size:19px">มื้อประจำ</b>${closeBtn}</div>
      <div class="grid2" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${Object.entries(MEATS).map(([k, m]) => `<button data-act="mealToggle" data-v="${k}" style="border:none;border-radius:20px;padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:6px;background:${p.meats.includes(k) ? '#FFF8D6;box-shadow:0 0 0 2px #FFD000' : 'var(--g)'}">${iconBox(m.icon, 26, 44, 16)}<b style="font-size:13px">${m.name}</b></button>`).join('')}</div>
      ${[['meatG', 'เนื้อสุก', 10], ['riceG', 'ข้าวสวย', 25]].map(([k, l, st]) => `<div class="row"><b style="flex:1;font-size:14px">${l}</b><button class="step" data-act="mealStep" data-k="${k}" data-d="-${st}" aria-label="ลด${l}">−</button><b style="width:64px;text-align:center">${p[k]} g</b><button class="step" data-act="mealStep" data-k="${k}" data-d="${st}" aria-label="เพิ่ม${l}">+</button></div>`).join('')}
      <button class="btn" data-act="close">เสร็จ</button>`);
  }
  if (s.type === 'profileEdit') {
    const p = db.profile;
    return wrap(`<div class="row"><b style="flex:1;font-size:19px">ข้อมูลร่างกาย</b>${closeBtn}</div>
      <div class="field"><label for="pe-name">ชื่อเล่น</label><div class="inp"><input id="pe-name" data-input="pe.name" value="${esc(s.name ?? p.name ?? '')}"></div></div>
      <div class="grid2"><div class="field"><label for="pe-birth">วันเกิด</label><div class="inp"><input id="pe-birth" type="date" data-input="pe.birth" value="${esc(s.birth ?? p.birth)}"></div></div><div class="field"><label for="pe-h">ส่วนสูง</label><div class="inp"><input id="pe-h" inputmode="decimal" data-input="pe.height" value="${esc(s.height ?? p.height)}"><span class="small mut">cm</span></div></div></div>
      <div class="field"><label for="pe-w">น้ำหนักตั้งต้น (ใช้คำนวณเป้า)</label><div class="inp"><input id="pe-w" inputmode="decimal" data-input="pe.startWeight" value="${esc(s.startWeight ?? p.startWeight)}"><span class="small mut">kg</span></div></div>
      <button class="btn" data-act="peSave">บันทึก</button><button class="link" data-act="resetAll" style="color:#B3261E">ล้างข้อมูลทั้งหมด</button>`);
  }
  if (s.type === 'confirm') return wrap(`<b style="font-size:18px;line-height:1.5">${esc(s.msg)}</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="btn g" data-act="close">ยกเลิก</button><button class="btn danger" data-act="${s.yes}">${esc(s.label)}</button></div>`);
  return '';
}

/* ================= render ================= */
const app = document.getElementById('app'); const layer = document.getElementById('layer');
function render() {
  let html = '';
  if (!db) html = vOnboard();
  else html = ({ today: vToday, suggest: vSuggest, pick: vPick, other: vOther, addfood: vAddFood, log: vLog, week: vWeek, weighin: vWeighIn, me: vMe }[S.view] || vToday)();
  app.innerHTML = html; renderLayer(); renderToast();
}
function renderLayer() { const t = layer.querySelector('.toast'); layer.innerHTML = sheetHtml(); if (t) layer.appendChild(t); renderToast(); }
function renderToast() {
  const old = layer.querySelector('.toast'); if (old) old.remove();
  if (!S.toast) return;
  const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status');
  d.innerHTML = `<span class="ic" style="width:52px;height:52px;border-radius:18px;background:var(--y)">${mascot(S.toast.mood, 48)}</span><span style="flex:1;min-width:0"><b style="display:block;font-size:15px">${S.toast.mood === 'calm' ? 'บันทึกแล้ว ไม่เป็นไรน้า' : S.toast.mood === 'huh' ? 'อุ๊ย' : 'เย้ บันทึกแล้ว!'}</b><span style="font-size:12px;color:#D6D6D6">${esc(S.toast.msg)}</span></span>${S.toast.undoId ? '<button data-act="undo" style="height:36px;padding:0 12px;border-radius:18px;border:none;background:#333;color:#FFE680;font-size:13px;font-weight:700">เลิกทำ</button>' : ''}`;
  layer.appendChild(d);
}

/* ================= actions ================= */
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const A = {
  nav: (el) => { if (el.dataset.to === 'suggest') S.comboIdx = 0; if (el.dataset.to === 'pick') S.pick = {}; if (el.dataset.to === 'other') { S.q = ''; S.comp = null; } if (el.dataset.to === 'weighin') S.wi = {}; if (['today', 'week', 'me'].includes(el.dataset.to)) S.ctx = null; go(el.dataset.to); },
  back: (el) => { const to = el.dataset.to; if (['today', 'week', 'me'].includes(to)) S.ctx = null; go(to); },
  close: () => closeSheet(),
  overlay: (el, ev) => { if (ev.target === el) closeSheet(); },
  noop: () => {},
  sheet: (el) => { const t = el.dataset.type; const sh = { type: t, id: el.dataset.id }; if (t === 'watch') sh.date = todayKey(); openSheet(sh); },
  logMeal: (el) => { const m = mealFoods().find((x) => x.id === el.dataset.id); const e = addEntry(m); if (e) afterLog([e]); },
  quickLog: (el) => { const f = foodById(el.dataset.id); if (f.kind === 'sized') return openSheet({ type: 'size', id: f.id }); const e = addEntry(f); if (e) afterLog([e]); },
  sizeSheet: (el) => openSheet({ type: 'size', id: el.dataset.id, fromPick: S.view === 'pick' }),
  sizePick: (el) => { S.sheet.grams = Number(el.dataset.g); renderLayer(); },
  sizeQ: (el) => { S.sheet.qty = Math.max(1, (S.sheet.qty ?? 1) + Number(el.dataset.d)); renderLayer(); },
  sizeSave: () => { const s = S.sheet; const f = foodById(s.id); const g = s.customG || s.grams || f.def; const q = s.qty || 1;
    if (s.fromPick) { S.pick[f.id] = q; S.pickG = S.pickG || {}; S.pickG[f.id] = g; closeSheet(); render(); return; }
    const e = addEntry(f, { grams: g * q }); closeSheet(); if (e) afterLog([e]); },
  store: (el) => { S.store = el.dataset.v; S.comboIdx = 0; render(); },
  comboNext: () => { S.comboIdx++; render(); },
  comboEdit: (el) => { const k = (S.ctx && S.ctx.date) || todayKey(); const cs = suggestCombos(k, S.store).combos; const c = cs[S.comboIdx % Math.max(1, cs.length)]; const it = c && c.items[Number(el.dataset.i)]; if (!it) return; if (it.food.kind === 'sized') openSheet({ type: 'size', id: it.food.id }); },
  comboEat: () => { const k = (S.ctx && S.ctx.date) || todayKey(); const s = suggestCombos(k, S.store); const c = s.combos[S.comboIdx % s.combos.length]; const es = c.items.map((i) => addEntry(i.food, i.food.kind === 'sized' ? { grams: i.grams } : { qty: i.qty })).filter(Boolean); afterLog(es); },
  pickAdd: (el) => { const f = foodById(el.dataset.id); if (!f.n && f.kind !== 'sized') return openSheet({ type: 'label', id: f.id }); S.pick[f.id] = (S.pick[f.id] || 0) + 1; render(); },
  pickDec: (el) => { S.pick[el.dataset.id] = Math.max(0, (S.pick[el.dataset.id] || 0) - 1); render(); },
  pickSave: () => { const es = Object.entries(S.pick).filter(([, q]) => q > 0).map(([id, q]) => { const f = foodById(id); return f.kind === 'sized' ? addEntry(f, { grams: ((S.pickG || {})[id] || f.def) * q }) : addEntry(f, { qty: q }); }).filter(Boolean); S.pick = {}; S.pickG = {}; afterLog(es); },
  compQ: (el) => { const p = S.comp.parts[Number(el.dataset.i)]; p.q = Math.max(p.base ? 1 : 0, Math.min(5, p.q + Number(el.dataset.d))); S.comp.override = null; refreshResults(); },
  compAdd: (el) => { const t = TOPPINGS.find((x) => x.name === el.dataset.name); S.comp.parts.push({ ...t, q: 1, extra: true }); S.comp.override = null; refreshResults(); },
  compOverride: () => { S.comp.editing = true; refreshResults(); const i = document.getElementById('comp-ov'); if (i) i.focus(); },
  compOvOk: () => { const v = num((document.getElementById('comp-ov') || {}).value); if (v != null && v > 0) S.comp.override = v; S.comp.editing = false; refreshResults(); },
  compSave: () => { const c = S.comp; const sum = c.parts.reduce((a, p) => ({ k: a.k + p.n.k * p.q, p: a.p + p.n.p * p.q, f: a.f + p.n.f * p.q }), { k: 0, p: 0, f: 0 });
    const k1 = c.override != null ? c.override / c.qty : sum.k; const ratio = sum.k ? k1 / sum.k : 1;
    const base = c.parts.find((p) => p.base); const f = { id: uid(), name: c.name, aliases: [], cat: base && base.icon === 'main' ? 'main' : 'snack', icon: base ? base.icon : 'snack', kind: 'item', unit: 'ชิ้น', n: { k: r1(k1), p: r1(sum.p * ratio), f: r1(sum.f * ratio) }, addon: false, stores: [], src: 'est', userId: db.userId, createdAt: new Date().toISOString() };
    db.foods.push(f); const e = addEntry(f, { qty: c.qty }); S.comp = null; S.q = ''; if (e) afterLog([e]); },
  addFood: (el) => { closeSheet(); S.af = { name: el.dataset.name || '', cat: 'main', unit: 'ชิ้น', k: '', p: '', f: '', src: 'est', addon: false, stores: [], back: S.view === 'me' ? 'me' : 'other' }; go('addfood'); },
  afSet: (el) => { S.af[el.dataset.k] = el.dataset.v; render(); },
  afToggle: () => { S.af.addon = !S.af.addon; render(); },
  afStore: (el) => { const v = el.dataset.v; const a = S.af.stores; S.af.stores = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; render(); },
  afSave: (el) => { const a = S.af; const k = num(a.k); const err = document.getElementById('af-err');
    if (!a.name.trim()) { err.textContent = 'ใส่ชื่อเมนูก่อน'; return; } if (k == null || k <= 0) { err.textContent = 'ใส่ kcal ก่อน (ถ้าไม่รู้ ประมาณเอาได้)'; return; }
    const data = { name: a.name.trim(), cat: a.cat, icon: CAT_ICON[a.cat], kind: 'item', unit: a.unit, n: { k, p: num(a.p) || 0, f: num(a.f) || 0 }, addon: a.addon, stores: a.stores, src: a.src };
    let f; if (a.id) { f = foodById(a.id); Object.assign(f, data); } else { f = { id: uid(), aliases: [], userId: db.userId, createdAt: new Date().toISOString(), ...data }; db.foods.push(f); }
    save(); if (el.dataset.eat === '1' && !a.id) { const e = addEntry(f); if (e) return afterLog([e]); }
    toast(a.id ? 'แก้ ' + f.name + ' แล้ว' : 'เพิ่ม ' + f.name + ' แล้ว'); go(a.back === 'me' ? 'me' : 'other', { q: '' }); },
  bucketLog: (el) => { const k = el.dataset.k; const v = Number(el.dataset.v); const f = { id: 'bucket-' + k, name: (k === 'out' ? 'มื้อนอกบ้าน ' : 'ขนม ') + el.dataset.n, icon: k === 'out' ? 'main' : 'snack', cat: k === 'out' ? 'main' : 'snack', kind: 'item', unit: 'มื้อ', n: { k: v, p: k === 'out' ? 20 : 4, f: k === 'out' ? 3 : 1 }, src: 'est' }; closeSheet(); const e = addEntry(f); if (e) afterLog([e]); },
  labelSave: () => { const s = S.sheet; const f = foodById(s.id || s.foodId); const k = num(s.k); if (k == null || k <= 0) { document.getElementById('lb-err').textContent = 'ใส่ kcal จากฉลากก่อน'; return; }
    f.n = { k, p: num(s.p) || 0, f: num(s.f) || 0 }; f.src = 'label'; save(); closeSheet(); if (s.then) { const e = addEntry(f, s.then); if (e) afterLog([e]); } else render(); },
  key: (el) => { let v = S.sheet.v ?? String(activeOf(S.sheet.date) || ''); v = el.dataset.v === '⌫' ? v.slice(0, -1) : (v + el.dataset.v).replace(/^0+/, '').slice(0, 4); S.sheet.v = v; renderLayer(); },
  watchSave: () => { const v = Number(S.sheet.v ?? activeOf(S.sheet.date)) || 0; db.activity[S.sheet.date] = v; save(); closeSheet(); render(); },
  watchPct: (el) => { db.profile.watchPct = Number(el.dataset.v); save(); renderLayer(); render(); },
  openLog: (el) => { S.logDate = el.dataset.date; go('log'); },
  logDay: (el) => { S.logDate = addDays(S.logDate || todayKey(), Number(el.dataset.d)); render(); },
  logAdd: (el) => { S.ctx = { date: S.logDate || todayKey(), slot: el.dataset.slot, ret: 'log' }; S.q = ''; S.comp = null; go('other'); },
  dayDone: (el) => { db.dayStatus[el.dataset.date] = 'done'; save(); render(); },
  editQ: (el) => { const e = db.entries.find((x) => x.id === S.sheet.id); S.sheet.qty = Math.max(0.5, (S.sheet.qty ?? e.qty) + Number(el.dataset.d)); renderLayer(); },
  editSlot: (el) => { S.sheet.slot = el.dataset.v; renderLayer(); },
  editSave: () => { const e = db.entries.find((x) => x.id === S.sheet.id); const q = S.sheet.qty ?? e.qty; const ratio = q / e.qty; Object.assign(e, { qty: q, k: r1(e.k * ratio), p: r1(e.p * ratio), f: r1(e.f * ratio), slot: S.sheet.slot ?? e.slot, unitLabel: e.grams ? Math.round(e.grams * ratio) + ' g' : q + ' ' + e.unitLabel.split(' ').slice(1).join(' '), grams: e.grams ? Math.round(e.grams * ratio) : null, editedAt: new Date().toISOString() }); save(); closeSheet(); render(); },
  editDel: () => { db.entries = db.entries.filter((x) => x.id !== S.sheet.id); save(); closeSheet(); render(); },
  undo: () => undo(S.toast.undoId),
  dsel: (el) => { S.dsel = el.dataset.d; render(); },
  wsel: (el) => { S.wsel = Number(el.dataset.i); render(); },
  weekOff: (el) => { S.weekOff = Math.min(0, S.weekOff + Number(el.dataset.d)); S.dsel = null; render(); },
  period: () => { const t = todayKey(); if (!db.periods.includes(t)) db.periods.push(t); save(); render(); },
  wiSave: () => { const w = num(S.wi.weight); const ws = num(S.wi.waist); const err = document.getElementById('wi-err');
    if (w == null && ws == null) { err.textContent = 'ใส่น้ำหนักหรือรอบเอวอย่างน้อยหนึ่งค่า'; return; }
    if ((w != null && (w < 25 || w > 300)) || (ws != null && (ws < 40 || ws > 200))) { err.textContent = 'ตัวเลขดูไม่ปกติ ลองตรวจอีกครั้ง'; return; }
    db.body.push({ id: uid(), userId: db.userId, date: todayKey(), weight: w, waist: ws, createdAt: new Date().toISOString(), schemaVersion: 1 }); if (ws != null) updateChin(); save(); toast('บันทึกแล้ว · ' + [w != null ? w + ' kg' : '', ws != null ? ws + ' cm' : ''].filter(Boolean).join(' · ')); go('week'); },
  pace: (el) => { db.profile.pace = el.dataset.v; save(); render(); },
  mealToggle: (el) => { const p = db.profile; const v = el.dataset.v; p.meats = p.meats.includes(v) ? (p.meats.length > 1 ? p.meats.filter((x) => x !== v) : p.meats) : [...p.meats, v].slice(0, 4); save(); renderLayer(); },
  mealStep: (el) => { const p = db.profile; p[el.dataset.k] = Math.max(0, Math.min(400, p[el.dataset.k] + Number(el.dataset.d))); save(); renderLayer(); },
  peSave: () => { const s = S.sheet; const p = db.profile; const h = num(s.height ?? p.height); const w = num(s.startWeight ?? p.startWeight); if (!h || !w) return; Object.assign(p, { name: (s.name ?? p.name ?? '').trim(), birth: s.birth ?? p.birth, height: h, startWeight: w }); save(); closeSheet(); render(); },
  resetAll: () => openSheet({ type: 'confirm', msg: 'ล้างข้อมูลทั้งหมดในเครื่องนี้? กู้คืนไม่ได้ถ้าไม่ได้สำรองไว้', yes: 'resetYes', label: 'ล้างข้อมูล' }),
  resetYes: () => { try { localStorage.removeItem(KEY); } catch (e) {} db = null; S.obStep = 1; closeSheet(); initOb(); render(); },
  foodHide: (el) => { const f = foodById(el.dataset.id); f.hidden = !f.hidden; save(); closeSheet(); render(); },
  foodAddon: (el) => { const f = foodById(el.dataset.id); f.addon = true; f.hidden = false; save(); closeSheet(); render(); },
  foodEdit: (el) => { const f = foodById(el.dataset.id); closeSheet(); S.af = { id: f.id, name: f.name, cat: f.cat || 'main', unit: f.unit || 'ชิ้น', k: f.n ? f.n.k : '', p: f.n ? f.n.p : '', f: f.n ? f.n.f : '', src: f.src === 'label' ? 'label' : 'est', addon: !!f.addon, stores: f.stores || [], back: 'me' }; go('addfood'); },
  foodDel: (el) => { const f = foodById(el.dataset.id); openSheet({ type: 'confirm', msg: 'ลบ ' + f.name + '? บันทึกเก่ายังอยู่ครบ', yes: 'foodDelYes', id: f.id, label: 'ลบเมนู' }); },
  foodDelYes: () => { const f = foodById(S.sheet.id); f.deleted = true; f.addon = false; save(); closeSheet(); render(); },
  importYes: () => { db = S.sheet.data; save(); closeSheet(); render(); toast('นำเข้าข้อมูลแล้ว', null, 'happy'); },
  exportJson: () => download('noneang-backup-' + todayKey() + '.json', JSON.stringify(db, null, 2), 'application/json'),
  exportCsv: () => { const rows = [['date', 'slot', 'name', 'qty', 'unit', 'kcal', 'protein_g', 'fiber_g', 'source']].concat(db.entries.map((e) => [e.date, e.slot, e.name, e.qty, e.unitLabel, e.k, e.p, e.f, e.src])); const body = [['date', 'weight_kg', 'waist_cm']].concat(db.body.map((b) => [b.date, b.weight ?? '', b.waist ?? '']));
    const csv = (r) => r.map((x) => x.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'); download('noneang-food-' + todayKey() + '.csv', '﻿' + csv(rows), 'text/csv'); setTimeout(() => download('noneang-body-' + todayKey() + '.csv', '﻿' + csv(body), 'text/csv'), 400); },
  checkFill: () => { const d = S.sheet.date; closeSheet(); S.logDate = d; go('log'); },
  checkDone: () => { db.dayStatus[S.sheet.date] = 'done'; save(); closeSheet(); },
  checkSkip: () => { db.dayStatus[S.sheet.date] = 'skip'; save(); closeSheet(); },
  /* onboarding */
  obSet: (el) => { S.ob[el.dataset.k] = el.dataset.v; render(); },
  obMeat: (el) => { const v = el.dataset.v; const m = S.ob.meats; S.ob.meats = m.includes(v) ? m.filter((x) => x !== v) : [...m, v]; render(); },
  obStep: (el) => { S.ob[el.dataset.k] = Math.max(0, Math.min(400, S.ob[el.dataset.k] + Number(el.dataset.d))); render(); },
  obAddon: (el) => { const v = el.dataset.v; const a = S.ob.addons; S.ob.addons = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; render(); },
  obBack: () => { S.obStep--; render(); },
  obNext: () => { const o = S.ob; const err = document.getElementById('ob-err');
    if (S.obStep === 1) { const h = num(o.height), w = num(o.weight); if (!o.birth) { err.textContent = 'ใส่วันเกิดก่อน'; return; } if (!h || h < 120 || h > 220) { err.textContent = 'ส่วนสูงควรอยู่ระหว่าง 120–220 cm'; return; } if (!w || w < 30 || w > 250) { err.textContent = 'น้ำหนักควรอยู่ระหว่าง 30–250 kg'; return; } }
    if (S.obStep === 2 && !o.meats.length) { err.textContent = 'เลือกอย่างน้อย 1 อย่าง'; return; }
    S.obStep++; render(); window.scrollTo(0, 0); },
  obFinish: () => { const o = S.ob; const userId = uid();
    db = { schemaVersion: 1, userId, createdAt: new Date().toISOString(), profile: { name: (o.name || '').trim(), sex: o.sex, birth: o.birth, height: num(o.height), startWeight: num(o.weight), pace: 'rec', watchPct: 0.6, meats: o.meats, meatG: o.meatG, riceG: o.riceG, startDate: todayKey() },
      foods: STARTER_FOODS.map((f) => ({ ...JSON.parse(JSON.stringify(f)), addon: o.addons.includes(f.id), userId })), entries: [], body: [{ id: uid(), userId, date: todayKey(), weight: num(o.weight), waist: num(o.waist), createdAt: new Date().toISOString(), schemaVersion: 1 }], activity: {}, periods: [], dayStatus: {}, chin: { level: 0, lower: 0 } };
    save(); S.view = 'today'; render(); }
};
function initOb() { S.ob = { name: '', sex: 'f', birth: '', height: '', weight: '', waist: '', meats: ['chicken', 'fish', 'beef'], meatG: 100, riceG: 150, addons: STARTER_FOODS.filter((f) => f.addon).map((f) => f.id) }; }
function refreshResults() { const r = document.getElementById('results'); if (r) r.innerHTML = otherResults(); }
function download(name, text, type) { const b = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
  const act = el.dataset.act; if (A[act]) { if (act !== 'overlay') ev.stopPropagation(); A[act](el, ev); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target; const k = el.dataset && el.dataset.input; if (!k) return;
  if (k === 'q') { S.q = el.value; S.comp = null; refreshResults(); return; }
  if (k === 'sizeG') { S.sheet.customG = num(el.value); return; }
  const [obj, field] = k.split('.');
  if (obj === 'ob') S.ob[field] = el.value; else if (obj === 'af') S.af[field] = el.value; else if (obj === 'wi') S.wi[field] = el.value; else if (obj === 'lb' || obj === 'pe') S.sheet[field] = el.value;
});
document.addEventListener('change', (ev) => {
  const el = ev.target; if (el.dataset && el.dataset.input === 'import' && el.files[0]) {
    const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!d.profile || !Array.isArray(d.entries)) throw new Error('bad'); openSheet({ type: 'confirm', msg: 'แทนที่ข้อมูลในเครื่องด้วยไฟล์สำรองนี้?', yes: 'importYes', data: d, label: 'นำเข้า' }); } catch (e) { toast('ไฟล์นี้ไม่ใช่ข้อมูลสำรองของ NoNeang', null, 'huh'); } }; r.readAsText(el.files[0]);
  }
});
/* long-press on add-on cards → manage */
let holdT = null;
document.addEventListener('pointerdown', (ev) => { const c = ev.target.closest('[data-hold]'); if (!c) return; holdT = setTimeout(() => { holdT = null; openSheet({ type: 'foodMenu', id: c.dataset.hold }); }, 550); });
['pointerup', 'pointerleave', 'pointercancel', 'scroll'].forEach((t) => document.addEventListener(t, () => { clearTimeout(holdT); holdT = null; }, true));
document.addEventListener('contextmenu', (ev) => { const c = ev.target.closest('[data-hold]'); if (c) { ev.preventDefault(); openSheet({ type: 'foodMenu', id: c.dataset.hold }); } });

/* ================= boot ================= */
if (!db) initOb();
else {
  const y = addDays(todayKey(), -1);
  if (db.profile.startDate <= y && !db.dayStatus[y] && entriesOn(y).length) S.sheet = { type: 'check', date: y };
}
render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
