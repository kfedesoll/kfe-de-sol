/**
 * K'fe De Sol - Google Sheets Backend (v3, + MenuMeta)
 * v3.0: Tambah getMenuMeta, saveMenuMeta, saveMenuImage (Google Drive)
 * v3.3.1: Pelanggan hanya ambil data sendiri (myOrders, myLoyalty); senarai
 *         penuh orders/customers untuk admin sahaja; action debug dibuang.
 * v3.3.3: addOrder ditolak (SHOP_CLOSED) di luar waktu operasi atau semasa
 *         cuti, ikut jadual yang sama dengan app (meta 'shop-status').
 * v3.3.4: Redeem tidak lagi tolak cawan. Setiap tebusan disimpan (masa) dalam
 *         kolum 'redeems' sheet Customers; air percuma = floor(qty/5) - tebusan.
 * v3.3.6: Action 'queueBoard' untuk skrin giliran (skrin.html): nombor giliran
 *         dan status sahaja, tanpa login, tanpa nama/telefon. Tetapan skrin
 *         disimpan dalam meta 'display-settings'.
 *         Waktu operasi biasa boleh ditetapkan admin (meta 'shop-hours', satu
 *         entri bagi setiap hari); addOrder dan app ikut tetapan yang sama.
 * v3.3.8: Skrin giliran papar order aktif dalam 12 jam terakhir (bukan 'hari
 *         ini' sahaja), supaya order sebelum tengah malam tidak hilang.
 * v3.4.0: Push notification ke telefon pelanggan (walaupun app ditutup):
 *         pesanan siap / ditolak, mata ganjaran bila Selesai, dan promosi
 *         daripada admin (action 'sendPromoPush'). Lihat bahagian
 *         PUSH NOTIFICATION di bawah; perlu Script Property PUSH_KEY.
 * v3.6.0: Data disimpan kekal. Sheet SemuaPelanggan (tidak pernah dipadam,
 *         diisi kali pertama daripada laporan bulanan lama) dan OrdersArkib
 *         (order bulan lepas dipindah ke sini, bukan dipadam). Kiraan cawan
 *         air percuma (Customers) masih reset bulanan. Action admin
 *         'allCustomers' dan 'sendCustomerPush'.
 * v3.7.0: Hebahan: setiap gambar ada jenis 'promo' (Promosi) atau 'notice'
 *         (Pemberitahuan / Ucapan), kolum 'type' sheet Promotions; action
 *         admin 'setPromotionType'. Notifikasi hebahan boleh bawa gambar.
 * v3.8.0: Notifikasi order baru ke telefon admin (walaupun skrin tutup / app
 *         lain dibuka). Action admin 'adminPushSubscribe', 'adminPushUnsubscribe',
 *         'adminPushTest'. Pilihan "ulang": notifikasi berbunyi semula setiap
 *         minit selagi order belum di-Acknowledge (maksimum 60 minit) — perlu
 *         jalankan pasangNotifAdmin() SEKALI dari editor (cipta trigger 1 minit).
 * v3.10.0: Points & katalog Reward. SemuaPelanggan dapat kolum 'points' (baki
 *         kekal, tidak reset) dan 'referralCode' (6 digit unik). Points masuk
 *         bila order Selesai (meta 'points-per-cup', asal 2). Kali pertama,
 *         pelanggan lama diberi points untuk cawan lepas. Sheet Rewards
 *         (hadiah + gambar + status Tersedia/Habis/Tidak Tersedia/Akan Datang) dan PointsLog (rekod setiap tambah/tolak points).
 *         Action: 'rewards' (GET), admin 'saveReward', 'deleteReward',
 *         'redeemReward'. 'myLoyalty' kini juga pulangkan points & kod.
 *         Duit referral: pelanggan baru masukkan kod kawan (action 'setReferral');
 *         setiap order kawan yang Selesai memberi RM1 kepada pengajak, untuk 3
 *         order pertama sahaja (meta 'referral-rm', 'referral-max'). Kolum
 *         SemuaPelanggan 9-12, sheet DuitLog; admin tolak baki ('useBalance').
 *         Profil: jantina & tarikh lahir (pilihan) dalam SemuaPelanggan kolum
 *         13-14, diisi pelanggan semasa daftar / di Account ('setProfile').
 * v3.10.2: Daftar sekali sahaja ('registerCustomer': nama, profil & kod kawan
 *         sekali gus; nombor yang sudah ada ditolak). Masuk dengan no. telefon
 *         sahaja: 'customerLookup' pulangkan nama pelanggan berdaftar.
 * v3.11.0: Notifikasi automatik (trigger harian harianNotif, pukul 10 pagi —
 *         jalankan pasangNotifHarian() SEKALI dari editor). Ucapan hari jadi +
 *         1 air percuma (sah meta auto-push.birthdayDays hari, sekali setahun,
 *         admin tebus 'redeemBirthday'; SemuaPelanggan kolum 15-16). Ingatan
 *         "Apa khabar" setiap 3 hari: pelanggan dibahagi rawak kepada kumpulan,
 *         satu kumpulan sehari, hanya hari kedai buka, langkau yang baru beli.
 *         Tetapan meta 'auto-push'; action admin 'autoPush' (GET), 'saveAutoPush'.
 * v3.12.0: Keselamatan: nama, item, telefon, id & status order daripada telefon
 *         dibersihkan (cleanText_) sebelum disimpan. Laporan bulanan dipindah
 *         daripada sel Meta 'reports' (had 50,000 aksara) ke sheet LaporanBulanan
 *         (seorang pelanggan sebulan) & KewanganBulanan (ringkasan kedai sebulan);
 *         action admin 'kewangan' (GET).
 * v3.12.1: Backup automatik mingguan (backupMingguan, setiap Ahad ~3 pagi) ke
 *         folder Drive "K'fe De Sol Backup", 12 salinan terakhir disimpan.
 *         Jalankan pasangBackup() SEKALI dari editor.
 * v3.13.0: Keselamatan untuk dijual kepada kedai lain:
 *         - Harga & jumlah order dikira di server (harga MenuMeta, jika tiada
 *           harga asal MENU_DEFAULTS_); harga daripada telefon diabaikan.
 *         - Kata laluan admin di-hash (SHA-256 + salt, dinaik taraf sendiri bila
 *           admin log masuk), tidak dihantar ke browser, tiada akaun lalai.
 *           Admin pertama: jalankan buatAdminPertama() dari editor.
 *         - Log masuk admin dikunci 15 minit selepas 5 kali salah.
 *         - Had request (CacheService): order, daftar, semak telefon, profil.
 *         - archiveCustomers perlu sesi admin; bulan juga ditukar oleh harianNotif.
 *         - Ralat tidak lagi memulangkan stack trace.
 *         - Sheet AuditLog: setiap tindakan admin (siapa, apa, bila).
 * v3.14.0: Menu baru kategori Coklat & Milk (6 item) dalam MENU_DEFAULTS_.
 * v3.15.0: Admin cipta kategori & menu sendiri dari app (tanpa ubah kod).
 *         Action admin 'saveMenuCategory' (cipta / tukar nama), 'deleteMenuCategory'
 *         (kategori kosong sahaja), 'addMenuItem', 'deleteMenuItem'. MenuMeta dapat
 *         kolum category, temp, custom, deleted; meta 'menu-categories'.
 *         'menuMeta' kini juga pulangkan senarai kategori.
 *         Action admin 'salesChart' (GET): jualan & cawan ikut jam / hari / bulan
 *         untuk graf Dashboard, daripada Orders + OrdersArkib.
 * v3.16.0: Suis Aktif / Tidak Aktif untuk program points (meta 'points-enabled')
 *         dan duit referral (meta 'referral-enabled'); '0' = berhenti, lain = aktif
 *         (asal aktif supaya tingkah laku lama tidak berubah). Bila tidak aktif,
 *         order Selesai tidak beri points / duit referral. Baki sedia ada kekal.
 *         Rewards kolum 9 'published': false = Draf (pelanggan tidak nampak, tidak
 *         boleh ditebus; admin nampak untuk pratonton). saveReward terima published.
 */

function ss_(){ return SpreadsheetApp.getActiveSpreadsheet(); }

/* ---------- v3.13.0: harga ditentukan di server ----------
   Harga asal setiap menu (sama dengan MENU dalam index.html). Harga yang admin
   tukar dalam app disimpan dalam MenuMeta dan diutamakan. temp: true = Hot/Ice. */
const MENU_DEFAULTS_ = {
  'coffee-latte': { name: 'Coffee Latte', price: 8.00, temp: true },
  'spanish-latte': { name: 'Spanish Latte', price: 8.00, temp: true },
  'cappuccino': { name: 'Cappuccino', price: 8.00, temp: true },
  'caramel-latte': { name: 'Caramel Latte', price: 9.00, temp: true },
  'mocha': { name: 'Mocha', price: 10.00, temp: true },
  'butterscotch-latte': { name: 'Butterscotch Latte', price: 10.00, temp: true },
  'mint-americano': { name: 'The Mint Americano', price: 7.00, temp: true },
  'peppermint-choc-americano': { name: 'Peppermint Chocolate Americano', price: 10.00, temp: true },
  'orange-americano': { name: 'Orange Americano', price: 9.00, temp: true },
  'sparkling-passion-americano': { name: 'Sparkling Passion Fruit Americano', price: 10.00, temp: true },
  'passion-pineapple-americano': { name: 'Passion Fruit Pineapple Americano', price: 10.00, temp: true },
  'affogato': { name: 'Affogato', price: 6.00, temp: true },
  'hazelnut-americano': { name: 'Hazelnut Americano', price: 7.00, temp: true },
  'vanilla-americano': { name: 'Vanilla Americano', price: 7.00, temp: true },
  'press-orange': { name: 'Press Orange', price: 8.00 },
  'watermelon-soda': { name: 'Watermelon Soda', price: 10.00 },
  'blue-wave': { name: 'The Blue Wave', price: 8.00 },
  'sunset-soda': { name: 'The Sunset Soda', price: 8.00 },
  'mojito': { name: 'Mojito', price: 8.00 },
  'lemonide-soda': { name: 'Lemonide Soda', price: 8.00 },
  'aparajita': { name: 'Aparajita', price: 8.00 },
  'matcha-latte': { name: 'Matcha Latte', price: 8.00 },
  'matcha-strawberry': { name: 'Matcha Strawberry', price: 9.00 },
  'matcha-watermelon': { name: 'Matcha Watermelon', price: 9.00 },
  'matcha-mango': { name: 'Matcha Mango', price: 9.00 },
  // v3.14.0: kategori Coklat & Milk
  'fresh-milk-vanilla': { name: 'Fresh Milk with Vanilla', price: 9.00, temp: true },
  'fresh-milk-hazelnut': { name: 'Fresh Milk with Hazelnut', price: 9.00, temp: true },
  'fresh-milk-honey': { name: 'Fresh Milk with Honey', price: 9.00, temp: true },
  'coklat-mint': { name: 'Coklat Mint', price: 8.00, temp: true },
  'coklat-original': { name: 'Coklat Original', price: 7.00, temp: true },
  'strawberry-milkshake': { name: 'Strawberry Milkshake', price: 9.00 }
};
/* ---------- v3.15.0: kategori & menu yang admin cipta sendiri ----------
   Kategori asal di bawah (sama dengan CATEGORIES dalam index.html). Nama baru,
   kategori ciptaan admin dan kategori yang dipadam disimpan dalam meta
   'menu-categories' (JSON [{id,label,custom,deleted}]). Menu ciptaan admin
   disimpan dalam sheet MenuMeta (kolum category, temp, custom=TRUE); menu yang
   dipadam (asal atau ciptaan) ditanda deleted=TRUE, tidak dibuang. */
const MENU_CATEGORY_DEFAULTS_ = [
  { id: 'fresh', label: 'Fresh Brew', items: ['coffee-latte','spanish-latte','cappuccino','caramel-latte','mocha','butterscotch-latte'] },
  { id: 'americano', label: 'Americano', items: ['mint-americano','peppermint-choc-americano','orange-americano','sparkling-passion-americano','passion-pineapple-americano','affogato','hazelnut-americano','vanilla-americano'] },
  { id: 'mocktail', label: 'Fruits / Mocktail', items: ['press-orange','watermelon-soda','blue-wave','sunset-soda','mojito','lemonide-soda','aparajita'] },
  { id: 'matcha', label: 'Matcha World', items: ['matcha-latte','matcha-strawberry','matcha-watermelon','matcha-mango'] },
  { id: 'coklat', label: 'Coklat & Milk', items: ['fresh-milk-vanilla','fresh-milk-hazelnut','fresh-milk-honey','coklat-mint','coklat-original','strawberry-milkshake'] }
];
function truthy_(v){ return v === true || String(v).toUpperCase() === 'TRUE'; }
function builtinCategoryOf_(id){
  const c = MENU_CATEGORY_DEFAULTS_.find(c => c.items.indexOf(id) !== -1);
  return c ? c.id : '';
}
function menuCategoryMeta_(){
  try{
    const list = JSON.parse(getMeta_('menu-categories', '[]') || '[]');
    return Array.isArray(list) ? list.filter(c => c && c.id) : [];
  }catch(e){ return []; }
}
// Senarai kategori aktif (asal dahulu, kemudian ciptaan admin): [{id,label,custom}]
function getMenuCategories_(){
  const meta = menuCategoryMeta_();
  const out = [];
  MENU_CATEGORY_DEFAULTS_.forEach(d => {
    const m = meta.find(c => c.id === d.id) || {};
    if(!m.deleted) out.push({ id: d.id, label: String(m.label || d.label), custom: false });
  });
  meta.forEach(m => {
    if(m.custom && !m.deleted && !MENU_CATEGORY_DEFAULTS_.some(d => d.id === m.id)) out.push({ id: String(m.id), label: String(m.label || ''), custom: true });
  });
  return out;
}
function saveMenuCategory_(body){
  const label = cleanText_(body.label, 40);
  if(!label) return { ok:false, error:'NAMA_KOSONG' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    const meta = menuCategoryMeta_();
    const active = getMenuCategories_();
    let id = String(body.id || '');
    if(id){
      if(!active.some(c => c.id === id)) return { ok:false, error:'KATEGORI_TIADA' };
      const m = meta.find(c => c.id === id);
      if(m) m.label = label; else meta.push({ id: id, label: label });
    } else {
      if(active.length >= 30) return { ok:false, error:'TERLALU_BANYAK' };
      id = 'k-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
      meta.push({ id: id, label: label, custom: true });
    }
    setMeta_('menu-categories', JSON.stringify(meta));
    return { ok:true, id: id, categories: getMenuCategories_() };
  } finally { lock.releaseLock(); }
}
function deleteMenuCategory_(body){
  const id = String(body.id || '');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    if(!getMenuCategories_().some(c => c.id === id)) return { ok:false, error:'KATEGORI_TIADA' };
    const catalog = menuCatalog_();
    if(Object.keys(catalog).some(k => catalog[k].category === id)) return { ok:false, error:'KATEGORI_ADA_MENU' };
    const meta = menuCategoryMeta_();
    const m = meta.find(c => c.id === id);
    if(m) m.deleted = true; else meta.push({ id: id, deleted: true });
    setMeta_('menu-categories', JSON.stringify(meta));
    return { ok:true, categories: getMenuCategories_() };
  } finally { lock.releaseLock(); }
}
function addMenuItem_(body){
  const name = cleanText_(body.name, 60);
  const price = Number(body.price);
  const category = String(body.category || '');
  if(!name) return { ok:false, error:'NAMA_KOSONG' };
  if(!(price >= 0 && price <= 1000)) return { ok:false, error:'HARGA_TIDAK_SAH' };
  if(!getMenuCategories_().some(c => c.id === category)) return { ok:false, error:'KATEGORI_TIADA' };
  const catalog = menuCatalog_();
  if(Object.keys(catalog).filter(k => !catalog[k].deleted).length >= 200) return { ok:false, error:'TERLALU_BANYAK' };
  const id = 'm-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const temp = truthy_(body.temp);
  const desc = cleanText_(body.desc, 200);
  const sheet = menuMetaSheet_();
  const cols = menuMetaColumns_(sheet);
  const row = new Array(sheet.getLastColumn()).fill('');
  row[cols.id - 1] = id;
  row[cols.desc - 1] = desc;
  row[cols.name - 1] = name;
  row[cols.price - 1] = rm2_(price);
  row[cols.published - 1] = true;
  row[cols.category - 1] = category;
  row[cols.temp - 1] = temp;
  row[cols.custom - 1] = true;
  row[cols.deleted - 1] = false;
  row[cols.updatedAt - 1] = new Date().toISOString();
  sheet.appendRow(row);
  return { ok:true, item: { id: id, name: name, price: rm2_(price), category: category, temp: temp, desc: desc, custom: true } };
}
function deleteMenuItem_(body){
  const id = String(body.id || '');
  if(!menuCatalog_()[id]) return { ok:false, error:'MENU_TIADA' };
  const sheet = menuMetaSheet_();
  const cols = menuMetaColumns_(sheet);
  let row = findRow_(sheet, cols.id - 1, id);
  if(row === -1){
    sheet.appendRow([]);
    row = sheet.getLastRow();
    sheet.getRange(row, cols.id).setValue(id);
  }
  sheet.getRange(row, cols.deleted).setValue(true);
  sheet.getRange(row, cols.updatedAt).setValue(new Date().toISOString());
  return { ok:true };
}

