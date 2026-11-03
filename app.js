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
  save(d) { d.updatedAt = new Date().toISOString(); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { toast('บันทึกลงเครื่องไม่ได้ (พื้นที่เต็มหรือโหมดส่วนตัว)'); } if ((typeof Cloud !== 'undefined')) Cloud.queue(); }
};
let db = Store.load();
if (db) { db.rewards = db.rewards || []; db.seenRecap = db.seenRecap || {}; db.plates = db.plates || []; db.periodEnds = db.periodEnds || {}; const mk = db.foods.find((f) => f.id === 'milk'); if (mk && !mk.group) mk.group = 'นมโปรตีน'; }
const save = () => Store.save(db);

/* ================= calculations ================= */
const PACE = { slow: { def: 250, name: 'สบายๆ', kg: 0.25 }, rec: { def: 500, name: 'แนะนำ', kg: 0.5 }, fast: { def: 750, name: 'เร่ง', kg: 0.75 } };
function ageOf(birth) { const b = parseKey(birth); const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a; }
const calcW = (p) => p.calcWeight || p.startWeight;
function bmr(p) { return 10 * calcW(p) + 6.25 * p.height - 5 * ageOf(p.birth) + (p.sex === 'm' ? 5 : -161); }
function baseTDEE(p) { return bmr(p) * 1.2; }
function targetBase(p) { const raw = baseTDEE(p) - PACE[p.pace].def; return { value: Math.max(p.sex === 'm' ? 1500 : 1200, Math.round(raw)), raw: Math.round(raw) }; }
const activeOf = (k) => db.activity[k] || 0;
const watchCredit = (k) => Math.round(activeOf(k) * db.profile.watchPct);
const goalOf = (k) => targetBase(db.profile).value + watchCredit(k);
const protPerKg = () => db.profile.protPerKg ?? 1.6;
const proteinTarget = () => Math.round(protPerKg() * calcW(db.profile));
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
  return `<nav class="nav">${b('today', 'วันนี้', '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>')}${b('week', 'ภาพรวม', '<path d="M5 20V10M12 20V4M19 20v-7"/>')}${b('me', 'ฉัน', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>')}</nav>`;
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
  const stk = streakInfo().cur;
  return hero('<span style="font-size:15px;font-weight:600;display:block">' + greet + '</span><span style="font-size:32px">' + esc(db.profile.name || 'สวัสดี') + '</span>', thDate(k) + '<br>' + flameChip(stk), { pb: 120, right: `<span style="transform:rotate(-6deg);display:block">${mascot(mood, 108, chinLevel(), 'มาสคอต NoNeang')}</span>` }) +
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
      </div></div>` + todayBody() + nav();
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
  const hit = (f) => f.name.toLowerCase().includes(s) || (f.aliases || []).some((a) => a.includes(s) || (a.length >= 4 && s.startsWith(a)));
  const mine = db.foods.filter((f) => !f.deleted && hit(f)).sort((a, b) => (b.uses || 0) - (a.uses || 0));
  const own = new Set(db.foods.map((f) => f.id));
  const dict = (typeof FOOD_DB === 'undefined' ? [] : FOOD_DB).filter((f) => !own.has(f.id) && hit(f)).map((f) => ({ ...f, _db: true }))
    .sort((a, b) => (a.name.startsWith(s) ? 0 : 1) - (b.name.startsWith(s) ? 0 : 1) || a.name.length - b.name.length);
  const pri = (f) => (f.name.toLowerCase().startsWith(s) || (f.aliases || []).some((a) => a.startsWith(s)) ? 0 : 1);
  return [...mine, ...dict].map((f, i) => ({ f, i })).sort((a, b) => pri(a.f) - pri(b.f) || a.i - b.i).map((x) => x.f);
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
      <div style="margin:12px 16px 0;display:flex;flex-wrap:wrap;gap:10px">${chips || '<span class="mut small">ยังไม่มี · บันทึกไปสักพักจะขึ้นตรงนี้</span>'}</div>
      <button class="card row" data-act="nav" data-to="browse" style="border:none;width:calc(100% - 32px);margin-top:18px;gap:12px;text-align:left"><span class="row" style="gap:0">${['main', 'drink', 'veg'].map((k, i) => `<span style="${i ? 'margin-left:-10px;' : ''}border:3px solid #fff;border-radius:22px">${iconBox(k, 22, 38)}</span>`).join('')}</span><span style="flex:1"><b style="font-size:15px">ดูเมนูทั้งหมด</b><span class="small mut" style="display:block">${typeof FOOD_DB === 'undefined' ? '' : FOOD_DB.length + ' รายการ · '}จานเดียว ก๋วยเตี๋ยว เซเว่น ขนม เครื่องดื่ม</span></span>${chev('r', 16)}</button>` + footer('');
  }
  const found = searchFoods(q);
  if (found.length) {
    const rows = found.slice(0, 12).map(foodRow).join('');
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
  const units = ['ทัพพี', 'จาน', 'ถ้วย', 'ชิ้น', 'ฟอง', 'กล่อง', 'แก้ว', 'ซอง', 'กรัม'];
  const IG = [['ข้าว / เส้น / แป้ง', ['rice', 'main', 'noodle', 'bread', 'waffle', 'snack', 'corn', 'sweetpotato']], ['โปรตีน', ['chicken', 'fish', 'beef', 'pork', 'shrimp', 'egg', 'friedegg', 'tofu', 'sausage', 'cheese']], ['ผัก / ผลไม้', ['veg', 'salad', 'broc', 'peas', 'guava', 'apple', 'banana', 'orange', 'mango']], ['เครื่องดื่ม / ของว่าง', ['milk', 'shake', 'yogurt', 'coffee', 'boba', 'drink', 'soup', 'icecream', 'cake', 'nuts', 'butter']]].map(([g, ks]) => [g, ks.filter((k) => ICONS[k])]);
  const curIcon = a.icon || CAT_ICON[a.cat]; const isG = a.unit === 'กรัม'; const custom = a.unit && !units.includes(a.unit);
  const icBtn = (k) => `<button data-act="afIcon" data-v="${k}" aria-label="${k}" style="border:none;padding:0;width:44px;height:44px;border-radius:22px;background:${ICONS[k][0]};display:flex;align-items:center;justify-content:center;${k === curIcon ? 'box-shadow:0 0 0 2.5px #FFD000' : ''}"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k][1]}</svg></button>`;
  const quick = [...new Set([curIcon, 'rice', 'chicken', 'egg', 'veg', 'milk'])].slice(0, 5);
  const allN = IG.reduce((t, [, ks]) => t + ks.length, 0);
  const num = (k, label, req) => `<div class="field"><label for="af-${k}" style="${req ? 'color:var(--ink)' : ''}">${label}${req ? ' <span style="color:#8A6D00">· ต้องใส่</span>' : ''}</label><input id="af-${k}" inputmode="decimal" data-input="af.${k}" value="${a[k] ?? ''}" placeholder="${req ? '0' : 'ถ้ารู้'}" style="height:52px;border-radius:16px;text-align:center;font-size:19px;font-weight:700;min-width:0;${req ? 'border:2px solid #FFD000;background:#FFFBE6' : 'border:1.5px dashed #CFCFCF;background:#fff'}"></div>`;
  const card = (n, title, inner, extra = '') => `<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="row"><span class="ic" style="width:26px;height:26px;border-radius:13px;background:var(--y);font-size:13px;font-weight:700">${n}</span><b style="font-size:16px">${title}</b>${extra}</div>${inner}</div>`;
  return `<div style="background:var(--g);min-height:100vh;padding-bottom:30px">` + topBar(a.id ? 'แก้เมนู' : 'เพิ่มเมนูของฉัน', 'กรอกครั้งเดียว ครั้งหน้าพิมพ์หาเจอเลย', a.back || 'other').replace('class="back"', 'class="back" style="background:#fff"') +
    card(1, 'ชื่อเมนู', `<input data-input="af.name" value="${esc(a.name)}" aria-label="ชื่อเมนู" style="height:52px;border-radius:16px;border:2px solid #FFD000;padding:0 14px;font-size:17px;font-weight:600">`) +
    card(2, 'ประเภท', `<div class="grid2" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${cats.map(([k, l]) => `<button data-act="afSet" data-k="cat" data-v="${k}" style="border:none;border-radius:18px;padding:10px 2px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:${a.cat === k ? 700 : 600};background:${a.cat === k ? '#FFF3B0;box-shadow:0 0 0 2px #FFD000' : 'var(--g)'}">${iconBox(CAT_ICON[k], 24, 40)}${l}</button>`).join('')}</div>`) +
    card(3, 'ไอคอน', a.allIcons ? IG.map(([g, ks]) => `<span class="small" style="font-weight:700;color:var(--mut)">${g}</span><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;justify-items:center">${ks.map(icBtn).join('')}</div>`).join('') + '<button class="link" data-act="afAllIcons">ย่อ</button>'
      : `<div class="row" style="gap:8px">${quick.map(icBtn).join('')}<button class="chip" data-act="afAllIcons" style="margin-left:auto">ทั้งหมด ${allN} ›</button></div>`) +
    (a.group ? card('·', 'อยู่ในกลุ่ม', `<span class="chip on" style="align-self:flex-start">${esc(a.group)}</span><span class="small mut">ค้นหา "${esc(a.group)}" แล้วเลือกยี่ห้อได้</span>`) : '') +
    card(4, 'นับเป็น', `<div class="row" style="gap:6px;flex-wrap:wrap">${units.map((u) => `<button class="chip ${a.unit === u ? 'on' : ''}" data-act="afSet" data-k="unit" data-v="${u}">${u}</button>`).join('')}<button class="chip ${custom ? 'on' : ''}" data-act="afCustomUnit">${custom ? esc(a.unit) + ' ✎' : '+ พิมพ์เอง'}</button></div>${a.unitTyping ? `<input data-input="af.unit" value="${custom ? esc(a.unit) : ''}" placeholder="เช่น ลูก, แท่ง, ไม้" aria-label="หน่วยเอง" style="height:46px;border-radius:14px;border:2px solid #FFD000;padding:0 12px;font-size:16px">` : ''}`) +
    card(5, isG ? 'พลังงาน ต่อ 100 กรัม' : 'พลังงาน ต่อ 1 ' + esc(a.unit), `<div class="grid3" style="gap:8px">${num('k', 'kcal', true)}${num('p', 'Protein g')}${num('f', 'Fiber g')}</div>
      <div class="seg"><button class="${a.src === 'label' ? 'on' : ''}" data-act="afSet" data-k="src" data-v="label">จากฉลาก</button><button class="${a.src === 'est' ? 'on' : ''}" data-act="afSet" data-k="src" data-v="est">ใช้ค่าประมาณ</button></div>
      <span class="small mut">ไม่รู้ตัวเลข? ถามในแชทก่อน แล้วกรอกครั้งเดียว</span>`) +
    card(6, 'ใช้เป็นของเติม', `<span class="small mut">ขึ้นในชุดแนะนำและหน้าเลือกเติมเอง</span>${a.addon ? `<div class="row" style="gap:6px;flex-wrap:wrap"><span class="small" style="font-weight:700;color:var(--mut)">ซื้อได้ที่</span>${['7-11', 'Lotus', 'ยิม'].map((x) => `<button class="chip ${a.stores.includes(x) ? 'on' : ''}" data-act="afStore" data-v="${x}">${a.stores.includes(x) ? '✓ ' : ''}${x}</button>`).join('')}</div>` : ''}`,
      `<button role="switch" aria-checked="${a.addon}" aria-label="ใช้เป็นของเติม" data-act="afToggle" style="margin-left:auto;width:52px;height:32px;border-radius:16px;border:none;background:${a.addon ? '#FFD000' : '#DDD'};position:relative"><span style="position:absolute;${a.addon ? 'right' : 'left'}:3px;top:3px;width:26px;height:26px;border-radius:13px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)"></span></button>`) +
    `<div id="af-err" class="small" style="color:#B3261E;margin:10px 20px 0;min-height:16px"></div><div style="margin:6px 16px 0;display:flex;flex-direction:column;gap:6px"><button class="btn" data-act="afSave" data-eat="1">${a.id ? 'บันทึกการแก้ไข' : (a.back === 'build' ? 'บันทึก + ใส่ในจาน' : 'บันทึกเมนู + กินเลย ' + (isG ? '100 กรัม' : '1 ' + esc(a.unit)))}</button>${a.id ? '' : '<button class="link" data-act="afSave" data-eat="0">บันทึกเมนูอย่างเดียว ยังไม่กิน</button>'}</div></div>`;
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
    <div class="row" style="margin:14px 20px 0;justify-content:space-between"><span class="mut">รวม <b style="color:var(--ink);font-size:18px">${fmt(t.k)}</b> / ${fmt(goal)} kcal</span>${st === 'done' ? '<span class="badge" style="background:var(--greenL)">ครบแล้ว ✓</span>' : st === 'special' ? `<span class="badge" style="background:#FFE8F3">${svgI('cake', 14)} มื้อพิเศษ</span>` : ''}</div>
    <div style="margin:14px 16px 0;position:relative;display:flex;flex-direction:column;gap:10px"><div style="position:absolute;left:16px;top:18px;bottom:18px;width:2px;background:#EFEFEC"></div>${items}</div>
    ${!LOGGED(k) && entriesOn(k).length ? `<div class="grid2" style="margin:18px 16px 0;gap:8px"><button class="btn" data-act="dayDone" data-date="${k}">จดครบแล้ว ✓</button><button class="btn w" data-act="daySpecial" data-date="${k}" style="font-size:14px">${svgI('cake', 18)} วันมื้อพิเศษ</button></div>` : ''}
    ${LOGGED(k) ? `<div style="margin:14px 16px 0;text-align:center"><button class="link" data-act="dayUndo" data-date="${k}">ยกเลิกสถานะ "${st === 'special' ? 'มื้อพิเศษ' : 'ครบแล้ว'}"</button></div>` : ''}` + nav();
}

function vWeek() {
  if (S.ovMode === 'month') return vMonth();
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
  return hero(ovToggle() + '<span style="display:block">' + (S.weekOff ? 'สัปดาห์ ' + thDate(days[0]) : 'สัปดาห์นี้') + '</span>', thDate(days[0]) + ' – ' + thDate(days[6]), { pb: 62, right: `<span class="row" style="gap:6px"><button class="back" data-act="weekOff" data-d="-1" aria-label="สัปดาห์ก่อน" style="width:36px;height:36px">${chev('l', 16)}</button><span role="img" aria-label="ตามเป้า ${onT} จาก ${complete.length} วัน" style="background:#fff;border-radius:16px;padding:8px 10px;display:flex;gap:4px;box-shadow:0 6px 14px rgba(140,100,0,.15)">${dots}</span>${S.weekOff < 0 ? `<button class="back" data-act="weekOff" data-d="1" aria-label="สัปดาห์ถัดไป" style="width:36px;height:36px">${chev('r', 16)}</button>` : ''}</span>` }) +
    weekKcalCard(days) + periodCard() + chinCard + `<button class="card row" data-act="openRecap" data-mon="${mon}" style="border:none;width:calc(100% - 32px);margin-top:12px;gap:12px;text-align:left">${mascot('proud', 46)}<span style="flex:1"><b style="font-size:15px">สรุปสัปดาห์นี้</b><span class="small mut" style="display:block">จดครบ ${days.filter(LOGGED).length}/7 วัน · ดูการ์ด + บันทึกเป็นรูป</span></span>${chev('r', 16)}</button>` + chart +
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
    ${cloudCard()}
    <div class="card" style="padding:4px 0;margin-top:14px">${[['foods', 'รายการอาหารของฉัน'], ['meals', 'มื้อประจำ (เนื้อสัตว์ + ปริมาณ)'], ['profileEdit', 'แก้ข้อมูลร่างกาย']].map(([a, l]) => `<button data-act="sheet" data-type="${a}" style="width:100%;border:none;background:none;min-height:54px;padding:0 16px;display:flex;align-items:center;font-size:15px;font-weight:600;border-bottom:1px solid #F2EEE6;text-align:left"><span style="flex:1">${l}</span>${chev('r', 18)}</button>`).join('')}
      <button data-act="exportJson" style="width:100%;border:none;background:none;min-height:54px;padding:0 16px;display:flex;align-items:center;font-size:15px;font-weight:600;border-bottom:1px solid #F2EEE6"><span style="flex:1;text-align:left">สำรองข้อมูล (JSON)</span>${chev('r', 18)}</button>
      <button data-act="exportCsv" style="width:100%;border:none;background:none;min-height:54px;padding:0 16px;display:flex;align-items:center;font-size:15px;font-weight:600;border-bottom:1px solid #F2EEE6"><span style="flex:1;text-align:left">Export CSV (ไว้วิเคราะห์ต่อ)</span>${chev('r', 18)}</button>
      <label style="width:100%;min-height:54px;padding:0 16px;display:flex;align-items:center;font-size:15px;font-weight:600;cursor:pointer"><span style="flex:1">นำเข้าข้อมูลสำรอง</span><input type="file" accept="application/json" data-input="import" class="sr">${chev('r', 18)}</label></div>
    <p class="small mut" style="margin:14px 20px;line-height:1.6">${(typeof Cloud !== 'undefined') && Cloud.user ? 'ข้อมูลอยู่ในเครื่องนี้ + สำรองบน Supabase อัตโนมัติ' : 'ข้อมูลเก็บในเครื่องนี้เท่านั้น ถ้าลบแอปหรือล้างข้อมูลเบราว์เซอร์จะหาย · สำรองไว้เป็นระยะ'}<br>ค่าโภชนาการเป็นค่าประมาณ ไม่ใช่คำแนะนำทางการแพทย์</p>` + nav();
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
      <div id="ob-err" class="small" style="color:#B3261E;min-height:16px"></div><button class="btn" data-act="obNext">ถัดไป</button>${(typeof Cloud !== 'undefined') && Cloud.enabled ? '<button class="link" data-act="cloudOpen" style="margin-top:4px">เคยใช้แล้ว? เข้าสู่ระบบเพื่อดึงข้อมูลกลับมา</button>' : ''}</div>`;
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
  if (s.type === 'celebrate') return celebrateHtml(s);
  const wrap = (inner, center = false) => `<div class="overlay ${center ? 'center' : ''}" data-act="overlay"><div class="${center ? 'modal' : 'sheet'}" role="dialog" aria-modal="true" data-stop="1">${center ? '' : '<span class="handle"></span>'}${inner}</div></div>`;
  const closeBtn = '<button class="back" data-act="close" aria-label="ปิด" style="width:40px;height:40px">' + xIcon + '</button>';
  if (s.type === 'cloud') return wrap(cloudSheet(s, closeBtn));
  if (s.type === 'widget') return wrap(widgetSheet(closeBtn));
  if (s.type === 'cloudPick') return wrap(`<div class="row"><b style="flex:1;font-size:19px">มีข้อมูล 2 ชุด ใช้ชุดไหน?</b></div>
      <div class="grid2" style="gap:10px"><div style="background:var(--g);border-radius:20px;padding:12px"><b>ในเครื่องนี้</b><div class="small mut">${db.entries.length} รายการ · ล่าสุด ${db.updatedAt ? thDate(db.updatedAt.slice(0, 10)) : '-'}</div></div><div style="background:var(--yll);border-radius:20px;padding:12px"><b>บน cloud</b><div class="small mut">${s.remote.entries.length} รายการ · ล่าสุด ${s.remote.updatedAt ? thDate(s.remote.updatedAt.slice(0, 10)) : '-'}</div></div></div>
      <span class="small mut">ชุดที่ไม่เลือกจะถูกแทนที่ (cloud เก็บสำเนารายวันไว้ให้)</span>
      <button class="btn" data-act="pickRemote">ใช้ข้อมูลบน cloud</button><button class="btn w" data-act="pickLocal">ใช้ข้อมูลในเครื่องนี้</button>`);
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
    const dtab = [-2, -1, 0].map((o) => { const d = addDays(todayKey(), o); return `<button data-act="watchDay" data-d="${d}" style="border:none;padding:8px 0;border-radius:14px;font-size:13px;font-weight:700;${d === k ? 'background:#fff;box-shadow:0 2px 6px rgba(31,31,31,.08)' : 'background:none;color:var(--mut)'}">${o === 0 ? 'วันนี้' : o === -1 ? 'เมื่อวาน' : thDate(d)}</button>`; }).join('');
    return wrap(`<div class="grid3" style="gap:4px;background:var(--g);border-radius:18px;padding:4px">${dtab}</div><div class="row">${iconBox('watch', 28, 48, 16)}<span style="flex:1"><b style="font-size:19px">เผาผลาญจาก Watch ${k === todayKey() ? 'วันนี้' : k === addDays(todayKey(), -1) ? 'เมื่อวาน' : thDate(k)}</b><span class="small mut" style="display:block">ดูตัวเลข Active ในแอป Fitness แล้วกรอก</span></span>${closeBtn}</div>
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
  if (s.type === 'plate') {
    const pl = s.id.startsWith('meal:') ? null : (db.plates || []).find((x) => x.id === s.id); const items = pl ? pl.items : [{ foodId: s.id.slice(5), qty: 1 }];
    const tot = plateNutr(items);
    return wrap(`<div class="row"><span style="flex:1"><b style="font-size:19px;display:block">${esc(plateName(pl, items))}</b><span class="small mut">${items.length} อย่าง · ${fmt(tot.k)} kcal · P ${Math.round(tot.p)} g</span></span>${closeBtn}</div>
      <div style="border-radius:20px;border:1px solid #F2EEE6;overflow:hidden">${items.map((i) => { const f = resolveFood(i.foodId); if (!f) return ''; const n = plateNutr([i]); return `<div class="row" style="padding:10px 12px;border-bottom:1px solid #F2EEE6">${iconBox(f.icon, 22, 38)}<span style="flex:1;min-width:0"><b style="font-size:14px">${esc(f.name)}</b><span class="small mut" style="display:block">${f.kind === 'sized' ? (i.grams || f.def) + ' g' : (i.qty || 1) + ' ' + esc(f.unit || '')}</span></span><b style="font-size:14px">${fmt(n.k)}</b></div>`; }).join('')}</div>
      ${pl ? `<div class="field"><label for="pl-name">ตั้งชื่อจาน (ไม่ใส่ก็ได้)</label><input id="pl-name" data-input="sheet.name" value="${esc(s.name ?? pl.name ?? '')}" placeholder="เช่น ข้าวเที่ยงประจำ" style="height:48px;border-radius:14px;border:2px solid #FFD000;padding:0 12px;font-size:16px"></div>` : ''}
      <button class="btn" data-act="plateLogSheet" data-id="${esc(s.id)}">บันทึกจานนี้</button>
      ${pl ? '<div class="grid2" style="gap:8px"><button class="btn g" data-act="plateRename">เก็บชื่อ</button><button class="btn danger" data-act="plateHide">เอาออกจากหน้าแรก</button></div>' : ''}`);
  }
  if (s.type === 'group') {
    const fs = db.foods.filter((f) => !f.deleted && f.group === s.g).sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''));
    return wrap(`<div class="row">${iconBox(fs[0] ? fs[0].icon : 'milk', 26, 46, 23)}<span style="flex:1"><b style="font-size:19px;display:block">${esc(s.g)}</b><span class="small mut">เลือกยี่ห้อ/แบบ · อันที่ใช้ล่าสุดอยู่บน</span></span>${closeBtn}</div>
      <div style="border-radius:20px;overflow:hidden;border:1px solid #F2EEE6">${fs.map((f, i) => { const n = nutr(f); return `<button data-act="groupPick" data-id="${f.id}" style="border:none;background:${i === 0 ? '#FFF8D6' : '#fff'};width:100%;display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #F2EEE6;text-align:left"><span style="flex:1"><b style="font-size:15px">${esc(f.name)}</b>${i === 0 && f.lastUsed ? ' <span style="font-size:11px;background:var(--y);border-radius:8px;padding:1px 6px">ล่าสุด</span>' : ''}<span class="small mut" style="display:block">${n ? fmt(n.k) + ' kcal · P ' + Math.round(n.p) + ' g' : 'ยังไม่มีค่าฉลาก'}</span></span><span class="ic" style="width:36px;height:36px;border-radius:18px;background:var(--y);font-size:18px;font-weight:700">+</span></button>`; }).join('')}
        <button data-act="groupNew" data-g="${esc(s.g)}" style="border:none;background:#fff;width:100%;min-height:50px;font-size:14px;font-weight:700;color:#6B5A00">+ เพิ่มยี่ห้อใหม่ (กรอกจากฉลาก)</button></div>`);
  }
  if (s.type === 'periodDay') {
    const has = periodDays().has(s.date); const isStart = db.periods.includes(s.date);
    return wrap(`<div class="row"><span class="ic" style="width:44px;height:44px;border-radius:22px;background:#FBE3EA">${DROP(22, '#FF8FA8')}</span><span style="flex:1"><b style="font-size:18px;display:block">${thDate(s.date)}</b><span class="small mut">${has ? 'บันทึกว่ามีประจำเดือน' : 'ยังไม่ได้บันทึก'}</span></span>${closeBtn}</div>
      ${has ? `${isStart ? '' : `<button class="btn w" data-act="periodEndAt" data-d="${s.date}">ให้วันนี้เป็นวันสุดท้าย</button>`}<button class="btn danger" data-act="periodRemove" data-d="${s.date}">ลบรอบนี้ออก</button>` : `<button class="btn" data-act="periodStartAt" data-d="${s.date}" style="background:#FF8FA8;color:#fff">เริ่มมีประจำเดือนวันนี้</button>`}`);
  }
  if (s.type === 'rebase') {
    return wrap(`<div class="row">${mascot('proud', 56)}<span style="flex:1"><b style="font-size:19px;display:block">น้ำหนักเปลี่ยนไป ${r1(Math.abs(s.w - s.old))} kg</b><span class="small mut">คำนวณเป้าใหม่จากน้ำหนักล่าสุด</span></span>${closeBtn}</div>
      <div class="row" style="gap:10px;justify-content:center"><div style="text-align:center"><span class="small mut">เป้าเดิม</span><b style="display:block;font-size:24px;color:var(--mut)">${fmt(s.from)}</b></div><span style="font-size:22px">→</span><div style="text-align:center"><span class="small mut">เป้าใหม่</span><b style="display:block;font-size:32px">${fmt(s.to)}</b></div></div>
      <span class="small mut" style="text-align:center;line-height:1.5">โปรตีนเปลี่ยนเป็น ${Math.round(protPerKg() * s.w)} g/วัน · ยังบวก Watch ทุกวันเหมือนเดิม</span>
      <button class="btn" data-act="rebaseYes">ใช้เป้าใหม่</button><button class="link" data-act="close">ยังไม่เปลี่ยน</button>`);
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
        <button class="btn" data-act="checkFill">ยังไม่ครบ · เติมย้อนหลัง</button><button class="btn w" data-act="checkDone">ครบแล้ว กินแค่นี้จริง</button><button class="btn w" data-act="checkSpecial" style="font-size:14px">${svgI('cake', 18)} วันมื้อพิเศษ · จดคร่าวๆ แล้ว</button></div>`, true);
  }
  if (s.type === 'formula') {
    const p = db.profile; const tb = targetBase(p);
    return wrap(`<div class="row"><b style="flex:1;font-size:19px">เป้ามาจากไหน</b>${closeBtn}</div>
      ${[['BMR (Mifflin-St Jeor)', fmt(bmr(p))], ['× 1.2 นั่งทำงาน = ใช้ต่อวัน', fmt(baseTDEE(p))], ['− ' + PACE[p.pace].def + ' เพื่อลด ' + PACE[p.pace].kg + ' kg/สัปดาห์', fmt(tb.raw)], ['ขั้นต่ำเพื่อความปลอดภัย', p.sex === 'm' ? '1,500' : '1,200'], ['เป้าฐานต่อวัน', fmt(tb.value)]].map(([l, v], i) => `<div class="row" style="${i === 4 ? 'background:var(--y);border-radius:16px;padding:10px 12px' : 'padding:0 4px'}"><span style="flex:1;font-size:14px">${l}</span><b style="font-size:${i === 4 ? 22 : 17}px">${v}</b></div>`).join('')}
      <span class="small mut" style="line-height:1.6">บวก ${Math.round(p.watchPct * 100)}% ของ active kcal จาก Watch ทุกวัน · ใช้ ×1.2 เป็นฐานเพื่อไม่นับการออกกำลังซ้ำ · protein ${protPerKg()} g/kg = ${proteinTarget()} g</span>
      <div class="row"><b style="flex:1;font-size:14px">Protein g/kg</b>${[1.2, 1.4, 1.6, 2.0].map((v) => `<button class="chip ${protPerKg() === v ? 'on' : ''}" data-act="protKg" data-v="${v}">${v}</button>`).join('')}</div>
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

/* ================= habits: streak · stickers · reward · recap ================= */
const LOGGED = (k) => db.dayStatus[k] === 'done' || db.dayStatus[k] === 'special';
function streakInfo() {
  const today = todayKey(); let d = LOGGED(today) ? today : addDays(today, -1); let cur = 0;
  while (LOGGED(d)) { cur++; d = addDays(d, -1); }
  const keys = Object.keys(db.dayStatus).filter(LOGGED).sort(); let best = 0, run = 0, prev = null;
  keys.forEach((k) => { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
  return { cur, best: Math.max(best, cur) };
}
const faceDot = (px, bg = '#FFE680') => `<span class="ic" style="width:${px}px;height:${px}px;border-radius:${px / 2}px;background:${bg}">${mascot('happy', Math.round(px * 0.84))}</span>`;
const cakeDot = (px) => `<span class="ic" style="width:${px}px;height:${px}px;border-radius:${px / 2}px;background:#FFE8F3">${svgI('cake', Math.round(px * 0.6))}</span>`;
function dayDot(k, px = 38) {
  const today = todayKey(); const st = db.dayStatus[k];
  if (st === 'special') return cakeDot(px);
  if (st === 'done') return faceDot(px);
  if (k === today) return `<span class="ic" style="width:${px}px;height:${px}px;border-radius:${px / 2}px;border:2.5px solid #1F1F1F;box-sizing:border-box;font-size:12px;font-weight:700">วันนี้</span>`;
  if (k > today || k < db.profile.startDate) return `<span class="ic" style="width:${px}px;height:${px}px;font-size:13px;color:#9A9A96">${parseKey(k).getDate()}</span>`;
  return `<span class="ic" style="width:${px}px;height:${px}px"><span style="width:10px;height:10px;border-radius:5px;background:#DDDDD8"></span></span>`;
}
const flameChip = (n) => `<button data-act="nav" data-to="stickers" aria-label="จดติดต่อกัน ${n} วัน · ดูแผ่นสติกเกอร์" style="border:none;background:#fff;border-radius:20px;padding:4px 10px 4px 4px;display:inline-flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(160,120,0,.18);margin-top:6px"><span class="ic" style="width:26px;height:26px;border-radius:13px;background:#FFE6E0">${svgI('flame', 18)}</span><b style="font-size:15px">${n}</b><span style="font-size:12px;font-weight:600">วัน</span></button>`;

function markDay(k, status) { db.dayStatus[k] = status; save(); S.toast = null; clearTimeout(toastTimer); S.sheet = { type: 'celebrate', date: k }; render(); }

/* --- today helpers --- */
function sameAsYesterday() {
  const k = todayKey(); const slot = slotNow(); const y = addDays(k, -1);
  if (entriesOn(k).some((e) => e.slot === slot)) return null;
  const es = entriesOn(y).filter((e) => e.slot === slot); if (!es.length) return null;
  return { slot, es, k: es.reduce((a, e) => a + e.k, 0), p: es.reduce((a, e) => a + e.p, 0), f: es.reduce((a, e) => a + e.f, 0) };
}
function slotFavs(exclude = []) {
  const slot = slotNow(); const since = addDays(todayKey(), -30); const cnt = {};
  db.entries.filter((e) => e.slot === slot && e.date >= since && !String(e.foodId).startsWith('meal')).forEach((e) => { cnt[e.foodId] = (cnt[e.foodId] || 0) + 1; });
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([id]) => foodById(id)).filter((f) => f && !f.deleted && !exclude.includes(f.id) && nutr(f)).slice(0, 3);
}
function todayExtras() {
  const k = todayKey(); const slotName = SLOTS.find((s) => s.id === slotNow()).name; let html = '';
  const same = sameAsYesterday();
  if (same) {
    const ic = same.es.slice(0, 3).map((e, i) => `<span style="${i ? 'margin-left:-12px;' : ''}transform:rotate(${i % 2 ? 6 : -6}deg);border:3px solid #FFF8D6;border-radius:20px">${iconBox(e.icon, 26, 44, 16)}</span>`).join('');
    html += `<div class="card" style="margin-top:12px;background:var(--yll);box-shadow:none;display:flex;flex-direction:column;gap:10px">
      <div class="row" style="gap:8px"><span class="ic" style="width:30px;height:30px;border-radius:15px;background:#fff">${slotSvg(same.slot, 20)}</span><b style="flex:1;font-size:15px">${slotName}เมื่อวานกินแบบนี้</b></div>
      <div class="row" style="gap:10px"><span class="row" style="gap:0">${ic}</span><span style="flex:1;min-width:0"><b style="display:block;font-size:14px;line-height:1.35">${esc(same.es.map((e) => e.name).join(' + '))}</b><span class="small mut">${fmt(same.k)} kcal · P ${Math.round(same.p)} g · Fb ${Math.round(same.f)} g</span></span></div>
      <div class="grid2" style="grid-template-columns:1.4fr 1fr;gap:8px"><button class="btn" data-act="sameLog" style="height:50px">✓ กินเหมือนเดิม</button><button class="btn w" data-act="nav" data-to="other" style="height:50px;font-size:14px">ปรับนิดหน่อย</button></div></div>`;
  }
  const favs = slotFavs([...(same ? same.es.map((e) => e.foodId) : []), ...entriesOn(k).filter((e) => e.slot === slotNow()).map((e) => e.foodId)]);
  if (favs.length) html += `<div class="row" style="margin:14px 20px 0;align-items:baseline"><b style="flex:1;font-size:16px">ของประจำช่วง${slotName}</b><span class="small mut">แตะ = บันทึกเลย</span></div>
    <div class="grid3" style="margin:10px 18px 0;gap:10px">${favs.map((f) => { const n = nutr(f); return `<button data-act="quickLog" data-id="${f.id}" aria-label="บันทึก ${esc(f.name)}" style="border:none;border-radius:22px;background:#fff;box-shadow:0 6px 18px rgba(31,31,31,.07);padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;position:relative">${iconBox(f.icon, 28, 46, 16)}<span style="font-size:13px;font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px">${esc(f.name)}</span><span class="small mut" style="font-size:11px">${fmt(n.k)} kcal</span><span class="ic" style="position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:11px;background:var(--y);font-size:14px;font-weight:700">+</span></button>`; }).join('')}</div>`;
  return html;
}
function finishDayCard() {
  const k = todayKey(); const h = new Date().getHours();
  if (LOGGED(k)) return `<div class="card row" style="margin-top:12px;background:var(--yll);box-shadow:none;gap:10px">${db.dayStatus[k] === 'special' ? cakeDot(40) : faceDot(40)}<span style="flex:1"><b style="font-size:14px">วันนี้จดครบแล้ว</b><span class="small mut" style="display:block">ได้สติกเกอร์แล้ว · กินเพิ่มก็บันทึกต่อได้</span></span></div>`;
  if (!entriesOn(k).length || (h < 17 && h >= 4)) return '';
  return `<div class="card" style="margin-top:12px;display:flex;flex-direction:column;gap:10px"><div class="row" style="gap:10px">${mascot('plate', 46)}<span style="flex:1"><b style="font-size:15px">วันนี้จดครบแล้วหรือยัง?</b><span class="small mut" style="display:block">กดแล้วได้สติกเกอร์ ไฟไม่ดับ</span></span></div>
    <div class="grid2" style="gap:8px"><button class="btn" data-act="markToday" data-v="done" style="height:48px">ครบแล้ว</button><button class="btn w" data-act="markToday" data-v="special" style="height:48px;font-size:14px">${svgI('cake', 18)} วันมื้อพิเศษ</button></div></div>`;
}

/* --- celebrate --- */
function weekRow(anchor, px = 38) {
  const mon = mondayOf(anchor); const names = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  return `<div class="row" style="justify-content:space-between">${[...Array(7)].map((_, i) => { const d = addDays(mon, i); return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${dayDot(d, px)}<span style="font-size:11px;font-weight:600;color:var(--mut)">${names[i]}</span></div>`; }).join('')}</div>`;
}
function celebrateHtml(s) {
  const st = streakInfo(); const special = db.dayStatus[s.date] === 'special'; const isToday = s.date === todayKey();
  const conf = '<svg width="100%" height="100%" viewBox="0 0 390 560" preserveAspectRatio="none" style="position:absolute;inset:0" aria-hidden="true"><circle cx="350" cy="40" r="80" fill="#FFE04D"/><circle cx="20" cy="300" r="56" fill="#FFE04D"/><rect x="60" y="90" width="4" height="16" fill="#FF7A59" transform="rotate(20 62 98)"/><rect x="320" y="250" width="4" height="16" fill="#8FCB9F" transform="rotate(-30 322 258)"/><rect x="250" y="110" width="4" height="14" fill="#fff" transform="rotate(-15 252 117)"/><circle cx="300" cy="170" r="5" fill="#FF9C85"/><circle cx="80" cy="200" r="4" fill="#fff"/></svg>';
  return `<div class="overlay center" data-act="overlay"><div class="modal" role="dialog" aria-modal="true" data-stop="1" style="background:var(--y);padding:0;overflow:hidden;position:relative">${conf}
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 20px 0">
      <span style="font-size:14px;font-weight:700;background:#fff;border-radius:16px;padding:6px 14px">${special ? 'วันมื้อพิเศษ ก็นับนะ' : (isToday ? 'จดครบวันนี้แล้ว!' : 'จด' + thDate(s.date) + 'ครบแล้ว!')}</span>
      <span class="ic" style="margin-top:8px;width:150px;height:150px;border-radius:75px;background:#fff;box-shadow:0 14px 30px rgba(160,120,0,.28);transform:rotate(-6deg)">${special ? `<span style="position:relative">${mascot('yay', 128)}<span style="position:absolute;right:-8px;bottom:0">${svgI('cake', 44)}</span></span>` : mascot('yay', 128)}</span>
      <b style="margin-top:8px;font-size:23px">ได้สติกเกอร์อีกใบ</b>
      <span style="font-size:13px;font-weight:600;text-align:center;line-height:1.5">นับแค่ว่าจดครบ กินเกินเป้าก็ได้นะ</span></div>
    <div style="position:relative;margin:16px 14px 0;background:#fff;border-radius:26px;padding:14px;display:flex;flex-direction:column;gap:12px">
      <div class="row" style="gap:10px"><span class="ic" style="width:48px;height:48px;border-radius:16px;background:#FFE6E0">${svgI('flame', 30)}</span><span style="flex:1"><b style="font-size:22px;display:block;line-height:1.1">${st.cur} วันติด</b><span class="small mut">${st.cur >= st.best ? 'สถิติใหม่ของเธอ!' : 'ยาวสุด ' + st.best + ' วัน · อีก ' + (st.best - st.cur + 1) + ' วันทำลายสถิติ'}</span></span></div>
      ${weekRow(s.date, 36)}</div>
    <div class="grid2" style="position:relative;margin:14px 14px 18px;gap:10px"><button class="btn" data-act="celebSheet" style="background:rgba(255,255,255,.55);box-shadow:none">ดูแผ่นสติกเกอร์</button><button class="btn" data-act="close" style="background:#fff">เก็บเลย</button></div>
  </div></div>`;
}

/* --- sticker month --- */
function vStickers() {
  const today = todayKey(); const ym = S.mon || today.slice(0, 7); const [Y, M] = ym.split('-').map(Number);
  const first = `${ym}-01`; const nDays = new Date(Y, M, 0).getDate(); const off = (parseKey(first).getDay() + 6) % 7;
  const cells = [...Array(off)].map(() => '<span></span>').join('') + [...Array(nDays)].map((_, i) => { const d = `${ym}-${pad(i + 1)}`; const past = d < today && d >= db.profile.startDate;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">${dayDot(d, 38)}<span style="font-size:10px;color:var(--mut)">${past || LOGGED(d) ? i + 1 : '&#160;'}</span></div>`; }).join('');
  const inMon = Object.keys(db.dayStatus).filter((d) => d.startsWith(ym));
  const logged = inMon.filter(LOGGED).length; const special = inMon.filter((d) => db.dayStatus[d] === 'special').length; const st = streakInfo();
  const prevYm = (() => { const d = new Date(Y, M - 2, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); })(); const nextYm = (() => { const d = new Date(Y, M, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); })();
  const canPrev = prevYm >= db.profile.startDate.slice(0, 7); const canNext = nextYm <= today.slice(0, 7);
  const tile = (bg, ic, v, l) => `<div style="background:${bg};border-radius:20px;padding:10px 12px;display:flex;flex-direction:column;gap:2px"><span class="ic" style="width:30px;height:30px;border-radius:15px;background:#fff">${ic}</span><b style="font-size:20px">${v}</b><span style="font-size:11px;color:var(--mut)">${l}</span></div>`;
  return topBar('สติกเกอร์ ' + TH_MON[M - 1], 'จดครบ 1 วัน = สติกเกอร์ 1 ใบ', 'today') +
    `<div class="grid3" style="margin:4px 16px 0;gap:8px">${tile('#FFF3B0', mascot('happy', 26), logged, 'วันที่จดครบ')}${tile('#FFE6E0', svgI('flame', 20), st.best, 'ติดยาวสุด')}${tile('#FFE8F3', svgI('cake', 18), special, 'วันมื้อพิเศษ')}</div>
    <div class="card" style="padding:12px 8px 14px;display:flex;flex-direction:column;gap:10px">
      <div class="row" style="padding:0 6px"><button class="back" data-act="mon" data-v="${prevYm}" ${canPrev ? '' : 'disabled style="opacity:.3"'} aria-label="เดือนก่อน" style="width:36px;height:36px">${chev('l', 16)}</button><b style="flex:1;text-align:center">${TH_MON[M - 1]} ${Y + 543}</b><button class="back" data-act="mon" data-v="${nextYm}" ${canNext ? '' : 'disabled style="opacity:.3"'} aria-label="เดือนถัดไป" style="width:36px;height:36px">${chev('r', 16)}</button></div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));font-size:12px;font-weight:700;color:var(--mut);text-align:center">${['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((x) => `<span>${x}</span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));row-gap:8px">${cells}</div></div>
    ${rewardMini()}
    <div class="row small mut" style="margin:12px 22px 0;gap:14px;font-size:12px;flex-wrap:wrap"><span class="row" style="gap:5px">${faceDot(18)}จดครบ</span><span class="row" style="gap:5px">${cakeDot(18)}มื้อพิเศษ</span><span class="row" style="gap:5px"><span style="width:9px;height:9px;border-radius:5px;background:#DDDDD8"></span>ไม่ได้จด (ไฟดับ)</span></div>` + nav();
}

/* --- reward --- */
const RW_TYPES = { waist: { name: 'รอบเอวลด', unit: 'cm', step: 0.5, min: 0.5, max: 20, def: 4, icon: 'tape' }, logged: { name: 'จดครบ', unit: 'วัน', step: 5, min: 5, max: 120, def: 30, icon: 'flame' }, protein: { name: 'Protein ถึงเป้า', unit: 'วัน', step: 5, min: 5, max: 120, def: 20, icon: 'chicken' } };
const RW_ICONS = [['pants', 'เสื้อผ้า'], ['spa', 'นวด/สปา'], ['shoe', 'รองเท้า'], ['plane', 'เที่ยว'], ['gift', 'อื่นๆ']];
const activeReward = () => (db.rewards || []).find((r) => r.status === 'active');
const latestWaist = (upTo) => { const s = bodySeries('waist').filter((b) => !upTo || b.date <= upTo); return s.length ? s[s.length - 1].waist : null; };
function rewardProgress(r) {
  let v = 0;
  if (r.type === 'waist') { const cur = latestWaist(); v = r.start != null && cur != null ? Math.max(0, r.start - cur) : 0; }
  else if (r.type === 'logged') v = Object.keys(db.dayStatus).filter((d) => d >= r.startDate && LOGGED(d)).length;
  else { const pT = proteinTarget(); const ds = [...new Set(db.entries.filter((e) => e.date >= r.startDate).map((e) => e.date))]; v = ds.filter((d) => totals(d).p >= pT).length; }
  return { v: r1(v), pct: Math.min(1, v / r.target), done: v >= r.target };
}
function rewardMini() {
  const r = activeReward();
  if (!r) return `<button data-act="nav" data-to="reward" class="card row" style="border:none;width:calc(100% - 32px);background:var(--yll);box-shadow:none;gap:12px;text-align:left"><span class="ic" style="width:50px;height:50px;border-radius:18px;background:#fff">${svgI('gift', 32)}</span><span style="flex:1"><b style="font-size:15px">ตั้งรางวัลให้ตัวเอง</b><span class="small mut" style="display:block">เช่น เอวลด 4 cm → ซื้อกางเกงตัวใหม่</span></span>${chev('r', 16)}</button>`;
  const pr = rewardProgress(r); const T = RW_TYPES[r.type];
  return `<button data-act="nav" data-to="reward" class="card row" style="border:none;width:calc(100% - 32px);background:var(--yll);box-shadow:none;gap:12px;text-align:left"><span class="ic" style="width:50px;height:50px;border-radius:18px;background:#fff;transform:rotate(-5deg)">${svgI(r.icon, 34)}</span><span style="flex:1;display:flex;flex-direction:column;gap:5px;min-width:0"><b style="font-size:15px">${esc(r.name)}</b><span class="small mut">${pr.done ? 'ถึงเป้าแล้ว! ไปรับรางวัลได้เลย' : T.name + ' ' + pr.v + ' จาก ' + r.target + ' ' + T.unit}</span><span style="height:8px;border-radius:4px;background:#fff;display:flex;overflow:hidden"><span style="width:${pr.pct * 100}%;background:#FFB547"></span></span></span>${chev('r', 16)}</button>`;
}
function vReward() {
  const r = activeReward(); const f = S.rw || (S.rw = { type: 'waist', target: RW_TYPES.waist.def, icon: 'pants', name: '' }); const T = RW_TYPES[f.type];
  let cur = '';
  if (r) { const pr = rewardProgress(r); const RT = RW_TYPES[r.type];
    cur = `<div class="card" style="background:var(--y);box-shadow:none;display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden"><svg width="140" height="140" viewBox="0 0 140 140" style="position:absolute;right:-40px;top:-50px" aria-hidden="true"><circle cx="70" cy="70" r="70" fill="#FFE04D"/></svg>
      <span style="font-size:12px;font-weight:700;position:relative">${pr.done ? 'ถึงเป้าแล้ว!' : 'กำลังไปถึง'}</span>
      <div class="row" style="gap:12px;position:relative"><span class="ic" style="width:68px;height:68px;border-radius:24px;background:#fff;transform:rotate(-5deg)">${svgI(r.icon, 44)}</span><span style="flex:1"><b style="font-size:20px;line-height:1.2;display:block">${esc(r.name)}</b><span style="font-size:13px;font-weight:600">เมื่อ${RT.name} ${r.target} ${RT.unit}</span></span></div>
      <div style="position:relative;background:#fff;border-radius:18px;padding:10px 12px 12px;display:flex;flex-direction:column;gap:10px">
        <div class="row" style="gap:8px">${svgI(RT.icon, 20)}<span style="flex:1;font-size:13px"><b>${pr.v}</b> จาก ${r.target} ${RT.unit}</span><span class="small mut">${pr.done ? 'ครบแล้ว' : 'อีก ' + r1(r.target - pr.v)}</span></div>
        <div style="height:12px;border-radius:6px;background:#FFF3B0;position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:${pr.pct * 100}%;border-radius:6px;background:#FFB547"></span><span class="ic" style="position:absolute;left:max(-4px,calc(${pr.pct * 100}% - 13px));top:-7px;width:26px;height:26px;border-radius:13px;background:#fff;border:2px solid #1F1F1F;box-sizing:border-box">${mascot('happy', 22)}</span></div>
        ${r.type === 'waist' && r.start == null ? '<span class="small mut">ยังไม่มีรอบเอวตั้งต้น · วัดรอบเอวครั้งถัดไปจะเริ่มนับ</span>' : ''}</div>
      ${pr.done ? '<button class="btn" data-act="rwClaim" style="background:#fff;position:relative">ได้รับรางวัลแล้ว ✓</button>' : ''}</div>`; }
  else cur = `<div class="card row" style="background:var(--yll);box-shadow:none;gap:12px">${mascot('wave', 64)}<span style="flex:1"><b style="font-size:16px">ยังไม่มีรางวัล</b><span class="small mut" style="display:block;line-height:1.5">ตั้งเป้าที่อยากทำ + ของที่อยากได้ แอปจะนับให้เอง</span></span></div>`;
  const done = (db.rewards || []).filter((x) => x.status === 'done');
  const typeBtn = (k) => { const t = RW_TYPES[k]; const on = f.type === k; return `<button data-act="rwType" data-v="${k}" style="border:none;border-radius:20px;padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;background:${on ? '#FFD000' : 'var(--g)'};font-weight:${on ? 700 : 500}">${svgI(t.icon, 26)}${t.name}</button>`; };
  const iconBtn = ([k, l]) => `<button data-act="rwIcon" data-v="${k}" style="border:none;border-radius:18px;padding:8px 2px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;background:${f.icon === k ? '#fff;box-shadow:0 0 0 3px #FFD000' : 'var(--g)'}">${svgI(k, 28)}${l}</button>`;
  return topBar('รางวัลของฉัน', '', S.rwBack || 'stickers') + cur +
    `<div class="h2" style="margin-top:18px">${r ? 'เปลี่ยนรางวัล' : 'ตั้งรางวัลใหม่'}</div>
    <div style="margin:0 16px;display:flex;flex-direction:column;gap:8px"><b style="font-size:13px">1 · เป้า</b>
      <div class="grid3" style="gap:8px">${Object.keys(RW_TYPES).map(typeBtn).join('')}</div>
      <div class="row" style="background:var(--g);border-radius:20px;padding:6px 6px 6px 14px;gap:8px"><span style="flex:1;font-size:14px">${T.name}</span><button class="step" data-act="rwStep" data-d="-1" aria-label="ลด" style="background:#fff">−</button><b style="font-size:20px;min-width:70px;text-align:center">${f.target} ${T.unit}</b><button class="step" data-act="rwStep" data-d="1" aria-label="เพิ่ม" style="background:#fff">+</button></div>
      <b style="font-size:13px;margin-top:6px">2 · รางวัล</b>
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px">${RW_ICONS.map(iconBtn).join('')}</div>
      <label class="small mut" for="rw-name">ชื่อรางวัล</label><div class="inp"><input id="rw-name" data-input="rwName" placeholder="เช่น กางเกงยีนส์ตัวใหม่" value="${esc(f.name)}" maxlength="40"></div>
      <div id="rw-err" class="small" style="color:#B3261E;min-height:16px"></div>
      <button class="btn" data-act="rwSave">${r ? 'เปลี่ยนเป็นรางวัลนี้' : 'ตั้งเป็นรางวัล'}</button></div>
    ${done.length ? `<div class="h2" style="margin-top:18px">ได้มาแล้ว</div><div style="margin:0 16px;display:flex;flex-direction:column;gap:8px">${done.slice(-5).reverse().map((x) => `<div class="row" style="background:var(--g);border-radius:18px;padding:8px 12px;gap:10px">${svgI(x.icon, 26)}<span style="flex:1;font-size:14px"><b>${esc(x.name)}</b> <span class="small mut">· ${thDate(x.doneAt)}</span></span>✓</div>`).join('')}</div>` : ''}` + nav();
}

/* --- sunday recap (single SVG: shown inline and saved as PNG) --- */
function recapData(mon) {
  const days = [...Array(7)].map((_, i) => addDays(mon, i)); const pT = proteinTarget();
  const prot = days.map((d) => ({ d, v: entriesOn(d).length ? Math.round(totals(d).p) : null, special: db.dayStatus[d] === 'special' }));
  const logged = days.filter(LOGGED).length; const protDays = prot.filter((x) => x.v != null && x.v >= pT).length;
  const wEnd = latestWaist(days[6]); const wStart = latestWaist(addDays(mon, -1));
  const waist = wEnd != null && wStart != null && bodySeries('waist').some((b) => b.date >= mon && b.date <= days[6]) ? r1(wEnd - wStart) : null;
  return { mon, days, prot, logged, protDays, waist, pT };
}
function recapSVG(R) {
  const W = 354, H = 560; const F = "font-family=\"Google Sans, Anuphan, sans-serif\"";
  const head = R.logged >= 6 ? ['สัปดาห์นี้', 'เก่งมาก!'] : R.logged >= 4 ? ['สัปดาห์นี้', 'ไปได้สวย!'] : ['สัปดาห์หน้า', 'เอาใหม่นะ'];
  const mood = R.logged >= 6 ? 'proud' : R.logged >= 4 ? 'yay' : 'calm';
  const nest = (svg, x, y) => svg.replace('<svg ', `<svg x="${x}" y="${y}" `);
  const stat = (x, icon, bg, num, unit, label) => `<rect x="${x + 22}" y="216" width="46" height="46" rx="16" fill="${bg}"/>${nest(icon, x + 29, 223)}
    <text x="${x + 45}" y="294" text-anchor="middle" ${F} font-size="28" font-weight="700" fill="#1F1F1F">${num}<tspan font-size="13" font-weight="600" fill="#5E5E5E">${unit}</tspan></text>
    <text x="${x + 45}" y="314" text-anchor="middle" ${F} font-size="12" font-weight="600" fill="#5E5E5E">${label}</text>`;
  const icon = (k, px) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24">${ICONS[k][1]}</svg>`;
  // bars
  const cx0 = 34, cw = (W - 68) / 7, base = 488, Hb = 96, MAXV = Math.max(R.pT * 1.15, ...R.prot.map((x) => x.v || 0));
  const gy = base - R.pT / MAXV * Hb; const names = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const bars = R.prot.map((x, i) => { const cx = cx0 + cw * i + cw / 2; let s = '';
    if (x.v == null) s = `<circle cx="${cx}" cy="${base - 4}" r="4" fill="#DDDDD8"/>`;
    else if (x.v >= R.pT) { const h = Math.max(8, x.v / MAXV * Hb); s = `<rect x="${cx - 13}" y="${base - h}" width="26" height="${h}" rx="12" fill="#FFD000"/>` + (x.special ? '' : `<path transform="translate(${cx} ${base - h - 12})" d="M0 -7 c.8 4.4 2.7 6.3 7 7 -4.3.8 -6.2 2.7 -7 7 -.8 -4.3 -2.7 -6.2 -7 -7 4.3 -.7 6.2 -2.6 7 -7z" fill="#FFD000" stroke="#1F1F1F" stroke-width="1.6" stroke-linejoin="round"/>`); }
    else { const h = Math.max(6, x.v / MAXV * Hb); s = `<rect x="${cx - 13}" y="${base - h}" width="26" height="${h}" rx="8" fill="#E4E4DF"/><rect x="${cx - 12}" y="${gy}" width="24" height="${base - h - gy}" rx="10" fill="none" stroke="#C9C9C3" stroke-width="1.6" stroke-dasharray="4 3"/>` + (base - h - gy > 16 ? `<text x="${cx}" y="${(gy + base - h) / 2 + 4}" text-anchor="middle" ${F} font-size="10" font-weight="700" fill="#5E5E5E">−${R.pT - x.v}</text>` : ''); }
    if (x.special) { const top = x.v == null ? base - 10 : base - Math.max(x.v, x.v >= R.pT ? x.v : R.pT) / MAXV * Hb; s += nest(icon('cake', 20), cx - 10, top - 24); }
    return s + `<text x="${cx}" y="${base + 20}" text-anchor="middle" ${F} font-size="12" font-weight="700" fill="${x.v != null && x.v >= R.pT ? '#1F1F1F' : '#5E5E5E'}">${names[i]}</text>`; }).join('');
  const waistTxt = R.waist == null ? '–' : (R.waist > 0 ? '+' : R.waist < 0 ? '−' : '') + Math.abs(R.waist);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="สรุปสัปดาห์ จดครบ ${R.logged} จาก 7 วัน protein ถึงเป้า ${R.protDays} วัน">
    <rect width="${W}" height="${H}" rx="32" fill="#FFD000"/><clipPath id="rc"><rect width="${W}" height="${H}" rx="32"/></clipPath><circle cx="${W - 20}" cy="20" r="100" fill="#FFE04D" clip-path="url(#rc)"/>
    <text x="22" y="40" ${F} font-size="13" font-weight="700" fill="#1F1F1F">${thDate(R.days[0])} – ${thDate(R.days[6])}</text>
    <text x="22" y="84" ${F} font-size="30" font-weight="700" fill="#1F1F1F">${head[0]}</text><text x="22" y="122" ${F} font-size="30" font-weight="700" fill="#1F1F1F">${head[1]}</text>
    ${nest(mascot(mood, 116), W - 136, 24)}
    <rect x="16" y="196" width="${W - 32}" height="136" rx="24" fill="#FFFFFF"/>
    <line x1="${16 + (W - 32) / 3}" y1="216" x2="${16 + (W - 32) / 3}" y2="312" stroke="#EEEEEA"/><line x1="${16 + 2 * (W - 32) / 3}" y1="216" x2="${16 + 2 * (W - 32) / 3}" y2="312" stroke="#EEEEEA"/>
    ${stat(16 + (W - 32) / 6 - 45, mascot('happy', 32), '#FFF3B0', R.logged, '/7', 'วันที่จดครบ')}
    ${stat(16 + (W - 32) / 2 - 45, icon('chicken', 32), '#FFE6D6', R.protDays, '/7', 'Protein ถึงเป้า')}
    ${stat(16 + 5 * (W - 32) / 6 - 45, icon('tape', 32), '#FFF3B0', waistTxt, R.waist == null ? '' : ' cm', R.waist == null ? 'ยังไม่ได้วัด' : 'รอบเอว')}
    <rect x="16" y="344" width="${W - 32}" height="196" rx="24" fill="#FFFFFF"/>
    <text x="32" y="372" ${F} font-size="13" font-weight="700" fill="#1F1F1F">Protein รายวัน</text><text x="${W - 32}" y="372" text-anchor="end" ${F} font-size="12" fill="#5E5E5E">เป้า ${R.pT} g</text>
    <line x1="30" y1="${gy}" x2="${W - 30}" y2="${gy}" stroke="#E6C200" stroke-width="2" stroke-dasharray="6 4"/>
    ${bars}
    <text x="${W - 22}" y="${H - 8}" text-anchor="end" ${F} font-size="10" font-weight="700" fill="#1F1F1F" opacity="0.8">NoNeang</text>
  </svg>`;
}
function vRecap() {
  const mon = S.recapMon || mondayOf(todayKey()); const R = recapData(mon);
  db.seenRecap = db.seenRecap || {}; if (!db.seenRecap[mon]) { db.seenRecap[mon] = 1; save(); }
  return topBar('สรุปประจำสัปดาห์', '', S.recapBack || 'week') +
    `<div style="margin:6px 18px 0">${recapSVG(R).replace('<svg ', '<svg style="width:100%;height:auto;display:block" ')}</div>
    <div class="row small mut" style="margin:10px 22px 0;gap:12px;justify-content:center;font-size:12px"><span class="row" style="gap:5px"><span style="width:12px;height:12px;border-radius:4px;background:#FFD000"></span>ถึงเป้า</span><span class="row" style="gap:5px"><span style="width:12px;height:12px;border-radius:4px;background:#E4E4DF"></span>ยังไม่ถึง</span><span class="row" style="gap:5px"><span style="width:12px;height:12px;border-radius:4px;border:2px dashed #C9C9C3;box-sizing:border-box"></span>ส่วนที่ขาด</span><span class="row" style="gap:4px">${svgI('cake', 15)}มื้อพิเศษ</span></div>
    ${activeReward() ? rewardMini() : ''}
    <div class="grid2" style="margin:14px 16px 0;grid-template-columns:1.3fr 1fr;gap:10px"><button class="btn" data-act="recapSave"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>บันทึกเป็นรูป</button><button class="btn w" data-act="nav" data-to="week">ดูกราฟ</button></div>` + nav();
}
async function recapSave() {
  try {
    const svg = recapSVG(recapData(S.recapMon || mondayOf(todayKey())));
    const img = new Image(); await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const c = document.createElement('canvas'); c.width = 354 * 3; c.height = 560 * 3; const x = c.getContext('2d'); x.scale(3, 3); x.drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); const name = 'noneang-' + (S.recapMon || mondayOf(todayKey())) + '.png';
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { if (e && e.name === 'AbortError') return; toast('บันทึกรูปไม่ได้ในเบราว์เซอร์นี้ ลองแคปหน้าจอแทนนะ', null, 'huh'); }
}

/* --- browse dictionary --- */
function foodRow(f) {
  const n = nutr(f); const act = f._db ? 'dbLog' : (f.kind === 'sized' ? 'sizeSheet' : 'quickLog');
  return `<button data-act="${act}" data-id="${f.id}" style="border:none;background:#fff;width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #F2EEE6;text-align:left">${iconBox(f.icon, 30, 50, 17)}<span style="flex:1;min-width:0"><b style="display:block;font-size:16px">${esc(f.name)}</b><span class="small mut">${f.kind === 'sized' ? fmt(f.per100.k) + ' kcal ต่อ 100 g' : (n ? fmt(n.k) + ' kcal · 1 ' + esc(f.unit) + (n.p >= 10 ? ' · P ' + Math.round(n.p) : '') : 'ยังไม่มีค่าฉลาก')}${f.src === 'est' || f._db ? ' · ประมาณ' : ''}</span></span>${f.kind === 'sized' ? '<span class="badge" style="background:var(--greenL)">เลือกขนาด ›</span>' : '<span class="ic" style="width:40px;height:40px;border-radius:20px;background:var(--y);font-size:20px;font-weight:700">+</span>'}</button>`;
}
function vBrowse() {
  const g = S.grp || FOOD_GROUPS[0].id; const own = new Set(db.foods.map((f) => f.id));
  const list = FOOD_DB.filter((f) => f.grp === g).map((f) => own.has(f.id) ? foodById(f.id) : { ...f, _db: true }).filter((f) => f && !f.deleted);
  return topBar('เมนูทั้งหมด', FOOD_DB.length + ' รายการ · ค่าประมาณต่อ 1 ที่', 'other') +
    `<div style="margin:6px 0 0;padding:0 16px 4px;display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch">${FOOD_GROUPS.map((x) => `<button class="chip ${x.id === g ? 'on' : ''}" data-act="grp" data-v="${x.id}" style="flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding-left:6px">${iconBox(x.icon, 16, 26)}${x.name}</button>`).join('')}</div>
    <div class="card" style="padding:0;overflow:hidden;margin-top:10px">${list.map(foodRow).join('')}</div>
    <div style="margin:14px 16px 0"><button class="btn ghost" data-act="addFood" data-name="">+ ไม่มีในนี้ · เพิ่มเมนูของฉัน</button></div>`;
}

/* --- cloud UI --- */
const CLOUD_ICON = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.6 4.5 4.5 0 0 0 7 18.5z" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 15.5v-5M9.8 12.5l2.2-2.2 2.2 2.2" fill="none" stroke="#1F1F1F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function cloudCard() {
  if (!(typeof Cloud !== 'undefined')) return '';
  if (!Cloud.enabled) return `<div class="card row" style="margin-top:14px;background:var(--g);box-shadow:none;gap:12px"><span class="ic" style="width:48px;height:48px;border-radius:16px;background:#fff">${CLOUD_ICON}</span><span style="flex:1"><b style="font-size:15px">สำรองขึ้น cloud</b><span class="small mut" style="display:block;line-height:1.5">ยังไม่ได้ตั้งค่า Supabase ใน config.js</span></span></div>`;
  if (!Cloud.user) return `<button class="card row" data-act="cloudOpen" style="border:none;width:calc(100% - 32px);margin-top:14px;background:var(--yll);box-shadow:none;gap:12px;text-align:left"><span class="ic" style="width:48px;height:48px;border-radius:16px;background:#fff">${CLOUD_ICON}</span><span style="flex:1"><b style="font-size:15px">เปิดสำรองข้อมูลขึ้น cloud</b><span class="small mut" style="display:block;line-height:1.5">ใส่อีเมล รับรหัส 6 หลัก · ข้อมูลไม่หาย + ใช้ widget ได้</span></span>${chev('r', 16)}</button>`;
  const st = { ok: ['#E7F4EA', 'สำรองแล้ว'], syncing: ['#FFF3B0', 'กำลังซิงก์…'], error: ['#FFE6E0', 'ซิงก์ไม่สำเร็จ'], offline: ['#F4F4F2', 'ออฟไลน์ · จะซิงก์เมื่อมีเน็ต'], signedout: ['#F4F4F2', '-'] }[Cloud.state] || ['#F4F4F2', Cloud.state];
  const t = Cloud.lastSync ? pad(Cloud.lastSync.getHours()) + ':' + pad(Cloud.lastSync.getMinutes()) : '-';
  return `<div class="card" style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
    <div class="row" style="gap:12px"><span class="ic" style="width:48px;height:48px;border-radius:16px;background:var(--yll)">${CLOUD_ICON}</span><span style="flex:1;min-width:0"><b style="font-size:15px">Cloud backup</b><span class="small mut" style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(Cloud.user.email || '')}</span></span><span class="badge" style="background:${st[0]}">${st[1]}</span></div>
    <div class="row small mut" style="justify-content:space-between"><span>ซิงก์ล่าสุด ${t}</span><button class="link" data-act="cloudSync" style="font-weight:700;color:var(--ink)">ซิงก์ตอนนี้</button></div>
    <button class="btn" data-act="widgetOpen" style="height:50px">${svgI('watch', 20)} ตั้งค่า widget หน้าจอ</button>
    <button class="link" data-act="cloudOut">ออกจากระบบ</button></div>`;
}
function cloudSheet(s, closeBtn) {
  const err = `<div class="small" style="color:#B3261E;min-height:16px;line-height:1.5">${esc(s.err || '')}</div>`;
  return `<div class="row">${mascot('wave', 56)}<span style="flex:1"><b style="font-size:19px">สำรองข้อมูลขึ้น cloud</b><span class="small mut" style="display:block">ครั้งแรกจะสร้างบัญชีให้อัตโนมัติ</span></span>${closeBtn}</div>
    <div class="field"><label for="cl-email">อีเมล</label><div class="inp"><input id="cl-email" type="email" inputmode="email" autocomplete="username" data-input="clEmail" placeholder="you@email.com" value="${esc(s.clEmail || '')}"></div></div>
    <div class="field"><label for="cl-pw">รหัสผ่าน (อย่างน้อย 6 ตัว)</label><div class="inp"><input id="cl-pw" type="password" autocomplete="current-password" data-input="clPw" value="${esc(s.clPw || '')}"></div></div>${err}
    <button class="btn" data-act="cloudLogin" ${s.busy ? 'disabled style="opacity:.5"' : ''}>${s.busy ? 'กำลังเชื่อม…' : 'เข้าสู่ระบบ / สร้างบัญชี'}</button>
    <span class="small mut" style="line-height:1.5">ล็อกอินครั้งเดียวต่อเครื่อง · ข้อมูลของเธออ่านได้แค่บัญชีนี้ · จดรหัสผ่านไว้ด้วย ใช้ตอนเปลี่ยนเครื่อง</span>`;
}
function widgetSheet(closeBtn) {
  const step = (n, t, d) => `<div class="row" style="align-items:flex-start;gap:10px"><span class="ic" style="width:28px;height:28px;border-radius:14px;background:var(--y);font-weight:700;font-size:14px;flex-shrink:0">${n}</span><span style="flex:1"><b style="font-size:14px">${t}</b><span class="small mut" style="display:block;line-height:1.5">${d}</span></span></div>`;
  const k = todayKey(); const t = totals(k); const g = goalOf(k); const pT = proteinTarget(); const need = Math.max(0, pT - Math.round(t.p));
  const left = Math.round(g - t.k);
  const prev = `<div style="align-self:center;width:160px;height:160px;border-radius:28px;background:#fff;padding:8px 12px 12px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;position:relative;box-shadow:0 10px 24px rgba(0,0,0,.14);border:1px solid #F1EEE6">
    <span style="position:absolute;right:6px;top:4px">${mascot('happy', 34)}</span>
    <div style="position:relative;width:104px;height:104px">${ring(t.k / g, 104, 12, '#FFD000', '#FFF3B0')}<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:10px;font-weight:700;color:#8A8A8A">${left < 0 ? 'เกินมา' : 'กินได้อีก'}</span><b style="font-size:28px;line-height:1.05;letter-spacing:-1px">${fmt(Math.abs(left))}</b><span style="font-size:10px;font-weight:700;color:#8A8A8A">kcal</span></div></div>
    <div class="row" style="margin-top:auto;gap:5px">${svgI('chicken', 17)}${need ? `<span style="font-size:11px;font-weight:700;color:#8A8A8A">เติมโปรตีนอีก</span><b style="font-size:16px">${need}</b><span style="font-size:11px;font-weight:700;color:#8A8A8A">g</span>` : '<b style="font-size:14px">โปรตีนครบ ✓</b>'}</div></div>`;
  return `<div class="row"><b style="flex:1;font-size:19px">Widget หน้าจอ</b>${closeBtn}</div>${prev}
    ${step(1, 'โหลดแอป Scriptable', 'ฟรีใน App Store · ใช้สร้าง widget ด้วยสคริปต์')}
    ${step(2, 'คัดลอกสคริปต์ของเธอ', 'มีรหัส widget ส่วนตัวอยู่ข้างใน อ่านได้แค่ตัวเลขสรุปของวันนี้')}
    <button class="btn" data-act="widgetCopy">คัดลอกสคริปต์</button>
    <textarea id="wg-script" readonly style="display:none;width:100%;height:120px;font-size:11px;border-radius:12px;border:1px solid #E0E0DC;padding:8px;box-sizing:border-box">${esc(Cloud.widgetScript())}</textarea>
    ${step(3, 'วางใน Scriptable', 'เปิด Scriptable → + → วาง → ตั้งชื่อ NoNeang')}
    ${step(4, 'เพิ่ม widget', 'กดค้างหน้าจอ → แก้ไข → เพิ่ม widget → Scriptable เลือกขนาดเล็กหรือกลาง → แตะ widget → Script: NoNeang · ใช้สคริปต์เดียวกันได้ทั้ง 2 ขนาด')}
    <span class="small mut" style="line-height:1.5">widget อัปเดตเองทุก 20–60 นาที (iOS เป็นคนกำหนด) · ตัวเลขมาจากครั้งล่าสุดที่แอปซิงก์</span>`;
}

/* ================= v6: plates · builder · groups · overview · period ================= */
const resolveFood = (id) => foodById(id) || mealFoods().find((m) => m.id === id) || null;
const PLATE_POS = { 1: [[50, 50, 32]], 2: [[33, 50, 24], [67, 50, 24]], 3: [[50, 31, 21], [31, 65, 21], [69, 65, 21]], 4: [[32, 32, 19], [68, 32, 19], [32, 68, 19], [68, 68, 19]] };
function plateSvg(icons, px = 62) {
  const n = Math.min(4, icons.length); const pos = PLATE_POS[n] || PLATE_POS[1];
  const inner = pos.map(([cx, cy, sz], i) => { const s = sz * px / 64; const ic = ICONS[icons[i]] || ICONS.main; return `<svg width="${s.toFixed(0)}" height="${s.toFixed(0)}" viewBox="0 0 24 24" style="position:absolute;left:${(cx * px / 100 - s / 2).toFixed(0)}px;top:${(cy * px / 100 - s / 2).toFixed(0)}px" aria-hidden="true">${ic[1]}</svg>`; }).join('');
  return `<span style="position:relative;width:${px}px;height:${px}px;border-radius:${px / 2}px;background:#fff;box-shadow:inset 0 0 0 4px #FFF3B0,0 3px 8px rgba(160,120,0,.18);flex-shrink:0;display:block">${inner}</span>`;
}
const plateKey = (items) => items.map((i) => i.foodId + 'x' + (i.grams || i.qty)).sort().join('|');
function plateNutr(items) { return items.reduce((a, i) => { const f = resolveFood(i.foodId); const n = f ? (f.kind === 'sized' ? nutr(f, { grams: i.grams }) : nutr(f, { qty: i.qty })) : null; return n ? { k: a.k + n.k, p: a.p + n.p, f: a.f + n.f } : a; }, { k: 0, p: 0, f: 0 }); }
function savePlate(items, slot) {
  if (!items.length) return; db.plates = db.plates || []; const key = plateKey(items);
  let pl = db.plates.find((x) => x.key === key);
  if (!pl) { pl = { id: uid(), userId: db.userId, key, items: items.map((i) => ({ foodId: i.foodId, qty: i.qty, grams: i.grams || null })), uses: 0, slots: {}, createdAt: new Date().toISOString(), schemaVersion: 1 }; db.plates.push(pl); }
  pl.uses++; pl.slots[slot] = (pl.slots[slot] || 0) + 1; pl.lastUsed = new Date().toISOString();
}
function homePlates(slot) {
  const ok = (db.plates || []).filter((p) => !p.hidden && p.items.every((i) => resolveFood(i.foodId)));
  const sorted = ok.sort((a, b) => ((b.slots[slot] || 0) * 3 + b.uses) - ((a.slots[slot] || 0) * 3 + a.uses) || (b.lastUsed || '').localeCompare(a.lastUsed || ''));
  const out = sorted.slice(0, 3).map((p) => ({ plate: p }));
  for (const m of mealFoods()) { if (out.length >= 3) break; if (!out.some((o) => o.plate && o.plate.items.length === 1 && o.plate.items[0].foodId === m.id)) out.push({ meal: m }); }
  return out.slice(0, 3);
}
const shortName = (n) => n.replace(/\s*\(.*?\)\s*/g, ' ').trim();
function plateName(pl, items) {
  if (pl && pl.name) return pl.name;
  const fs = items.map((i) => ({ f: resolveFood(i.foodId), n: plateNutr([i]) })).filter((x) => x.f).sort((a, b) => b.n.k - a.n.k);
  const ns = fs.map((x) => shortName(x.f.name));
  return ns.length <= 2 ? ns.join(' + ') : ns.slice(0, 2).join(' + ') + ' +' + (ns.length - 2);
}
function plateCard(o) {
  const items = o.plate ? o.plate.items : [{ foodId: o.meal.id, qty: 1 }];
  const foods = items.map((i) => resolveFood(i.foodId)); const n = plateNutr(items);
  const name = plateName(o.plate, items);
  const id = o.plate ? o.plate.id : 'meal:' + o.meal.id;
  return `<button data-act="plateLog" data-id="${esc(id)}" data-press="plateMenu" aria-label="บันทึก ${esc(name)} · กดค้างเพื่อดูทั้งหมด" style="-webkit-touch-callout:none;user-select:none;border:none;border-radius:24px;background:#fff;box-shadow:0 6px 18px rgba(31,31,31,.07);padding:12px 6px 10px;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;min-width:0">
    <span style="width:74px;height:74px;border-radius:37px;background:#FFF8D6;display:flex;align-items:center;justify-content:center">${plateSvg(foods.map((f) => f.icon))}</span>
    <span style="font-size:12.5px;font-weight:700;margin-top:4px;max-width:100%;line-height:1.25;min-height:2.5em;text-align:center;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding:0 4px">${esc(name)}</span>
    <span class="small mut" style="font-size:11px">${foods.length > 1 ? foods.length + ' อย่าง · ' : ''}${fmt(n.k)} kcal</span>
    <span class="ic" style="position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:12px;background:var(--y);font-size:15px;font-weight:700">+</span></button>`;
}
function logItems(items, slot, date) {
  const miss = items.map((i) => resolveFood(i.foodId)).find((f) => f && f.kind !== 'sized' && !nutr(f)); if (miss) { openSheet({ type: 'label', foodId: miss.id }); return null; }
  const out = []; for (const i of items) { const f = resolveFood(i.foodId); if (!f) continue; const e = addEntry(f, { qty: i.qty, grams: i.grams || undefined, slot, date }); if (e) out.push(e); else return null; }
  return out;
}

/* ---- builder ---- */
function freqFoods(n = 8) {
  const own = db.foods.filter((f) => !f.deleted && nutr(f)).sort((a, b) => (b.uses || 0) - (a.uses || 0) || (b.lastUsed || '').localeCompare(a.lastUsed || ''));
  const list = [...own.slice(0, n)]; for (const m of mealFoods()) { if (list.length >= n) break; list.push(m); }
  return list.slice(0, n);
}
function trayAdd(id) { const f = resolveFood(id); if (!f) return; if (!nutr(f) && f.kind !== 'sized') { openSheet({ type: 'label', foodId: f.id, thenTray: true }); return; } S.tray = S.tray || []; const t = S.tray.find((x) => x.foodId === id); if (t) { if (f.kind === 'sized') t.grams += f.def; else t.qty++; } else S.tray.push({ foodId: id, qty: 1, grams: f.kind === 'sized' ? f.def : null }); }
function searchGrouped(q) {
  const found = searchFoods(q); const groups = {}; const singles = [];
  found.forEach((f) => { if (f.group) (groups[f.group] = groups[f.group] || []).push(f); else singles.push(f); });
  const gs = Object.entries(groups).map(([g, fs]) => fs.length > 1 ? { group: g, foods: fs } : null).filter(Boolean);
  Object.values(groups).forEach((fs) => { if (fs.length === 1) singles.unshift(fs[0]); });
  db.foods.filter((f) => f.group && !f.deleted && f.group.toLowerCase().includes(q.trim().toLowerCase()) && !gs.some((g) => g.group === f.group)).forEach((f) => { const g = gs.find((x) => x.group === f.group); if (g) g.foods.push(f); else gs.push({ group: f.group, foods: [f] }); });
  return { groups: gs, singles: singles.filter((f) => !gs.some((g) => g.foods.includes(f))) };
}
function builderResults() {
  const q = (S.bq || '').trim(); const tray = S.tray || [];
  const tile = (f) => { const on = tray.some((t) => t.foodId === f.id); const n = nutr(f, f.kind === 'sized' ? { grams: f.def } : {});
    return `<button data-act="trayAdd" data-id="${esc(f.id)}" style="border:none;border-radius:20px;background:${on ? '#FFF8D6;box-shadow:0 0 0 2.5px #FFD000' : '#fff;box-shadow:0 4px 12px rgba(31,31,31,.07)'};padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;min-width:0">${iconBox(f.icon, 24, 42, 21)}<span style="font-size:12px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3px">${esc(f.name)}</span><span style="font-size:10px;color:var(--mut)">${n ? fmt(n.k) : '?'}</span>${on ? '<span class="ic" style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:10px;background:var(--y);font-size:11px;font-weight:700">✓</span>' : ''}</button>`; };
  if (!q) return `<span class="small" style="font-weight:700;color:var(--mut)">ชิ้นที่ใช้บ่อย · แตะใส่จาน</span><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${freqFoods(8).map(tile).join('')}</div>`;
  const { groups, singles } = searchGrouped(q);
  const row = (f) => { const n = nutr(f, f.kind === 'sized' ? { grams: f.def } : {}); return `<button data-act="${f._db ? 'dbTray' : 'trayAdd'}" data-id="${esc(f.id)}" style="border:none;background:#fff;width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid #F2EEE6;text-align:left">${iconBox(f.icon, 26, 44, 22)}<span style="flex:1;min-width:0"><b style="display:block;font-size:15px">${esc(f.name)}</b><span class="small mut">${n ? fmt(n.k) + ' kcal · ' + (f.kind === 'sized' ? f.def + ' g' : '1 ' + esc(f.unit || '')) : 'ยังไม่มีค่าฉลาก'}${f._db || f.src === 'est' ? ' · ประมาณ' : ''}</span></span><span class="ic" style="width:36px;height:36px;border-radius:18px;background:var(--y);font-size:18px;font-weight:700">+</span></button>`; };
  const grow = (g) => `<button data-act="groupOpen" data-g="${esc(g.group)}" style="border:none;background:#fff;width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid #F2EEE6;text-align:left">${iconBox(g.foods[0].icon, 26, 44, 22)}<span style="flex:1"><b style="display:block;font-size:15px">${esc(g.group)}</b><span class="small mut">เลือกยี่ห้อ/แบบ</span></span><span class="badge" style="background:var(--yl);font-size:12px">${g.foods.length} แบบ ›</span></button>`;
  const create = `<button data-act="buildCreate" style="border:1.5px dashed #D8D2BE;background:#fff;border-radius:18px;min-height:44px;font-size:13px;font-weight:700;color:#6B5A00">+ ไม่เจอ? สร้าง "${esc(q)}" ใหม่ (ครั้งเดียว)</button>`;
  if (!groups.length && !singles.length) { const comp = parseComposite(q); return (comp ? `<button data-act="buildComp" style="border:none;border-radius:18px;background:var(--yll);min-height:48px;padding:0 14px;font-size:14px;font-weight:700;text-align:left">แยกเป็นเมนูผสม: ${comp.parts.map((p) => esc(p.name)).join(' + ')} ›</button>` : '<span class="small mut">ยังไม่มีในระบบ</span>') + create; }
  return (groups.length ? `<span class="small" style="font-weight:700;color:var(--mut)">กลุ่ม</span><div class="card" style="margin:0;padding:0;overflow:hidden">${groups.map(grow).join('')}</div>` : '') +
    (singles.length ? `<div class="card" style="margin:0;padding:0;overflow:hidden">${singles.slice(0, 10).map(row).join('')}</div>` : '') + create;
}
function vBuild() {
  const tray = S.tray || []; const slot = S.bslot || slotNow(); const n = plateNutr(tray); const left = goalOf(S.bdate || todayKey()) - totals(S.bdate || todayKey()).k - n.k;
  const chips = tray.map((t, i) => { const f = resolveFood(t.foodId); return `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff;border-radius:18px;padding:3px 4px 3px 3px">${iconBox(f.icon, 16, 28, 14)}<span style="font-size:13px;font-weight:700;max-width:96px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</span><button data-act="trayQ" data-i="${i}" data-d="-1" aria-label="ลด" style="border:none;width:22px;height:22px;border-radius:11px;background:var(--g);font-weight:700">−</button><b style="font-size:12px;min-width:18px;text-align:center">${f.kind === 'sized' ? t.grams + 'g' : t.qty}</b><button data-act="trayQ" data-i="${i}" data-d="1" aria-label="เพิ่ม" style="border:none;width:22px;height:22px;border-radius:11px;background:var(--y);font-weight:700">+</button></span>`; }).join('');
  const slots = SLOTS.map((s) => `<button data-act="bslot" data-v="${s.id}" style="border:none;padding:5px 9px;border-radius:14px;font-size:12px;font-weight:700;${s.id === slot ? 'background:var(--y)' : 'background:var(--g);color:var(--mut)'}">${s.name}</button>`).join('');
  return topBar('ประกอบจาน', S.bdate && S.bdate !== todayKey() ? 'บันทึกลง ' + thDate(S.bdate) : 'แตะของที่กิน แล้วกดบันทึกครั้งเดียว', S.bback || 'today') +
    `<div style="margin:0 16px;display:flex;gap:4px;flex-wrap:wrap">${slots}</div>
    <div style="margin:10px 16px 0;border-radius:22px;background:var(--yll);padding:10px;display:flex;align-items:center;gap:10px;min-height:56px">${tray.length ? plateSvg(tray.map((t) => resolveFood(t.foodId).icon), 52) : `<span style="opacity:.45">${plateSvg([], 52)}</span>`}<div style="flex:1;display:flex;flex-wrap:wrap;gap:6px">${chips || '<span class="small mut">จานยังว่าง · แตะของด้านล่างเพื่อใส่</span>'}</div></div>
    <div style="margin:10px 16px 0;position:relative"><label class="sr" for="bq">ค้นหาอาหาร</label><input id="bq" class="search" style="height:50px" placeholder="พิมพ์ค้นหา เช่น ไรซ์, นม, กะเพรา" value="${esc(S.bq || '')}" autocomplete="off" data-input="bq"></div>
    <div id="bres" style="margin:12px 16px 0;display:flex;flex-direction:column;gap:8px;padding-bottom:110px">${builderResults()}</div>
    <div style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:#fff;border-radius:28px 28px 0 0;padding:12px 16px calc(18px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:12px;box-shadow:0 -6px 20px rgba(31,31,31,.08);z-index:20">
      <span style="flex:1"><span class="small mut" style="display:block">${tray.length} อย่าง · ${SLOTS.find((s) => s.id === slot).name}</span><b style="font-size:18px">${fmt(n.k)} kcal</b> <span class="small mut">· เหลือ ${fmt(left)}</span></span>
      <button class="btn" style="width:auto;padding:0 28px" data-act="traySave" ${tray.length ? '' : 'disabled style="opacity:.4;width:auto;padding:0 28px"'}>บันทึก</button></div>`;
}
function refreshBuild() { const r = document.getElementById('bres'); if (r) r.innerHTML = builderResults(); }

/* ---- period ---- */
function periodDays() { const set = new Set(); const ends = db.periodEnds || {}; [...db.periods].sort().forEach((s) => { const now = periodNow(); const e = ends[s] || (now && now.start === s ? todayKey() : addDays(s, 4)); let d = s; for (let i = 0; i < 10 && d <= e; i++) { set.add(d); d = addDays(d, 1); } }); return set; }
function periodNow() { const t = todayKey(); const last = [...db.periods].sort().filter((s) => s <= t).pop(); if (!last) return null; if ((db.periodEnds || {})[last]) return null; const n = daysBetween(last, t); return n >= 0 && n <= 6 ? { start: last, day: n + 1 } : null; }
function periodNext() { const ps = [...db.periods].sort(); if (!ps.length) return null; const gaps = ps.slice(1).map((d, i) => daysBetween(ps[i], d)).filter((g) => g >= 21 && g <= 40); const cyc = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 28; return addDays(ps[ps.length - 1], cyc); }
const DROP = (px = 12, c = '#FF5C85') => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 3-6.5 6-11z" fill="${c}"/></svg>`;
function periodCard() {
  const now = periodNow(); const last = [...db.periods].sort().pop(); const nx = periodNext();
  const sub = (last ? 'รอบล่าสุด ' + thDate(last) : 'ยังไม่เคยบันทึก') + (nx ? ' · รอบหน้า ~' + thDate(nx) : '');
  const head = `<div class="row" style="gap:10px"><span class="ic" style="width:40px;height:40px;border-radius:20px;background:#FBE3EA">${DROP(20, '#FF8FA8')}</span><span style="flex:1"><b style="font-size:15px;display:block">${now ? 'ประจำเดือน วันที่ ' + now.day : 'ประจำเดือน'}</b><span class="small mut">${sub}</span></span>${now ? '<button data-act="periodEnd" style="height:40px;padding:0 14px;border:none;border-radius:20px;background:#FBE3EA;color:#A33A5A;font-size:13px;font-weight:700">หมดแล้ว</button>' : ''}</div>`;
  const btns = now ? '' : `<div class="grid2" style="grid-template-columns:1.3fr 1fr;gap:8px"><button data-act="periodStart" style="height:44px;border:none;border-radius:22px;background:#FF8FA8;color:#fff;font-size:14px;font-weight:700">มาวันนี้</button><label style="height:44px;border-radius:22px;background:#FBE3EA;color:#A33A5A;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">เลือกวันที่มา<input type="date" data-change="periodPick" max="${todayKey()}" style="position:absolute;inset:0;opacity:0"></label></div>`;
  return `<div class="card" style="display:flex;flex-direction:column;gap:10px">${head}${btns}<span class="small mut" style="text-align:center;font-size:11px">แตะวันในกราฟเพื่อแก้วันที่มีประจำเดือน</span></div>`;
}

