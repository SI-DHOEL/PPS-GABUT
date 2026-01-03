// Google Apps Script untuk menerima update dari Telegram dan menyimpan tugas ke Google Sheet
// Cara pakai:
// 1. Ganti TELEGRAM_TOKEN_GAS dan SPREADSHEET_ID di bawah.
// 2. Buat Google Sheet baru dan catat ID (dari URL)
// 3. Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone
// 4. Copy URL dan jalankan fungsi setWebhook(WEB_APP_URL) di editor GAS untuk mendaftarkan webhook ke Telegram

const TELEGRAM_TOKEN_GAS = 'REPLACE_WITH_YOUR_BOT_TOKEN';
const SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SPREADSHEET_ID';
const SHEET_NAME = 'Tasks';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || '';

      if (/tambah|ingetin|masukin/i.test(text)) {
        const parsed = parseTaskNatural(text);
        saveTaskToSheet(parsed);
        const reply = `✅ <b>Tugas diterima</b>\n\n📝 ${escapeHtml(parsed.name)}\n📅 ${parsed.humanDate}\n⚡ ${parsed.priority}`;
        sendTelegramMessage(chatId, reply);
      } else {
        const help = 'Halo! Saya bot tugas. Contoh perintah:\n"Tambah tugas PKN tanggal 9 jam 15 penting"';
        sendTelegramMessage(chatId, help);
      }
    }
  } catch (err) {
    console.error(err);
  }
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
}

function parseTaskNatural(input) {
  const text = input.toLowerCase();
  const now = new Date();

  let priority = 'Medium';
  if (/penting|urgent|high/.test(text)) priority = 'High';
  if (/santai|low/.test(text)) priority = 'Low';

  let date = new Date(now);
  if (text.includes('besok')) date.setDate(date.getDate() + 1);
  else if (text.includes('lusa')) date.setDate(date.getDate() + 2);

  const tglMatch = text.match(/tanggal\s(\d{1,2})/);
  if (tglMatch) {
    const tgl = parseInt(tglMatch[1], 10);
    date.setDate(tgl);
    if (date < now) date.setMonth(date.getMonth() + 1);
  }

  let hour = 9, minute = 0;
  const jamMatch = text.match(/jam\s(\d{1,2})(?:[:.](\d{2}))?/);
  if (jamMatch) {
    hour = parseInt(jamMatch[1], 10);
    minute = jamMatch[2] ? parseInt(jamMatch[2], 10) : 0;
  }

  if (text.includes('pagi')) { if (hour === 12) hour = 0; }
  else if (text.includes('siang')) { if (hour < 12) hour += 12; }
  else if (text.includes('sore')) { if (hour < 12) hour += 12; }
  else if (text.includes('malam')) { if (hour === 12) hour = 0; else if (hour < 12) hour += 12; }

  if (hour > 23) hour = 23; if (minute > 59) minute = 0;
  date.setHours(hour, minute, 0, 0);

  let name = input.replace(/tambah|ingetin|masukin|tolong|dong/gi, '')
    .replace(/tanggal\s\d{1,2}/gi, '')
    .replace(/besok|lusa/gi, '')
    .replace(/jam\s\d{1,2}([.:]\d{2})?/gi, '')
    .replace(/pagi|siang|sore|malam/gi, '')
    .replace(/penting|urgent|high|santai|low/gi, '')
    .trim();

  if (name.length < 3) name = 'Tugas Baru';

  return {
    name: name,
    date: date.toISOString(),
    humanDate: Utilities.formatDate(date, Session.getScriptTimeZone(), "EEE, d MMM yyyy HH:mm"),
    priority: priority
  };
}

function saveTaskToSheet(task) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id','name','date','priority','completed','created_at']);
  }
  const id = Date.now();
  sheet.appendRow([id, task.name, task.date, task.priority, false, new Date()]);
}

function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN_GAS}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  const options = { method: 'post', payload: payload, muteHttpExceptions: true };
  UrlFetchApp.fetch(url, options);
}

function setWebhook(webAppUrl) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN_GAS}/setWebhook?url=${encodeURIComponent(webAppUrl)}`;
  const res = UrlFetchApp.fetch(url);
  Logger.log(res.getContentText());
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