// Senarai harga terkini: { id: { name, price, temp, published, category, deleted } }
// Menu yang dipadam kekal dalam senarai (published=false) supaya order lama
// dengan nama itu masih dikenali, tetapi tidak boleh dipesan.
function menuCatalog_(){
  const out = {};
  Object.keys(MENU_DEFAULTS_).forEach(id => { out[id] = Object.assign({ published: true, category: builtinCategoryOf_(id) }, MENU_DEFAULTS_[id]); });
  (getMenuMeta_().items || []).forEach(m => {
    let item = out[m.id];
    if(!item){
      if(!truthy_(m.custom) || !String(m.name || '').trim() || !(Number(m.price) >= 0) || m.price === '') return;
      item = out[m.id] = { name: '', price: 0, temp: truthy_(m.temp), published: true, category: String(m.category || ''), custom: true };
    }
    if(String(m.name || '').trim()) item.name = String(m.name).trim();
    if(m.price !== '' && m.price != null && Number(m.price) >= 0) item.price = Number(m.price);
    if(m.published === false || String(m.published).toUpperCase() === 'FALSE') item.published = false;
    if(truthy_(m.deleted)){ item.deleted = true; item.published = false; item.category = ''; }
  });
  return out;
}
// Item daripada telefon → item dengan nama & harga server. null jika tidak sah.
// App lama (tanpa id) dipadankan melalui nama, cth. "Coffee Latte (Ice)".
function priceOrderItem_(i, catalog){
  let id = String(i.id || '');
  let temp = String(i.temp || '');
  if(!catalog[id]){
    const m = String(i.name || '').trim().match(/^(.*?)(?: \((Hot|Ice)\))?$/);
    const base = m ? m[1].trim().toLowerCase() : '';
    id = Object.keys(catalog).find(k => catalog[k].name.toLowerCase() === base || (MENU_DEFAULTS_[k] || catalog[k]).name.toLowerCase() === base) || '';
    if(m && m[2]) temp = m[2].toLowerCase();
  }
  const item = catalog[id];
  if(!item) return null;
  if(!item.published) return { unavailable: true, name: item.name };
  const t = item.temp ? (temp === 'ice' ? 'Ice' : 'Hot') : '';
  return { id: id, name: item.name + (t ? ' (' + t + ')' : ''), qty: Number(i.qty), price: rm2_(item.price) };
}

/* ---------- v3.13.0: had request ----------
   Kiraan dalam CacheService (tamat sendiri). Pulangkan true jika masih dalam
   had. Jika cache gagal, request dibenarkan supaya kedai tidak terhenti. */
function rateOk_(key, limit, seconds){
  try{
    const cache = CacheService.getScriptCache();
    const k = 'rl-' + key;
    const n = Number(cache.get(k) || 0);
    if(n >= limit) return false;
    cache.put(k, String(n + 1), seconds);
    return true;
  }catch(e){ return true; }
}
function rateCount_(key){
  try{ return Number(CacheService.getScriptCache().get('rl-' + key) || 0); }catch(e){ return 0; }
}
function rateClear_(key){
  try{ CacheService.getScriptCache().remove('rl-' + key); }catch(e){}
}

