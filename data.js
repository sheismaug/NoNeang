/* NoNeang — static data: icons, mascot, starter dictionary.
   ค่าโภชนาการเป็นค่าประมาณจาก USDA FoodData Central / ตารางคุณค่าทางโภชนาการอาหารไทย
   ของแพ็กเกจ (นมโปรตีน, อกไก่ปั่น) ไม่ใส่ค่า ให้กรอกจากฉลาก */

const ICONS = {
  chicken: ['#FFF0DE', '<path d="M15 3.5a5.5 5.5 0 0 1 3.9 9.4c-1.7 1.7-4.3 2.1-5.9 1.2-.9-1.6-.5-4.2 1.2-5.9A5.5 5.5 0 0 1 15 3.5z" fill="#FFB067" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M13 14.1l-3.4 3.4a2 2 0 1 1-2.8 2.8 2 2 0 1 1-2.8-2.8 2 2 0 0 1 2.8 0l3.4-3.4" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/>'],
  fish: ['#FFF1EA', '<path d="M2.5 12c3-4 7-5.2 11-4.3 2.4.6 4.3 2.2 5.5 4.3-1.2 2.1-3.1 3.7-5.5 4.3-4 .9-8-.3-11-4.3z" fill="#FFB59E" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M19 12l3-3.5v7z" fill="#FF8E6E" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><circle cx="7.5" cy="11" r="1" fill="#1F1F1F"/>'],
  beef: ['#FFE6E0', '<path d="M5 9c2.2-3.6 7.6-4.6 11.6-2.4 3.2 1.8 4.4 5.6 2.2 8.6-2.2 3.2-6.6 5-10.6 4-3.2-.8-5.2-3.2-5.2-5.4 0-1.8.8-3.2 2-4.8z" fill="#FF8E7A" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><circle cx="14" cy="12" r="2.2" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.4"/>'],
  pork: ['#FFE6E0', '<path d="M5 10c1.5-3.5 6-5 10-4s5.5 4 4.5 7-4.5 5.5-8.5 5-7-3.5-6-8z" fill="#FFB3A3" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 11c2 1 5 1 8 0" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>'],
  milk: ['#FFF1EA', '<path d="M8 3h8v3l2 3v12H6V9l2-3z" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 9h12v5H6z" fill="#FFB547" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 3h8v3H8z" fill="#FF8E6E" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/>'],
  shake: ['#FFE6E0', '<path d="M6.5 8h11l-1.4 13H7.9z" fill="#FFD3C2" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 6h13v2.5h-13z" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M13 6l2-4h3" fill="none" stroke="#1F1F1F" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'],
  egg: ['#FFF3B0', '<path d="M12 3c-4 0-7 7-7 11a7 7 0 0 0 14 0c0-4-3-11-7-11z" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.4"/><circle cx="12" cy="14.5" r="3.2" fill="#FFC75A" stroke="#1F1F1F" stroke-width="1.2"/>'],
  friedegg: ['#FFF3B0', '<path d="M12 4c4 0 8 3 8 8s-4 8-8 8-8-3-8-8 4-8 8-8z" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.4"/><circle cx="12" cy="12" r="3.4" fill="#FFC75A" stroke="#1F1F1F" stroke-width="1.2"/>'],
  guava: ['#E7F4EA', '<path d="M12 7.5c-4-2-8 0-8 5 0 5 3 8.5 6 8.5 1 0 1.4-.4 2-.4s1 .4 2 .4c3 0 6-3.5 6-8.5 0-5-4-7-8-5z" fill="#A9D98B" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 7.5c0-2 1-3.5 3-4.5" fill="none" stroke="#1F1F1F" stroke-width="1.4" stroke-linecap="round"/>'],
  apple: ['#FFE6E0', '<path d="M12 7.5c-4-2-8 0-8 5 0 5 3 8.5 6 8.5 1 0 1.4-.4 2-.4s1 .4 2 .4c3 0 6-3.5 6-8.5 0-5-4-7-8-5z" fill="#FF8E7A" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 7.5c0-2 1-3.5 3-4.5" fill="none" stroke="#1F1F1F" stroke-width="1.4" stroke-linecap="round"/>'],
  mango: ['#FFF3B0', '<path d="M7 6c4-2 11 0 12 6 .8 5-3 9-8 8.5C6.5 20 3.5 16 4.2 11.5 4.6 9 5.5 7 7 6z" fill="#FFC75A" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.5 2.5c2-.8 3.8 0 4 1.5-2 .8-3.6.2-4-1.5z" fill="#8FCB9F" stroke="#1F1F1F" stroke-width="1.1" stroke-linejoin="round"/>'],
  banana: ['#FFF3B0', '<path d="M5 6c0 7 5 13 13 13 1.6 0 2.5-.9 2.5-1.8C13 17 9 12 9 5.5 9 4.5 8 4 7 4S5 4.8 5 6z" fill="#FFD95A" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/>'],
  orange: ['#FFF0DE', '<circle cx="12" cy="13" r="7.5" fill="#FFB547" stroke="#1F1F1F" stroke-width="1.4"/><path d="M12 5.5c0-1.5 1-2.5 2.5-2.5" fill="none" stroke="#1F1F1F" stroke-width="1.4" stroke-linecap="round"/>'],
  peas: ['#E7F4EA', '<path d="M2.5 13c4 6.5 15 6 19-5-5 4-14 6-19 5z" fill="#8FCB9F" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="13.6" r="2" fill="#4FA374" stroke="#1F1F1F" stroke-width="1.1"/><circle cx="12.4" cy="13" r="2" fill="#4FA374" stroke="#1F1F1F" stroke-width="1.1"/><circle cx="16.4" cy="11.2" r="2" fill="#4FA374" stroke="#1F1F1F" stroke-width="1.1"/>'],
  broc: ['#E7F4EA', '<circle cx="8" cy="9" r="3.5" fill="#4FA374" stroke="#1F1F1F" stroke-width="1.3"/><circle cx="12.5" cy="7" r="3.8" fill="#4FA374" stroke="#1F1F1F" stroke-width="1.3"/><circle cx="16.5" cy="9.5" r="3.3" fill="#4FA374" stroke="#1F1F1F" stroke-width="1.3"/><path d="M10 12.5l1 8h3l1-8" fill="#A9D98B" stroke="#1F1F1F" stroke-width="1.3" stroke-linejoin="round"/>'],
  waffle: ['#FFF3B0', '<rect x="4" y="4" width="16" height="16" rx="4" fill="#FFC75A" stroke="#1F1F1F" stroke-width="1.4"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" stroke="#1F1F1F" stroke-width="1.1"/>'],
  sausage: ['#FFE6E0', '<rect x="3" y="9" width="18" height="6.5" rx="3.25" fill="#FF8E7A" stroke="#1F1F1F" stroke-width="1.4"/><path d="M8 11l1 1.5M12 11l1 1.5M16 11l1 1.5" stroke="#1F1F1F" stroke-width="1" stroke-linecap="round"/>'],
  butter: ['#FFF8D6', '<path d="M4 15l4-6h12l-4 6z" fill="#FFE58A" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 15v3h12v-3M16 18l4-6V9" fill="#FFD95A" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/>'],
  cheese: ['#FFF3B0', '<path d="M3 17l9-10 9 10z" fill="#FFD95A" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><circle cx="10" cy="14" r="1.4" fill="#FFF8D6" stroke="#1F1F1F" stroke-width="1"/><circle cx="14.5" cy="12" r="1.1" fill="#FFF8D6" stroke="#1F1F1F" stroke-width="1"/>'],
  main: ['#FFF0DE', '<path d="M3 11h18a9 9 0 0 1-18 0z" fill="#FFB067" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 7.5c0-1.2 1-1.8 1-3M12 7.5c0-1.2 1-1.8 1-3M16 7.5c0-1.2 1-1.8 1-3" fill="none" stroke="#1F1F1F" stroke-width="1.4" stroke-linecap="round"/>'],
  veg: ['#E7F4EA', '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z" fill="#8FCB9F" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 19l8-8" stroke="#1F1F1F" stroke-width="1.4" stroke-linecap="round"/>'],
  snack: ['#FFF3B0', '<path d="M3 18L12 5l9 13z" fill="#FFC75A" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M6.5 13h11" stroke="#1F1F1F" stroke-width="1.3"/><circle cx="12" cy="4.5" r="1.8" fill="#FF7A59" stroke="#1F1F1F" stroke-width="1.2"/>'],
  drink: ['#FFE6E0', '<path d="M6.5 8h11l-1.4 13H7.9z" fill="#FFD3C2" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 6h13v2.5h-13z" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.4" stroke-linejoin="round"/><path d="M13 6l2-4h3" fill="none" stroke="#1F1F1F" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'],
  watch: ['#ECE9FB', '<rect x="7" y="6" width="10" height="12" rx="3" fill="#B9B1F0" stroke="#1F1F1F" stroke-width="1.5"/><path d="M9 6V3h6v3M9 18v3h6v-3" fill="none" stroke="#1F1F1F" stroke-width="1.5"/><path d="M12 9.5v3l1.8 1" stroke="#1F1F1F" stroke-width="1.5" stroke-linecap="round" fill="none"/>'],
  flame: ['#FFF3B0', '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" fill="#FFD000" stroke="#1F1F1F" stroke-width="1.5" stroke-linejoin="round"/>']
};
const CAT_ICON = { main: 'main', veg: 'veg', snack: 'snack', drink: 'drink' };