/* ---- overview: week ---- */
function ovToggle() { const m = S.ovMode === 'month'; return `<div class="row" style="background:#fff;border-radius:18px;padding:3px;gap:2px;align-self:flex-start;position:relative;margin-bottom:6px"><button data-act="ovMode" data-v="week" style="border:none;padding:6px 14px;border-radius:15px;font-size:13px;font-weight:700;${m ? 'background:none;color:#5E5E5E' : 'background:rgba(31,31,31,.07)'}">สัปดาห์</button><button data-act="ovMode" data-v="month" style="border:none;padding:6px 14px;border-radius:15px;font-size:13px;font-weight:700;${m ? 'background:rgba(31,31,31,.07)' : 'background:none;color:#5E5E5E'}">เดือน</button></div>`; }
function weekKcalCard(days) {
  const today = todayKey(); const pdays = periodDays(); const H = 140;
  const done = days.filter((d) => d < today && entriesOn(d).length); const inT = done.filter((d) => totals(d).k <= goalOf(d)).length;
  const avg = done.length ? done.reduce((a, d) => a + totals(d).k, 0) / done.length : 0;
  const mx = Math.max(1800, ...days.map((d) => totals(d).k));
  const names = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const cols = days.map((d, i) => { const k = totals(d).k; const has = entriesOn(d).length > 0; const over = has && d < today && k > goalOf(d); const isT = d === today; const per = pdays.has(d);
    const col = !has ? 'transparent' : isT ? '#FFE88A' : over ? '#FF8A65' : '#FFD000'; const h = has ? Math.max(6, Math.round(k / mx * H)) : 0;
    return `<button data-act="dayPeriod" data-d="${d}" aria-label="${thDate(d)} ${has ? fmt(k) + ' kcal' : 'ไม่ได้จด'}" style="flex:1;border:none;background:${per ? '#FDE7EE' : 'none'};border-radius:12px;padding:6px 0;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0">
      <span style="height:12px">${per ? DROP() : ''}</span>
      <span style="height:${H}px;width:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px">${has ? `<span style="font-size:10px;font-weight:700;color:${over ? '#C2522E' : '#5E5E5E'}">${fmt(k)}</span>` : (d < today && d >= db.profile.startDate ? '<span style="font-size:10px;color:#B0ABA0">–</span>' : '')}<span style="width:24px;height:${h}px;border-radius:9px 9px 5px 5px;background:${col}"></span></span>
      <span style="font-size:12px;font-weight:700;color:${isT ? 'var(--ink)' : 'var(--mut)'}">${names[i]}</span></button>`; }).join('');
  const stat = (big, small, bg) => `<div style="flex:1;background:${bg};border-radius:18px;padding:10px 12px"><b style="font-size:22px;display:block;line-height:1.1">${big}</b><span class="small mut" style="font-size:11px">${small}</span></div>`;
  const leg = (c, t) => `<span class="row" style="gap:5px"><span style="width:12px;height:12px;border-radius:4px;background:${c}"></span>${t}</span>`;
  return `<div class="card" style="padding:12px 10px;display:flex;flex-direction:column;gap:10px">
    <div class="row" style="gap:8px;padding:0 2px">${stat(done.length ? inT + ' / ' + done.length + ' วัน' : '–', 'กินอยู่ในเป้า', 'var(--yll)')}${stat(avg ? fmt(avg) : '–', 'kcal เฉลี่ยต่อวัน', 'var(--g)')}</div>
    <div class="row" style="gap:2px;align-items:stretch">${cols}</div>
    <div class="row small mut" style="gap:14px;font-size:11px;padding:8px 4px 0;border-top:1px solid #F2EEE6;flex-wrap:wrap">${leg('#FFD000', 'ในเป้า')}${leg('#FF8A65', 'เกินเป้า')}${leg('#FDE7EE', 'มีประจำเดือน')}</div></div>`;
}