// v3.12.0: teks daripada telefon (nama, item) tanpa aksara yang boleh jadi kod HTML/skrip
function cleanText_(v, max){
  return String(v == null ? '' : v).replace(/[<>"`\\\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function todayStr_(){
  return Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

function getSheet_(name, headers){
  const ss = ss_();
  let sheet = ss.getSheetByName(name);
  if(!sheet){
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function ordersSheet_(){
  const sheet = getSheet_('Orders', ['id','queueNo','items','total','status','createdAt','customerName','customerPhone','loyalty']);
  // Column 9 tracks loyalty credit: 'pending' until the order is completed,
  // then 'counted'. Orders from before v3.3.1 leave it blank because their
  // points were already added when the customer submitted them.
  if(String(sheet.getRange(1, 9).getValue()) !== 'loyalty') sheet.getRange(1, 9).setValue('loyalty');
  return sheet;
}
function customersSheet_(){
  const sheet = getSheet_('Customers', ['phone','name','count','qty','redeems']);
  // Column 5 lists redemption times (JSON array of ms timestamps). Added in v3.3.4.
  if(String(sheet.getRange(1, 5).getValue()) !== 'redeems') sheet.getRange(1, 5).setValue('redeems');
  return sheet;
}

// Free drinks are earned every 5 cups. Redeeming no longer removes cups; it
// records the time so the app can mark that milestone as "Ditebus".
const FREE_DRINK_EVERY_ = 5;
function parseRedeems_(cell){
  try{
    const list = JSON.parse(cell || '[]');
    return Array.isArray(list) ? list.map(Number).filter(n => n > 0) : [];
  }catch(e){ return []; }
}
function loyaltyFromRow_(r){
  return { name: r[1], count: Number(r[2]) || 0, qty: Number(r[3]) || 0, redeems: parseRedeems_(r[4]) };
}
function adminsSheet_(){ return getSheet_('Admins', ['id','name','username','password']); }

/* ---------- v3.6.0: data pelanggan & order disimpan kekal ----------
   SemuaPelanggan: satu baris bagi setiap pelanggan, TIDAK PERNAH dipadam
   (sheet Customers masih reset bulanan untuk kiraan air percuma).
   OrdersArkib: order bulan lepas dipindah ke sini pada awal bulan. */
const ALL_CUSTOMERS_HEADERS_ = ['phone','name','firstSeen','lastOrder','orders','cups'];
function ordersArchiveSheet_(){
  return getSheet_('OrdersArkib', ['id','queueNo','items','total','status','createdAt','customerName','customerPhone','loyalty','month']);
}
// No. telefon sebagai kunci: digit sahaja; nombor lama yang hilang 0 di depan (cth. 137308431) dibetulkan
function phoneKey_(phone){
  const d = String(phone == null ? '' : phone).replace(/\D/g, '');
  return /^1\d{8,9}$/.test(d) ? '0' + d : d;
}
function shopTimeStr_(ms){ return Utilities.formatDate(new Date(ms || Date.now()), SHOP_TZ_, 'yyyy-MM-dd HH:mm'); }

function allCustomersSheet_(){
  const isNew = !ss_().getSheetByName('SemuaPelanggan');
  const sheet = getSheet_('SemuaPelanggan', ALL_CUSTOMERS_HEADERS_);
  if(isNew){
    sheet.getRange('A:A').setNumberFormat('@');
    sheet.setFrozenRows(1);
    backfillAllCustomers_(sheet);
  }
  ensurePointsColumns_(sheet);
  ensureReferralColumns_(sheet);
  ensureProfileColumns_(sheet);
  ensureBirthdayColumns_(sheet);
  return sheet;
}

// Kali pertama sahaja: isi daripada laporan bulanan lama (Meta 'reports'),
// senarai Customers bulan ini dan sheet Orders, supaya pelanggan lama tidak hilang.
function backfillAllCustomers_(sheet){
  const map = {};
  const add = function(phone, name, month, count, qty, lastMs){
    const key = phoneKey_(phone);
    if(!/^\d{9,15}$/.test(key)) return;
    const c = map[key] || (map[key] = { name: '', first: '', last: '', lastMs: 0, orders: 0, cups: 0 });
    if(name) c.name = String(name);
    if(month && (!c.first || month < c.first)) c.first = month;
    if(month && (!c.last || month > c.last)) c.last = month;
    c.orders += Number(count) || 0;
    c.cups += Number(qty) || 0;
    if(lastMs && lastMs > c.lastMs) c.lastMs = lastMs;
  };
  let reports = {};
  try{ reports = JSON.parse(getMeta_('reports', '{}') || '{}') || {}; }catch(e){ reports = {}; }
  Object.keys(reports).sort().forEach(function(month){
    const snap = reports[month] || {};
    Object.keys(snap).forEach(function(phone){ const r = snap[phone] || {}; add(phone, r.name, month, r.count, r.qty, 0); });
  });
  const curMonth = getMeta_('current-month', '') || Utilities.formatDate(new Date(), SHOP_TZ_, 'yyyy-MM');
  customersSheet_().getDataRange().getValues().slice(1).forEach(function(r){ if(r[0]) add(r[0], r[1], curMonth, r[2], r[3], 0); });
  // Order bulan ini: nama terkini & masa order terakhir (kiraan sudah ada dalam Customers)
  ordersSheet_().getDataRange().getValues().slice(1).forEach(function(r){
    if(r[0] && r[7]) add(r[7], r[6], Utilities.formatDate(new Date(Number(r[5]) || Date.now()), SHOP_TZ_, 'yyyy-MM'), 0, 0, Number(r[5]) || 0);
  });
  const rows = Object.keys(map).map(function(key){
    const c = map[key];
    return [key, c.name, c.first, c.lastMs ? shopTimeStr_(c.lastMs) : c.last, c.orders, c.cups];
  });
  if(rows.length) sheet.getRange(2, 1, rows.length, ALL_CUSTOMERS_HEADERS_.length).setValues(rows);
}

// Kemas kini satu pelanggan. opts: { lastOrderMs, addOrders, addCups, addPoints }.
// Pulangkan baki points selepas kemas kini (null jika gagal). Tidak pernah gagalkan order.
function upsertAllCustomer_(phone, name, opts){
  try{
    const key = phoneKey_(phone);
    if(!/^\d{9,15}$/.test(key)) return null;
    opts = opts || {};
    name = cleanText_(name, 60);
    const sheet = allCustomersSheet_();
    const rows = findRowsByColumn_(sheet, 1, key);
    if(!rows.length){
      const row = sheet.getLastRow() + 1;
      setTextCell_(sheet, row, 1, key);
      const points = opts.addPoints || 0;
      sheet.getRange(row, 2, 1, 6).setValues([[String(name || ''), shopTimeStr_(), opts.lastOrderMs ? shopTimeStr_(opts.lastOrderMs) : '', opts.addOrders || 0, opts.addCups || 0, points]]);
      setTextCell_(sheet, row, 8, newReferralCode_(referralCodesInUse_(sheet)));
      return points;
    }
    const row = rows[0];
    const cur = sheet.getRange(row, 1, 1, 8).getValues()[0];
    if(name) cur[1] = String(name);
    if(opts.lastOrderMs) cur[3] = shopTimeStr_(opts.lastOrderMs);
    cur[4] = (Number(cur[4]) || 0) + (opts.addOrders || 0);
    cur[5] = (Number(cur[5]) || 0) + (opts.addCups || 0);
    cur[6] = (Number(cur[6]) || 0) + (opts.addPoints || 0);
    sheet.getRange(row, 2, 1, 6).setValues([cur.slice(1, 7)]);
    if(!/^\d{6}$/.test(String(cur[7]))) setTextCell_(sheet, row, 8, newReferralCode_(referralCodesInUse_(sheet)));
    return cur[6];
  }catch(err){ console.error('SemuaPelanggan gagal: ' + err); return null; }
}

function getAllCustomers_(){
  const data = allCustomersSheet_().getDataRange().getValues().slice(1).filter(r => r[0]);
  const auto = getAutoPush_(), today = shopTodayStr_();
  const friends = {};
  data.forEach(r => { const by = String(r[8] || ''); if(by) friends[by] = (friends[by] || 0) + 1; });
  return data.map(r => ({
    phone: String(r[0]), name: String(r[1] || ''), firstSeen: String(r[2] || ''), lastOrder: String(r[3] || ''),
    orders: Number(r[4]) || 0, cups: Number(r[5]) || 0,
    points: Number(r[6]) || 0, referralCode: String(r[7] || ''),
    referredBy: String(r[8] || ''), rm: rm2_(r[9]), rmEarned: rm2_(r[10]), friends: friends[String(r[7] || '')] || 0,
    gender: String(r[12] || ''), birthday: birthdayStr_(r[13]),
    bdayGift: birthdayGift_(birthdayStr_(r[13]), r[15], today, auto)
  }));
}

/* ---------- v3.10.0: points, kod referral & katalog Reward ----------
   SemuaPelanggan kolum 7 'points' = baki points (kekal, tidak reset bulanan),
   kolum 8 'referralCode' = kod 6 digit unik setiap pelanggan.
   Points masuk bila order Selesai (sudah bayar); admin tolak bila tebus hadiah. */
function pointsPerCup_(){
  const n = parseInt(getMeta_('points-per-cup', '2'), 10);
  return n >= 0 && n <= 100 ? n : 2;
}
// v3.16.0: suis Aktif / Tidak Aktif (asal aktif)
function pointsOn_(){ return String(getMeta_('points-enabled', '1')) !== '0'; }
function referralOn_(){ return String(getMeta_('referral-enabled', '1')) !== '0'; }

// Kali pertama sahaja (kolum belum ada): tambah kolum, beri points untuk cawan
// lepas (cawan × points-per-cup) dan cipta kod referral untuk semua pelanggan.
function ensurePointsColumns_(sheet){
  const head = sheet.getRange(1, 7, 1, 2).getValues()[0];
  if(String(head[0]) === 'points' && String(head[1]) === 'referralCode') return;
  sheet.getRange(1, 7, 1, 2).setValues([['points', 'referralCode']]);
  sheet.getRange('H:H').setNumberFormat('@');
  const last = sheet.getLastRow();
  if(last < 2) return;
  const rows = sheet.getRange(2, 1, last - 1, 8).getValues();
  const per = pointsPerCup_();
  const used = {};
  rows.forEach(r => { if(/^\d{6}$/.test(String(r[7]))) used[String(r[7])] = true; });
  const out = rows.map(r => {
    if(!r[0]) return [r[6], r[7]];
    const points = r[6] === '' || r[6] == null ? (Number(r[5]) || 0) * per : Number(r[6]) || 0;
    const code = /^\d{6}$/.test(String(r[7])) ? String(r[7]) : newReferralCode_(used);
    return [points, code];
  });
  sheet.getRange(2, 7, out.length, 2).setValues(out);
}

function referralCodesInUse_(sheet){
  const used = {};
  const last = sheet.getLastRow();
  if(last < 2) return used;
  sheet.getRange(2, 8, last - 1, 1).getValues().forEach(r => { if(r[0] !== '') used[String(r[0])] = true; });
  return used;
}
// Kod 6 digit rawak (100000-999999) yang belum dipakai; `used` dikemas kini.
function newReferralCode_(used){
  for(let i = 0; i < 200; i++){
    const code = String(100000 + Math.floor(Math.random() * 900000));
    if(!used[code]){ used[code] = true; return code; }
  }
  throw new Error('REFERRAL_CODE_FULL');
}

// Rekod setiap tambah / tolak points (untuk semakan jika pelanggan bertanya).
function pointsLogSheet_(){ return getSheet_('PointsLog', ['time','phone','name','change','balance','reason','ref','by']); }
function logPoints_(phone, name, change, balance, reason, ref, by){
  try{
    const sheet = pointsLogSheet_();
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1).setValue(shopTimeStr_());
    setTextCell_(sheet, row, 2, phoneKey_(phone));
    sheet.getRange(row, 3, 1, 6).setValues([[String(name || ''), change, balance, reason, String(ref || ''), String(by || '')]]);
  }catch(err){ console.error('PointsLog gagal: ' + err); }
}

// Pelanggan: baki points & kod sendiri. Pelanggan yang belum pernah order
// didaftar dalam SemuaPelanggan supaya kodnya wujud dan kekal.
function getMyPoints_(phone, name){
  const key = phoneKey_(phone);
  if(!/^\d{9,15}$/.test(key)) return null;
  const sheet = allCustomersSheet_();
  let rows = findRowsByColumn_(sheet, 1, key);
  if(!rows.length || !/^\d{6}$/.test(String(sheet.getRange(rows[0], 8).getValue()))){
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{ upsertAllCustomer_(key, String(name || '').slice(0, 60), {}); }
    finally{ lock.releaseLock(); }
    rows = findRowsByColumn_(sheet, 1, key);
    if(!rows.length) return null;
  }
  const r = sheet.getRange(rows[0], 1, 1, 16).getValues()[0];
  const code = String(r[7] || '');
  const last = sheet.getLastRow();
  const friends = last < 2 ? 0 : sheet.getRange(2, 9, last - 1, 1).getValues().filter(x => String(x[0]) === code).length;
  return { points: Number(r[6]) || 0, referralCode: code, perCup: pointsPerCup_(),
    pointsOn: pointsOn_(), refOn: referralOn_(),
    rm: rm2_(r[9]), rmEarned: rm2_(r[10]), friends: friends, referredBy: String(r[8] || ''),
    canEnterCode: !String(r[8] || '') && !(Number(r[4]) > 0), refRm: referralRm_(), refMax: referralMax_(),
    gender: String(r[12] || ''), birthday: birthdayStr_(r[13]),
    bdayGift: birthdayGift_(birthdayStr_(r[13]), r[15], shopTodayStr_(), getAutoPush_()) };
}

/* ---------- v3.10.0: duit referral (RM) ----------
   SemuaPelanggan kolum 9 'referredBy' = kod kawan yang mengajak (diisi sekali,
   pelanggan baru sahaja), 10 'rmBalance' = baki duit, 11 'rmEarned' = jumlah
   pernah dapat, 12 'refPaid' = berapa order pelanggan ini sudah beri RM kepada
   pengajaknya (berhenti pada referral-max). */
const REFERRAL_HEADERS_ = ['referredBy','rmBalance','rmEarned','refPaid'];
function ensureReferralColumns_(sheet){
  const head = sheet.getRange(1, 9, 1, 4).getValues()[0].map(String);
  if(head.join() === REFERRAL_HEADERS_.join()) return;
  sheet.getRange(1, 9, 1, 4).setValues([REFERRAL_HEADERS_]);
  sheet.getRange('I:I').setNumberFormat('@');
}
function referralRm_(){ const n = Number(getMeta_('referral-rm', '1')); return n >= 0 && n <= 100 ? n : 1; }
function referralMax_(){ const n = parseInt(getMeta_('referral-max', '3'), 10); return n >= 0 && n <= 100 ? n : 3; }
function rm2_(n){ return Math.round((Number(n) || 0) * 100) / 100; }

function rmLogSheet_(){ return getSheet_('DuitLog', ['time','phone','name','change','balance','reason','ref','by']); }
function logRm_(phone, name, change, balance, reason, ref, by){
  try{
    const sheet = rmLogSheet_();
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1).setValue(shopTimeStr_());
    setTextCell_(sheet, row, 2, phoneKey_(phone));
    sheet.getRange(row, 3, 1, 6).setValues([[String(name || ''), change, balance, reason, String(ref || ''), String(by || '')]]);
  }catch(err){ console.error('DuitLog gagal: ' + err); }
}

// Pelanggan baru masukkan kod kawan (sekali sahaja, sebelum order pertama Selesai).
// Caller must hold the script lock.
function setReferral_(phone, name, code){
  const key = phoneKey_(phone);
  code = String(code || '').replace(/\D/g, '');
  if(!/^\d{9,15}$/.test(key)) return { ok:false, error:'NO_CUSTOMER' };
  if(!/^\d{6}$/.test(code)) return { ok:false, error:'INVALID_CODE' };
  const sheet = allCustomersSheet_();
  let rows = findRowsByColumn_(sheet, 1, key);
  if(!rows.length){ upsertAllCustomer_(key, String(name || '').slice(0, 60), {}); rows = findRowsByColumn_(sheet, 1, key); }
  if(!rows.length) return { ok:false, error:'NO_CUSTOMER' };
  const me = sheet.getRange(rows[0], 1, 1, 12).getValues()[0];
  if(String(me[8] || '')) return { ok:false, error:'ALREADY_REFERRED' };
  if(Number(me[4]) > 0) return { ok:false, error:'NOT_NEW_CUSTOMER' };
  if(String(me[7]) === code) return { ok:false, error:'OWN_CODE' };
  const refRows = findRowsByColumn_(sheet, 8, code);
  if(!refRows.length) return { ok:false, error:'CODE_NOT_FOUND' };
  const referrer = sheet.getRange(refRows[0], 1, 1, 2).getValues()[0];
  setTextCell_(sheet, rows[0], 9, code);
  return { ok:true, referrerName: String(referrer[1] || '') };
}

// Dipanggil bila order Selesai: beri RM kepada pengajak untuk order pertama
// (sampai referral-max) pelanggan yang diajak. Tidak pernah gagalkan order.
function creditReferral_(phone, name, orderId){
  try{
    const key = phoneKey_(phone);
    const sheet = allCustomersSheet_();
    const rows = findRowsByColumn_(sheet, 1, key);
    if(!rows.length) return;
    const me = sheet.getRange(rows[0], 1, 1, 12).getValues()[0];
    const code = String(me[8] || '');
    if(!/^\d{6}$/.test(code)) return;
    if(!referralOn_()) return; // v3.16.0: program duit referral tidak aktif
    const paid = Number(me[11]) || 0, max = referralMax_(), rm = referralRm_();
    if(paid >= max || !(rm > 0)) return;
    const refRows = findRowsByColumn_(sheet, 8, code);
    if(!refRows.length) return;
    const ref = sheet.getRange(refRows[0], 1, 1, 12).getValues()[0];
    const balance = rm2_((Number(ref[9]) || 0) + rm);
    const earned = rm2_((Number(ref[10]) || 0) + rm);
    sheet.getRange(refRows[0], 10, 1, 2).setValues([[balance, earned]]);
    sheet.getRange(rows[0], 12).setValue(paid + 1);
    const who = String(name || me[1] || key);
    logRm_(ref[0], ref[1], rm, balance, 'Kawan ' + who + ' beli (' + (paid + 1) + '/' + max + ')', orderId, '');
    pushQueue_.push({ phone: String(ref[0]), tag: 'kfe-referral', url: '/',
      title: '💰 +RM' + rm.toFixed(2) + ' duit referral!',
      body: who + ' beli air guna kod anda (' + (paid + 1) + '/' + max + '). Baki duit anda RM' + balance.toFixed(2) + '.' });
  }catch(err){ console.error('Referral gagal: ' + err); }
}

/* ---------- v3.10.0: profil pelanggan ----------
   Kolum 13 'gender' = 'L' (Lelaki) / 'P' (Perempuan) / kosong,
   kolum 14 'birthday' = 'yyyy-MM-dd' (teks) / kosong. Kedua-duanya pilihan. */
function ensureProfileColumns_(sheet){
  const head = sheet.getRange(1, 13, 1, 2).getValues()[0].map(String);
  if(head[0] === 'gender' && head[1] === 'birthday') return;
  sheet.getRange(1, 13, 1, 2).setValues([['gender', 'birthday']]);
  sheet.getRange('N:N').setNumberFormat('@');
}
// Sheet boleh tukar teks tarikh jadi Date; pulangkan sentiasa 'yyyy-MM-dd'
function birthdayStr_(v){
  if(Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v, SHOP_TZ_, 'yyyy-MM-dd');
  const t = String(v || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}
// Pelanggan simpan jantina / tarikh lahir. Hanya medan yang dihantar dikemas kini.
// Caller must hold the script lock.
function setProfile_(body){
  const key = phoneKey_(body.phone);
  if(!/^\d{9,15}$/.test(key)) return { ok:false, error:'NO_CUSTOMER' };
  const hasGender = Object.prototype.hasOwnProperty.call(body, 'gender');
  const hasBirthday = Object.prototype.hasOwnProperty.call(body, 'birthday');
  const gender = String(body.gender || '');
  const birthday = String(body.birthday || '');
  if(hasGender && ['', 'L', 'P'].indexOf(gender) === -1) return { ok:false, error:'INVALID_GENDER' };
  if(hasBirthday && birthday){
    const d = new Date(birthday + 'T00:00:00');
    const year = Number(birthday.slice(0, 4));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || isNaN(d) || year < 1920 || d.getTime() > Date.now()) return { ok:false, error:'INVALID_BIRTHDAY' };
  }
  const sheet = allCustomersSheet_();
  let rows = findRowsByColumn_(sheet, 1, key);
  if(!rows.length){ upsertAllCustomer_(key, String(body.name || '').slice(0, 60), {}); rows = findRowsByColumn_(sheet, 1, key); }
  if(!rows.length) return { ok:false, error:'NO_CUSTOMER' };
  if(hasGender) sheet.getRange(rows[0], 13).setValue(gender);
  if(hasBirthday) setTextCell_(sheet, rows[0], 14, birthday);
  const r = sheet.getRange(rows[0], 13, 1, 2).getValues()[0];
  return { ok:true, gender:String(r[0] || ''), birthday:birthdayStr_(r[1]) };
}

/* ---------- v3.11.0: hadiah hari jadi ----------
   Kolum 15 'bdayPushed' = tahun ucapan hari jadi terakhir dihantar,
   kolum 16 'bdayRedeemed' = tahun air percuma hari jadi terakhir ditebus.
   Hadiah = 1 air percuma, sah dari hari jadi selama birthdayDays hari, sekali
   setahun. Tiada hadiah bila suis hari jadi dimatikan. */
function ensureBirthdayColumns_(sheet){
  const head = sheet.getRange(1, 15, 1, 2).getValues()[0].map(String);
  if(head[0] === 'bdayPushed' && head[1] === 'bdayRedeemed') return;
  sheet.getRange(1, 15, 1, 2).setValues([['bdayPushed', 'bdayRedeemed']]);
  sheet.getRange('O:P').setNumberFormat('@');
}
function shopTodayStr_(){ return Utilities.formatDate(new Date(), SHOP_TZ_, 'yyyy-MM-dd'); }
function addDays_(ymd, n){ return Utilities.formatDate(new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000), 'UTC', 'yyyy-MM-dd'); }
// Tarikh hari jadi pada tahun itu; 29 Feb disambut 28 Feb pada tahun biasa
function birthdayOn_(birthday, year){
  let md = birthday.slice(5);
  if(md === '02-29' && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) md = '02-28';
  return year + '-' + md;
}
// { year, from, until } jika hari ini dalam tempoh hadiah & belum ditebus, jika tidak null
function birthdayGift_(birthday, redeemedYear, today, auto){
  if(!auto.birthday || !birthday) return null;
  const year = Number(today.slice(0, 4));
  for(const y of [year, year - 1]){
    const from = birthdayOn_(birthday, y);
    const until = addDays_(from, auto.birthdayDays - 1);
    if(today >= from && today <= until) return String(redeemedYear) === String(y) ? null : { year: y, from: from, until: until };
  }
  return null;
}
// Admin tebus air percuma hari jadi di kaunter. Caller must hold the script lock.
function redeemBirthday_(body){
  const key = phoneKey_(body.phone);
  const sheet = allCustomersSheet_();
  const rows = findRowsByColumn_(sheet, 1, key);
  if(!rows.length) return { ok:false, error:'NO_CUSTOMER' };
  const r = sheet.getRange(rows[0], 1, 1, 16).getValues()[0];
  const gift = birthdayGift_(birthdayStr_(r[13]), r[15], shopTodayStr_(), getAutoPush_());
  if(!gift) return { ok:false, error:'NO_BIRTHDAY_GIFT' };
  setTextCell_(sheet, rows[0], 16, String(gift.year));
  const aRow = findRow_(adminsSheet_(), 0, body.adminId);
  const by = aRow === -1 ? '' : String(adminsSheet_().getRange(aRow, 2).getValue());
  logPoints_(key, r[1], 0, Number(r[6]) || 0, 'Tebus air percuma hari jadi ' + gift.year, '', by);
  return { ok:true, year: gift.year };
}

/* ---------- v3.10.2: Masuk & Daftar ----------
   Pelanggan berdaftar = ada baris dalam SemuaPelanggan. Masuk perlukan no.
   telefon sahaja (nama diambil daripada sheet); Daftar sekali sahaja. */
function customerLookup_(phone){
  const key = phoneKey_(phone);
  if(!/^\d{9,15}$/.test(key)) return { exists:false, error:'INVALID_PHONE' };
  const sheet = allCustomersSheet_();
  const rows = findRowsByColumn_(sheet, 1, key);
  if(!rows.length) return { exists:false };
  return { exists:true, name:String(sheet.getRange(rows[0], 2).getValue() || '') };
}
// Caller must hold the script lock.
function registerCustomer_(body){
  const key = phoneKey_(body.phone);
  const name = cleanText_(body.name, 60);
  if(!/^\d{9,15}$/.test(key)) return { ok:false, error:'INVALID_PHONE' };
  if(!name) return { ok:false, error:'NAME_EMPTY' };
  const sheet = allCustomersSheet_();
  const found = findRowsByColumn_(sheet, 1, key);
  if(found.length) return { ok:false, error:'ALREADY_REGISTERED', name:String(sheet.getRange(found[0], 2).getValue() || '') };
  upsertAllCustomer_(key, name, {});
  const out = { ok:true, name:name };
  const profile = { phone:key };
  if(body.gender) profile.gender = String(body.gender);
  if(body.birthday) profile.birthday = String(body.birthday);
  if(profile.gender || profile.birthday){
    const p = setProfile_(profile);
    if(!p.ok) out.profileError = p.error;
  }
  if(body.code){
    const r = setReferral_(key, name, body.code);
    if(r.ok) out.referrerName = r.referrerName; else out.refError = r.error;
  }
  const rows = findRowsByColumn_(sheet, 1, key);
  out.referralCode = rows.length ? String(sheet.getRange(rows[0], 8).getValue() || '') : '';
  return out;
}

// Admin tolak baki duit di kaunter (diskaun atau tunai). Caller must hold the script lock.
function useBalance_(body){
  const key = phoneKey_(body.phone);
  const amount = rm2_(body.amount);
  if(!(amount > 0)) return { ok:false, error:'INVALID_AMOUNT' };
  const sheet = allCustomersSheet_();
  const rows = findRowsByColumn_(sheet, 1, key);
  if(!rows.length) return { ok:false, error:'NO_CUSTOMER' };
  const cur = sheet.getRange(rows[0], 1, 1, 12).getValues()[0];
  const have = rm2_(cur[9]);
  if(amount > have) return { ok:false, error:'NOT_ENOUGH_BALANCE', rm:have };
  const balance = rm2_(have - amount);
  sheet.getRange(rows[0], 10).setValue(balance);
  const aRow = findRow_(adminsSheet_(), 0, body.adminId);
  const by = aRow === -1 ? '' : String(adminsSheet_().getRange(aRow, 2).getValue());
  logRm_(key, cur[1], -amount, balance, 'Guna baki di kaunter', '', by);
  return { ok:true, rm:balance };
}

// Status hadiah (perkataan sama di semua tempat): available = Tersedia,
// soldout = Habis, unavailable = Tidak Tersedia (tidak dipaparkan kepada
// pelanggan), comingsoon = Akan Datang. Hanya Tersedia boleh ditebus.
// v3.16.0: kolum 9 'published' — false = Draf (admin sahaja nampak, untuk pratonton).
// Baris lama tanpa nilai = sudah publish (tingkah laku lama kekal).
const REWARD_HEADERS_ = ['id','title','points','imageUrl','fileId','visible','createdAt','status','published'];
const REWARD_STATUSES_ = ['available','soldout','unavailable','comingsoon'];
function rewardsSheet_(){
  const sheet = getSheet_('Rewards', REWARD_HEADERS_);
  if(String(sheet.getRange(1, 8).getValue()) !== 'status') sheet.getRange(1, 8).setValue('status');
  if(String(sheet.getRange(1, 9).getValue()) !== 'published') sheet.getRange(1, 9).setValue('published');
  return sheet;
}
function rewardFromRow_(r){
  const visibleCell = r[5] === '' || r[5] == null || r[5] === true || String(r[5]).toLowerCase() === 'true';
  const status = REWARD_STATUSES_.indexOf(String(r[7])) !== -1 ? String(r[7]) : (visibleCell ? 'available' : 'unavailable');
  const published = !(r[8] === false || String(r[8]).toLowerCase() === 'false');
  return { id: String(r[0]), title: String(r[1] || ''), points: Number(r[2]) || 0, imageUrl: String(r[3] || ''),
    status: status, visible: status !== 'unavailable', published: published, createdAt: Number(r[6]) || 0 };
}
// Hadiah disusun ikut points (paling murah dahulu), macam katalog Setel.
// Pelanggan: dipaparkan & sudah publish sahaja. Admin: semua termasuk Draf.
function getRewards_(includeHidden){
  return rewardsSheet_().getDataRange().getValues().slice(1)
    .filter(r => r[0])
    .map(rewardFromRow_)
    .filter(x => includeHidden || (x.visible && x.published))
    .sort((a, b) => a.points - b.points || a.createdAt - b.createdAt);
}

function saveRewardImage_(base64Data, mimeType, id){
  if(String(mimeType || '').toLowerCase() !== 'image/webp') return { error:'JENIS_FAIL_TIDAK_DISOKONG' };
  const b64 = String(base64Data || '').replace(/^data:[^;]+;base64,/, '');
  if(!b64 || b64.length > 7 * 1024 * 1024) return { error:'SAIZ_GAMBAR_MELEBIHI_5MB' };
  const bytes = Utilities.base64Decode(b64);
  if(bytes.length > 5 * 1024 * 1024) return { error:'SAIZ_GAMBAR_MELEBIHI_5MB' };
  const folderName = 'KfeDeSOL_Rewards';
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const file = folder.createFile(Utilities.newBlob(bytes, 'image/webp', id + '-' + Date.now() + '.webp'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: 'https://drive.google.com/uc?export=view&id=' + file.getId(), fileId: file.getId() };
}

// Tambah hadiah baru (tiada id) atau kemas kini (ada id). Gambar pilihan semasa edit.
function saveReward_(body){
  const title = String(body.title || '').trim().slice(0, 60);
  const points = Math.floor(Number(body.points));
  const status = REWARD_STATUSES_.indexOf(String(body.status)) !== -1 ? String(body.status)
    : body.visible === false ? 'unavailable' : body.visible === true ? 'available' : '';
  if(!title) return { error:'TITLE_EMPTY' };
  if(!(points >= 1 && points <= 100000)) return { error:'INVALID_POINTS' };
  const sheet = rewardsSheet_();
  const isNew = !body.id;
  const id = isNew ? 'r_' + Utilities.getUuid().slice(0, 8) : String(body.id);
  let row = isNew ? -1 : findRow_(sheet, 0, id);
  if(!isNew && row === -1) return { error:'REWARD_NOT_FOUND' };
  let image = null;
  if(body.base64){
    image = saveRewardImage_(body.base64, body.mimeType, id);
    if(image.error) return image;
  }
  // v3.16.0: published dihantar = tukar; tidak dihantar = kekal (hadiah baru = sudah publish)
  const hasPub = typeof body.published === 'boolean';
  if(isNew){
    row = sheet.getLastRow() + 1;
    const st = status || 'available';
    sheet.getRange(row, 1, 1, 9).setValues([[id, title, points, image ? image.url : '', image ? image.fileId : '', st !== 'unavailable', Date.now(), st, hasPub ? body.published : true]]);
  } else {
    const cur = sheet.getRange(row, 1, 1, 9).getValues()[0];
    if(image && cur[4]){ try{ DriveApp.getFileById(String(cur[4])).setTrashed(true); }catch(e){} }
    const st = status || rewardFromRow_(cur).status;
    const pub = hasPub ? body.published : rewardFromRow_(cur).published;
    sheet.getRange(row, 2, 1, 8).setValues([[title, points, image ? image.url : cur[3], image ? image.fileId : cur[4], st !== 'unavailable', cur[6], st, pub]]);
  }
  return { ok:true, reward: rewardFromRow_(sheet.getRange(row, 1, 1, 9).getValues()[0]) };
}

function deleteReward_(id){
  const sheet = rewardsSheet_();
  const row = findRow_(sheet, 0, id);
  if(row === -1) return { error:'REWARD_NOT_FOUND' };
  const fileId = String(sheet.getRange(row, 5).getValue() || '');
  if(fileId){ try{ DriveApp.getFileById(fileId).setTrashed(true); }catch(e){} }
  sheet.deleteRow(row);
  return { ok:true, id:String(id) };
}

// Admin tebus hadiah untuk pelanggan di kaunter: tolak points (tidak boleh jadi negatif).
// Caller must hold the script lock.
function redeemReward_(body){
  const key = phoneKey_(body.phone);
  if(!/^\d{9,15}$/.test(key)) return { ok:false, error:'NO_CUSTOMER' };
  const rRow = findRow_(rewardsSheet_(), 0, body.rewardId);
  if(rRow === -1) return { ok:false, error:'REWARD_NOT_FOUND' };
  const reward = rewardFromRow_(rewardsSheet_().getRange(rRow, 1, 1, 9).getValues()[0]);
  if(reward.status !== 'available') return { ok:false, error:'REWARD_NOT_AVAILABLE', status:reward.status };
  if(!reward.published) return { ok:false, error:'REWARD_DRAFT' }; // v3.16.0: Draf belum boleh ditebus
  const sheet = allCustomersSheet_();
  const rows = findRowsByColumn_(sheet, 1, key);
  if(!rows.length) return { ok:false, error:'NO_CUSTOMER' };
  const cur = sheet.getRange(rows[0], 1, 1, 8).getValues()[0];
  const have = Number(cur[6]) || 0;
  if(have < reward.points) return { ok:false, error:'NOT_ENOUGH_POINTS', points:have };
  const balance = have - reward.points;
  sheet.getRange(rows[0], 7).setValue(balance);
  const aRow = findRow_(adminsSheet_(), 0, body.adminId);
  const by = aRow === -1 ? '' : String(adminsSheet_().getRange(aRow, 2).getValue());
  logPoints_(key, cur[1], -reward.points, balance, 'Tebus: ' + reward.title, reward.id, by);
  return { ok:true, points:balance, reward:reward };
}
function metaSheet_(){ return getSheet_('Meta', ['key','value']); }
function menuMetaSheet_(){
  const required = ['id','desc','imageUrl','name','price','published','updatedAt','category','temp','custom','deleted'];
  const sheet = getSheet_('MenuMeta', required);
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  required.forEach(header => {
    if(current.indexOf(header) === -1){
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      current.push(header);
    }
  });
  return sheet;
}
function promotionsSheet_(){
  const sheet = getSheet_('Promotions', ['id','url','fileId','createdAt','visible','type']);
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
  if(headers.indexOf('visible') === -1){ sheet.getRange(1, sheet.getLastColumn() + 1).setValue('visible'); headers.push('visible'); }
  // v3.7.0: jenis gambar hebahan: 'promo' (Promosi) atau 'notice' (Pemberitahuan / Ucapan)
  if(headers.indexOf('type') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('type');
  return sheet;
}
function promotionTypeColumn_(sheet){
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String).indexOf('type') + 1;
}
const PROMOTION_TYPES_ = ['promo', 'notice'];

function getPromotions_(includeHidden){
  const sheet = promotionsSheet_();
  const data = sheet.getDataRange().getValues();
  const typeIdx = promotionTypeColumn_(sheet) - 1;
  const promotions = [];
  for(let i = 1; i < data.length; i++){
    if(!data[i][0] || !data[i][1]) continue;
    const visible = data[i][4] === '' || data[i][4] == null || data[i][4] === true || String(data[i][4]).toLowerCase() === 'true';
    if(!includeHidden && !visible) continue;
    const type = PROMOTION_TYPES_.indexOf(String(data[i][typeIdx])) !== -1 ? String(data[i][typeIdx]) : 'promo';
    promotions.push({ id:String(data[i][0]), url:String(data[i][1]), createdAt:Number(data[i][3]) || 0, visible, type });
  }
  return promotions;
}

function setPromotionType_(id, type){
  if(PROMOTION_TYPES_.indexOf(type) === -1) return { error:'INVALID_TYPE' };
  const sheet = promotionsSheet_();
  const row = findRow_(sheet, 0, id);
  if(row === -1) return { error:'PROMOTION_NOT_FOUND' };
  sheet.getRange(row, promotionTypeColumn_(sheet)).setValue(type);
  return { ok:true, id:String(id), type:type };
}

function setPromotionVisible_(id, visible){
  const sheet = promotionsSheet_();
  const row = findRow_(sheet, 0, id);
  if(row === -1) return { error:'PROMOTION_NOT_FOUND' };
  sheet.getRange(row, 5).setValue(!!visible);
  return { ok:true, id:String(id), visible:!!visible };
}

function deletePromotion_(id){
  const sheet = promotionsSheet_();
  const row = findRow_(sheet, 0, id);
  if(row === -1) return { error:'PROMOTION_NOT_FOUND' };
  const fileId = String(sheet.getRange(row, 3).getValue() || '');
  if(fileId){
    try{ DriveApp.getFileById(fileId).setTrashed(true); }
    catch(e){ return { error:'PROMOTION_FILE_DELETE_FAILED: ' + String(e) }; }
  }
  sheet.deleteRow(row);
  return { ok:true, id:String(id) };
}

function savePromotionImage_(base64Data, mimeType, originalName, type){
  try{
    const allowedTypes = { 'image/webp':'webp' };
    const extension = allowedTypes[String(mimeType || '').toLowerCase()];
    if(!extension) return { error:'JENIS_FAIL_TIDAK_DISOKONG' };
    const b64 = String(base64Data || '').replace(/^data:[^;]+;base64,/, '');
    if(!b64 || b64.length > 7 * 1024 * 1024) return { error:'SAIZ_GAMBAR_MELEBIHI_5MB' };
    const bytes = Utilities.base64Decode(b64);
    if(bytes.length > 5 * 1024 * 1024) return { error:'SAIZ_GAMBAR_MELEBIHI_5MB' };

    const folderName = 'KfeDeSOL_Promotions';
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    const id = Utilities.getUuid();
    const safeName = String(originalName || 'promosi').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const blob = Utilities.newBlob(bytes, mimeType, id + '-' + safeName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    const kind = PROMOTION_TYPES_.indexOf(type) !== -1 ? type : 'promo';
    const sheet = promotionsSheet_();
    sheet.appendRow([id, url, file.getId(), Date.now(), true]);
    sheet.getRange(sheet.getLastRow(), promotionTypeColumn_(sheet)).setValue(kind);
    return { ok:true, promotion:{ id, url, createdAt:Date.now(), visible:true, type:kind } };
  }catch(e){ return { error:String(e) }; }
}

function menuMetaColumns_(sheet){
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const out = {};
  headers.forEach((header, index) => { out[header] = index + 1; });
  return out;
}

function jsonOut_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function orderFromRow_(r){
  // A hand-edited or damaged items cell must not break the whole orders list.
  let items = [];
  try{ items = JSON.parse(r[2] || '[]'); }catch(e){ items = []; }
  return {
    id: r[0], queueNo: Number(r[1]),
    items: Array.isArray(items) ? items : [],
    total: Number(r[3]), status: r[4],
    createdAt: Number(r[5]), customerName: r[6], customerPhone: r[7],
    loyalty: String(r[8] || '')
  };
}

function upsertCustomer_(phone, name, deltaCount, deltaQty){
  const sheet = customersSheet_();
  const row = findRow_(sheet, 0, phone);
  if(row === -1){
    const newRow = sheet.getLastRow() + 1;
    setTextCell_(sheet, newRow, 1, phone);
    sheet.getRange(newRow, 2, 1, 3).setValues([[name, deltaCount || 0, deltaQty || 0]]);
  } else {
    const curCount = Number(sheet.getRange(row, 3).getValue()) || 0;
    const curQty = Number(sheet.getRange(row, 4).getValue()) || 0;
    setTextCell_(sheet, row, 1, phone);
    sheet.getRange(row, 2).setValue(name);
    sheet.getRange(row, 3).setValue(curCount + (deltaCount || 0));
    sheet.getRange(row, 4).setValue(curQty + (deltaQty || 0));
  }
}

// Set an order's status and, when it becomes 'selesai', credit the customer's
// loyalty from the order stored in the sheet (never from client input).
// Caller must hold the script lock.
function setOrderStatus_(sheet, row, status){
  const r = sheet.getRange(row, 1, 1, 9).getValues()[0];
  const prev = String(r[4]).split('|')[0];
  const base = String(status).split('|')[0];
  sheet.getRange(row, 5).setValue(status);
  // Push hanya bila status betul-betul berubah (tekan Siap dua kali = satu notifikasi)
  if(base !== prev) queueOrderPush_(r, base, status);
  if(base !== 'selesai') return;
  if(String(r[8]) !== 'pending' || !r[7]) return;
  let qty = 0;
  try{ JSON.parse(r[2] || '[]').forEach(item => { qty += Number(item.qty) || 0; }); }catch(e){}
  upsertCustomer_(String(r[7]), String(r[6] || ''), 1, qty);
  sheet.getRange(row, 9).setValue('counted');
  // v3.10.0: points hanya masuk di sini, iaitu bila order sudah dibayar (Selesai)
  const addPoints = pointsOn_() ? qty * pointsPerCup_() : 0; // v3.16.0: 0 bila tidak aktif
  const balance = upsertAllCustomer_(String(r[7]), String(r[6] || ''), { addOrders: 1, addCups: qty, addPoints: addPoints });
  if(addPoints && balance !== null) logPoints_(String(r[7]), String(r[6] || ''), addPoints, balance, qty + ' cawan (No. ' + pushQueueNo_(r[1]) + ')', r[0], '');
  queueLoyaltyPush_(String(r[7]), qty, addPoints, balance);
  creditReferral_(String(r[7]), String(r[6] || ''), r[0]);
}

// Row numbers (1-based) whose cell in column `col` (1-based) equals `value`.
// TextFinder searches inside Sheets, so we never download the whole sheet.
function findRowsByColumn_(sheet, col, value){
  const last = sheet.getLastRow();
  if(last < 2 || value === '' || value == null) return [];
  return sheet.getRange(2, col, last - 1, 1)
    .createTextFinder(String(value)).matchEntireCell(true).findAll()
    .map(cell => cell.getRow());
}

function readOrderRows_(rows){
  const sheet = ordersSheet_();
  if(!rows.length) return [];
  // A few lookups are cheaper than a full read; many are not.
  if(rows.length > 5){
    const data = sheet.getDataRange().getValues();
    return rows.map(row => data[row - 1]).filter(r => r && r[0]).map(orderFromRow_);
  }
  return rows.map(row => sheet.getRange(row, 1, 1, 9).getValues()[0])
    .filter(r => r[0]).map(orderFromRow_);
}

function getMyOrders_(params){
  const sheet = ordersSheet_();
  let rows = [];
  if(params.ids){
    String(params.ids).split(',').map(s => s.trim()).filter(Boolean).slice(0, 20)
      .forEach(id => { rows = rows.concat(findRowsByColumn_(sheet, 1, id)); });
  } else if(params.phone){
    rows = findRowsByColumn_(sheet, 8, String(params.phone).trim());
  }
  rows = rows.filter((row, index) => rows.indexOf(row) === index).sort((a, b) => a - b);
  return readOrderRows_(rows);
}

// Settings for the queue display, saved by the admin panel through setMeta.
function getDisplaySettings_(){
  let s = {};
  try{ s = JSON.parse(getMeta_('display-settings', '{}') || '{}') || {}; }catch(e){ s = {}; }
  return {
    enabled: s.enabled === true,
    source: ['own', 'youtube', 'web', 'none'].indexOf(s.source) !== -1 ? s.source : 'own',
    youtube: String(s.youtube || '').slice(0, 300),
    // Only https links are passed on to the screen.
    web: /^https:\/\//i.test(String(s.web || '')) ? String(s.web).slice(0, 500) : ''
  };
}

function getQueueBoard_(){
  const settings = getDisplaySettings_();
  if(!settings.enabled) return { enabled:false, settings:settings, orders:[] };
  // Active orders from the last 12 hours. A calendar-day rule dropped an
  // order placed before midnight the moment the date changed, while a shop
  // open past midnight was still making it. Twelve hours also clears anything
  // left unfinished from the day before.
  const since = Date.now() - 12 * 60 * 60 * 1000;
  const data = ordersSheet_().getDataRange().getValues();
  const orders = [];
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(!r[0]) continue;
    const status = String(r[4]).split('|')[0];
    if(status !== 'pending' && status !== 'sedang_dibuat' && status !== 'siap') continue;
    if((Number(r[5]) || 0) < since) continue;
    orders.push({ queueNo: Number(r[1]) || 0, status: status });
  }
  return { enabled:true, settings:settings, orders:orders };
}

function getMyLoyalty_(phone){
  const sheet = customersSheet_();
  const rows = findRowsByColumn_(sheet, 1, String(phone || '').trim());
  if(!rows.length) return null;
  return loyaltyFromRow_(sheet.getRange(rows[0], 1, 1, 5).getValues()[0]);
}

function findRow_(sheet, colIndex, value){
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][colIndex]) === String(value)) return i + 1;
  }
  return -1;
}