const SLOT_ICONS = {
  morning: '<path d="M4 17h16" stroke="#1F1F1F" stroke-width="1.6" stroke-linecap="round"/><path d="M7.5 17a4.5 4.5 0 0 1 9 0z" fill="#FFD000" stroke="#1F1F1F" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 6v2.5M6.3 9.3l1.6 1.6M17.7 9.3l-1.6 1.6" stroke="#1F1F1F" stroke-width="1.6" stroke-linecap="round"/>',
  noon: '<circle cx="12" cy="12" r="4.5" fill="#FFB547" stroke="#1F1F1F" stroke-width="1.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" stroke="#1F1F1F" stroke-width="1.6" stroke-linecap="round"/>',
  afternoon: '<circle cx="10" cy="10" r="4" fill="#FF9F1C" stroke="#1F1F1F" stroke-width="1.5"/><path d="M9 19h9a3 3 0 0 0 0-6 4 4 0 0 0-7.5-1A3.5 3.5 0 0 0 9 19z" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="1.5" stroke-linejoin="round"/>',
  evening: '<path d="M4 16h16" stroke="#1F1F1F" stroke-width="1.6" stroke-linecap="round"/><path d="M7 16a5 5 0 0 1 10 0z" fill="#FF7A59" stroke="#1F1F1F" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 20h6" stroke="#1F1F1F" stroke-width="1.6" stroke-linecap="round"/>',
  night: '<path d="M15 4a8 8 0 1 0 5 13A6.5 6.5 0 0 1 15 4z" fill="#B9B1F0" stroke="#1F1F1F" stroke-width="1.5" stroke-linejoin="round"/>'
};
const SLOTS = [
  { id: 'morning', name: 'เช้า', from: 5, to: 10 },
  { id: 'noon', name: 'กลางวัน', from: 10, to: 14 },
  { id: 'afternoon', name: 'บ่าย', from: 14, to: 17 },
  { id: 'evening', name: 'เย็น', from: 17, to: 20 },
  { id: 'night', name: 'กลางคืน', from: 20, to: 29 }
];

