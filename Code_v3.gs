/**
 * K'fe De Sol - Google Sheets Backend (v3, + MenuMeta)
 * v3.0: Tambah getMenuMeta, saveMenuMeta, saveMenuImage (Google Drive)
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

function ordersSheet_(){ return getSheet_('Orders', ['id','queueNo','items','total','status','createdAt','customerName','customerPhone']); }
function customersSheet_(){ return getSheet_('Customers', ['phone','name','count','qty']); }
function adminsSheet_(){ return getSheet_('Admins', ['id','name','username','password']); }
function metaSheet_(){ return getSheet_('Meta', ['key','value']); }
function menuMetaSheet_(){ return getSheet_('MenuMeta', ['id','desc','imageUrl','updatedAt']); }

function jsonOut_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
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

/* ================= MenuMeta helpers ================= */
function getMenuMeta_(){
  try{
    const sheet = menuMetaSheet_();
    const rows = sheet.getDataRange().getValues();
    if(rows.length <= 1) return { items: [] };
    const items = [];
    for(let i = 1; i < rows.length; i++){
      const [id, desc, imageUrl] = rows[i];
      if(id) items.push({ id: String(id), desc: String(desc || ''), imageUrl: String(imageUrl || '') });
    }
    return { items };
  }catch(e){ return { error: String(e) }; }
}