function setTextCell_(sheet, row, col, value){
  const cell = sheet.getRange(row, col);
  cell.setNumberFormat('@');
  cell.setValue(String(value));
}

function normalizeMonthValue_(val){
  if(typeof val === 'string' && /^\d{4}-\d{2}$/.test(val)) return val;
  const d = (val instanceof Date) ? val : new Date(val);
  if(!isNaN(d.getTime())){
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  return val;
}

function getMeta_(key, defVal){
  const sheet = metaSheet_();
  const row = findRow_(sheet, 0, key);
  if(row === -1) return defVal;
  const val = sheet.getRange(row, 2).getValue();
  if(key === 'current-month') return normalizeMonthValue_(val);
  return String(val);
}
/* ---------- operating hours (same rules as index.html) ----------
   Regular hours are set by the admin and kept in meta 'shop-hours': an array
   of 7 entries, index 0 = Sunday ... 6 = Saturday, each {open, close, closed}.
   Until the admin saves any, the defaults below apply (Friday 15:00-18:00,
   other days 11:00-18:00). Malaysia time throughout.
   'shop-status' meta holds {holidays:[{from,until}], extraHours:[{date,from,until}]};
   a holiday overrides everything, an extra-hours slot opens the shop outside
   regular hours (until <= from means it runs past midnight).
   The hours live in their own meta key so that an older app version saving
   holidays or extra hours can never wipe them. */
const SHOP_TZ_ = 'Asia/Kuala_Lumpur';

function defaultShopHours_(){
  const hours = [];
  for(let day = 0; day < 7; day++) hours.push({ open: day === 5 ? '15:00' : '11:00', close: '18:00', closed: false });
  return hours;
}

// Returns a clean 7-day list; anything malformed falls back to the default
// for that day, so a damaged setting can never lock the shop shut.
function normalizeShopHours_(raw){
  const defaults = defaultShopHours_();
  if(!Array.isArray(raw) || raw.length !== 7) return defaults;
  const isTime = function(v){ return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)); };
  return raw.map(function(d, i){
    if(!d || !isTime(d.open) || !isTime(d.close) || d.open === d.close) return defaults[i];
    return { open: String(d.open), close: String(d.close), closed: d.closed === true };
  });
}

function getShopHours_(){
  let raw = null;
  try{ raw = JSON.parse(getMeta_('shop-hours', 'null') || 'null'); }catch(e){ raw = null; }
  return normalizeShopHours_(raw);
}

// Regular hours only. A day whose closing time is not after its opening time
// runs past midnight, so the early hours belong to the previous day.
function regularHoursOpen_(hours, day, time){
  const today = hours[day];
  if(!today.closed){
    if(today.close > today.open){ if(time >= today.open && time < today.close) return true; }
    else if(time >= today.open) return true;
  }
  const yesterday = hours[(day + 6) % 7];
  return !yesterday.closed && yesterday.close <= yesterday.open && time < yesterday.close;
}

function shopScheduleOpenAt_(status, when){
  const date = Utilities.formatDate(when, SHOP_TZ_, 'yyyy-MM-dd');
  const time = Utilities.formatDate(when, SHOP_TZ_, 'HH:mm');
  // 'u' is 1 = Monday ... 7 = Sunday; the hours list starts at Sunday = 0.
  const day = Number(Utilities.formatDate(when, SHOP_TZ_, 'u')) % 7;
  const holidays = Array.isArray(status.holidays) ? status.holidays
    : (status.from && status.until ? [{from:status.from, until:status.until}] : []);
  if(holidays.some(function(h){ return date >= h.from && date <= h.until; })) return false;
  if(regularHoursOpen_(normalizeShopHours_(status.hours), day, time)) return true;
  return (Array.isArray(status.extraHours) ? status.extraHours : []).some(function(s){
    if(!s || !s.date || !s.from || !s.until) return false;
    if(s.until > s.from) return date === s.date && time >= s.from && time < s.until;
    return (date === s.date && time >= s.from) || (date === nextDayOf_(s.date) && time < s.until);
  });
}

function nextDayOf_(date){
  return Utilities.formatDate(new Date(Date.parse(date + 'T00:00:00Z') + 86400000), 'UTC', 'yyyy-MM-dd');
}

function shopOpenNow_(){
  const raw = getMeta_('shop-status', null);
  if(raw === 'closed') return false;
  let status = {};
  try{ status = raw ? JSON.parse(raw) : {}; }catch(e){ status = {}; }
  if(!status || typeof status !== 'object') status = {};
  status.hours = getShopHours_();
  const now = new Date();
  // 2-minute grace: a customer who pressed Hantar at 17:59 should not be
  // rejected just because Apps Script answered a little after 18:00.
  return shopScheduleOpenAt_(status, now) || shopScheduleOpenAt_(status, new Date(now.getTime() - 120000));
}

