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
 */

function ss_(){ return SpreadsheetApp.getActiveSpreadsheet(); }

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
  const friends = {};
  data.forEach(r => { const by = String(r[8] || ''); if(by) friends[by] = (friends[by] || 0) + 1; });
  return data.map(r => ({
    phone: String(r[0]), name: String(r[1] || ''), firstSeen: String(r[2] || ''), lastOrder: String(r[3] || ''),
    orders: Number(r[4]) || 0, cups: Number(r[5]) || 0,
    points: Number(r[6]) || 0, referralCode: String(r[7] || ''),
    referredBy: String(r[8] || ''), rm: rm2_(r[9]), rmEarned: rm2_(r[10]), friends: friends[String(r[7] || '')] || 0
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
  const r = sheet.getRange(rows[0], 1, 1, 12).getValues()[0];
  const code = String(r[7] || '');
  const last = sheet.getLastRow();
  const friends = last < 2 ? 0 : sheet.getRange(2, 9, last - 1, 1).getValues().filter(x => String(x[0]) === code).length;
  return { points: Number(r[6]) || 0, referralCode: code, perCup: pointsPerCup_(),
    rm: rm2_(r[9]), rmEarned: rm2_(r[10]), friends: friends, referredBy: String(r[8] || ''),
    canEnterCode: !String(r[8] || '') && !(Number(r[4]) > 0), refRm: referralRm_(), refMax: referralMax_() };
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
const REWARD_HEADERS_ = ['id','title','points','imageUrl','fileId','visible','createdAt','status'];
const REWARD_STATUSES_ = ['available','soldout','unavailable','comingsoon'];
function rewardsSheet_(){
  const sheet = getSheet_('Rewards', REWARD_HEADERS_);
  if(String(sheet.getRange(1, 8).getValue()) !== 'status') sheet.getRange(1, 8).setValue('status');
  return sheet;
}
function rewardFromRow_(r){
  const visibleCell = r[5] === '' || r[5] == null || r[5] === true || String(r[5]).toLowerCase() === 'true';
  const status = REWARD_STATUSES_.indexOf(String(r[7])) !== -1 ? String(r[7]) : (visibleCell ? 'available' : 'unavailable');
  return { id: String(r[0]), title: String(r[1] || ''), points: Number(r[2]) || 0, imageUrl: String(r[3] || ''),
    status: status, visible: status !== 'unavailable', createdAt: Number(r[6]) || 0 };
}
// Hadiah disusun ikut points (paling murah dahulu), macam katalog Setel.
function getRewards_(includeHidden){
  return rewardsSheet_().getDataRange().getValues().slice(1)
    .filter(r => r[0])
    .map(rewardFromRow_)
    .filter(x => includeHidden || x.visible)
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
  if(isNew){
    row = sheet.getLastRow() + 1;
    const st = status || 'available';
    sheet.getRange(row, 1, 1, 8).setValues([[id, title, points, image ? image.url : '', image ? image.fileId : '', st !== 'unavailable', Date.now(), st]]);
  } else {
    const cur = sheet.getRange(row, 1, 1, 8).getValues()[0];
    if(image && cur[4]){ try{ DriveApp.getFileById(String(cur[4])).setTrashed(true); }catch(e){} }
    const st = status || rewardFromRow_(cur).status;
    sheet.getRange(row, 2, 1, 7).setValues([[title, points, image ? image.url : cur[3], image ? image.fileId : cur[4], st !== 'unavailable', cur[6], st]]);
  }
  return { ok:true, reward: rewardFromRow_(sheet.getRange(row, 1, 1, 8).getValues()[0]) };
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
  const reward = rewardFromRow_(rewardsSheet_().getRange(rRow, 1, 1, 8).getValues()[0]);
  if(reward.status !== 'available') return { ok:false, error:'REWARD_NOT_AVAILABLE', status:reward.status };
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
  const required = ['id','desc','imageUrl','name','price','published','updatedAt'];
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
  const addPoints = qty * pointsPerCup_();
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

/* ================= Admin session security ================= */
const ADMIN_SESSION_TTL_MS_ = 7 * 24 * 60 * 60 * 1000;
function adminSessionKey_(token){ return 'admin-session-token-' + String(token); }

function findAdminByLogin_(username, password){
  const sheet = adminsSheet_();
  let data = sheet.getDataRange().getValues();
  if(data.length <= 1){
    sheet.appendRow(['a_' + Date.now(), 'Admin', 'admin', 'admin123']);
    data = sheet.getDataRange().getValues();
  }
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(String(r[2]) === String(username) && String(r[3]) === String(password)){
      return { id:String(r[0]), name:String(r[1]), username:String(r[2]) };
    }
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
function getMenuMeta_(){
  try{
    const sheet = menuMetaSheet_();
    const rows = sheet.getDataRange().getValues();
    const cols = menuMetaColumns_(sheet);
    if(rows.length <= 1) return { items: [] };
    const items = [];
    for(let i = 1; i < rows.length; i++){
      const id = rows[i][cols.id - 1];
      if(id) items.push({
        id: String(id),
        desc: String(rows[i][cols.desc - 1] || ''),
        imageUrl: String(rows[i][cols.imageUrl - 1] || ''),
        name: String(rows[i][cols.name - 1] || ''),
        price: rows[i][cols.price - 1],
        published: rows[i][cols.published - 1] === '' ? true : rows[i][cols.published - 1]
      });
    }
    return { items };
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
  catch(err){ return jsonOut_({ error: String(err), stack: err.stack || '' }); }
}

function doGet_(e){
  const action = e.parameter.action;

  if(action === 'version'){
    return jsonOut_({ version: 'v3.10.0-secure' });
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

  // v3.10.0: katalog hadiah. Pelanggan nampak yang dipaparkan sahaja; admin nampak semua.
  if(action === 'rewards'){
    return jsonOut_({ rewards:getRewards_(!!sessionFrom_(e.parameter)), perCup:pointsPerCup_(), refRm:referralRm_(), refMax:referralMax_() });
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
    const sheet = adminsSheet_();
    let data = sheet.getDataRange().getValues();
    if(data.length <= 1){
      sheet.appendRow(['a_' + Date.now(), 'Admin', 'admin', 'admin123']);
      data = sheet.getDataRange().getValues();
    }
    const admins = [];
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[0]) continue;
      admins.push({ id: r[0], name: r[1], username: String(r[2]), password: String(r[3]) });
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
    return jsonOut_(getMenuMeta_());
  }

  return jsonOut_({ error: 'unknown action' });
}

/* ================= POST ================= */
function doPost(e){
  try{ return doPost_(e); }
  catch(err){ return jsonOut_({ error: String(err), stack: err.stack || '' }); }
  // Notifikasi dihantar selepas kunci (lock) dilepaskan, supaya order lain tidak tertunggu
  finally{ flushPush_(); }
}

function doPost_(e){
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if(action === 'adminLogin'){
    const admin = findAdminByLogin_(body.username, body.password);
    if(!admin) return jsonOut_({ ok:false, error:'LOGIN_FAILED' });
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
    'saveReward','deleteReward','redeemReward','useBalance'
  ];
  if(adminOnlyActions.indexOf(action) !== -1 && !sessionFrom_(body)){
    return jsonOut_({ error:'SESSION_INVALID' });
  }

  if(action === 'addOrder'){
    if(!shopOpenNow_()) return jsonOut_({ error:'SHOP_CLOSED' });
    const o = body.order;
    // Loyalty is credited from these items, so reject anything the app itself
    // could never send (no items, silly quantities, missing id).
    const items = o && Array.isArray(o.items) ? o.items : [];
    const itemsValid = items.length > 0 && items.length <= 30 && items.every(i =>
      i && String(i.name || '').trim() && Number.isInteger(Number(i.qty)) && Number(i.qty) >= 1 && Number(i.qty) <= 99 &&
      Number(i.price) >= 0);
    if(!o || !o.id || !itemsValid) return jsonOut_({ error:'INVALID_ORDER' });
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
      return jsonOut_({ queueNo: n, loyalty: 'pending' });
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

  if(action === 'addAdmin'){
    const sheet = adminsSheet_();
    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1).setValue('a_' + Date.now());
    sheet.getRange(newRow, 2).setValue(body.name);
    setTextCell_(sheet, newRow, 3, body.username);
    setTextCell_(sheet, newRow, 4, body.password);
    return jsonOut_({ ok: true });
  }

  if(action === 'updateAdmin'){
    const sheet = adminsSheet_();
    const row = findRow_(sheet, 0, body.id);
    if(row !== -1){
      sheet.getRange(row, 2).setValue(body.name);
      setTextCell_(sheet, row, 3, body.username);
      setTextCell_(sheet, row, 4, body.password);
    }
    return jsonOut_({ ok: true });
  }

  if(action === 'deleteAdmin'){
    const sheet = adminsSheet_();
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
    const data = sheet.getDataRange().getValues();
    const snapshot = {};
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[0]) continue;
      snapshot[r[0]] = loyaltyFromRow_(r);
    }
    const reports = JSON.parse(getMeta_('reports', '{}'));
    reports[lastMonth] = snapshot;
    setMeta_('reports', JSON.stringify(reports));
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
