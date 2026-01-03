/* =========================================
   SCRIPT.JS - ULTIMATE JALUR DARAT (V3) 🚜
   Fitur:
   1. Anti-Spam Telegram (ID Filtering)
   2. Chatbot Web Pinter (Sapaan Waktu & Menu Lengkap)
   3. Auto Reminder & LocalStorage
========================================= */

/* -----------------------------------------
   ⚠️ KONFIGURASI TELEGRAM ⚠️
   ----------------------------------------- */
const TELEGRAM_TOKEN = "8581333428:AAFoab8W32zdKSKn4-NVI5WjRz0YCHH0vSE"; 
const CHAT_ID = "8400553086"; 

/* =========================================
   1. AUTHENTICATION & LOGIN
========================================= */
const VALID_USER = "admin";
const VALID_PASS = "12345";

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", e => {
        e.preventDefault();
        const user = document.getElementById("username").value;
        const pass = document.getElementById("password").value;
        const errorMsg = document.getElementById("errorMsg");

        if (user === VALID_USER && pass === VALID_PASS) {
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("username", user);
            window.location.href = "dashboard.html";
        } else {
            if (errorMsg) errorMsg.innerText = "Username atau Password salah!";
        }
    });
}

function checkAuth() {
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') return;
    if (!localStorage.getItem("isLoggedIn")) window.location.href = "index.html";
}

function logout() {
    if(confirm("Yakin mau logout?")) {
        localStorage.clear();
        window.location.href = "index.html";
    }
}

/* =========================================
   2. DATA MANAGEMENT (CORE)
========================================= */
function getTasks() {
    return JSON.parse(localStorage.getItem("myTasks") || "[]");
}

function saveTasks(tasks) {
    localStorage.setItem("myTasks", JSON.stringify(tasks));
    if(typeof renderTasks === 'function') renderTasks();
    if(typeof updateProgress === 'function') updateProgress();
}

// --- FUNGSI KIRIM TELEGRAM (SENDER) ---
async function sendTelegramAlert(rawMessage) {
    if (!TELEGRAM_TOKEN || !CHAT_ID) return;
    const text = encodeURIComponent(rawMessage);
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}&parse_mode=HTML`;
    try { await fetch(url); } catch (e) { console.error("Gagal kirim TG:", e); }
}

// --- FUNGSI TAMBAH TUGAS ---
function addTask(name, date, priority, fromTelegram = false) {
    const tasks = getTasks();
    const now = Date.now();
    
    const newTask = {
        id: now,
        name: name,
        date: date,
        priority: priority,
        completed: false,
        notified_urgent: false,
        last_reminded: now
    };
    
    tasks.push(newTask);
    saveTasks(tasks);

    // Notif balik ke Telegram (hanya kalau input manual dr web)
    if (!fromTelegram) {
        const deadlineStr = new Date(date).toLocaleString('id-ID', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
        const msg = `🆕 <b>TUGAS DICATAT SAYANG!</b>\n\n📝 <b>${name}</b>\n📅 ${deadlineStr}\n⚡ ${priority}\n\nSemangat ngerjainnya! Muach! 😘`;
        sendTelegramAlert(msg);
    }
}

/* =========================================
   3. TELEGRAM RECEIVER (ANTI-SPAM SYSTEM) 🔥
   Menangkap chat dari Telegram -> Masuk Web
========================================= */
let lastUpdateId = parseInt(localStorage.getItem("tg_last_update") || "0");

async function pollTelegramMessages() {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=0`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.ok && data.result.length > 0) {
            // Ambil daftar ID pesan yang sudah diproses biar gak double
            let processedIds = JSON.parse(localStorage.getItem("processed_msg_ids") || "[]");

            data.result.forEach(update => {
                // Update Offset biar server tau kita udah baca
                if (update.update_id > lastUpdateId) {
                    lastUpdateId = update.update_id;
                    localStorage.setItem("tg_last_update", lastUpdateId);
                }

                if (update.message && update.message.chat.id.toString() === CHAT_ID) {
                    const msgId = update.message.message_id;

                    // 🔥 FILTER ANTI SPAM: Cek apakah pesan ini udah diproses?
                    if (processedIds.includes(msgId)) {
                        return; // SKIP
                    }

                    // Proses Pesan
                    processTelegramText(update.message.text);

                    // Catat ID pesan ini sebagai "Sudah Diproses"
                    processedIds.push(msgId);
                    // Batasi memori cuma simpan 50 pesan terakhir biar gak berat
                    if (processedIds.length > 50) processedIds.shift();
                    localStorage.setItem("processed_msg_ids", JSON.stringify(processedIds));
                }
            });
        }
    } catch (e) { /* Silent error */ }
}