function setMeta_(key, value){
  const sheet = metaSheet_();
  const row = findRow_(sheet, 0, key);
  let r;
  if(row === -1){
    sheet.appendRow([key, '']);
    r = sheet.getLastRow();
  } else {
    r = row;
  }
  const cell = sheet.getRange(r, 2);
  if(key === 'current-month') cell.setNumberFormat('@');
  cell.setValue(value);
}

/* ---------- v3.13.0: AuditLog — setiap tindakan admin ----------
   Masa, nama admin, action & ringkasan (tanpa token, kata laluan atau gambar).
   Tidak pernah gagalkan request. */
const AUDIT_SKIP_ = ['adminPushTest'];
const AUDIT_HIDE_ = ['action','adminId','authToken','password','base64','subscription','endpoint'];
function auditLog_(body){
  try{
    const sheet = getSheet_('AuditLog', ['masa','admin','action','butiran']);
    const row = findRow_(adminsSheet_(), 0, body.adminId);
    const who = row === -1 ? String(body.adminId || '') : String(adminsSheet_().getRange(row, 2).getValue());
    const detail = {};
    Object.keys(body).forEach(k => { if(AUDIT_HIDE_.indexOf(k) === -1) detail[k] = body[k]; });
    sheet.appendRow([shopTimeStr_(), who, String(body.action), JSON.stringify(detail).slice(0, 300)]);
  }catch(err){ console.error('AuditLog gagal: ' + err); }
}

/* ---------- v3.13.0: kata laluan admin di-hash ----------
   Disimpan 'h1$<salt>$<hash>' (SHA-256 berulang). Kata laluan lama (teks biasa)
   masih diterima sekali dan terus ditukar kepada hash bila admin log masuk. */
const PASSWORD_ROUNDS_ = 300;
function hashPassword_(password, salt){
  salt = salt || Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  let bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + String(password), Utilities.Charset.UTF_8);
  for(let i = 1; i < PASSWORD_ROUNDS_; i++){
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.base64Encode(bytes) + salt, Utilities.Charset.UTF_8);
  }
  return 'h1$' + salt + '$' + Utilities.base64Encode(bytes);
}
function passwordMatches_(stored, password){
  stored = String(stored || '');
  if(stored.indexOf('h1$') !== 0) return stored !== '' && stored === String(password);
  const salt = stored.split('$')[1];
  return hashPassword_(password, salt) === stored;
}
// Minimum 8 aksara, ada huruf & nombor (sama dengan app)
function strongPassword_(pw){
  pw = String(pw || '');
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

// Jalankan SEKALI dari editor bila pasang untuk kedai baru (sheet Admins kosong).
// Kata laluan rawak dipaparkan dalam Execution log; tukar selepas log masuk.
function buatAdminPertama(){
  const sheet = adminsSheet_();
  if(sheet.getLastRow() > 1){ Logger.log('✗ Sudah ada admin. Tiada apa diubah.'); return; }
  const password = Utilities.getUuid().replace(/-/g, '').slice(0, 10) + '7a';
  sheet.appendRow(['a_' + Date.now(), 'Admin', 'admin', '']);
  setTextCell_(sheet, sheet.getLastRow(), 4, hashPassword_(password));
  Logger.log('✓ Admin pertama dicipta. ID: admin · Kata laluan: ' + password + ' — tukar selepas log masuk.');
}

/* ================= Admin session security ================= */
const ADMIN_SESSION_TTL_MS_ = 7 * 24 * 60 * 60 * 1000;
function adminSessionKey_(token){ return 'admin-session-token-' + String(token); }

function findAdminByLogin_(username, password){
  const sheet = adminsSheet_();
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(String(r[2]) !== String(username) || !passwordMatches_(r[3], password)) continue;
    // Kata laluan lama (teks biasa) terus ditukar kepada hash
    if(String(r[3]).indexOf('h1$') !== 0) setTextCell_(sheet, i + 1, 4, hashPassword_(password));
    return { id:String(r[0]), name:String(r[1]), username:String(r[2]) };
  }
  return null;
}

function validAdminSession_(adminId, token){
  if(!adminId || !token) return false;
  const props = PropertiesService.getScriptProperties();
  const key = adminSessionKey_(token);
  const raw = props.getProperty(key);
  if(!raw) return false;
  try{
    const session = JSON.parse(raw);
    if(String(session.adminId) !== String(adminId) || Number(session.expiresAt) <= Date.now()){
      props.deleteProperty(key);
      return false;
    }
    // Renew only near expiry, avoiding a Script Properties write on every
    // three-second client health check.
    if(Number(session.expiresAt) - Date.now() < 24 * 60 * 60 * 1000){
      session.expiresAt = Date.now() + ADMIN_SESSION_TTL_MS_;
      props.setProperty(key, JSON.stringify(session));
    }
    return true;
  }catch(e){
    props.deleteProperty(key);
    return false;
  }
}

// Sessions that were never logged out (closed browser, cleared data) stay in
// Script Properties forever. The store is capped (~500KB), so drop expired
// ones whenever someone logs in, before the cap can block new logins.
function purgeExpiredAdminSessions_(){
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = Date.now();
  Object.keys(all).forEach(key => {
    if(key.indexOf('admin-session-token-') !== 0) return;
    let expiresAt = 0;
    try{ expiresAt = Number(JSON.parse(all[key]).expiresAt) || 0; }catch(e){}
    if(expiresAt <= now) props.deleteProperty(key);
  });
}

function sessionFrom_(source){
  source = source || {};
  return validAdminSession_(source.adminId, source.authToken);
}

/* ================= MenuMeta helpers ================= */
function getMenuMeta_(withCategories){
  try{
    const sheet = menuMetaSheet_();
    const rows = sheet.getDataRange().getValues();
    const cols = menuMetaColumns_(sheet);
    const items = [];
    for(let i = 1; i < rows.length; i++){
      const id = rows[i][cols.id - 1];
      if(id) items.push({
        id: String(id),
        desc: String(rows[i][cols.desc - 1] || ''),
        imageUrl: String(rows[i][cols.imageUrl - 1] || ''),
        name: String(rows[i][cols.name - 1] || ''),
        price: rows[i][cols.price - 1],
        published: rows[i][cols.published - 1] === '' ? true : rows[i][cols.published - 1],
        // v3.15.0
        category: String(rows[i][cols.category - 1] || ''),
        temp: truthy_(rows[i][cols.temp - 1]),
        custom: truthy_(rows[i][cols.custom - 1]),
        deleted: truthy_(rows[i][cols.deleted - 1])
      });
    }
    return withCategories ? { items: items, categories: getMenuCategories_() } : { items: items };
  }catch(e){ return { error: String(e) }; }
}

function saveMenuMeta_(id, desc, imageUrl, name, price, published){
  try{
    const sheet = menuMetaSheet_();
    const cols = menuMetaColumns_(sheet);
    const row = findRow_(sheet, cols.id - 1, id);
    let targetRow = row;
    if(row === -1){
      sheet.appendRow([]);
      targetRow = sheet.getLastRow();
      sheet.getRange(targetRow, cols.id).setValue(id);
    }
    if(desc !== null && desc !== undefined) sheet.getRange(targetRow, cols.desc).setValue(desc);
    if(imageUrl) sheet.getRange(targetRow, cols.imageUrl).setValue(imageUrl);
    if(name !== null && name !== undefined) sheet.getRange(targetRow, cols.name).setValue(name);
    if(price !== null && price !== undefined && price !== '') sheet.getRange(targetRow, cols.price).setValue(price);
    if(published !== null && published !== undefined) sheet.getRange(targetRow, cols.published).setValue(Boolean(published));
    sheet.getRange(targetRow, cols.updatedAt).setValue(new Date().toISOString());
    return { ok: true };
  }catch(e){ return { error: String(e) }; }
}

function saveMenuImage_(id, base64Data, mimeType){
  try{
    const folderName = 'KfeDeSOL_MenuImages';
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if(folders.hasNext()){
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    // Delete old file if exists
    const existing = folder.getFilesByName(id + '.png');
    while(existing.hasNext()) existing.next().setTrashed(true);

    // Decode base64 (strip data URL prefix)
    const b64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), mimeType || 'image/png', id + '.png');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const imageUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();

    // Also save URL to MenuMeta sheet
    saveMenuMeta_(id, null, imageUrl);

    return { ok: true, imageUrl };
  }catch(e){ return { error: String(e) }; }
}

/* ================= GET ================= */
// Like doPost, answer errors as JSON; an uncaught error used to return an
// HTML page that the app could not read, so it silently kept stale data.
function doGet(e){
  try{ return doGet_(e); }
  catch(err){ console.error('doGet ' + ((e && e.parameter && e.parameter.action) || '') + ': ' + (err.stack || err)); return jsonOut_({ error: 'SERVER_ERROR' }); }
}

function doGet_(e){
  const action = e.parameter.action;

  if(action === 'version'){
    return jsonOut_({ version: 'v3.16.0-secure' });
  }

  // v3.12.0: ringkasan kewangan setiap bulan (admin)
  if(action === 'kewangan'){
    if(!sessionFrom_(e.parameter)) return jsonOut_({ error:'SESSION_INVALID' });
    return jsonOut_(getKewangan_());
  }

  // v3.15.0: graf Jualan vs Cawan ikut Hari / Bulan / Tahun
  if(action === 'salesChart'){
    if(!sessionFrom_(e.parameter)) return jsonOut_({ error:'SESSION_INVALID' });
    return jsonOut_(salesChart_(e.parameter.mode, e.parameter.key));
  }

  // v3.11.0: tetapan notifikasi automatik + siapa dapat hari ini (admin)
  if(action === 'autoPush'){
    if(!sessionFrom_(e.parameter)) return jsonOut_({ error:'SESSION_INVALID' });
    let today = null;
    try{
      const plan = autoPushPlan_(shopTodayStr_());
      today = { shopOpen: plan.shopOpen, skipped: plan.skipped, remind: plan.remind.length,
        birthday: plan.birthday.map(p => p.name), sent: plan.sent };
    }catch(err){ today = { error: String(err.message || err).slice(0, 120) }; }
    let last = null;
    try{ last = JSON.parse(PropertiesService.getScriptProperties().getProperty(AUTO_PUSH_LAST_PROP_) || 'null'); }catch(err){}
    return jsonOut_({ settings: getAutoPush_(), trigger: autoPushTriggerInstalled_(), last: last, today: today, pushKey: !!pushKey_() });
  }

  // Admin: senarai kekal semua pelanggan + no. telefon yang sudah hidupkan notifikasi
  if(action === 'allCustomers'){
    if(!sessionFrom_(e.parameter)) return jsonOut_({ error:'SESSION_INVALID' });
    let pushPhones = null;
    try{ pushPhones = pushPhones_(); }catch(err){ pushPhones = null; }
    return jsonOut_({ customers: getAllCustomers_(), pushPhones: pushPhones });
  }

  // Public queue display (skrin.html). The screen stands where anyone can see
  // it, so this returns queue numbers and statuses only: no names, phones,
  // items or totals. When the feature is switched off it returns no orders.
  if(action === 'queueBoard'){
    return jsonOut_(getQueueBoard_());
  }

  // Customer: only the orders they ask for by id, or by their own phone.
  if(action === 'myOrders'){
    return jsonOut_({ orders:getMyOrders_(e.parameter) });
  }

  // Customer: only their own loyalty row (+ v3.10.0 points & referral code).
  if(action === 'myLoyalty'){
    let points = null;
    try{ points = getMyPoints_(e.parameter.phone, e.parameter.name); }catch(err){ console.error('myPoints gagal: ' + err); }
    return jsonOut_({ customer:getMyLoyalty_(e.parameter.phone), points:points });
  }

  // v3.10.2: Masuk dengan no. telefon sahaja — semak sama ada sudah berdaftar
  if(action === 'customerLookup'){
    if(!rateOk_('lookup-all', 300, 600)) return jsonOut_({ error:'BUSY' });
    return jsonOut_(customerLookup_(e.parameter.phone));
  }

  // v3.10.0: katalog hadiah. Pelanggan nampak yang dipaparkan sahaja; admin nampak semua.
  if(action === 'rewards'){
    return jsonOut_({ rewards:getRewards_(!!sessionFrom_(e.parameter)), perCup:pointsPerCup_(), refRm:referralRm_(), refMax:referralMax_(),
      pointsOn:pointsOn_(), refOn:referralOn_() });
  }

  if(action === 'orders'){
    if(!sessionFrom_(e.parameter)) return jsonOut_({ error:'SESSION_INVALID' });
    const sheet = ordersSheet_();
    const data = sheet.getDataRange().getValues();
    const orders = [];
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[0]) continue;
      orders.push(orderFromRow_(r));
    }
    return jsonOut_({ orders });
  }

  if(action === 'customers'){
    if(!sessionFrom_(e.parameter)) return jsonOut_({ error:'SESSION_INVALID' });
    const sheet = customersSheet_();
    const data = sheet.getDataRange().getValues();
    const customers = {};
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[0]) continue;
      customers[r[0]] = loyaltyFromRow_(r);
    }
    return jsonOut_({ customers, currentMonth: getMeta_('current-month', '') });
  }

  if(action === 'promotions'){
    return jsonOut_({ promotions:getPromotions_(!!sessionFrom_(e.parameter)) });
  }

  if(action === 'admins'){
    if(!sessionFrom_(e.parameter)) return jsonOut_({ error:'SESSION_INVALID' });
    // v3.13.0: kata laluan tidak pernah dihantar ke browser
    const data = adminsSheet_().getDataRange().getValues();
    const admins = [];
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[0]) continue;
      admins.push({ id: r[0], name: r[1], username: String(r[2]) });
    }
    return jsonOut_({ admins });
  }

  if(action === 'adminSession'){
    return jsonOut_({ valid:sessionFrom_(e.parameter) });
  }

  if(action === 'meta'){
    const value = getMeta_(e.parameter.key, null);
    if(e.parameter.key === 'shop-status'){
      // The app checks the schedule once a minute; the regular hours ride
      // along in the same answer so it does not need a second request.
      let status = {};
      try{ status = value ? JSON.parse(value) : {}; }catch(err){ return jsonOut_({ value: value, hours: getShopHours_() }); }
      if(!status || typeof status !== 'object' || Array.isArray(status)) status = {};
      status.hours = getShopHours_();
      return jsonOut_({ value: JSON.stringify(status) });
    }
    return jsonOut_({ value: value });
  }

  // ★ NEW: load menu descriptions + image URLs
  if(action === 'menuMeta'){
    return jsonOut_(getMenuMeta_(true));
  }

  return jsonOut_({ error: 'unknown action' });
}

/* ================= POST ================= */
function doPost(e){
  try{ return doPost_(e); }
  catch(err){ console.error('doPost: ' + (err.stack || err)); return jsonOut_({ error: 'SERVER_ERROR' }); }
  // Notifikasi dihantar selepas kunci (lock) dilepaskan, supaya order lain tidak tertunggu
  finally{ flushPush_(); }
}