function saveMenuMeta_(id, desc, imageUrl){
  try{
    const sheet = menuMetaSheet_();
    const row = findRow_(sheet, 0, id);
    if(row === -1){
      sheet.appendRow([id, desc || '', imageUrl || '', new Date().toISOString()]);
    } else {
      if(desc !== null && desc !== undefined) sheet.getRange(row, 2).setValue(desc);
      if(imageUrl) sheet.getRange(row, 3).setValue(imageUrl);
      sheet.getRange(row, 4).setValue(new Date().toISOString());
    }
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
function doGet(e){
  const action = e.parameter.action;

  if(action === 'version'){
    return jsonOut_({ version: 'v3.0-menumeta' });
  }

  if(action === 'debug'){
    const custSheet = customersSheet_();
    const custData = custSheet.getDataRange().getValues();
    const metaSheet = metaSheet_();
    const metaData = metaSheet.getDataRange().getValues();
    return jsonOut_({ customersRowCount: custData.length, customersRaw: custData, metaRaw: metaData });
  }

  if(action === 'orders'){
    const sheet = ordersSheet_();
    const data = sheet.getDataRange().getValues();
    const orders = [];
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[0]) continue;
      orders.push({
        id: r[0], queueNo: Number(r[1]),
        items: JSON.parse(r[2] || '[]'),
        total: Number(r[3]), status: r[4],
        createdAt: Number(r[5]), customerName: r[6], customerPhone: r[7]
      });
    }
    return jsonOut_({ orders });
  }

  if(action === 'customers'){
    const sheet = customersSheet_();
    const data = sheet.getDataRange().getValues();
    const customers = {};
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[0]) continue;
      customers[r[0]] = { name: r[1], count: Number(r[2]) || 0, qty: Number(r[3]) || 0 };
    }
    return jsonOut_({ customers, currentMonth: getMeta_('current-month', '') });
  }

  if(action === 'admins'){
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

  if(action === 'meta'){
    return jsonOut_({ value: getMeta_(e.parameter.key, null) });
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
}

function doPost_(e){
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if(action === 'addOrder'){
    const o = body.order;
    let n = parseInt(getMeta_('counter', '0'), 10) || 0;
    n += 1;
    setMeta_('counter', String(n));
    const sheet = ordersSheet_();
    sheet.appendRow([o.id, n, JSON.stringify(o.items), o.total, o.status, o.createdAt, o.customerName, o.customerPhone]);
    setTextCell_(sheet, sheet.getLastRow(), 8, o.customerPhone || '');
    return jsonOut_({ queueNo: n });
  }

  if(action === 'updateOrderStatus'){
    const sheet = ordersSheet_();
    const row = findRow_(sheet, 0, body.id);
    if(row !== -1) sheet.getRange(row, 5).setValue(body.status);
    return jsonOut_({ ok: true });
  }

  if(action === 'bulkUpdateStatus'){
    const sheet = ordersSheet_();
    const data = sheet.getDataRange().getValues();
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      const key = r[7] || r[6] || r[0];
      if(String(key) !== String(body.key)) continue;
      if(body.fromStatus && r[4] !== body.fromStatus) continue;
      sheet.getRange(i + 1, 5).setValue(body.newStatus);
    }
    return jsonOut_({ ok: true });
  }

  if(action === 'resetOrders'){
    const sheet = ordersSheet_();
    const last = sheet.getLastRow();
    if(last > 1) sheet.deleteRows(2, last - 1);
    setMeta_('counter', '0');
    setMeta_('last-reset-date', todayStr_());
    return jsonOut_({ ok: true });
  }

  if(action === 'upsertCustomer'){
    const sheet = customersSheet_();
    const row = findRow_(sheet, 0, body.phone);
    if(row === -1){
      const newRow = sheet.getLastRow() + 1;
      setTextCell_(sheet, newRow, 1, body.phone);
      sheet.getRange(newRow, 2, 1, 3).setValues([[body.name, body.deltaCount || 0, body.deltaQty || 0]]);
    } else {
      const curCount = Number(sheet.getRange(row, 3).getValue()) || 0;
      const curQty = Number(sheet.getRange(row, 4).getValue()) || 0;
      setTextCell_(sheet, row, 1, body.phone);
      sheet.getRange(row, 2).setValue(body.name);
      sheet.getRange(row, 3).setValue(curCount + (body.deltaCount || 0));
      sheet.getRange(row, 4).setValue(curQty + (body.deltaQty || 0));
    }
    return jsonOut_({ ok: true });
  }

  if(action === 'setCustomerCount'){
    const sheet = customersSheet_();
    const row = findRow_(sheet, 0, body.phone);
    if(row !== -1) sheet.getRange(row, 3).setValue(body.count);
    return jsonOut_({ ok: true });
  }

  if(action === 'redeemFreeDrinks'){
    const sheet = customersSheet_();
    const row = findRow_(sheet, 0, body.phone);
    if(row !== -1){
      const curQty = Number(sheet.getRange(row, 4).getValue()) || 0;
      const reduceBy = (Number(body.count) || 0) * 6;
      const newQty = Math.max(0, curQty - reduceBy);
      sheet.getRange(row, 4).setValue(newQty);
      return jsonOut_({ ok: true, newQty });
    }
    return jsonOut_({ ok: true, newQty: 0 });
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
    return jsonOut_(saveMenuMeta_(body.id, body.desc, body.imageUrl || null));
  }

  // ★ NEW: save menu image to Google Drive
  if(action === 'saveMenuImage'){
    return jsonOut_(saveMenuImage_(body.id, body.base64, body.mimeType));
  }

  return jsonOut_({ error: 'unknown action' });
}

/* ================= Triggers ================= */
function dailyAutoReset(){
  const today = todayStr_();
  const lastReset = getMeta_('last-reset-date', '');
  if(lastReset === today) return;
  const sheet = ordersSheet_();
  const last = sheet.getLastRow();
  if(last > 1) sheet.deleteRows(2, last - 1);
  setMeta_('counter', '0');
  setMeta_('last-reset-date', today);
}

function archiveCustomersIfMonthChanged_(){
  const now = new Date();
  const curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
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
      snapshot[r[0]] = { name: r[1], count: Number(r[2]) || 0, qty: Number(r[3]) || 0 };
    }
    const reports = JSON.parse(getMeta_('reports', '{}'));
    reports[lastMonth] = snapshot;
    setMeta_('reports', JSON.stringify(reports));
    const last = sheet.getLastRow();
    if(last > 1) sheet.deleteRows(2, last - 1);
    setMeta_('current-month', curMonth);
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