function processTelegramText(text) {
    const lower = text.toLowerCase();
    if (!lower.match(/tugas|ingetin|catet|pr|deadline/)) return;

    let priority = "Medium";
    if (lower.match(/penting|urgent|parah|high/)) priority = "High";
    else if (lower.match(/santai|gampang|low/)) priority = "Low";

    // Logika Tanggal Pintar
    let date = new Date();
    let dateSet = false;

    if (lower.includes("besok")) { date.setDate(date.getDate() + 1); dateSet = true; }
    else if (lower.includes("lusa")) { date.setDate(date.getDate() + 2); dateSet = true; }
    
    const tglMatch = lower.match(/(?:tanggal\s+|tgl\s+)?(\d{1,2})\s*([a-z]+)?/);
    if (tglMatch && !dateSet) {
        const tgl = parseInt(tglMatch[1]);
        const blnStr = tglMatch[2];
        const bulanIndo = {"januari":0,"jan":0,"februari":1,"feb":1,"maret":2,"mar":2,"april":3,"apr":3,"mei":4,"juni":5,"jun":5,"juli":6,"jul":6,"agustus":7,"agus":7,"september":8,"sep":8,"oktober":9,"okt":9,"november":10,"nov":10,"desember":11,"des":11};
        
        if (tgl >= 1 && tgl <= 31) {
            date.setDate(tgl);
            if (blnStr && bulanIndo.hasOwnProperty(blnStr)) {
                date.setMonth(bulanIndo[blnStr]);
                const now = new Date();
                if (date.getMonth() < now.getMonth() && date.getFullYear() === now.getFullYear()) {
                    date.setFullYear(date.getFullYear() + 1);
                }
            } else if (tgl < new Date().getDate()) {
                date.setMonth(date.getMonth() + 1);
            }
        }
    }

    const jamMatch = lower.match(/jam\s?(\d{1,2})([.:](\d{2}))?/);
    if (jamMatch) {
        let jam = parseInt(jamMatch[1]);
        let menit = jamMatch[3] ? parseInt(jamMatch[3]) : 0;
        if ((lower.includes("siang") || lower.includes("sore")) && jam < 12) jam += 12;
        if (lower.includes("malam")) { if (jam === 12) jam = 0; else if (jam < 12) jam += 12; }
        date.setHours(jam, menit, 0, 0);
    } else {
        date.setHours(23, 59, 59);
    }

    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 16);

    let cleanName = text.replace(/tolong|dong|tugas|ingetin|catet|pr|besok|lusa|jam\s?\d+|pagi|siang|sore|malam|penting|urgent|tanggal\s?\d+/gi, "").replace(/[,.-]/g, "").trim();
    if (cleanName.length < 2) cleanName = "Tugas Dari Telegram";
    else cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    addTask(cleanName, localISOTime, priority, true);

    const deadlineStr = date.toLocaleString('id-ID', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
    sendTelegramAlert(`🤖 <b>SIAP LUR!</b>\n\n✅ <b>${cleanName}</b> udah dicatet.\n📅 Deadline: ${deadlineStr}\n\nJangan lupa dikerjain ya! 👍`);
}