function doPost_(e){
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if(action === 'adminLogin'){
    // v3.13.0: 5 kali salah = dikunci 15 minit (bagi setiap ID), 30 kali salah semua dalam 15 minit
    const who = 'login-' + String(body.username || '').toLowerCase().slice(0, 40);
    if(rateCount_(who) >= 5 || rateCount_('login-all') >= 30) return jsonOut_({ ok:false, error:'LOGIN_LOCKED' });
    const admin = findAdminByLogin_(body.username, body.password);
    if(!admin){
      rateOk_(who, 5, 900);
      rateOk_('login-all', 30, 900);
      return jsonOut_({ ok:false, error:'LOGIN_FAILED' });
    }
    rateClear_(who);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{
      try{ purgeExpiredAdminSessions_(); }catch(err){} // housekeeping must never block a login
      const token = Utilities.getUuid() + '-' + Utilities.getUuid();
      PropertiesService.getScriptProperties().setProperty(adminSessionKey_(token), JSON.stringify({
        adminId: admin.id,
        expiresAt: Date.now() + ADMIN_SESSION_TTL_MS_
      }));
      return jsonOut_({ ok:true, admin:admin, token:token });
    } finally { lock.releaseLock(); }
  }

  if(action === 'adminLogout'){
    if(sessionFrom_(body)){
      PropertiesService.getScriptProperties().deleteProperty(adminSessionKey_(body.authToken));
    }
    return jsonOut_({ ok:true });
  }

  const adminOnlyActions = [
    'updateOrderStatus','bulkUpdateStatus','resetOrders','upsertCustomer','setCustomerCount',
    'redeemFreeDrinks','addAdmin','updateAdmin','deleteAdmin',
    'setMeta','repairMeta','saveMenuMeta','saveMenuImage','savePromotionImage','setPromotionVisible','deletePromotion',
    'sendPromoPush','sendCustomerPush','setPromotionType',
    'adminPushSubscribe','adminPushUnsubscribe','adminPushTest',
    'saveReward','deleteReward','redeemReward','useBalance','redeemBirthday','saveAutoPush',
    'archiveCustomers',
    'saveMenuCategory','deleteMenuCategory','addMenuItem','deleteMenuItem'
  ];
  if(adminOnlyActions.indexOf(action) !== -1 && !sessionFrom_(body)){
    return jsonOut_({ error:'SESSION_INVALID' });
  }
  if(adminOnlyActions.indexOf(action) !== -1 && AUDIT_SKIP_.indexOf(action) === -1) auditLog_(body);

  if(action === 'addOrder'){
    if(!shopOpenNow_()) return jsonOut_({ error:'SHOP_CLOSED' });
    const o = body.order;
    // Loyalty is credited from these items, so reject anything the app itself
    // could never send (no items, silly quantities, missing id).
    const items = o && Array.isArray(o.items) ? o.items : [];
    // v3.13.0: harga daripada telefon tidak lagi digunakan, jadi tidak disemak
    const itemsValid = items.length > 0 && items.length <= 30 && items.every(i =>
      i && (String(i.id || '').trim() || String(i.name || '').trim()) &&
      Number.isInteger(Number(i.qty)) && Number(i.qty) >= 1 && Number(i.qty) <= 99);
    if(!o || !/^[A-Za-z0-9_-]{1,64}$/.test(String(o.id || '')) || !itemsValid) return jsonOut_({ error:'INVALID_ORDER' });
    // v3.12.0: teks daripada telefon pelanggan dibersihkan sebelum disimpan
    o.customerName = cleanText_(o.customerName, 60);
    o.customerPhone = String(o.customerPhone || '').replace(/\D/g, '').slice(0, 15);
    // v3.13.0: nama & harga diambil daripada menu di server, bukan daripada telefon
    const catalog = menuCatalog_();
    const priced = items.map(i => priceOrderItem_(i, catalog));
    if(priced.some(p => !p)) return jsonOut_({ error:'INVALID_ORDER' });
    const off = priced.find(p => p.unavailable);
    if(off) return jsonOut_({ error:'ITEM_UNAVAILABLE', item: off.name });
    o.items = priced;
    o.total = rm2_(priced.reduce((sum, p) => sum + p.price * p.qty, 0));
    o.status = 'pending';
    // v3.13.0: had — 5 pesanan aktif seorang, 8 pesanan seorang dalam 10 minit, 60 semua dalam 5 minit
    if(o.customerPhone){
      const active = ordersSheet_().getDataRange().getValues().slice(1).filter(r =>
        String(r[7]) === o.customerPhone && ['pending','sedang_dibuat','siap'].indexOf(String(r[4]).split('|')[0]) !== -1 &&
        Date.now() - (Number(r[5]) || 0) < 12 * 60 * 60 * 1000).length;
      if(active >= 5) return jsonOut_({ error:'TOO_MANY_ORDERS' });
      if(!rateOk_('order-' + o.customerPhone, 8, 600)) return jsonOut_({ error:'TOO_MANY_ORDERS' });
    }
    if(!rateOk_('order-all', 60, 300)) return jsonOut_({ error:'BUSY' });
    o.createdAt = Number(o.createdAt) || Date.now();
    // Lock so two customers ordering at the same moment never share a queue number.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{
      let n = parseInt(getMeta_('counter', '0'), 10) || 0;
      n += 1;
      setMeta_('counter', String(n));
      const sheet = ordersSheet_();
      sheet.appendRow([o.id, n, JSON.stringify(o.items), o.total, o.status, o.createdAt, o.customerName, o.customerPhone, 'pending']);
      setTextCell_(sheet, sheet.getLastRow(), 8, o.customerPhone || '');
      upsertAllCustomer_(o.customerPhone, o.customerName, { lastOrderMs: Number(o.createdAt) || Date.now() });
      queueAdminOrderPush_(n, o);
      return jsonOut_({ queueNo: n, loyalty: 'pending', total: o.total, items: o.items });
    } finally { lock.releaseLock(); }
  }

  if(action === 'updateOrderStatus'){
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{
      const sheet = ordersSheet_();
      const row = findRow_(sheet, 0, body.id);
      if(row !== -1) setOrderStatus_(sheet, row, body.status);
    } finally { lock.releaseLock(); }
    return jsonOut_({ ok: true });
  }

  if(action === 'bulkUpdateStatus'){
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{
      const sheet = ordersSheet_();
      const data = sheet.getDataRange().getValues();
      for(let i = 1; i < data.length; i++){
        const r = data[i];
        const key = r[7] || r[6] || r[0];
        if(String(key) !== String(body.key)) continue;
        if(body.fromStatus && r[4] !== body.fromStatus) continue;
        setOrderStatus_(sheet, i + 1, body.newStatus);
      }
    } finally { lock.releaseLock(); }
    return jsonOut_({ ok: true });
  }

  if(action === 'resetOrders'){
    // Locked so an order arriving mid-reset is not wiped by clearContent.
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try{
      const sheet = ordersSheet_();
      const data = sheet.getDataRange().getValues();
      // Manual reset clears the live queue only. Completed orders are the
      // source for Simpanan and the current-month report, so retain them.
      const completed = data.slice(1).filter(r => String(r[4]).split('|')[0] === 'selesai');
      const last = sheet.getLastRow();
      if(last > 1) sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
      if(completed.length) sheet.getRange(2, 1, completed.length, completed[0].length).setValues(completed);
      setMeta_('counter', '0');
      setMeta_('last-reset-date', todayStr_());
    } finally { lock.releaseLock(); }
    return jsonOut_({ ok: true });
  }

  if(action === 'upsertCustomer'){
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{
      upsertCustomer_(body.phone, body.name, body.deltaCount, body.deltaQty);
    } finally { lock.releaseLock(); }
    return jsonOut_({ ok: true });
  }

  if(action === 'setCustomerCount'){
    const sheet = customersSheet_();
    const row = findRow_(sheet, 0, body.phone);
    if(row !== -1) sheet.getRange(row, 3).setValue(body.count);
    return jsonOut_({ ok: true });
  }

  if(action === 'redeemFreeDrinks'){
    // v3.3.4: cups stay as they are; each redemption is logged with its time.
    // Never redeem more than the customer has actually earned.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{
      const sheet = customersSheet_();
      const row = findRow_(sheet, 0, body.phone);
      if(row === -1) return jsonOut_({ ok: false, error: 'NO_CUSTOMER' });
      const r = sheet.getRange(row, 1, 1, 5).getValues()[0];
      const qty = Number(r[3]) || 0;
      const redeems = parseRedeems_(r[4]);
      const available = Math.max(0, Math.floor(qty / FREE_DRINK_EVERY_) - redeems.length);
      const n = Math.min(Math.max(0, Math.floor(Number(body.count) || 0)), available);
      if(n === 0) return jsonOut_({ ok: false, error: 'NO_FREE_DRINKS', qty, redeems });
      const now = Date.now();
      for(let i = 0; i < n; i++) redeems.push(now);
      sheet.getRange(row, 5).setValue(JSON.stringify(redeems));
      return jsonOut_({ ok: true, redeemed: n, qty, redeems });
    } finally { lock.releaseLock(); }
  }

  if(action === 'sendPromoPush'){
    const title = String(body.title || '').trim().slice(0, 60);
    const text = String(body.body || '').trim().slice(0, 200);
    if(!title || !text) return jsonOut_({ ok: false, error: 'EMPTY' });
    if(!pushKey_()) return jsonOut_({ ok: false, error: 'PUSH_KEY_MISSING' });
    // v3.7.0: gambar pilihan (Android papar gambar besar; iPhone teks sahaja)
    const image = /^https:\/\//.test(String(body.image || '')) ? String(body.image).slice(0, 500) : '';
    try{ return jsonOut_({ ok: true, sent: pushBroadcast_(title, text, image) }); }
    catch(err){ return jsonOut_({ ok: false, error: String(err.message || err).slice(0, 120) }); }
  }

  // v3.8.0: telefon admin terima notifikasi order baru
  if(action === 'adminPushSubscribe' || action === 'adminPushUnsubscribe' || action === 'adminPushTest'){
    if(!pushKey_()) return jsonOut_({ ok: false, error: 'PUSH_KEY_MISSING' });
    try{
      if(action === 'adminPushSubscribe'){
        const row = findRow_(adminsSheet_(), 0, body.adminId);
        const name = row === -1 ? '' : String(adminsSheet_().getRange(row, 2).getValue());
        adminPushCall_('/admin-subscribe', { subscription: body.subscription, repeat: body.repeat === true, name: name });
        return jsonOut_({ ok: true, trigger: adminRepeatTriggerInstalled_() });
      }
      const endpoint = String(body.endpoint || '');
      if(!/^https:\/\//.test(endpoint)) return jsonOut_({ ok: false, error: 'EMPTY' });
      if(action === 'adminPushUnsubscribe'){
        adminPushCall_('/admin-unsubscribe', { endpoint: endpoint });
        return jsonOut_({ ok: true });
      }
      const j = adminPushCall_('/admin-send', { endpoint: endpoint, tag: 'kfe-admin-test', url: '/',
        title: '🔔 Notifikasi order baru aktif',
        body: 'Telefon ini akan berbunyi bila pelanggan buat order, walaupun skrin tutup.' });
      return jsonOut_({ ok: true, sent: Number(j.sent) || 0 });
    }catch(err){ return jsonOut_({ ok: false, error: String(err.message || err).slice(0, 120) }); }
  }

  // Admin: notifikasi kepada SATU pelanggan (cth. ingatkan pelanggan lama)
  if(action === 'sendCustomerPush'){
    const title = String(body.title || '').trim().slice(0, 60);
    const text = String(body.body || '').trim().slice(0, 200);
    const phone = phoneKey_(body.phone);
    if(!title || !text || !/^\d{9,15}$/.test(phone)) return jsonOut_({ ok: false, error: 'EMPTY' });
    if(!pushKey_()) return jsonOut_({ ok: false, error: 'PUSH_KEY_MISSING' });
    try{
      const sent = pushSend_([{ phone: phone, title: title, body: text, tag: 'kfe-personal', url: '/' }]);
      return jsonOut_({ ok: true, sent: Number(sent[phone]) || 0 });
    }catch(err){ return jsonOut_({ ok: false, error: String(err.message || err).slice(0, 120) }); }
  }

  if(action === 'archiveCustomers'){
    const curMonth = archiveCustomersIfMonthChanged_();
    return jsonOut_({ ok: true, currentMonth: curMonth });
  }

  // v3.13.0: nama/ID dibersihkan, ID unik, kata laluan kuat & di-hash
  if(action === 'addAdmin' || action === 'updateAdmin'){
    const sheet = adminsSheet_();
    const name = cleanText_(body.name, 40);
    const username = cleanText_(body.username, 40);
    const password = String(body.password || '');
    if(!name || !username) return jsonOut_({ ok:false, error:'EMPTY' });
    const row = action === 'updateAdmin' ? findRow_(sheet, 0, body.id) : -1;
    if(action === 'updateAdmin' && row === -1) return jsonOut_({ ok:false, error:'NOT_FOUND' });
    // Edit: kata laluan kosong = kekal yang lama
    if((action === 'addAdmin' || password) && !strongPassword_(password)) return jsonOut_({ ok:false, error:'WEAK_PASSWORD' });
    const taken = sheet.getDataRange().getValues().slice(1).some((r, i) => String(r[2]).toLowerCase() === username.toLowerCase() && i + 2 !== row);
    if(taken) return jsonOut_({ ok:false, error:'USERNAME_TAKEN' });
    const target = row === -1 ? sheet.getLastRow() + 1 : row;
    if(row === -1) sheet.getRange(target, 1).setValue('a_' + Date.now());
    sheet.getRange(target, 2).setValue(name);
    setTextCell_(sheet, target, 3, username);
    if(password) setTextCell_(sheet, target, 4, hashPassword_(password));
    return jsonOut_({ ok: true });
  }

  if(action === 'deleteAdmin'){
    const sheet = adminsSheet_();
    if(sheet.getLastRow() <= 2) return jsonOut_({ ok:false, error:'LAST_ADMIN' });
    if(String(body.id) === String(body.adminId)) return jsonOut_({ ok:false, error:'SELF' });
    const row = findRow_(sheet, 0, body.id);
    if(row !== -1) sheet.deleteRow(row);
    return jsonOut_({ ok: true });
  }

  if(action === 'setMeta'){
    if(body.key === 'shop-hours'){
      // Store the cleaned list, never the raw text from the browser.
      let raw = null;
      try{ raw = JSON.parse(body.value); }catch(err){ return jsonOut_({ ok:false, error:'INVALID_HOURS' }); }
      if(!Array.isArray(raw) || raw.length !== 7) return jsonOut_({ ok:false, error:'INVALID_HOURS' });
      const hours = normalizeShopHours_(raw);
      setMeta_('shop-hours', JSON.stringify(hours));
      return jsonOut_({ ok: true, hours: hours });
    }
    setMeta_(body.key, body.value);
    return jsonOut_({ ok: true });
  }

  if(action === 'repairMeta'){
    const sheet = metaSheet_();
    const row = findRow_(sheet, 0, 'current-month');
    let fixedMonth = null;
    if(row !== -1){
      const raw = sheet.getRange(row, 2).getValue();
      fixedMonth = normalizeMonthValue_(raw);
      setMeta_('current-month', fixedMonth);
    }
    const reports = JSON.parse(getMeta_('reports', '{}'));
    const fixedReports = {};
    for(const k in reports) fixedReports[normalizeMonthValue_(k)] = reports[k];
    setMeta_('reports', JSON.stringify(fixedReports));
    return jsonOut_({ ok: true, fixedMonth, fixedReportsKeys: Object.keys(fixedReports) });
  }

  // ★ NEW: save menu description
  // v3.15.0: admin cipta / tukar nama / padam kategori & menu
  if(action === 'saveMenuCategory') return jsonOut_(saveMenuCategory_(body));
  if(action === 'deleteMenuCategory') return jsonOut_(deleteMenuCategory_(body));
  if(action === 'addMenuItem') return jsonOut_(addMenuItem_(body));
  if(action === 'deleteMenuItem') return jsonOut_(deleteMenuItem_(body));

  if(action === 'saveMenuMeta'){
    return jsonOut_(saveMenuMeta_(body.id, body.desc, body.imageUrl || null, body.name, body.price, body.published));
  }

  // ★ NEW: save menu image to Google Drive
  if(action === 'saveMenuImage'){
    return jsonOut_(saveMenuImage_(body.id, body.base64, body.mimeType));
  }

  if(action === 'savePromotionImage'){
    return jsonOut_(savePromotionImage_(body.base64, body.mimeType, body.name, body.type));
  }

  if(action === 'setPromotionType'){
    return jsonOut_(setPromotionType_(body.id, body.type));
  }

  if(action === 'setPromotionVisible'){
    return jsonOut_(setPromotionVisible_(body.id, body.visible));
  }

  if(action === 'deletePromotion'){
    return jsonOut_(deletePromotion_(body.id));
  }

  // v3.10.0: katalog Reward & tebus points
  if(action === 'saveReward'){
    try{ return jsonOut_(saveReward_(body)); }
    catch(err){ return jsonOut_({ error:String(err) }); }
  }

  if(action === 'deleteReward'){
    return jsonOut_(deleteReward_(body.id));
  }

  // v3.10.0: pelanggan baru masukkan kod kawan (sekali sahaja)
  if(action === 'setReferral'){
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{ return jsonOut_(setReferral_(body.phone, body.name, body.code)); }
    finally{ lock.releaseLock(); }
  }

  if(action === 'registerCustomer'){
    if(!rateOk_('register-all', 30, 600)) return jsonOut_({ ok:false, error:'BUSY' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{ return jsonOut_(registerCustomer_(body)); }
    finally{ lock.releaseLock(); }
  }

  if(action === 'setProfile'){
    if(!rateOk_('profile-' + phoneKey_(body.phone), 10, 3600)) return jsonOut_({ ok:false, error:'BUSY' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{ return jsonOut_(setProfile_(body)); }
    finally{ lock.releaseLock(); }
  }

  if(action === 'useBalance'){
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{ return jsonOut_(useBalance_(body)); }
    finally{ lock.releaseLock(); }
  }

  if(action === 'redeemReward'){
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{ return jsonOut_(redeemReward_(body)); }
    finally{ lock.releaseLock(); }
  }

  // v3.11.0: hadiah hari jadi & notifikasi automatik
  if(action === 'redeemBirthday'){
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try{ return jsonOut_(redeemBirthday_(body)); }
    finally{ lock.releaseLock(); }
  }

  if(action === 'saveAutoPush'){
    const settings = cleanAutoPush_(body.settings || {});
    setMeta_('auto-push', JSON.stringify(settings));
    return jsonOut_({ ok: true, settings: settings });
  }

  return jsonOut_({ error: 'unknown action' });
}

/* ================= Triggers ================= */
function dailyAutoReset(){
  const today = todayStr_();
  const lastReset = getMeta_('last-reset-date', '');
  if(lastReset === today) return;
  // Orders are the current-month history used by Simpanan and the monthly
  // charts. Never delete them at the daily boundary.
  archiveCustomersIfMonthChanged_();
  setMeta_('counter', '0');
  setMeta_('last-reset-date', today);
}

function archiveCustomersIfMonthChanged_(){
  // Malaysia time, so the month flips at midnight here whatever the project
  // timezone is set to.
  const curMonth = Utilities.formatDate(new Date(), SHOP_TZ_, 'yyyy-MM');
  // Several devices (and the daily trigger) can call this at once on the 1st.
  // Without the lock a second run would re-read the already-emptied sheet and
  // overwrite last month's report with an empty snapshot.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{ return archiveCustomersLocked_(curMonth); }
  finally{ lock.releaseLock(); }
}

function archiveCustomersLocked_(curMonth){
  const lastMonth = getMeta_('current-month', null);
  if(lastMonth === null){
    setMeta_('current-month', curMonth);
  } else if(lastMonth !== curMonth){
    const sheet = customersSheet_();
    // v3.12.0: laporan bulan lepas ke sheet LaporanBulanan & KewanganBulanan
    // (dahulu satu sel Meta 'reports', yang terhad 50,000 aksara)
    const custRows = sheet.getDataRange().getValues().slice(1).filter(r => r[0]);
    const lastOrders = ordersSheet_().getDataRange().getValues().slice(1).filter(r => r[0]);
    writeMonthReport_(lastMonth, custRows.map(r => ({ phone: r[0], name: r[1], count: r[2], qty: r[3], redeems: parseRedeems_(r[4]) })), lastOrders);
    const last = sheet.getLastRow();
    if(last > 1) sheet.deleteRows(2, last - 1);
    setMeta_('current-month', curMonth);

    // A new month starts a fresh operational/order history only after the
    // previous customer's monthly snapshot has been saved.
    // v3.6.0: order bulan lepas DIPINDAH ke sheet OrdersArkib (disimpan kekal),
    // bukan dipadam. Sheet Orders kekal kecil supaya admin laju.
    const orderSheet = ordersSheet_();
    const orderLast = orderSheet.getLastRow();
    if(orderLast > 1){
      const rows = orderSheet.getRange(2, 1, orderLast - 1, 9).getValues().filter(r => r[0]);
      if(rows.length){
        const arkib = ordersArchiveSheet_();
        const start = arkib.getLastRow() + 1;
        arkib.getRange(start, 8, rows.length, 1).setNumberFormat('@'); // no. telefon kekal dengan 0 di depan
        arkib.getRange(start, 1, rows.length, 10).setValues(rows.map(r => r.concat([String(lastMonth)])));
      }
      orderSheet.deleteRows(2, orderLast - 1);
    }
    setMeta_('counter', '0');
  }
  return curMonth;
}

/* ---------- v3.12.0: laporan bulanan dalam sheet sendiri ----------
   Bulan semasa  : sheet Customers (seorang satu baris) + Orders, macam dahulu.
   Bulan lepas   : bila bulan bertukar, disalin ke
     LaporanBulanan  — seorang pelanggan satu baris bagi setiap bulan
     KewanganBulanan — ringkasan kedai satu baris bagi setiap bulan.
   Kali pertama, laporan lama dalam Meta 'reports' disalin ke sini (sel itu
   dibiarkan, tidak ditulis lagi). Jualan bulan lama diambil daripada OrdersArkib. */
const LAPORAN_HEADERS_ = ['bulan','telefon','nama','pesanan','cawan','airPercumaDitebus','jualanRM'];
const KEWANGAN_HEADERS_ = ['bulan','jualanRM','pesananSelesai','pesananDitolak','cawan','pelanggan','pelangganBaru',
  'airPercuma','airHariJadi','pointsDiberi','pointsDitebus','duitReferralRM','duitDigunakanRM','dikemasKini'];

function monthOf_(v){
  if(Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v, SHOP_TZ_, 'yyyy-MM');
  const t = String(v || '');
  return /^\d{4}-\d{2}/.test(t) ? t.slice(0, 7) : '';
}
function orderCups_(r){
  try{ return JSON.parse(r[2] || '[]').reduce((s, i) => s + (Number(i.qty) || 0), 0); }catch(e){ return 0; }
}
function sheetRows_(name){
  const sheet = ss_().getSheetByName(name);
  return sheet ? sheet.getDataRange().getValues().slice(1) : [];
}

// Ringkasan satu bulan. orderRows = baris Orders / OrdersArkib bulan itu,
// redeems = bilangan air percuma (Beli 5) ditebus bulan itu.
function monthSummary_(month, orderRows, redeems){
  const s = { month: month, sales: 0, done: 0, rejected: 0, cups: 0, customers: 0, newCustomers: 0, freeDrinks: redeems,
    birthdayDrinks: 0, pointsGiven: 0, pointsUsed: 0, referralPaid: 0, balanceUsed: 0, salesByPhone: {} };
  orderRows.forEach(r => {
    if(!r[0]) return;
    const base = String(r[4]).split('|')[0];
    if(base === 'rejected'){ s.rejected++; return; }
    if(base !== 'selesai') return;
    const total = Number(r[3]) || 0, key = phoneKey_(r[7]);
    s.done++; s.sales += total; s.cups += orderCups_(r);
    if(key) s.salesByPhone[key] = (s.salesByPhone[key] || 0) + total;
  });
  s.customers = Object.keys(s.salesByPhone).length;
  sheetRows_('SemuaPelanggan').forEach(r => { if(r[0] && monthOf_(r[2]) === month) s.newCustomers++; });
  sheetRows_('PointsLog').forEach(r => {
    if(monthOf_(r[0]) !== month) return;
    const n = Number(r[3]) || 0;
    if(n > 0) s.pointsGiven += n; else s.pointsUsed -= n;
    if(String(r[5]).indexOf('Tebus air percuma hari jadi') === 0) s.birthdayDrinks++;
  });
  sheetRows_('DuitLog').forEach(r => {
    if(monthOf_(r[0]) !== month) return;
    const n = Number(r[3]) || 0;
    if(n > 0) s.referralPaid += n; else s.balanceUsed -= n;
  });
  s.sales = rm2_(s.sales); s.referralPaid = rm2_(s.referralPaid); s.balanceUsed = rm2_(s.balanceUsed);
  Object.keys(s.salesByPhone).forEach(k => { s.salesByPhone[k] = rm2_(s.salesByPhone[k]); });
  return s;
}
function kewanganRow_(s){
  return [s.month, s.sales, s.done, s.rejected, s.cups, s.customers, s.newCustomers, s.freeDrinks, s.birthdayDrinks,
    s.pointsGiven, s.pointsUsed, s.referralPaid, s.balanceUsed, shopTimeStr_()];
}
function kewanganSheet_(){
  const sheet = getSheet_('KewanganBulanan', KEWANGAN_HEADERS_);
  sheet.getRange('A:A').setNumberFormat('@');
  return sheet;
}
function laporanSheet_(){
  const isNew = !ss_().getSheetByName('LaporanBulanan');
  const sheet = getSheet_('LaporanBulanan', LAPORAN_HEADERS_);
  if(isNew){
    sheet.getRange('A:B').setNumberFormat('@');
    sheet.setFrozenRows(1);
    migrateOldReports_();
  }
  return sheet;
}

// Simpan satu bulan. customers = [{ phone, name, count, qty, redeems:[ms] }].
// Selamat dipanggil semula: bulan yang sudah ada dalam LaporanBulanan tidak ditulis dua kali.
function writeMonthReport_(month, customers, orderRows){
  const redeems = customers.reduce((n, c) => n + c.redeems.length, 0);
  const s = monthSummary_(month, orderRows, redeems);
  const sheet = laporanSheet_();
  const done = sheet.getDataRange().getValues().slice(1).some(r => monthOf_(r[0]) === month);
  const rows = customers.map(c => [month, phoneKey_(c.phone), String(c.name || ''), Number(c.count) || 0, Number(c.qty) || 0,
    c.redeems.length, s.salesByPhone[phoneKey_(c.phone)] || 0]);
  if(!done && rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, LAPORAN_HEADERS_.length).setValues(rows);
  const kew = kewanganSheet_();
  const found = kew.getDataRange().getValues().findIndex((r, i) => i > 0 && monthOf_(r[0]) === month);
  kew.getRange(found > 0 ? found + 1 : kew.getLastRow() + 1, 1, 1, KEWANGAN_HEADERS_.length).setValues([kewanganRow_(s)]);
}

// Kali pertama sahaja: laporan lama dalam Meta 'reports' → LaporanBulanan & KewanganBulanan
function migrateOldReports_(){
  let reports = {};
  try{ reports = JSON.parse(getMeta_('reports', '{}') || '{}') || {}; }catch(e){ reports = {}; }
  const arkib = sheetRows_('OrdersArkib');
  Object.keys(reports).map(normalizeMonthValue_).filter(m => /^\d{4}-\d{2}$/.test(m)).sort().forEach(month => {
    const snap = reports[month] || {};
    const customers = Object.keys(snap).map(phone => {
      const c = snap[phone] || {};
      return { phone: phone, name: c.name, count: c.count, qty: c.qty, redeems: Array.isArray(c.redeems) ? c.redeems : [] };
    });
    writeMonthReport_(month, customers, arkib.filter(r => monthOf_(r[9]) === month));
  });
}

// Admin: ringkasan setiap bulan (lepas + bulan semasa, dikira terus)
function getKewangan_(){
  laporanSheet_(); // kali pertama: salin laporan lama
  const history = kewanganSheet_().getDataRange().getValues().slice(1).filter(r => r[0]).map(r => {
    const o = {};
    KEWANGAN_HEADERS_.forEach((h, i) => { o[h] = h === 'bulan' ? monthOf_(r[i]) : h === 'dikemasKini' ? String(r[i] || '') : Number(r[i]) || 0; });
    return o;
  });
  const month = getMeta_('current-month', '') || Utilities.formatDate(new Date(), SHOP_TZ_, 'yyyy-MM');
  const redeems = customersSheet_().getDataRange().getValues().slice(1)
    .reduce((n, r) => n + (r[0] ? parseRedeems_(r[4]).length : 0), 0);
  const cur = monthSummary_(month, ordersSheet_().getDataRange().getValues().slice(1), redeems);
  const row = kewanganRow_(cur), current = {};
  KEWANGAN_HEADERS_.forEach((h, i) => { current[h] = row[i]; });
  current.semasa = true;
  return { current: current, history: history.filter(h => h.bulan !== month).sort((a, b) => a.bulan < b.bulan ? 1 : -1) };
}

/* ---------- v3.15.0: graf Jualan vs Cawan (Hari / Bulan / Tahun) ----------
   mode 'day'   key 'yyyy-MM-dd' → 24 titik (setiap jam)
   mode 'month' key 'yyyy-MM'    → satu titik setiap hari
   mode 'year'  key 'yyyy'       → 12 titik (setiap bulan)
   Dikira daripada Orders + OrdersArkib (semua order kecuali ditolak, sama
   seperti Dashboard). Bulan lama tanpa order dalam arkib (sebelum v3.6.0)
   guna ringkasan KewanganBulanan. Waktu Malaysia (UTC+8, tiada DST). */
function salesChart_(mode, key){
  mode = String(mode || ''); key = String(key || '');
  const ok = (mode === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(key)) || (mode === 'month' && /^\d{4}-\d{2}$/.test(key)) || (mode === 'year' && /^\d{4}$/.test(key));
  if(!ok) return { ok:false, error:'BAD_PERIOD' };
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7)) || 1;
  const n = mode === 'day' ? 24 : mode === 'month' ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 12;
  const points = Array.from({ length: n }, () => ({ jualan: 0, cawan: 0, pesanan: 0 }));
  const seen = {};
  const add = r => {
    const id = String(r[0] || '');
    if(!id || seen[id]) return;
    seen[id] = true;
    if(String(r[4]).split('|')[0] === 'rejected') return;
    const ms = Number(r[5]);
    if(!ms) return;
    const d = new Date(ms + 8 * 3600000);
    const ds = d.toISOString();
    if(mode === 'day' ? ds.slice(0, 10) !== key : mode === 'month' ? ds.slice(0, 7) !== key : ds.slice(0, 4) !== key) return;
    const p = points[mode === 'day' ? d.getUTCHours() : mode === 'month' ? d.getUTCDate() - 1 : d.getUTCMonth()];
    p.jualan += Number(r[3]) || 0;
    p.cawan += orderCups_(r);
    p.pesanan++;
  };
  ordersSheet_().getDataRange().getValues().slice(1).forEach(add);
  sheetRows_('OrdersArkib').forEach(add);
  if(mode === 'year'){
    sheetRows_('KewanganBulanan').forEach(r => {
      const mo = monthOf_(r[0]);
      if(mo.slice(0, 4) !== key) return;
      const p = points[Number(mo.slice(5, 7)) - 1];
      if(p && !p.pesanan && !p.jualan){ p.jualan = Number(r[1]) || 0; p.cawan = Number(r[4]) || 0; p.pesanan = Number(r[2]) || 0; p.ringkasan = true; }
    });
  }
  const total = { jualan: 0, cawan: 0, pesanan: 0 };
  points.forEach(p => { p.jualan = rm2_(p.jualan); total.jualan += p.jualan; total.cawan += p.cawan; total.pesanan += p.pesanan; });
  total.jualan = rm2_(total.jualan);
  return { ok:true, mode: mode, key: key, points: points, total: total };
}

function monthlyAutoArchive(){
  archiveCustomersIfMonthChanged_();
}

function repairAdminsManual(){
  const sheet = adminsSheet_();
  const data = sheet.getDataRange().getValues();
  let fixedCount = 0;
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(!r[0]) continue;
    setTextCell_(sheet, i + 1, 3, r[2]);
    setTextCell_(sheet, i + 1, 4, r[3]);
    fixedCount++;
  }
  Logger.log('Fixed ' + fixedCount + ' admin rows.');
}

/* =====================================================================
   PUSH NOTIFICATION (telefon berbunyi walaupun app ditutup) — v3.4.0
   Diambil daripada Repatha Care (pushSend_ / semakPush).
   - Servis: Cloudflare Worker "kfe-de-sol-push" (folder push-worker)
   - Kunci rahsia: Project Settings → Script Properties → PUSH_KEY (diberi oleh developer)
   - Jalankan semakPush() dari editor untuk pastikan sambungan ke servis push OK.
   Dihantar serta-merta bila admin tukar status: Siap, Ditolak, Selesai (mata ganjaran).
   Promosi: Admin > Promosi > Hantar Notifikasi Promosi (action 'sendPromoPush').
   ===================================================================== */
const PUSH_URL_ = 'https://kfe-de-sol-push.kfedesoll.workers.dev';
function pushKey_(){ return PropertiesService.getScriptProperties().getProperty('PUSH_KEY') || ''; }

// Notifikasi dikumpul semasa request, dihantar sekali gus oleh flushPush_() di hujung doPost
let pushQueue_ = [];
function pushQueueNo_(n){ return String(n || '').padStart(3, '0'); }

function queueOrderPush_(r, base, status){
  const phone = String(r[7] || '');
  if(!phone) return;
  const no = pushQueueNo_(r[1]);
  const tag = 'kfe-order-' + r[0];
  if(base === 'siap'){
    pushQueue_.push({ phone: phone, tag: tag, url: '/',
      title: '☕ Pesanan No. ' + no + ' dah siap!',
      body: 'Sila datang ke kaunter K\'fe De Sol untuk ambil & bayar. Sebut nombor giliran anda.' });
  } else if(base === 'rejected'){
    const reason = String(status).split('|')[1] || '';
    pushQueue_.push({ phone: phone, tag: tag, url: '/',
      title: 'Maaf, pesanan No. ' + no + ' ditolak',
      body: (reason ? 'Sebab: ' + reason + '. ' : '') + 'Sila buat pesanan baru jika masih ingin membeli.' });
  }
}

// Dipanggil selepas mata ganjaran dimasukkan (status Selesai)
function queueLoyaltyPush_(phone, addedQty, addedPoints, balance){
  if(!phone || !addedQty) return;
  const loyalty = getMyLoyalty_(phone);
  if(!loyalty) return;
  const free = Math.max(0, Math.floor(loyalty.qty / FREE_DRINK_EVERY_) - loyalty.redeems.length);
  const more = FREE_DRINK_EVERY_ - (loyalty.qty % FREE_DRINK_EVERY_);
  // v3.10.0: sebut points yang baru masuk & baki
  const pts = addedPoints && balance !== null && balance !== undefined ? ' +' + addedPoints + ' points (baki ' + balance + ').' : '';
  pushQueue_.push(free > 0 ? {
    phone: phone, tag: 'kfe-loyalty', url: '/',
    title: '🎁 Anda ada ' + free + ' air percuma!',
    body: 'Terima kasih! +' + addedQty + ' cawan direkod (jumlah ' + loyalty.qty + ').' + pts + ' Tunjuk app di kaunter untuk tebus.'
  } : {
    phone: phone, tag: 'kfe-loyalty', url: '/',
    title: '⭐ +' + addedQty + ' cawan direkod',
    body: 'Jumlah ' + loyalty.qty + ' cawan.' + pts + ' Lagi ' + more + ' cawan untuk dapat 1 air percuma!'
  });
}

/* ---------- v3.8.0: notifikasi order baru ke telefon admin ----------
   Telefon admin didaftar di Worker (kunci "a:") melalui action adminPushSubscribe.
   Satu tag untuk semua ("kfe-admin-order"): notifikasi baru ganti yang lama dan
   berbunyi semula. Ulangan dibuat oleh trigger ulangNotifAdmin (setiap minit). */
const ADMIN_PUSH_TAG_ = 'kfe-admin-order';
const ADMIN_REPEAT_MAX_MS_ = 60 * 60 * 1000;   // berhenti ulang selepas 60 minit
const ADMIN_PENDING_PROP_ = 'ADMIN_ORDER_PENDING'; // ada order baru → trigger perlu semak sheet
let adminPushQueue_ = [];

function adminOrderLine_(items){
  return (items || []).map(function(i){ return String(i.name || '') + ' ×' + (Number(i.qty) || 0); }).join(', ');
}

// Tidak pernah gagalkan order: hanya tanda + baris gilir (dihantar oleh flushPush_)
function queueAdminOrderPush_(n, o){
  try{ PropertiesService.getScriptProperties().setProperty(ADMIN_PENDING_PROP_, String(Date.now())); }
  catch(err){ console.error('tanda order admin gagal: ' + err); }
  const total = Number(o.total);
  adminPushQueue_.push({ tag: ADMIN_PUSH_TAG_, url: '/',
    title: '🔔 Order baru · No. ' + pushQueueNo_(n),
    body: [String(o.customerName || 'Pelanggan'), adminOrderLine_(o.items), isNaN(total) ? '' : 'RM' + total.toFixed(2)]
      .filter(String).join(' · ').slice(0, 300) });
}

function adminPushCall_(path, payload){
  const res = UrlFetchApp.fetch(PUSH_URL_ + path, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + pushKey_() }, payload: JSON.stringify(payload)
  });
  const j = JSON.parse(res.getContentText() || '{}');
  if(!j.ok) throw new Error('Servis push: ' + (j.error || res.getResponseCode()));
  return j;
}

