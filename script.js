/* ========================================
   SCRIPT.JS - ULTIMATE WEB CLIENT 🌐
   Fitur:
   1. Koneksi ke Google Sheet (Database Pusat)
   2. Sync Realtime (Web <-> Telegram)
   3. Mode Pacar (Notif Manja)
========================================= */

// --- KONFIGURASI SERVER ---
// ⚠️ GANTI URL INI DENGAN URL DEPLOYMENT GOOGLE APPS SCRIPT BARU KAMU!
const GAS_URL = "https://script.google.com/macros/s/AKfycbzIA9HgAreYkZqj_GChSQ1AdgsIJ2DkBgEYu88AFfoGlVJlSvOMbwmZh4qOMGsWB8Fg/exec";

// --- KONFIGURASI TELEGRAM (Untuk Notif Instan dari Web) ---
const TELEGRAM_TOKEN = "8581333428:AAFoab8W32zdKSKn4-NVI5WjRz0YCHH0vSE"; 
const CHAT_ID = "8400553086"; 

/* =========================================
   1. AUTHENTICATION
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
   2. DATA MANAGEMENT (CLOUD SYNC)
========================================= */
function getTasks() {
    return JSON.parse(localStorage.getItem("myTasks") || "[]");
}

// Fungsi Simpan: Save Lokal + Kirim ke Server Google
function saveTasks(tasks) {
    localStorage.setItem("myTasks", JSON.stringify(tasks));
    if(typeof renderTasks === 'function') renderTasks();
    if(typeof updateProgress === 'function') updateProgress();
    
    // Kirim data terbaru ke Google Sheet (Background Process)
    uploadToServer(tasks);
}

// --- FUNGSI SYNC KE SERVER (UPLOAD) ---
async function uploadToServer(tasks) {
    try {
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors", // Mode ini penting agar browser tidak memblokir request ke Google
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sync", tasks: tasks })
        });
        console.log("✅ Data tersimpan di Awan Google!");
    } catch (e) {
        console.error("Gagal upload:", e);
    }
}

// --- FUNGSI AMBIL DARI SERVER (DOWNLOAD) ---
// Ini yang bikin tugas dari HP muncul di Web
async function syncFromServer() {
    try {
        const response = await fetch(GAS_URL);
        const cloudTasks = await response.json();
        
        // Cek apakah data server beda dengan lokal?
        const localStr = localStorage.getItem("myTasks") || "[]";
        // Kita hanya ambil properti yang penting untuk dibandingkan
        const cloudStr = JSON.stringify(cloudTasks);
        
        // Jika data berbeda dan data server valid
        if (localStr !== cloudStr && Array.isArray(cloudTasks)) {
            console.log("🔄 Sinkronisasi data baru dari server...");
            localStorage.setItem("myTasks", cloudStr);
            if(typeof renderTasks === 'function') renderTasks();
            if(typeof updateProgress === 'function') updateProgress();
        }
    } catch (e) {
        // Silent error biar console gak merah kalau internet putus/server sibuk
        console.log("Sync skipped (Network/Server Busy)");
    }
}

// --- FUNGSI KIRIM TELEGRAM (SENDER) ---
async function sendTelegramAlert(rawMessage) {
    if (!TELEGRAM_TOKEN || !CHAT_ID) return;
    const text = encodeURIComponent(rawMessage);
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}&parse_mode=HTML`;
    try { await fetch(url); } catch (e) {}
}

/* =========================================
   3. TASK LOGIC (CRUD)
========================================= */
function addTask(name, date, priority) {
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
    // Simpan & Upload ke Google
    saveTasks(tasks); 

    // Notif Instan Mode Pacar
    const deadlineStr = new Date(date).toLocaleString('id-ID', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
    const msg = `
🆕 <b>SAYANG, ADA TUGAS BARU NIH!</b>

📝 Tugas: <b>${name}</b>
📅 Deadline: ${deadlineStr}
⚡ Priority: ${priority}