/* =========================================
   4. CHATBOT WEB LOGIC 🤖 (SUPER INTERAKTIF)
========================================= */
const chatBox = document.getElementById('chat-box');
const chatBody = document.getElementById('chat-body');
const chatInput = document.getElementById('chat-input');
const toggleBtn = document.getElementById('chat-toggle-btn');
const closeBtn = document.getElementById('chat-close-btn');
const sendBtn = document.getElementById('chat-send-btn');

// --- Greeting Sesuai Jam ---
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 19) return "Selamat Sore";
    return "Selamat Malam";
}

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        chatBox.classList.remove('hidden');
        // Jika chat masih kosong, kasih sapaan otomatis
        if (chatBody.children.length <= 1) {
            const greeting = getGreeting();
            const msg = `Hai, ${greeting} Sayang! ❤️<br>Aku siap bantu kamu nih. Mau ngapain?`;
            const menu = [
                { text: "📅 Cek Tanggal", action: "date" },
                { text: "📝 Cek Tugas", action: "check_tasks" },
                { text: "➕ Tambah Tugas", action: "add_info" },
                { text: "💡 Motivasi", action: "quote" },
                { text: "👤 About Me", action: "about" }
            ];
            // Hapus pesan lama biar fresh
            chatBody.innerHTML = '';
            addMessage(msg, 'bot', menu);
        }
    });

    closeBtn.addEventListener('click', () => chatBox.classList.add('hidden'));
    sendBtn.addEventListener('click', () => sendMessage());
    chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });
}

function sendMessage() {
    const text = chatInput.value.trim();
    if(text === "") return;
    addMessage(text, 'user');
    chatInput.value = "";
    setTimeout(() => { processBotResponse(text); }, 500);
}

function processBotResponse(input) {
    const lower = input.toLowerCase();
    
    // --- 1. MENU UTAMA ---
    if (lower.match(/halo|hi|hai|menu|bantuan|help/)) {
        const greeting = getGreeting();
        const msg = `${greeting} ganteng! 👇 Pilih menu di bawah ya:`;
        const options = [
            { text: "📅 Cek Tanggal", action: "date" },
            { text: "📝 Cek Tugas", action: "check_tasks" },
            { text: "➕ Tambah Tugas", action: "add_info" },
            { text: "💡 Motivasi", action: "quote" },
            { text: "👤 About Me", action: "about" },
            { text: "🧹 Hapus Chat", action: "clear" }
        ];
        addMessage(msg, 'bot', options);
        return;
    }

    // --- 2. CEK TANGGAL ---
    if (lower.includes('tanggal') || lower.includes('date')) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        addMessage(`Sekarang hari <b>${dateStr}</b>, jam <b>${timeStr}</b>.\nJangan lupa sholat ya sayang! 🕌`, 'bot', [{ text: "⬅️ Menu", action: "menu" }]);
        return;
    }

    // --- 3. ABOUT ME ---
    if (lower.includes('about') || lower.includes('siapa') || lower.includes('pembuat')) {
        addMessage("<b>Tentang Aku:</b><br>Aku adalah AI Assistant 'D-Project' yang dibuat khusus oleh <b>Musa</b> untuk nemenin kamu produktif! Jangan lupa traktir kopi ya! ☕", 'bot', [{ text: "⬅️ Menu", action: "menu" }]);
        return;
    }

    // --- 4. CEK TUGAS ---
    if (lower.includes('tugas') || lower.includes('cek') || lower.includes('check_tasks')) {
        const tasks = getTasks();
        const pending = tasks.filter(t => !t.completed);
        if (pending.length === 0) {
            addMessage("Wah, kamu rajin banget! Semua tugas udah kelar. Istirahat gih sayang! 🥰", 'bot');
        } else {
            let listHtml = "<b>Daftar Tugas Kamu:</b><br>";
            pending.forEach(t => { listHtml += `• ${t.name} (${t.priority})<br>`; });
            listHtml += "<br>Semangat ngerjainnya ya!";
            addMessage(listHtml, 'bot', [{ text: "⬅️ Menu", action: "menu" }]);
        }
        return;
    }

    // --- 5. INFO TAMBAH TUGAS ---
    if (lower.includes('tambah') || lower.includes('add')) {
        addMessage("<b>Cara Tambah Tugas:</b><br>1. Lewat Form di Dashboard.<br>2. Lewat Telegram: Chat aja <i>'Ingatin tugas MTK besok jam 8'</i>.<br><br>Gampang kan? 😉", 'bot', [{ text: "Siap!", action: "menu" }]);
        return;
    }

    // --- 6. MOTIVASI ---
    if (lower.includes('motivasi') || lower.includes('quote')) {
        const quotes = [
            "Masa depan adalah milik mereka yang menyiapkannya hari ini.",
            "Jangan bandingkan prosesmu dengan orang lain. Kamu punya zonamu sendiri.",
            "Lelah itu wajar, berhenti itu jangan! 💪",
            "Ingat, coding itu 1% ngoding, 99% nyari error di Google. 😂"
        ];
        const random = quotes[Math.floor(Math.random() * quotes.length)];
        addMessage(`✨ <i>"${random}"</i>`, 'bot', [{ text: "Lagi dong", action: "quote" }, { text: "⬅️ Menu", action: "menu" }]);
        return;
    }

    // --- 7. CLEAR CHAT ---
    if (lower.includes('clear') || lower.includes('hapus')) {
        chatBody.innerHTML = '';
        const greeting = getGreeting();
        addMessage(`${greeting} sayang! Chat udah bersih nih. ✨`, 'bot', [{ text: "Menu", action: "menu" }]);
        return;
    }

    // DEFAULT
    addMessage("Maaf sayang, aku gak ngerti maksudnya 🥺. Coba klik menu di bawah ya.", 'bot', [{ text: "Buka Menu", action: "menu" }]);
}