// Dipanggil oleh trigger setiap minit. Murah bila tiada order baru: baca satu
// Script Property sahaja, sheet hanya dibaca bila ada order yang belum dilayan.
function ulangNotifAdmin(){
  const props = PropertiesService.getScriptProperties();
  if(!props.getProperty(ADMIN_PENDING_PROP_) || !pushKey_()) return;
  const now = Date.now();
  const rows = ordersSheet_().getDataRange().getValues().slice(1);
  const pending = rows.filter(function(r){
    const at = Number(r[5]) || 0;
    return r[0] && String(r[4]).split('|')[0] === 'pending' && now - at < ADMIN_REPEAT_MAX_MS_;
  });
  if(!pending.length){ props.deleteProperty(ADMIN_PENDING_PROP_); return; }
  // Order yang baru masuk (< 50 saat) sudah dapat notifikasi pertama
  const due = pending.filter(function(r){ return now - (Number(r[5]) || 0) >= 50 * 1000; });
  if(!due.length) return;
  const oldest = Math.max(1, Math.round((now - Math.min.apply(null, due.map(function(r){ return Number(r[5]) || now; }))) / 60000));
  let msg;
  if(due.length === 1){
    const r = due[0];
    let items = [];
    try{ items = JSON.parse(r[2] || '[]'); }catch(e){}
    msg = { title: '🔔 Order No. ' + pushQueueNo_(r[1]) + ' belum dilayan',
      body: [String(r[6] || 'Pelanggan'), adminOrderLine_(items), oldest + ' minit lalu'].filter(String).join(' · ') + '. Tekan Acknowledge.' };
  } else {
    msg = { title: '🔔 ' + due.length + ' order belum dilayan',
      body: 'No. ' + due.map(function(r){ return pushQueueNo_(r[1]); }).join(', ') + ' · paling lama ' + oldest + ' minit. Tekan Acknowledge.' };
  }
  try{ adminPushCall_('/admin-send', { title: msg.title, body: msg.body.slice(0, 300), tag: ADMIN_PUSH_TAG_, url: '/', repeatOnly: true }); }
  catch(err){ console.error('ulang push admin gagal: ' + err); }
}