/* ---- overview: month ---- */
function vMonth() {
  const today = todayKey(); const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + (S.monOff || 0));
  const Y = base.getFullYear(), M = base.getMonth() + 1; const ym = Y + '-' + pad(M); const first = ym + '-01'; const nDays = new Date(Y, M, 0).getDate(); const last = ym + '-' + pad(nDays);
  const off = (parseKey(first).getDay() + 6) % 7; const pdays = periodDays();
  const all = [...Array(nDays)].map((_, i) => ym + '-' + pad(i + 1));
  const done = all.filter((d) => d < today && entriesOn(d).length); const inT = done.filter((d) => totals(d).k <= goalOf(d)).length;
  const avg = done.length ? done.reduce((a, d) => a + totals(d).k, 0) / done.length : 0;
  const wIn = bodySeries('waist').filter((b) => b.date >= first && b.date <= last); const wBefore = bodySeries('waist').filter((b) => b.date < first);
  const startW = wBefore.length ? wBefore[wBefore.length - 1].waist : (wIn[0] && wIn[0].waist); const endW = wIn.length ? wIn[wIn.length - 1].waist : null;
  const wd = endW != null && startW != null && (wBefore.length || wIn.length > 1) ? r1(endW - startW) : null;
  const cells = '<span></span>'.repeat(off) + all.map((d, i) => { const has = entriesOn(d).length > 0; const isT = d === today;
    const st = d > today || d < db.profile.startDate ? 'background:transparent;color:#B0ABA0' : isT ? 'background:#FFE88A;box-shadow:inset 0 0 0 2px #1F1F1F' : !has ? 'background:#F1EEE6;color:#8A8A8A' : totals(d).k > goalOf(d) ? 'background:#FF8A65;color:#fff' : 'background:#FFD000';
    return `<button data-act="dayPeriod" data-d="${d}" aria-label="${thDate(d)}" style="border:none;width:38px;height:38px;border-radius:12px;${st};font-size:13px;font-weight:700;justify-self:center;position:relative;padding:0">${i + 1}${pdays.has(d) ? `<span class="ic" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:9px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)">${DROP(12)}</span>` : ''}</button>`; }).join('');
  // weeks
  const weeks = []; let wk = mondayOf(first); while (wk <= last) { weeks.push(wk); wk = addDays(wk, 7); }
  const tiles = weeks.slice(0, 5).map((m, i) => { const ds = [...Array(7)].map((_, j) => addDays(m, j)).filter((d) => d >= first && d <= last && d < today && entriesOn(d).length);
    if (!ds.length) return `<div style="flex:1;border:2px dashed #E8E4D8;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#B0ABA0;font-size:11px;font-weight:700;min-height:120px"><span>W${i + 1}</span>${m > today ? 'ยังไม่ถึง' : 'ไม่มีข้อมูล'}</div>`;
    const a = ds.reduce((s, d) => s + totals(d).k, 0) / ds.length; const g = ds.reduce((s, d) => s + goalOf(d), 0) / ds.length; const over = a > g;
    return `<div style="flex:1;background:${over ? '#FFE6E0' : '#FFF3B0'};border-radius:20px;padding:10px 2px;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0"><span style="font-size:11px;font-weight:700;color:var(--mut)">W${i + 1}</span><span class="ic" style="width:50px;height:50px;border-radius:25px;background:#fff;margin:2px 0">${mascot(over ? 'calm' : 'yay', 42)}</span><b style="font-size:16px">${fmt(a)}</b><span style="font-size:10px;font-weight:700;color:${over ? '#C2522E' : '#2F6B45'}">${over ? 'เกิน ' + fmt(a - g) : 'ในเป้า ✓'}</span></div>`; }).join('');
  const stat = (big, small, bg) => `<div style="flex:1;background:${bg};border-radius:18px;padding:10px 12px;min-width:0"><b style="font-size:19px;display:block;line-height:1.15">${big}</b><span class="small mut" style="font-size:11px">${small}</span></div>`;
  const leg = (sw, t) => `<span class="row" style="gap:5px">${sw}${t}</span>`; const sq = (c) => `<span style="width:12px;height:12px;border-radius:4px;background:${c}"></span>`;
  const canPrev = ym > db.profile.startDate.slice(0, 7); const canNext = (S.monOff || 0) < 0;
  return hero(ovToggle() + '<span style="display:block">' + ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][M - 1] + '</span>', String(Y + 543), { pb: 40, right: `<span class="row" style="gap:6px"><button class="back" data-act="monOff" data-d="-1" ${canPrev ? '' : 'disabled style="opacity:.35"'} aria-label="เดือนก่อน">${chev('l', 18)}</button><button class="back" data-act="monOff" data-d="1" ${canNext ? '' : 'disabled style="opacity:.35"'} aria-label="เดือนถัดไป">${chev('r', 18)}</button></span>` }) +
    `<div class="row" style="margin:-22px 16px 0;gap:8px;position:relative">${stat(done.length ? inT + ' / ' + done.length : '–', 'วันที่อยู่ในเป้า', '#FFF8D6;box-shadow:0 6px 18px rgba(31,31,31,.07)')}${stat(avg ? fmt(avg) : '–', 'kcal เฉลี่ย/วัน', '#fff;box-shadow:0 6px 18px rgba(31,31,31,.07)')}${stat(wd == null ? '–' : (wd > 0 ? '+' : wd < 0 ? '−' : '') + Math.abs(wd), wd == null ? 'ยังไม่ได้วัดเอว' : 'cm รอบเอว', '#E7F4EA;box-shadow:0 6px 18px rgba(31,31,31,.07)')}</div>
    <div class="card" style="padding:12px 10px;display:flex;flex-direction:column;gap:8px">
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));font-size:11px;font-weight:700;color:#8A8A8A;text-align:center">${['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((x) => `<span>${x}</span>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));row-gap:6px">${cells}</div>
      <div class="row small mut" style="flex-wrap:wrap;gap:6px 12px;font-size:11px;padding:8px 4px 0;border-top:1px solid #F2EEE6">${leg(sq('#FFD000'), 'ในเป้า')}${leg(sq('#FF8A65'), 'เกินเป้า')}${leg(sq('#F1EEE6'), 'ไม่ได้จด')}${leg(DROP(13), 'มีประจำเดือน')}</div></div>
    <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="row" style="justify-content:space-between"><b style="font-size:14px">แต่ละสัปดาห์คุมได้ไหม</b><span class="small mut" style="font-size:11px">kcal เฉลี่ย/วัน</span></div><div class="row" style="gap:8px;align-items:stretch">${tiles}</div></div>
    ${periodCard()}` + nav();
}

function todayBody() {
  const k = todayKey(); const slot = slotNow(); const sname = SLOTS.find((s) => s.id === slot).name; const y = addDays(k, -1);
  const watchMiss = !S.hideWatch && y >= db.profile.startDate && entriesOn(y).length && !db.activity[y];
  const wcard = watchMiss ? `<div class="card row" style="margin-top:10px;background:var(--lav);box-shadow:none;gap:10px;padding:10px 12px"><span class="ic" style="width:34px;height:34px;border-radius:17px;background:#fff">${svgI('watch', 20)}</span><button data-act="watchOpen" data-date="${y}" style="flex:1;border:none;background:none;text-align:left;padding:0"><b style="font-size:13px;display:block">เมื่อวานยังไม่ได้กรอก Watch</b><span class="small mut" style="font-size:11px">แตะเพื่อกรอก · เพิ่มโควต้าให้เมื่อวาน</span></button><button data-act="hideWatch" aria-label="ซ่อน" style="border:none;background:none;padding:6px">${xIcon}</button></div>` : '';
  const t = totals(k); const cnt = entriesOn(k).length;
  return wcard + `<div class="row" style="margin:12px 20px 0;justify-content:space-between;align-items:baseline"><b style="font-size:17px">มื้อ${sname}กินอะไร?</b><span class="small mut">แตะ = บันทึก · กดค้าง = ดูทั้งหมด</span></div>
    <div class="grid3" style="margin:10px 16px 0;gap:10px">${homePlates(slot).map(plateCard).join('')}</div>
    <button data-act="openBuild" style="margin:12px 16px 0;width:calc(100% - 32px);height:54px;border:none;border-radius:27px;background:#fff;box-shadow:0 6px 18px rgba(31,31,31,.08);display:flex;align-items:center;gap:10px;padding:0 8px 0 18px;color:#8A8A8A;font-size:15px;text-align:left"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><span style="flex:1">ไม่ใช่จานพวกนี้? ค้นหา / ประกอบจาน</span><span class="ic" style="width:40px;height:40px;border-radius:20px;background:var(--y);font-size:22px;font-weight:700;color:var(--ink)">+</span></button>
    <button data-act="openLog" data-date="${k}" style="margin:10px 18px 0;width:calc(100% - 36px);border:none;background:var(--g);border-radius:22px;min-height:48px;padding:0 16px;display:flex;align-items:center;gap:10px;text-align:left"><span style="flex:1;font-size:14px;font-weight:600">${cnt ? 'วันนี้กินไปแล้ว ' + cnt + ' ครั้ง · ' + fmt(t.k) + ' kcal' : 'ยังไม่ได้บันทึกวันนี้'}</span>${chev('r', 18)}</button>` + finishDayCard();
}

/* ================= render ================= */
const app = document.getElementById('app'); const layer = document.getElementById('layer');
function render() {
  let html = '';
  if (!db) html = vOnboard();
  else html = ({ today: vToday, suggest: vSuggest, pick: vPick, other: vOther, addfood: vAddFood, log: vLog, week: vWeek, weighin: vWeighIn, me: vMe, stickers: vStickers, reward: vReward, recap: vRecap, browse: vBrowse, build: vBuild }[S.view] || vToday)();
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
  afCustomUnit: () => { S.af.unitTyping = true; if (['ทัพพี', 'จาน', 'ถ้วย', 'ชิ้น', 'ฟอง', 'กล่อง', 'แก้ว', 'ซอง', 'กรัม'].includes(S.af.unit)) S.af.unit = ''; render(); setTimeout(() => { const i = document.querySelector('[data-input="af.unit"]'); if (i) i.focus(); }, 30); },
  afStore: (el) => { const v = el.dataset.v; const a = S.af.stores; S.af.stores = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; render(); },
  afSave: (el) => { const a = S.af; const k = num(a.k); const err = document.getElementById('af-err');
    if (!a.name.trim()) { err.textContent = 'ใส่ชื่อเมนูก่อน'; return; } if (k == null || k <= 0) { err.textContent = 'ใส่ kcal ก่อน (ถ้าไม่รู้ ประมาณเอาได้)'; return; }
    const nn = { k, p: num(a.p) || 0, f: num(a.f) || 0 }; const unit = (a.unit || '').trim() || 'ชิ้น';
    const data = unit === 'กรัม' ? { name: a.name.trim(), cat: a.cat, icon: a.icon || CAT_ICON[a.cat], kind: 'sized', unit: 'g', per100: nn, def: 100, sizes: [[50, 'ครึ่ง', 'S'], [100, '100 g', 'M'], [150, '150 g', 'L']], addon: a.addon, stores: a.stores, src: a.src }
      : { name: a.name.trim(), cat: a.cat, icon: a.icon || CAT_ICON[a.cat], kind: 'item', unit, n: nn, addon: a.addon, stores: a.stores, src: a.src };
    if (a.group) data.group = a.group;
    let f; if (a.id) { f = foodById(a.id); Object.assign(f, data); } else { f = { id: uid(), aliases: [], userId: db.userId, createdAt: new Date().toISOString(), ...data }; db.foods.push(f); }
    save(); if (a.back === 'build' && !a.id) { trayAdd(f.id); S.bq = ''; toast('ใส่ ' + f.name + ' ในจานแล้ว'); return go('build'); }
    if (el.dataset.eat === '1' && !a.id) { const e = f.kind === 'sized' ? addEntry(f, { grams: 100 }) : addEntry(f); if (e) return afterLog([e]); }
    toast(a.id ? 'แก้ ' + f.name + ' แล้ว' : 'เพิ่ม ' + f.name + ' แล้ว'); go(a.back === 'me' ? 'me' : 'other', { q: '' }); },
  bucketLog: (el) => { const k = el.dataset.k; const v = Number(el.dataset.v); const f = { id: 'bucket-' + k, name: (k === 'out' ? 'มื้อนอกบ้าน ' : 'ขนม ') + el.dataset.n, icon: k === 'out' ? 'main' : 'snack', cat: k === 'out' ? 'main' : 'snack', kind: 'item', unit: 'มื้อ', n: { k: v, p: k === 'out' ? 20 : 4, f: k === 'out' ? 3 : 1 }, src: 'est' }; closeSheet(); const e = addEntry(f); if (e) afterLog([e]); },
  labelSave: () => { const s = S.sheet; const f = foodById(s.id || s.foodId); const k = num(s.k); if (k == null || k <= 0) { document.getElementById('lb-err').textContent = 'ใส่ kcal จากฉลากก่อน'; return; }
    f.n = { k, p: num(s.p) || 0, f: num(s.f) || 0 }; f.src = 'label'; save(); closeSheet(); if (s.thenTray) { trayAdd(f.id); render(); return; } if (s.then) { const e = addEntry(f, s.then); if (e) afterLog([e]); } else render(); },
  key: (el) => { let v = S.sheet.v ?? String(activeOf(S.sheet.date) || ''); v = el.dataset.v === '⌫' ? v.slice(0, -1) : (v + el.dataset.v).replace(/^0+/, '').slice(0, 4); S.sheet.v = v; renderLayer(); },
  watchSave: () => { const v = Number(S.sheet.v ?? activeOf(S.sheet.date)) || 0; db.activity[S.sheet.date] = v; save(); closeSheet(); render(); },
  protKg: (el) => { db.profile.protPerKg = Number(el.dataset.v); save(); renderLayer(); render(); },
  watchPct: (el) => { db.profile.watchPct = Number(el.dataset.v); save(); renderLayer(); render(); },
  openLog: (el) => { S.logDate = el.dataset.date; go('log'); },
  openBuild: () => { S.tray = []; S.bq = ''; S.bslot = slotNow(); S.bdate = null; S.bback = 'today'; go('build'); },
  plateLog: (el) => { const id = el.dataset.id; const slot = slotNow(); let items;
    if (id.startsWith('meal:')) items = [{ foodId: id.slice(5), qty: 1 }]; else { const p = (db.plates || []).find((x) => x.id === id); if (!p) return; items = p.items; }
    const out = logItems(items, slot, todayKey()); if (!out) return; savePlate(items, slot); save(); afterLog(out); },
  trayAdd: (el) => { trayAdd(el.dataset.id); render(); const i = document.getElementById('bq'); },
  dbTray: (el) => { let f = foodById(el.dataset.id); if (!f) { const d = FOOD_DB.find((x) => x.id === el.dataset.id); f = { ...JSON.parse(JSON.stringify(d)), addon: false, userId: db.userId }; db.foods.push(f); save(); } trayAdd(f.id); S.bq = ''; render(); },
  trayQ: (el) => { const t = S.tray[Number(el.dataset.i)]; const f = resolveFood(t.foodId); const d = Number(el.dataset.d);
    if (f.kind === 'sized') { t.grams = Math.max(0, t.grams + d * (f.sizes ? f.sizes[0][0] / 2 : 50)); if (!t.grams) S.tray.splice(Number(el.dataset.i), 1); } else { t.qty += d; if (t.qty <= 0) S.tray.splice(Number(el.dataset.i), 1); } render(); },
  traySave: () => { const tray = S.tray || []; if (!tray.length) return; const slot = S.bslot || slotNow(); const date = S.bdate || todayKey();
    const out = logItems(tray, slot, date); if (!out) return; savePlate(tray, slot); save(); S.tray = []; S.ctx = S.bback === 'log' ? { date, slot, ret: 'log' } : null; afterLog(out); },
  bslot: (el) => { S.bslot = el.dataset.v; render(); },
  buildCreate: () => { A.addFood({ dataset: { name: (S.bq || '').trim() } }); S.af.back = 'build'; render(); },
  buildComp: () => { S.q = S.bq; S.comp = null; S.ctx = { date: S.bdate || todayKey(), slot: S.bslot || slotNow(), ret: S.bback === 'log' ? 'log' : 'today' }; go('other', { q: S.bq }); },
  groupOpen: (el) => openSheet({ type: 'group', g: el.dataset.g }),
  groupPick: (el) => { closeSheet(); if (S.view === 'build') { trayAdd(el.dataset.id); S.bq = ''; render(); } else A.quickLog({ dataset: { id: el.dataset.id } }); },
  groupNew: (el) => { const g = el.dataset.g; closeSheet(); const back = S.view === 'build' ? 'build' : 'other'; A.addFood({ dataset: { name: '' } }); Object.assign(S.af, { group: g, cat: 'drink', icon: 'milk', unit: 'กล่อง', src: 'label', back }); render(); },
  plateMenu: (el) => openSheet({ type: 'plate', id: el.dataset.id }),
  plateLogSheet: (el) => { closeSheet(); A.plateLog(el); },
  plateRename: () => { const s = S.sheet; const pl = db.plates.find((x) => x.id === s.id); if (pl) { pl.name = (s.name ?? pl.name ?? '').trim() || undefined; save(); } closeSheet(); render(); },
  plateHide: () => { const pl = db.plates.find((x) => x.id === S.sheet.id); if (pl) { pl.hidden = true; save(); } closeSheet(); render(); toast('เอาออกแล้ว'); },
  ovMode: (el) => { S.ovMode = el.dataset.v; render(); },
  monOff: (el) => { S.monOff = Math.min(0, (S.monOff || 0) + Number(el.dataset.d)); render(); },
  dayPeriod: (el) => openSheet({ type: 'periodDay', date: el.dataset.d }),
  periodStart: () => { const t = todayKey(); if (!db.periods.includes(t)) db.periods.push(t); save(); render(); toast('บันทึกประจำเดือนแล้ว', null, 'calm'); },
  periodStartAt: (el) => { const d = el.dataset.d; if (!db.periods.includes(d)) db.periods.push(d); save(); closeSheet(); render(); },
  periodEnd: () => { const n = periodNow(); if (!n) return; db.periodEnds[n.start] = todayKey(); save(); render(); },
  periodEndAt: (el) => { const d = el.dataset.d; const st = [...db.periods].sort().filter((x) => x <= d).pop(); if (st) db.periodEnds[st] = d; save(); closeSheet(); render(); },
  periodRemove: (el) => { const d = el.dataset.d; const st = [...db.periods].sort().filter((x) => x <= d).pop(); if (st) { db.periods = db.periods.filter((x) => x !== st); delete db.periodEnds[st]; } save(); closeSheet(); render(); },
  watchOpen: (el) => openSheet({ type: 'watch', date: el.dataset.date }),
  watchDay: (el) => { S.sheet.date = el.dataset.d; S.sheet.v = undefined; renderLayer(); },
  hideWatch: () => { S.hideWatch = true; render(); },
  rebaseYes: () => { const s = S.sheet; db.profile.calcWeight = s.w; save(); closeSheet(); render(); toast('เป้าใหม่ ' + fmt(s.to) + ' kcal', null, 'yay'); },
  afIcon: (el) => { S.af.icon = el.dataset.v; render(); },
  afAllIcons: () => { S.af.allIcons = !S.af.allIcons; render(); },
  logDay: (el) => { S.logDate = addDays(S.logDate || todayKey(), Number(el.dataset.d)); render(); },
  logAdd: (el) => { S.ctx = { date: S.logDate || todayKey(), slot: el.dataset.slot, ret: 'log' }; S.q = ''; S.comp = null; go('other'); },
  dayDone: (el) => markDay(el.dataset.date, 'done'),
  daySpecial: (el) => markDay(el.dataset.date, 'special'),
  dayUndo: (el) => { delete db.dayStatus[el.dataset.date]; save(); render(); },
  markToday: (el) => markDay(todayKey(), el.dataset.v),
  celebSheet: () => { S.sheet = null; S.mon = null; go('stickers'); },
  sameLog: () => { const sm = sameAsYesterday(); if (!sm) return; const out = sm.es.map((e) => { const f = foodById(e.foodId) || { id: e.foodId, name: e.name, icon: e.icon, cat: e.cat, kind: 'item', unit: '' }; const ne = addEntry(f, { n: { k: e.k, p: e.p, f: e.f }, qty: e.qty, grams: e.grams, slot: sm.slot, date: todayKey(), src: e.src }); if (ne) ne.unitLabel = e.unitLabel; return ne; }).filter(Boolean); save(); afterLog(out); },
  mon: (el) => { S.mon = el.dataset.v; render(); },
  grp: (el) => { S.grp = el.dataset.v; render(); },
  dbLog: (el) => { let f = foodById(el.dataset.id); if (!f) { const d = FOOD_DB.find((x) => x.id === el.dataset.id); f = { ...JSON.parse(JSON.stringify(d)), addon: false, userId: db.userId }; db.foods.push(f); save(); } A.quickLog({ dataset: { id: f.id } }); },
  rwType: (el) => { S.rw.type = el.dataset.v; S.rw.target = RW_TYPES[el.dataset.v].def; render(); },
  rwStep: (el) => { const T = RW_TYPES[S.rw.type]; S.rw.target = Math.min(T.max, Math.max(T.min, r1(S.rw.target + T.step * Number(el.dataset.d)))); render(); },
  rwIcon: (el) => { S.rw.icon = el.dataset.v; const nm = document.getElementById('rw-name'); if (nm) S.rw.name = nm.value; render(); },
  rwSave: () => { const f = S.rw; const name = (f.name || '').trim(); if (!name) { const e = document.getElementById('rw-err'); if (e) e.textContent = 'ตั้งชื่อรางวัลก่อนนะ'; return; }
    (db.rewards || []).forEach((r) => { if (r.status === 'active') r.status = 'cancelled'; });
    db.rewards.push({ id: uid(), userId: db.userId, type: f.type, target: f.target, icon: f.icon, name, startDate: todayKey(), start: f.type === 'waist' ? latestWaist() : null, status: 'active', createdAt: new Date().toISOString(), schemaVersion: 1 });
    save(); S.rw = null; render(); toast('ตั้งรางวัลแล้ว · ' + name, null, 'yay'); },
  rwClaim: () => { const r = activeReward(); if (!r) return; r.status = 'done'; r.doneAt = todayKey(); save(); render(); toast('ยินดีด้วย! ได้ ' + r.name + ' แล้ว', null, 'yay'); },
  recapSave: () => recapSave(),
  cloudOpen: () => openSheet({ type: 'cloud', clEmail: ((typeof Cloud !== 'undefined') && Cloud.user && Cloud.user.email) || '' }),
  cloudLogin: async () => { const sh = S.sheet; const em = (sh.clEmail || '').trim(); const pw = sh.clPw || '';
    if (!/^\S+@\S+\.\S+$/.test(em)) { sh.err = 'อีเมลไม่ถูกต้อง'; return renderLayer(); }
    if (pw.length < 6) { sh.err = 'รหัสผ่านอย่างน้อย 6 ตัว'; return renderLayer(); }
    sh.busy = true; sh.err = ''; renderLayer();
    try { await Cloud.login(em, pw); if (S.sheet && S.sheet.type === 'cloud') S.sheet = null; render(); toast('เชื่อม cloud แล้ว ข้อมูลสำรองอัตโนมัติ', null, 'yay'); }
    catch (e) { sh.busy = false; const m = e && e.message;
      sh.err = m === 'WRONG_PW' ? 'อีเมลนี้มีบัญชีแล้ว แต่รหัสผ่านไม่ถูก' : m === 'CONFIRM_ON' ? 'Supabase ยังเปิด "Confirm email" อยู่ ไปปิดใน Authentication → Sign In / Providers → Email ก่อนนะ' : 'เชื่อมไม่สำเร็จ: ' + (m || e); renderLayer(); } },
  cloudOut: () => openSheet({ type: 'confirm', msg: 'ออกจากระบบ? ข้อมูลในเครื่องนี้ยังอยู่ แต่จะไม่สำรองขึ้น cloud จนกว่าจะเข้าใหม่', yes: 'cloudOutYes', label: 'ออกจากระบบ' }),
  cloudOutYes: async () => { closeSheet(); await Cloud.signOut(); render(); },
  cloudSync: async () => { await Cloud.push(); await Cloud.pull(); toast(Cloud.state === 'ok' ? 'ซิงก์แล้ว' : 'ซิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง', null, Cloud.state === 'ok' ? 'yay' : 'huh'); },
  widgetOpen: async () => { if (!Cloud.token) await Cloud.push(); openSheet({ type: 'widget' }); },
  widgetCopy: async () => { try { await navigator.clipboard.writeText(Cloud.widgetScript()); toast('คัดลอกสคริปต์แล้ว ไปวางใน Scriptable', null, 'yay'); } catch (e) { const t = document.getElementById('wg-script'); if (t) { t.style.display = 'block'; t.select(); } toast('คัดลอกเองจากกล่องด้านล่างนะ', null, 'huh'); } },
  pickRemote: () => { const r = S.sheet.remote; S.sheet = null; Cloud.adopt(r); },
  pickLocal: async () => { closeSheet(); db.userId = Cloud.user.id; save(); await Cloud.push(); render(); },
  openRecap: (el) => { S.recapMon = el.dataset.mon; S.recapBack = 'week'; go('recap'); },
  checkSpecial: () => { const d = S.sheet.date; markDay(d, 'special'); },
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
    db.body.push({ id: uid(), userId: db.userId, date: todayKey(), weight: w, waist: ws, createdAt: new Date().toISOString(), schemaVersion: 1 }); if (ws != null) updateChin(); save(); toast('บันทึกแล้ว · ' + [w != null ? w + ' kg' : '', ws != null ? ws + ' cm' : ''].filter(Boolean).join(' · ')); go('week');
    const old = calcW(db.profile); if (w != null && Math.abs(w - old) >= 2) { const from = targetBase(db.profile).value; const to = targetBase({ ...db.profile, calcWeight: w }).value; if (from !== to) openSheet({ type: 'rebase', w, old, from, to }); } },
  pace: (el) => { db.profile.pace = el.dataset.v; save(); render(); },
  mealToggle: (el) => { const p = db.profile; const v = el.dataset.v; p.meats = p.meats.includes(v) ? (p.meats.length > 1 ? p.meats.filter((x) => x !== v) : p.meats) : [...p.meats, v].slice(0, 4); save(); renderLayer(); },
  mealStep: (el) => { const p = db.profile; p[el.dataset.k] = Math.max(0, Math.min(400, p[el.dataset.k] + Number(el.dataset.d))); save(); renderLayer(); },
  peSave: () => { const s = S.sheet; const p = db.profile; const h = num(s.height ?? p.height); const w = num(s.startWeight ?? p.startWeight); if (!h || !w) return; Object.assign(p, { name: (s.name ?? p.name ?? '').trim(), birth: s.birth ?? p.birth, height: h, startWeight: w }); save(); closeSheet(); render(); },
  resetAll: () => openSheet({ type: 'confirm', msg: 'ล้างข้อมูลทั้งหมดในเครื่องนี้? กู้คืนไม่ได้ถ้าไม่ได้สำรองไว้', yes: 'resetYes', label: 'ล้างข้อมูล' }),
  resetYes: () => { try { localStorage.removeItem(KEY); } catch (e) {} db = null; S.obStep = 1; closeSheet(); initOb(); render(); },
  foodHide: (el) => { const f = foodById(el.dataset.id); f.hidden = !f.hidden; save(); closeSheet(); render(); },
  foodAddon: (el) => { const f = foodById(el.dataset.id); f.addon = true; f.hidden = false; save(); closeSheet(); render(); },
  foodEdit: (el) => { const f = foodById(el.dataset.id); closeSheet(); S.af = { id: f.id, name: f.name, cat: f.cat || 'main', unit: f.unit || 'ชิ้น', k: f.n ? f.n.k : '', p: f.n ? f.n.p : '', f: f.n ? f.n.f : '', src: f.src === 'label' ? 'label' : 'est', addon: !!f.addon, stores: f.stores || [], icon: f.icon, group: f.group, back: 'me' }; go('addfood'); },
  foodDel: (el) => { const f = foodById(el.dataset.id); openSheet({ type: 'confirm', msg: 'ลบ ' + f.name + '? บันทึกเก่ายังอยู่ครบ', yes: 'foodDelYes', id: f.id, label: 'ลบเมนู' }); },
  foodDelYes: () => { const f = foodById(S.sheet.id); f.deleted = true; f.addon = false; save(); closeSheet(); render(); },
  importYes: () => { db = S.sheet.data; save(); closeSheet(); render(); toast('นำเข้าข้อมูลแล้ว', null, 'happy'); },
  exportJson: () => download('noneang-backup-' + todayKey() + '.json', JSON.stringify(db, null, 2), 'application/json'),
  exportCsv: () => { const rows = [['date', 'slot', 'name', 'qty', 'unit', 'kcal', 'protein_g', 'fiber_g', 'source']].concat(db.entries.map((e) => [e.date, e.slot, e.name, e.qty, e.unitLabel, e.k, e.p, e.f, e.src])); const body = [['date', 'weight_kg', 'waist_cm']].concat(db.body.map((b) => [b.date, b.weight ?? '', b.waist ?? '']));
    const csv = (r) => r.map((x) => x.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'); download('noneang-food-' + todayKey() + '.csv', '﻿' + csv(rows), 'text/csv'); setTimeout(() => download('noneang-body-' + todayKey() + '.csv', '﻿' + csv(body), 'text/csv'), 400); },
  checkFill: () => { const d = S.sheet.date; closeSheet(); S.logDate = d; go('log'); },
  checkDone: () => { const d = S.sheet.date; markDay(d, 'done'); },
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
    db = { schemaVersion: 1, userId, createdAt: new Date().toISOString(), profile: { name: (o.name || '').trim(), sex: o.sex, birth: o.birth, height: num(o.height), startWeight: num(o.weight), pace: 'rec', watchPct: 0.6, protPerKg: 1.6, meats: o.meats, meatG: o.meatG, riceG: o.riceG, startDate: todayKey() },
      foods: STARTER_FOODS.map((f) => ({ ...JSON.parse(JSON.stringify(f)), addon: o.addons.includes(f.id), userId })), entries: [], body: [{ id: uid(), userId, date: todayKey(), weight: num(o.weight), waist: num(o.waist), createdAt: new Date().toISOString(), schemaVersion: 1 }], activity: {}, periods: [], dayStatus: {}, chin: { level: 0, lower: 0 }, rewards: [], seenRecap: {} };
    save(); S.view = 'today'; render(); }
};
function initOb() { S.ob = { name: '', sex: 'f', birth: '', height: '', weight: '', waist: '', meats: ['chicken', 'fish', 'beef'], meatG: 100, riceG: 150, addons: STARTER_FOODS.filter((f) => f.addon).map((f) => f.id) }; }
function refreshResults() { const r = document.getElementById('results'); if (r) r.innerHTML = otherResults(); }
function download(name, text, type) { const b = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

let pressT = null, pressed = false;
document.addEventListener('pointerdown', (ev) => { const el = ev.target.closest('[data-press]'); pressed = false; if (!el) return; const sx = ev.clientX, sy = ev.clientY;
  pressT = setTimeout(() => { pressed = true; pressT = null; if (navigator.vibrate) navigator.vibrate(15); A[el.dataset.press](el); }, 480);
  const cancel = (e) => { if (e.type === 'pointermove' && Math.hypot(e.clientX - sx, e.clientY - sy) < 10) return; clearTimeout(pressT); pressT = null; document.removeEventListener('pointermove', cancel); document.removeEventListener('pointerup', cancel); document.removeEventListener('pointercancel', cancel); };
  document.addEventListener('pointermove', cancel); document.addEventListener('pointerup', cancel); document.addEventListener('pointercancel', cancel); });
document.addEventListener('contextmenu', (ev) => { if (ev.target.closest('[data-press]')) ev.preventDefault(); });
document.addEventListener('click', (ev) => {
  if (pressed) { pressed = false; ev.preventDefault(); ev.stopPropagation(); return; }
  const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
  const act = el.dataset.act; if (A[act]) { if (act !== 'overlay') ev.stopPropagation(); A[act](el, ev); }
});
document.addEventListener('change', (ev) => { const el = ev.target; if (el.dataset && el.dataset.change === 'periodPick' && el.value) { if (!db.periods.includes(el.value)) db.periods.push(el.value); save(); render(); toast('บันทึกประจำเดือน ' + thDate(el.value), null, 'calm'); } });
document.addEventListener('input', (ev) => {
  const el = ev.target; const k = el.dataset && el.dataset.input; if (!k) return;
  if (k === 'q') { S.q = el.value; S.comp = null; refreshResults(); return; }
  if (k === 'sizeG') { S.sheet.customG = num(el.value); return; }
  if (k === 'rwName') { S.rw.name = el.value; return; }
  if (k === 'bq') { S.bq = el.value; refreshBuild(); return; }
  if (k === 'sheet.name') { S.sheet.name = el.value; return; }
  if (k === 'clEmail' || k === 'clPw') { S.sheet[k] = k === 'clPw' ? el.value : el.value.trim(); return; }
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
  else {
    const now = new Date(); const thisMon = mondayOf(todayKey()); const lastMon = addDays(thisMon, -7);
    const pick = now.getDay() === 0 && now.getHours() >= 17 ? thisMon : (now.getDay() >= 1 && now.getDay() <= 2 ? lastMon : null);
    if (pick && !db.seenRecap[pick] && pick >= mondayOf(db.profile.startDate) && [...Array(7)].some((_, i) => entriesOn(addDays(pick, i)).length)) { S.view = 'recap'; S.recapMon = pick; S.recapBack = 'today'; }
  }
}
render();
if ((typeof Cloud !== 'undefined')) Cloud.init();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