function addMessage(html, sender, options = []) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    let content = `<p>${html}</p>`;
    if (options.length > 0) {
        content += `<div class="options">`;
        options.forEach(opt => { content += `<button onclick="sendOption('${opt.action}')">${opt.text}</button>`; });
        content += `</div>`;
    }
    div.innerHTML = content;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function sendOption(action) { processBotResponse(action); }

/* =========================================
   5. UI TASKS & REMINDER SYSTEM
========================================= */
const taskForm = document.getElementById("taskForm");
if (taskForm) {
    taskForm.addEventListener("submit", function(e) {
        e.preventDefault();
        const name = document.getElementById("taskName").value;
        const date = document.getElementById("taskDate").value;
        const priority = document.getElementById("taskPriority").value;
        if(name && date) {
            addTask(name, date, priority, false);
            taskForm.reset();
            document.getElementById("taskPriority").value = "Medium";
            alert("✅ Tugas dicatat!");
        }
    });
}

function renderTasks() {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("emptyState");
    if (!list) return;

    let tasks = getTasks();
    tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
    list.innerHTML = "";

    if (!tasks.length) {
        if(empty) empty.style.display = "block";
    } else {
        if(empty) empty.style.display = "none";
        tasks.forEach(t => {
            const li = document.createElement("li");
            li.className = `task-item ${t.completed ? "completed" : ""}`;
            li.setAttribute('data-priority', t.priority);
            
            const dateObj = new Date(t.date);
            const dateStr = dateObj.toLocaleDateString("id-ID", { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

            li.innerHTML = `
                <div class="task-info">
                    <span class="task-title" style="font-size:1.1rem; display:block; margin-bottom:4px; font-weight:600;">
                        ${t.name} ${t.completed ? '<span class="badge" style="background:#ddd; color:#555; font-size:0.6rem">Selesai</span>' : ''}
                    </span>
                    <div class="task-meta" style="font-size:0.9rem; color:#666;">
                        <i class="far fa-calendar"></i> ${dateStr} <span class="badge badge-${t.priority}" style="margin-left:8px">${t.priority}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button onclick="toggleTask(${t.id})" class="btn-check" style="color:#2ed573"><i class="fas fa-check-circle fa-lg"></i></button>
                    <button onclick="deleteTask(${t.id})" class="btn-delete" style="color:#ff4757"><i class="fas fa-trash-alt fa-lg"></i></button>
                </div>
            `;
            list.appendChild(li);
        });
    }
}

function toggleTask(id) {
    const tasks = getTasks();
    const t = tasks.find(t => t.id === id);
    if (t) { 
        t.completed = !t.completed; 
        saveTasks(tasks); 
        if(t.completed) sendTelegramAlert(`✅ <b>TUGAS SELESAI!</b>\n"${t.name}"\nMantap lur! 🎉`);
    }
}

function deleteTask(id) {
    if (confirm("Yakin hapus?")) { saveTasks(getTasks().filter(t => t.id !== id)); }
}

function updateProgress() {
    const bar = document.getElementById("progressBar");
    const txt = document.getElementById("progressText");
    if (!bar) return;
    const tasks = getTasks();
    const done = tasks.filter(t => t.completed).length;
    const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    bar.style.width = percent + "%";
    if(txt) txt.innerText = percent + "%";
}

function initDashboardTime() {
    const clockEl = document.getElementById("liveClock");
    const dateEl = document.getElementById("liveDate");
    const cdD = document.getElementById("cd-days");
    const cdH = document.getElementById("cd-hours");
    const cdM = document.getElementById("cd-minutes");
    const taskNameEl = document.getElementById("nextTaskName");

    if (!clockEl) return;

    function update() {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        dateEl.innerText = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

        let tasks = getTasks();
        let tasksChanged = false;

        tasks.forEach(t => {
            if (!t.completed) {
                let deadline = new Date(t.date);
                if (t.date.length <= 10) deadline.setHours(23, 59, 59);
                const diff = deadline - now.getTime();

                // Alert H-1 Jam
                if (diff > 0 && diff <= 3600000 && !t.notified_urgent) {
                    sendTelegramAlert(`🚨 <b>DEADLINE MEPET!</b>\n📌 ${t.name}\n⏳ < 1 Jam lagi! Buruan!`);
                    t.notified_urgent = true;
                    tasksChanged = true;
                }
            }
        });

        if (tasksChanged) localStorage.setItem("myTasks", JSON.stringify(tasks));

        const activeTasks = tasks.filter(t => !t.completed).sort((a, b) => new Date(a.date) - new Date(b.date));
        if (!activeTasks.length) {
            if(taskNameEl) taskNameEl.innerText = "Tidak ada tugas 🎉";
            if(cdD) cdD.textContent = 0; if(cdH) cdH.textContent = 0; if(cdM) cdM.textContent = 0;
            return;
        }

        const next = activeTasks[0];
        if(taskNameEl) taskNameEl.innerText = next.name;
        
        let nextDeadline = new Date(next.date);
        if (next.date.length <= 10) nextDeadline.setHours(23, 59, 59);
        const nextDiff = nextDeadline - now;

        if (nextDiff <= 0) {
            if(taskNameEl) taskNameEl.innerText = "Telat: " + next.name;
            if(cdD) cdD.textContent = 0; if(cdH) cdH.textContent = 0; if(cdM) cdM.textContent = 0;
            return;
        }

        if(cdD) cdD.textContent = Math.floor(nextDiff / 86400000);
        if(cdH) cdH.textContent = Math.floor((nextDiff / 3600000) % 24);
        if(cdM) cdM.textContent = Math.floor((nextDiff / 60000) % 60);
    }

    update();
    setInterval(update, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("liveClock")) initDashboardTime();
    if (document.getElementById("taskList")) { renderTasks(); updateProgress(); }
    
    // 🔥 PENTING: JALANKAN POLLING 3 DETIK 🔥
    setInterval(pollTelegramMessages, 3000);
});