function adminRepeatTriggerInstalled_(){
  try{ return ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'ulangNotifAdmin'; }); }
  catch(e){ return false; }
}

// Jalankan SEKALI dari editor Apps Script (pilih pasangNotifAdmin → Run → benarkan akses).
// Cipta trigger setiap 1 minit untuk notifikasi admin berulang.
function pasangNotifAdmin(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'ulangNotifAdmin') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('ulangNotifAdmin').timeBased().everyMinutes(1).create();
  Logger.log('✓ Trigger notifikasi admin berulang dipasang (setiap 1 minit).');
}

// Pilihan: buang trigger (notifikasi order baru pertama masih jalan, cuma tidak berulang)
function buangNotifAdmin(){
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'ulangNotifAdmin'){ ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log('✓ ' + n + ' trigger dibuang.');
}

// Tidak pernah gagalkan request asal: ralat push hanya dilog
function flushPush_(){
  const items = pushQueue_;
  const adminItems = adminPushQueue_;
  pushQueue_ = [];
  adminPushQueue_ = [];
  if(!pushKey_()) return;
  if(items.length){ try{ pushSend_(items); }catch(err){ console.error('push gagal: ' + err); } }
  adminItems.forEach(function(m){
    try{ adminPushCall_('/admin-send', m); }catch(err){ console.error('push admin gagal: ' + err); }
  });
}

// Hantar ke servis push. Pulangkan { telefon: bilangan peranti yang terima }
function pushSend_(items){
  const key = pushKey_();
  if(!key || !items.length) return {};
  const res = UrlFetchApp.fetch(PUSH_URL_ + '/send', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + key }, payload: JSON.stringify({ items: items })
  });
  const j = JSON.parse(res.getContentText() || '{}');
  if(!j.ok) throw new Error('Servis push: ' + (j.error || res.getResponseCode()));
  const out = {};
  (j.results || []).forEach(function(r){ out[r.phone] = r.sent; });
  return out;
}

// Promosi kepada semua: Worker hantar 40 telefon sekali, ulang dengan cursor sehingga habis
function pushBroadcast_(title, text, image){
  const key = pushKey_();
  let cursor = null, sent = 0;
  for(let round = 0; round < 50; round++){
    const res = UrlFetchApp.fetch(PUSH_URL_ + '/broadcast', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify({ title: title, body: text, image: image || '', tag: 'kfe-promo', url: '/', cursor: cursor })
    });
    const j = JSON.parse(res.getContentText() || '{}');
    if(!j.ok) throw new Error('Servis push: ' + (j.error || res.getResponseCode()));
    sent += Number(j.sent) || 0;
    if(j.done || !j.cursor) break;
    cursor = j.cursor;
  }
  return sent;
}

// No. telefon yang ada sekurang-kurangnya satu telefon langganan (untuk tanda 🔔 di admin)
function pushPhones_(){
  const key = pushKey_();
  if(!key) return null;
  const res = UrlFetchApp.fetch(PUSH_URL_ + '/phones', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + key }, payload: '{}'
  });
  const j = JSON.parse(res.getContentText() || '{}');
  if(!j.ok) throw new Error('Servis push: ' + (j.error || res.getResponseCode()));
  return j.phones || [];
}

/* ---------- v3.11.0: notifikasi automatik (trigger harian) ----------
   harianNotif() dijalankan oleh trigger setiap hari sekitar 10 pagi (waktu
   Malaysia). Pasang dengan pasangNotifHarian() SEKALI dari editor.
   1. Hari jadi: ucapan + air percuma, sekali setahun (kolum 15 elak berganda).
   2. Ingatan: pelanggan dibahagi kepada remindEvery kumpulan ikut no. telefon
      (nampak rawak, kekal tetap); setiap hari satu kumpulan, jadi setiap orang
      dapat sekali setiap remindEvery hari. Hanya hari kedai buka; langkau
      pelanggan yang beli sejak ingatan lepas dan yang dapat ucapan hari jadi.
   Hanya pelanggan yang hidupkan notifikasi menerima. {nama} = nama pertama,
   {hingga} = tarikh akhir hadiah hari jadi (dd/MM). */
const AUTO_PUSH_DEFAULTS_ = {
  remind: true, remindEvery: 3,
  remindTitle: '☕ Apa khabar, {nama}?',
  remindBody: 'Dah minum kopi hari ni? Jom order kopi dan minuman lain di K\'fe De Sol!',
  birthday: true, birthdayDays: 7,
  birthdayTitle: '🎂 Selamat Hari Jadi, {nama}!',
  birthdayBody: 'Hadiah dari K\'fe De Sol: 1 air percuma untuk anda. Tunjuk app di kaunter sebelum {hingga}.'
};
const AUTO_PUSH_DATE_PROP_ = 'AUTO_PUSH_DATE';  // tarikh terakhir harianNotif dijalankan
const AUTO_PUSH_LAST_PROP_ = 'AUTO_PUSH_LAST';  // keputusan terakhir (dipapar di Admin)

function cleanAutoPush_(raw){
  const d = AUTO_PUSH_DEFAULTS_;
  raw = raw && typeof raw === 'object' ? raw : {};
  const text = (v, def, max) => String(v == null ? '' : v).trim().slice(0, max) || def;
  const num = (v, def, min, max) => { const n = parseInt(v, 10); return n >= min && n <= max ? n : def; };
  return {
    remind: raw.remind === undefined ? d.remind : raw.remind === true,
    remindEvery: num(raw.remindEvery, d.remindEvery, 1, 30),
    remindTitle: text(raw.remindTitle, d.remindTitle, 60),
    remindBody: text(raw.remindBody, d.remindBody, 200),
    birthday: raw.birthday === undefined ? d.birthday : raw.birthday === true,
    birthdayDays: num(raw.birthdayDays, d.birthdayDays, 1, 31),
    birthdayTitle: text(raw.birthdayTitle, d.birthdayTitle, 60),
    birthdayBody: text(raw.birthdayBody, d.birthdayBody, 200)
  };
}
function getAutoPush_(){
  let raw = {};
  try{ raw = JSON.parse(getMeta_('auto-push', '{}') || '{}'); }catch(e){ raw = {}; }
  return cleanAutoPush_(raw);
}

// Kedai buka pada tarikh itu (waktu biasa atau waktu tambahan), bukan cuti
function shopOpensOn_(date){
  const raw = getMeta_('shop-status', null);
  if(raw === 'closed') return false;
  let status = {};
  try{ status = raw ? JSON.parse(raw) : {}; }catch(e){ status = {}; }
  if(!status || typeof status !== 'object') status = {};
  const holidays = Array.isArray(status.holidays) ? status.holidays
    : (status.from && status.until ? [{from:status.from, until:status.until}] : []);
  if(holidays.some(h => h && date >= h.from && date <= h.until)) return false;
  if(!getShopHours_()[new Date(Date.parse(date + 'T00:00:00Z')).getUTCDay()].closed) return true;
  return (Array.isArray(status.extraHours) ? status.extraHours : []).some(s => s && s.date === date);
}
// Sheet boleh tukar 'yyyy-MM-dd HH:mm' jadi Date; pulangkan 'yyyy-MM-dd' atau ''
function ymdOf_(v){
  if(Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v, SHOP_TZ_, 'yyyy-MM-dd');
  const t = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}
function firstName_(name){ return String(name || '').trim().split(/\s+/)[0] || 'kawan'; }
// Kumpulan tetap bagi setiap no. telefon (0 .. every-1)
function remindGroup_(phone, every){
  let h = 7;
  const s = 'kfe-remind-' + phone;
  for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
  return h % every;
}

// Siapa dapat notifikasi pada tarikh itu (tiada apa dihantar di sini)
function autoPushPlan_(today){
  const s = getAutoPush_();
  const subscribed = {};
  (pushPhones_() || []).forEach(p => { subscribed[phoneKey_(p)] = String(p); });
  const plan = { settings: s, today: today, shopOpen: shopOpensOn_(today), birthday: [], remind: [], skipped: 0,
    sent: PropertiesService.getScriptProperties().getProperty(AUTO_PUSH_DATE_PROP_) === today };
  const group = Math.floor(Date.parse(today + 'T00:00:00Z') / 86400000) % s.remindEvery;
  const since = addDays_(today, -s.remindEvery); // beli selepas tarikh ini = baru beli
  allCustomersSheet_().getDataRange().getValues().slice(1).forEach((r, i) => {
    const key = phoneKey_(r[0]);
    const phone = subscribed[key];
    if(!phone) return;
    const name = firstName_(r[1]);
    const gift = birthdayGift_(birthdayStr_(r[13]), r[15], today, s);
    if(gift && String(r[14]) !== String(gift.year)){
      plan.birthday.push({ row: i + 2, phone: phone, name: name, year: gift.year, until: gift.until });
      return;
    }
    if(!s.remind || !plan.shopOpen || remindGroup_(key, s.remindEvery) !== group) return;
    const last = ymdOf_(r[3]);
    if(last && last > since){ plan.skipped++; return; }
    plan.remind.push({ phone: phone, name: name });
  });
  return plan;
}

// Dijalankan oleh trigger harian. Sekali sehari sahaja walaupun dipanggil lebih.
function harianNotif(){
  // v3.13.0: tukar bulan di sini juga (archiveCustomers kini perlu sesi admin)
  try{ archiveCustomersIfMonthChanged_(); }catch(err){ console.error('arkib bulanan gagal: ' + err); }
  const today = shopTodayStr_();
  const props = PropertiesService.getScriptProperties();
  if(props.getProperty(AUTO_PUSH_DATE_PROP_) === today || !pushKey_()) return;
  props.setProperty(AUTO_PUSH_DATE_PROP_, today);
  const result = { date: today, at: shopTimeStr_(), birthday: 0, remind: 0, skipped: 0, shopOpen: null, error: '' };
  try{
    const plan = autoPushPlan_(today);
    const s = plan.settings;
    result.shopOpen = plan.shopOpen;
    result.skipped = plan.skipped;
    const fill = (t, p) => t.replace(/\{nama\}/g, p.name).replace(/\{hingga\}/g, p.until ? p.until.slice(8, 10) + '/' + p.until.slice(5, 7) : '');
    // Tanda dahulu supaya ucapan tidak berganda jika penghantaran tergendala
    if(plan.birthday.length){
      const sheet = allCustomersSheet_();
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try{ plan.birthday.forEach(p => setTextCell_(sheet, p.row, 15, String(p.year))); }
      finally{ lock.releaseLock(); }
    }
    const items = plan.birthday.map(p => ({ phone: p.phone, tag: 'kfe-birthday', url: '/', title: fill(s.birthdayTitle, p), body: fill(s.birthdayBody, p) }))
      .concat(plan.remind.map(p => ({ phone: p.phone, tag: 'kfe-remind', url: '/', title: fill(s.remindTitle, p), body: fill(s.remindBody, p) })));
    const sent = {};
    // Worker hantar paling banyak 40 notifikasi sekali; seorang boleh ada 2 telefon
    for(let i = 0; i < items.length; i += 20){
      try{ Object.assign(sent, pushSend_(items.slice(i, i + 20))); }
      catch(err){ result.error = String(err.message || err).slice(0, 120); }
    }
    result.birthday = plan.birthday.filter(p => sent[p.phone] > 0).length;
    result.remind = plan.remind.filter(p => sent[p.phone] > 0).length;
  }catch(err){
    result.error = String(err.message || err).slice(0, 120);
    console.error('harianNotif gagal: ' + err);
  }
  props.setProperty(AUTO_PUSH_LAST_PROP_, JSON.stringify(result));
}

function autoPushTriggerInstalled_(){
  try{ return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'harianNotif'); }
  catch(e){ return false; }
}
// Jalankan SEKALI dari editor Apps Script (pilih pasangNotifHarian → Run → benarkan akses).
function pasangNotifHarian(){
  ScriptApp.getProjectTriggers().forEach(t => { if(t.getHandlerFunction() === 'harianNotif') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('harianNotif').timeBased().atHour(10).everyDays(1).inTimezone(SHOP_TZ_).create();
  Logger.log('✓ Notifikasi automatik dipasang: setiap hari sekitar 10 pagi.');
}
// Pilihan: hentikan semua notifikasi automatik
function buangNotifHarian(){
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(t => { if(t.getHandlerFunction() === 'harianNotif'){ ScriptApp.deleteTrigger(t); n++; } });
  Logger.log('✓ ' + n + ' trigger dibuang.');
}

/* ---------- v3.12.1: backup automatik mingguan ----------
   backupMingguan() dijalankan oleh trigger setiap Ahad sekitar 3 pagi: salin
   seluruh Google Sheet (semua tab: pelanggan, points, duit, order, laporan) ke
   folder Drive "K'fe De Sol Backup". 12 salinan terakhir (~3 bulan) disimpan;
   yang lebih lama dibuang ke Trash. Pasang dengan pasangBackup() SEKALI dari
   editor; ia juga terus buat backup pertama.
   Pulih: buka salinan dalam folder itu → File → Make a copy, atau salin tab
   yang perlu ke Sheet asal. */
const BACKUP_FOLDER_ = 'K\'fe De Sol Backup';
const BACKUP_PREFIX_ = 'Backup ';
const BACKUP_KEEP_ = 12;

function backupMingguan(){
  const ss = ss_();
  const it = DriveApp.getFoldersByName(BACKUP_FOLDER_);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER_);
  const name = BACKUP_PREFIX_ + ss.getName() + ' ' + Utilities.formatDate(new Date(), SHOP_TZ_, 'yyyy-MM-dd HH:mm');
  DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
  const copies = [];
  const files = folder.getFiles();
  while(files.hasNext()){
    const f = files.next();
    if(f.getName().indexOf(BACKUP_PREFIX_) === 0) copies.push(f);
  }
  copies.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
  copies.slice(BACKUP_KEEP_).forEach(f => f.setTrashed(true));
  PropertiesService.getScriptProperties().setProperty('BACKUP_LAST', shopTimeStr_());
  Logger.log('✓ ' + name + ' disimpan dalam folder "' + BACKUP_FOLDER_ + '" (' + Math.min(copies.length, BACKUP_KEEP_) + ' salinan).');
}

// Jalankan SEKALI dari editor Apps Script (pilih pasangBackup → Run → benarkan akses).
function pasangBackup(){
  ScriptApp.getProjectTriggers().forEach(t => { if(t.getHandlerFunction() === 'backupMingguan') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupMingguan').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).inTimezone(SHOP_TZ_).create();
  backupMingguan();
  Logger.log('✓ Backup automatik dipasang: setiap Ahad sekitar 3 pagi.');
}

// Jalankan sekali dari editor (pilihan): cipta & isi sheet SemuaPelanggan sekarang
function isiSemuaPelanggan(){
  const sheet = allCustomersSheet_();
  Logger.log('✓ SemuaPelanggan: ' + (sheet.getLastRow() - 1) + ' pelanggan.');
}

// Semak sambungan ke servis push (jalankan dari editor Apps Script)
function semakPush(){
  if(!pushKey_()){ Logger.log('✗ PUSH_KEY belum diisi. Project Settings → Script Properties → Add → PUSH_KEY'); return; }
  try{ pushSend_([{ phone: '0000000000', title: 'test', body: 'test' }]); Logger.log('✓ Sambungan ke servis push OK.'); }
  catch(e){ Logger.log('✗ ' + e.message); }
}