Semangat ngerjainnya ya ganteng! Jangan ditunda-tunda lho. Love you! 😘❤️
    `.trim();
    sendTelegramAlert(msg);
}

// --- EVENT LISTENER HALAMAN TASKS ---
const taskForm = document.getElementById("taskForm");
if (taskForm) {
    taskForm.addEventListener("submit", function(e) {
        e.preventDefault();
        const name = document.getElementById("taskName").value;
        const date = document.getElementById("taskDate").value;
        const priority = document.getElementById("taskPriority").value;

        if(name && date) {
            addTask(name, date, priority);
            taskForm.reset();
            document.getElementById("taskPriority").value = "Medium";
            alert("✅ Tugas dicatat & Disimpan ke Server!");
        }
    });
}

let currentFilter = "all";
function setFilter(filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    renderTasks();
}
function filterTasks() { renderTasks(); }

function renderTasks() {
    const list = document.getElementById("taskList");
    const empty = document.getElementById("emptyState");
    if (!list) return;

    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    let tasks = getTasks();

    tasks = tasks.filter(t => {
        if (currentFilter === "pending" && t.completed) return false;
        if (currentFilter === "completed" && !t.completed) return false;
        if (search && !t.name.toLowerCase().includes(search)) return false;
        return true;
    });

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
            const hasTime = t.date.includes("T") || t.date.length > 10;
            const dateOptions = { weekday:'short', day:'numeric', month:'short' };
            if(hasTime) { dateOptions.hour = '2-digit'; dateOptions.minute = '2-digit'; }
            const dateStr = dateObj.toLocaleDateString("id-ID", dateOptions);

            li.innerHTML = `
                <div class="task-info">
                    <span class="task-title" style="font-size:1.1rem; display:block; margin-bottom:4px; font-weight:600;">
                        ${t.name}
                        ${t.completed ? '<span class="badge" style="background:#ddd; color:#555; margin-left:5px; font-size:0.6rem">Selesai</span>' : ''}
                    </span>
                    <div class="task-meta" style="font-size:0.9rem; color:#666;">
                        <i class="far fa-calendar"></i> ${dateStr}
                        <span class="badge badge-${t.priority}" style="margin-left:8px">${t.priority}</span>
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
        
        if(t.completed) {
            const msg = `✅ <b>YEAY! TUGAS SELESAI!</b>\n\n"${t.name}"\n\nPinter banget sih pacar aku! 😍 Istirahat dulu gih. Muach! 💋`;
            sendTelegramAlert(msg);
        }
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

/* =========================================
   4. DASHBOARD LOGIC (COUNTDOWN UI)
   Note: Reminder WA/Telegram sekarang ditangani oleh Google Apps Script
========================================= */
function initDashboardTime() {
    const clockEl = document.getElementById("liveClock");
    const dateEl = document.getElementById("liveDate");
    const cdD = document.getElementById("cd-days");
    const cdH = document.getElementById("cd-hours");
    const cdM = document.getElementById("cd-minutes");
    const taskNameEl = document.getElementById("nextTaskName");

    if (!clockEl || !taskNameEl) return;

    function update() {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        dateEl.innerText = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

        const tasks = getTasks().filter(t => !t.completed).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (!tasks.length) {
            taskNameEl.innerText = "Tidak ada tugas 🎉";
            if(cdD) cdD.textContent = 0; if(cdH) cdH.textContent = 0; if(cdM) cdM.textContent = 0;
            return;
        }

        const next = tasks[0];
        taskNameEl.innerText = next.name;
        
        let nextDeadline = new Date(next.date);
        if (next.date.length <= 10) nextDeadline.setHours(23, 59, 59);
        const diff = nextDeadline - now;

        if (diff <= 0) {
            taskNameEl.innerText = "Telat: " + next.name;
            if(cdD) cdD.textContent = 0; if(cdH) cdH.textContent = 0; if(cdM) cdM.textContent = 0;
            return;
        }

        if(cdD) cdD.textContent = Math.floor(diff / 86400000);
        if(cdH) cdH.textContent = Math.floor((diff / 3600000) % 24);
        if(cdM) cdM.textContent = Math.floor((diff / 60000) % 60);
    }

    update();
    setInterval(update, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("liveClock")) initDashboardTime();
    
    // Inisialisasi Data
    if (document.getElementById("taskList")) {
        renderTasks(); 
        updateProgress();
        // Tarik data dari Google Sheet saat halaman dibuka
        syncFromServer();
    }
    
    // 🔥 AUTO SYNC SETIAP 5 DETIK 🔥
    // Ini biar kalau lu update lewat telegram (HP), di web (Laptop) langsung berubah
    setInterval(syncFromServer, 5000);
});