/* ---------- mascot ---------- */
const M_FACE = '<path d="M100 36 C138 36 158 62 158 96 C158 130 134 148 100 148 C66 148 42 130 42 96 C42 62 62 36 100 36Z" fill="#FFF4E8" stroke="#1F1F1F" stroke-width="6"/>';
const M_BLUSH = '<ellipse cx="66" cy="110" rx="9" ry="6" fill="#FF9C85" opacity="0.8"/><ellipse cx="134" cy="110" rx="9" ry="6" fill="#FF9C85" opacity="0.8"/>';
const mst = (d, w = 6) => `<path d="${d}" fill="none" stroke="#1F1F1F" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const mspark = (x, y, s = 1, f = '#FFFFFF') => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -11 c1.2 7 4 9.8 11 11 -7 1.2 -9.8 4 -11 11 -1.2 -7 -4 -9.8 -11 -11 7 -1.2 9.8 -4 11 -11z" fill="${f}" stroke="#1F1F1F" stroke-width="2.6" stroke-linejoin="round"/>`;
const M_HAPPY_EYES = mst('M74 94 Q81 86 88 94') + mst('M112 94 Q119 86 126 94');
const M_DOT_EYES = '<circle cx="81" cy="93" r="6" fill="#1F1F1F"/><circle cx="119" cy="93" r="6" fill="#1F1F1F"/>';
const CHIN = [
  '<path d="M56 130 Q100 206 144 130 Q100 158 56 130Z" fill="#FFF4E8" stroke="#1F1F1F" stroke-width="5" stroke-linejoin="round"/>',
  '<path d="M56 130 Q100 206 144 130" fill="#FFF4E8" stroke="#1F1F1F" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 8" opacity="0.75"/>',
  '<path d="M68 150 Q100 172 132 150" fill="none" stroke="#1F1F1F" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 12" opacity="0.45"/>',
  mspark(100, 166, 0.9) + mspark(130, 158, 0.55)
];
function mascot(mood, px, chin = -1, label = '') {
  let inner = '';
  if (mood === 'morning') inner = '<circle cx="160" cy="44" r="14" fill="#FFD000" stroke="#1F1F1F" stroke-width="3"/>' + M_FACE + mst('M73 95 H89') + mst('M111 95 H127') + '<ellipse cx="100" cy="118" rx="6" ry="7" fill="#1F1F1F"/>' + M_BLUSH;
  else if (mood === 'yay') inner = M_FACE + M_HAPPY_EYES + mst('M86 112 Q100 128 114 112') + M_BLUSH + mspark(162, 46) + mspark(38, 60, 0.7);
  else if (mood === 'proud') inner = M_FACE + mst('M73 96 L81 88 L89 96') + mst('M111 96 L119 88 L127 96') + '<path d="M84 110 Q100 132 116 110 Z" fill="#1F1F1F" stroke="#1F1F1F" stroke-width="5" stroke-linejoin="round"/>' + M_BLUSH + mspark(160, 50);
  else if (mood === 'sleepy') inner = '<path d="M168 30 a16 16 0 1 0 12 26 a13 13 0 1 1 -12 -26z" fill="#FFD000" stroke="#1F1F1F" stroke-width="3" stroke-linejoin="round"/>' + M_FACE + mst('M74 92 Q81 99 88 92') + mst('M112 92 Q119 99 126 92') + mst('M94 116 Q100 120 106 116') + M_BLUSH;
  else if (mood === 'calm') inner = M_FACE + M_DOT_EYES + mst('M88 114 Q100 122 112 114') + M_BLUSH + '<path transform="translate(160 50)" d="M0 6 C-10 -4 -18 4 -10 12 L0 20 L10 12 C18 4 10 -4 0 6Z" fill="#FF7A59" stroke="#1F1F1F" stroke-width="2.6" stroke-linejoin="round"/>';
  else if (mood === 'plate') inner = M_FACE + M_DOT_EYES + mst('M92 116 Q100 120 108 116') + M_BLUSH + '<ellipse cx="100" cy="172" rx="56" ry="13" fill="#FFFFFF" stroke="#1F1F1F" stroke-width="5"/>';
  else if (mood === 'huh') inner = '<g transform="rotate(-12 100 96)">' + M_FACE + M_DOT_EYES + mst('M92 118 Q100 114 108 118') + M_BLUSH + '</g><text x="150" y="58" font-size="40" font-weight="700" fill="#1F1F1F" font-family="Google Sans, sans-serif">?</text>';
  else if (mood === 'wave') inner = M_FACE + M_HAPPY_EYES + mst('M86 112 Q100 128 114 112') + M_BLUSH + mst('M150 128 q14 -10 12 -30') + '<circle cx="162" cy="92" r="9" fill="#FFF4E8" stroke="#1F1F1F" stroke-width="5"/>' + mspark(40, 52, 0.7);
  else inner = M_FACE + M_HAPPY_EYES + mst('M88 114 Q100 125 112 114') + M_BLUSH + mspark(164, 44);
  if (chin >= 0) inner = CHIN[chin] + inner;
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg width="${px}" height="${px}" viewBox="20 10 170 190" ${aria}>${inner}</svg>`;
}

/* ---------- starter dictionary ----------
   kind: meal (มื้อปกติ) | item (กินเป็นหน่วย) | sized (เลือกขนาด กรัม) | base/topping (ประกอบเมนูผสม)
   n = { k: kcal, p: protein g, f: fiber g } ต่อ 1 หน่วย หรือต่อ 100 g สำหรับ sized */
const MEATS = {
  chicken: { name: 'อกไก่', icon: 'chicken', per100: { k: 165, p: 31, f: 0 } },
  fish: { name: 'ปลานิล', icon: 'fish', per100: { k: 128, p: 26, f: 0 } },
  beef: { name: 'เนื้อวัว', icon: 'beef', per100: { k: 185, p: 29, f: 0 } },
  pork: { name: 'หมู', icon: 'pork', per100: { k: 200, p: 28, f: 0 } }
};
const RICE100 = { k: 130, p: 2.7, f: 0.4 };

const STARTER_FOODS = [
  { id: 'milk', name: 'นมโปรตีน', aliases: ['นม', 'protein'], cat: 'drink', icon: 'milk', kind: 'item', unit: 'กล่อง', n: null, addon: true, stores: ['7-11'], src: 'label' },
  { id: 'shake', name: 'อกไก่ปั่น', aliases: ['ปั่น', 'เชค'], cat: 'drink', icon: 'shake', kind: 'item', unit: 'แก้ว', n: null, addon: true, stores: ['ยิม'], src: 'label' },
  { id: 'egg', name: 'ไข่ต้ม', aliases: ['ไข่'], cat: 'main', icon: 'egg', kind: 'item', unit: 'ฟอง', n: { k: 70, p: 6.3, f: 0 }, addon: true, stores: ['7-11'], src: 'dict' },
  { id: 'guava', name: 'ฝรั่ง', aliases: [], cat: 'veg', icon: 'guava', kind: 'sized', per100: { k: 68, p: 2.6, f: 5.4 }, sizes: [[150, 'เล็ก', '≈ ลูกเทนนิส'], [200, 'กลาง', '≈ กำปั้น'], [300, 'ใหญ่', 'ใหญ่กว่ากำปั้น']], def: 200, addon: true, stores: ['Lotus'], src: 'dict' },
  { id: 'peas', name: 'ถั่วลันเตาแช่แข็ง', aliases: ['ถั่วลันเตา', 'ถั่ว'], cat: 'veg', icon: 'peas', kind: 'sized', per100: { k: 81, p: 5.4, f: 5.7 }, sizes: [[100, 'น้อย', '≈ ½ ถ้วย'], [150, 'กลาง', '≈ 1 ถ้วยกาแฟ'], [200, 'เยอะ', '≈ 1 ถ้วยใหญ่']], def: 150, addon: true, stores: ['Lotus'], src: 'dict' },
  { id: 'broc', name: 'บรอกโคลี', aliases: ['บร็อคโคลี่', 'บล็อกโคลี่'], cat: 'veg', icon: 'broc', kind: 'sized', per100: { k: 35, p: 2.4, f: 3.3 }, sizes: [[100, 'น้อย', '≈ 1 กำมือ'], [150, 'กลาง', '≈ 1 ถ้วย'], [250, 'เยอะ', '≈ 1 ถุงเล็ก']], def: 150, addon: true, stores: ['Lotus'], src: 'dict' },
  { id: 'banana', name: 'กล้วยหอม', aliases: ['กล้วย'], cat: 'veg', icon: 'banana', kind: 'item', unit: 'ลูก', n: { k: 105, p: 1.3, f: 3.1 }, addon: true, stores: ['7-11', 'Lotus'], src: 'dict' },
  { id: 'apple', name: 'แอปเปิ้ล', aliases: ['แอปเปิล'], cat: 'veg', icon: 'apple', kind: 'item', unit: 'ลูก', n: { k: 95, p: 0.5, f: 4.4 }, addon: false, stores: ['Lotus'], src: 'dict' },
  { id: 'orange', name: 'ส้ม', aliases: [], cat: 'veg', icon: 'orange', kind: 'item', unit: 'ลูก', n: { k: 62, p: 1.2, f: 3.1 }, addon: false, stores: ['Lotus'], src: 'dict' },
  { id: 'mango', name: 'มะม่วงสุก', aliases: ['มะม่วง'], cat: 'veg', icon: 'mango', kind: 'sized', per100: { k: 60, p: 0.8, f: 1.6 }, sizes: [[150, 'ครึ่งลูก', '≈ ½ ลูกกลาง'], [250, '1 ลูกเล็ก', '≈ กำปั้นใหญ่'], [350, '1 ลูกใหญ่', 'ลูกยาวเต็มมือ']], def: 150, addon: false, stores: ['Lotus'], src: 'dict' },
  { id: 'stickymango', name: 'ข้าวเหนียวมะม่วง', aliases: [], cat: 'snack', icon: 'mango', kind: 'item', unit: 'จาน', n: { k: 480, p: 6, f: 3 }, addon: false, stores: [], src: 'est' },
  { id: 'croissant', name: 'ครัวซองต์', aliases: ['ครัวซอง'], cat: 'snack', icon: 'snack', kind: 'item', unit: 'ชิ้น', n: { k: 270, p: 5, f: 1.5 }, addon: false, stores: [], src: 'est' }
];

const BASES = [
  { key: ['วาฟเฟิล', 'วาฟเฟิ้ล'], name: 'วาฟเฟิล', icon: 'waffle', n: { k: 220, p: 5, f: 1 } },
  { key: ['ครัวซองต์', 'ครัวซอง'], name: 'ครัวซองต์', icon: 'snack', n: { k: 270, p: 5, f: 1.5 } },
  { key: ['ขนมปัง'], name: 'ขนมปัง', icon: 'snack', n: { k: 250, p: 7, f: 2 } },
  { key: ['โดนัท'], name: 'โดนัท', icon: 'snack', n: { k: 250, p: 4, f: 1 } },
  { key: ['ซาลาเปา'], name: 'ซาลาเปา', icon: 'snack', n: { k: 200, p: 7, f: 1.5 } },
  { key: ['แซนด์วิช', 'แซนวิช'], name: 'แซนด์วิช', icon: 'snack', n: { k: 250, p: 10, f: 2 } },
  { key: ['กะเพรา', 'กระเพรา', 'ข้าวราด'], name: 'ข้าวราดกะเพรา', icon: 'main', n: { k: 550, p: 22, f: 2 } },
  { key: ['ข้าวผัด'], name: 'ข้าวผัด', icon: 'main', n: { k: 600, p: 15, f: 2 } },
  { key: ['ก๋วยเตี๋ยว', 'เส้นเล็ก', 'เส้นใหญ่'], name: 'ก๋วยเตี๋ยวน้ำ', icon: 'main', n: { k: 350, p: 15, f: 1.5 } },
  { key: ['โจ๊ก'], name: 'โจ๊ก', icon: 'main', n: { k: 250, p: 10, f: 0.5 } }
];
const TOPPINGS = [
  { key: ['ไส้กรอก', 'ฮอทดอก', 'ฮอตดอก'], name: 'ไส้กรอก', icon: 'sausage', n: { k: 80, p: 3.5, f: 0 } },
  { key: ['เนย'], name: 'เนย', icon: 'butter', n: { k: 50, p: 0, f: 0 } },
  { key: ['ชีส'], name: 'ชีส', icon: 'cheese', n: { k: 60, p: 4, f: 0 } },
  { key: ['หมูหยอง'], name: 'หมูหยอง', icon: 'pork', n: { k: 60, p: 5, f: 0 } },
  { key: ['ช็อกโกแลต', 'ช็อค', 'ช็อก'], name: 'ช็อกโกแลต', icon: 'snack', n: { k: 80, p: 1, f: 1 } },
  { key: ['ครีม', 'คัสตาร์ด'], name: 'ครีม', icon: 'snack', n: { k: 70, p: 1, f: 0 } },
  { key: ['ไข่ดาว'], name: 'ไข่ดาว', icon: 'friedegg', n: { k: 90, p: 6, f: 0 } },
  { key: ['ไข่เจียว'], name: 'ไข่เจียว', icon: 'friedegg', n: { k: 180, p: 9, f: 0 } },
  { key: ['หมูกรอบ'], name: 'หมูกรอบ', icon: 'pork', n: { k: 150, p: 7, f: 0 } },
  { key: ['แยม', 'นมข้น'], name: 'แยม/นมข้น', icon: 'snack', n: { k: 40, p: 0, f: 0 } }
];
const BUCKETS = {
  out: [['เบา', 450], ['กลาง', 650], ['หนัก', 850]],
  snack: [['เบา', 150], ['กลาง', 300], ['หนัก', 450]]
};
