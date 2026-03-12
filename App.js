// ══════════════════════════════════════════
// CONFIG + CONSTANTS
// ══════════════════════════════════════════
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztfxOJsfCSyza8OL9xkpw5t7ncJUJzeFhfmaOgmmh3QnNCZ9Vl3tAwa87FIbMnTlA00A/exec";
const ORDER_URL    = "order.html";
const PAYMENT_URL  = "payment.html";
const RETURN_URL   = "return.html";
const ADMIN_URL    = "admin.html";

const MIN_CHECKOUT = 10 * 1000;     // 10 seconds minimum
const GPS_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ══════════════════════════════════════════
// STORAGE HELPER
// ══════════════════════════════════════════
const store = {
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  del: (k) => { try { localStorage.removeItem(k); } catch {} }
};

// ══════════════════════════════════════════
// LANGUAGE SUPPORT
// ══════════════════════════════════════════
let lang = store.get("lang") || "hi";

const L = {
  hi: {
    title: "फील्ड अटेंडेंस",
    sub: "अपनी डेली अटेंडेंस और विज़िट ट्रैक करो",
    start: "शुरू करें →",
    loginas: "लॉग इन है",
    verifyH: "👤 पहचान सत्यापित करें",
    verifyP: "अपना नाम और PIN डालें",
    nameLbl: "अपना नाम चुनें",
    pinLbl: "PIN / पासवर्ड",
    loginBtn: "लॉगिन →",
    ci: "चेक-इन",
    ciSub: "दिन शुरू करो",
    co: "चेक-आउट",
    coSub: "दिन खत्म करो",
    re: "नई विज़िट",
    reSub: "दोबारा विज़िट दर्ज करो",
    gSub: "आज क्या करना है?",
    quickPhoto: "Quick Photo",
    visitPhoto: "Visit Photo lo"
  },
  en: {
    title: "Field Attendance",
    sub: "Track your daily attendance & visits",
    start: "Get Started →",
    loginas: "Logged in as",
    verifyH: "👤 Verify Identity",
    verifyP: "Enter your name and PIN",
    nameLbl: "Select your name",
    pinLbl: "PIN / Password",
    loginBtn: "Login →",
    ci: "Check-In",
    ciSub: "Start your day",
    co: "Check-Out",
    coSub: "End your day",
    re: "New Visit",
    reSub: "Log another visit",
    gSub: "What's on today?",
    quickPhoto: "Quick Photo",
    visitPhoto: "Take Visit Photo"
  }
};

function setLang(l) {
  lang = l;
  store.set("lang", l);
  document.querySelectorAll(".lang-chip").forEach((c, i) => {
    c.classList.toggle("active", (i === 0 && l === "hi") || (i === 1 && l === "en"));
  });
  applyLang();
}

function applyLang() {
  const t = L[lang] || L.hi;
  document.getElementById("txt-title").textContent = t.title;
  document.getElementById("txt-sub").textContent = t.sub;
  document.getElementById("txt-start").textContent = t.start;
  document.getElementById("txt-loginas").textContent = t.loginas;
  document.getElementById("txt-verify-h").textContent = t.verifyH;
  document.getElementById("txt-verify-p").textContent = t.verifyP;
  document.getElementById("txt-name-lbl").textContent = t.nameLbl;
  document.getElementById("txt-pin-lbl").textContent = t.pinLbl;
  document.getElementById("txt-login-btn").textContent = t.loginBtn;
  document.getElementById("txt-ci").textContent = t.ci;
  document.getElementById("txt-ci-sub").textContent = t.ciSub;
  document.getElementById("txt-co").textContent = t.co;
  document.getElementById("txt-co-sub").textContent = t.coSub;
  document.getElementById("txt-re").textContent = t.re;
  document.getElementById("txt-re-sub").textContent = t.reSub;
  document.getElementById("gSub").textContent = t.gSub;
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove("show"), 4000);
}

async function apiPost(payload) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    console.error("API error:", e);
    throw e;
  }
}

function compressPhoto(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxW = 720;
      const scale = img.width > maxW ? maxW / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.55));
    };
    img.src = dataUrl;
  });
}

function fmtDate(val) {
  if (!val) return "";
  let d = val instanceof Date ? val : new Date(val);
  if (isNaN(d)) return val.toString();
  return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear()}`;
}

function fmtTime(val) {
  if (!val) return "";
  const timeStr = val.toString().match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!timeStr) return val;
  let h = parseInt(timeStr[1]), m = parseInt(timeStr[2]);
  const ampm = timeStr[3] ? timeStr[3].toUpperCase() : (h >= 12 ? "PM" : "AM");
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2,'0')} ${ampm}`;
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

// ══════════════════════════════════════════
// STATE VARIABLES
// ══════════════════════════════════════════
let currentEmp   = null;
let visitPhoto   = null;
let camMode      = "";
let camFacing    = "environment";
let camStream    = null;
let gpsInterval  = null;
let gpsPos       = null;
let timerInt     = null;
let cdInt        = null;
let clockInt     = null;
let totalDist    = 0;
let lastGpsPos   = null;
let allEmployees = [];

// ══════════════════════════════════════════
// SCREEN NAVIGATION
// ══════════════════════════════════════════
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

// ══════════════════════════════════════════
// LANDING → VERIFY
// ══════════════════════════════════════════
function goVerify() {
  show("s-verify");
  loadEmployees();
}

// ══════════════════════════════════════════
// LOAD EMPLOYEES
// ══════════════════════════════════════════
async function loadEmployees() {
  const wrap = document.getElementById("empList-wrap");
  const load = document.getElementById("empLoading");
  wrap.style.display = "none";
  load.style.display = "block";

  const cached = store.get("empCache");
  if (cached?.length) {
    allEmployees = cached;
    populateEmpSelect(cached);
    wrap.style.display = "block";
    load.style.display = "none";
  }

  try {
    const r = await apiPost({ action: "get_employees" });
    if (r.employees?.length) {
      allEmployees = r.employees;
      store.set("empCache", r.employees);
      populateEmpSelect(r.employees);
    }
    wrap.style.display = "block";
    load.style.display = "none";
  } catch {
    if (!cached?.length) load.innerHTML = "⚠️ Network error. Dobara try karein.";
    else { wrap.style.display = "block"; load.style.display = "none"; }
  }
}

function populateEmpSelect(emps) {
  const sel = document.getElementById("empSelect");
  sel.innerHTML = '<option value="">-- Naam chunein --</option>';
  emps.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.name;
    opt.textContent = e.name + (e.designation ? ` (${e.designation})` : "");
    sel.appendChild(opt);
  });
}

function togglePin() {
  const inp = document.getElementById("pinInput");
  const btn = document.getElementById("eyeBtn");
  if (inp.type === "password") { inp.type = "text"; btn.textContent = "🙈"; }
  else { inp.type = "password"; btn.textContent = "👁️"; }
}

// ══════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════
function doLogin() {
  const name = document.getElementById("empSelect").value.trim();
  const pin  = document.getElementById("pinInput").value.trim();
  const err  = document.getElementById("pinErr");
  err.classList.remove("show");

  if (!name) return toast("Naam chunein pehle", "error");
  if (!pin)  return toast("PIN darj karo", "error");

  const emp = allEmployees.find(e => e.name === name);
  if (!emp || emp.pin.toString() !== pin.toString()) {
    err.classList.add("show");
    return;
  }

  currentEmp = emp;
  store.set("emp", emp);
  document.getElementById("pinInput").value = "";
  goToDash();
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
function goToDash() {
  show("s-dash");
  document.getElementById("dName").textContent = currentEmp.name;
  document.getElementById("gName").textContent = currentEmp.name;
  document.getElementById("dDate").textContent = fmtDate(new Date());
  startClock();
  refreshDash();
  loadDist();
  scheduleAutoCheckout();
}

function doLogout() {
  stopGps();
  stopTimer();
  currentEmp = null;
  store.del("emp");
  show("s-land");
}

// ══════════════════════════════════════════
// CLOCK
// ══════════════════════════════════════════
function startClock() {
  if (clockInt) clearInterval(clockInt);
  function tick() {
    const n = new Date();
    let h = n.getHours(), m = n.getMinutes();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    document.getElementById("lClock").textContent = h + ":" + (m < 10 ? "0" + m : m) + " " + ap;
  }
  tick();
  clockInt = setInterval(tick, 10000);
}

// ══════════════════════════════════════════
// REFRESH DASHBOARD STATE
// ══════════════════════════════════════════
function refreshDash() {
  const sv = store.get("ci_" + currentEmp.name);
  const isCheckedIn = !!sv;

  document.getElementById("sDot").className = "dot" + (isCheckedIn ? " g" : "");
  document.getElementById("sTxt").textContent = isCheckedIn ? "Checked in ✓" : "Not checked in";
  document.getElementById("tCard").classList.toggle("show", isCheckedIn);
  document.getElementById("distCard").classList.toggle("show", isCheckedIn);
  document.getElementById("pingBar").classList.toggle("show", isCheckedIn);

  if (isCheckedIn) {
    document.getElementById("tSub").textContent = "Check-In: " + fmtTime(sv.time);
    startTimer(sv.ms);
    document.getElementById("bCI").classList.add("dis");
    document.getElementById("bCO").classList.remove("dis");
    document.getElementById("bOrd").classList.remove("dis");
    document.getElementById("bPay").classList.remove("dis");
    document.getElementById("bRe").classList.remove("dis");
    document.getElementById("bRet").classList.remove("dis");

    const elapsed = Date.now() - sv.ms;
    if (elapsed < MIN_CHECKOUT) {
      document.getElementById("bCO").classList.add("dis");
      document.getElementById("cdBadge").classList.add("show");
      startCD(sv.ms);
    } else {
      document.getElementById("bCO").classList.remove("dis");
      document.getElementById("cdBadge").classList.remove("show");
    }
    startGps();
  } else {
    document.getElementById("bCI").classList.remove("dis");
    document.getElementById("bCO").classList.add("dis");
    document.getElementById("bOrd").classList.add("dis");
    document.getElementById("bPay").classList.add("dis");
    document.getElementById("bRe").classList.add("dis");
    document.getElementById("bRet").classList.add("dis");
    stopTimer();
    stopGps();
    document.getElementById("distCard").classList.remove("show");
  }
}

// ══════════════════════════════════════════
// CHECK-IN
// ══════════════════════════════════════════
function doCheckin() {
  document.getElementById("visitModalTitle").textContent = "📍 Visit Details";
  document.getElementById("visitSaveBtn").textContent = "✓ Save & Check-In";
  document.getElementById("visitModal")._mode = "checkin";
  openVisitModal();
}

function doNewVisit() {
  document.getElementById("visitModalTitle").textContent = "🔄 New Visit";
  document.getElementById("visitSaveBtn").textContent = "✓ Save Visit";
  document.getElementById("visitModal")._mode = "reentry";
  openVisitModal();
}

function openVisitModal() {
  visitPhoto = null;
  ["mShop","mKeeper","mContact","mArea","mNotes"].forEach(id => {
    document.getElementById(id).value = "";
  });
  resetModalPhoto();
  document.getElementById("visitModal").classList.add("show");
  getGps();
}

function cancelVisit() {
  document.getElementById("visitModal").classList.remove("show");
  visitPhoto = null;
  resetModalPhoto();
}

function resetModalPhoto() {
  document.getElementById("mPhotoImg").style.display = "none";
  document.getElementById("mPhotoImg").src = "";
  document.getElementById("mPhotoIcon").style.display = "";
}

function openVisitCamera() {
  camMode = "visit";
  document.getElementById("camTitle").textContent = "Visit Photo lo";
  document.getElementById("visitModal").classList.remove("show");
  show("s-cam");
  startCam();
}

// ══════════════════════════════════════════
// SAVE VISIT / CHECK-IN
// ══════════════════════════════════════════
async function saveVisit() {
  const shop    = document.getElementById("mShop").value.trim();
  const keeper  = document.getElementById("mKeeper").value.trim();
  const contact = document.getElementById("mContact").value.trim();
  const area    = document.getElementById("mArea").value.trim();
  const notes   = document.getElementById("mNotes").value.trim();
  const contErr = document.getElementById("mContactErr");
  contErr.classList.remove("show");

  if (!shop || !keeper || !area) { toast("Sab zaroori fields bharein", "error"); return; }
  if (contact.length !== 10)    { contErr.classList.add("show"); return; }

  const btn  = document.getElementById("visitSaveBtn");
  const mode = document.getElementById("visitModal")._mode;
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const now     = new Date();
  const mapLink = gpsPos ? `https://maps.google.com/?q=${gpsPos.lat},${gpsPos.lng}` : "";

  const payload = {
    action:            "checkin",
    name:              currentEmp.name,
    contact:           currentEmp.contact || contact,
    shopName:          shop,
    shopkeeperName:    keeper,
    shopkeeperContact: contact,
    area:              area,
    notes:             notes,
    mapLink:           mapLink,
    photo:             visitPhoto || "",
    timestamp:         now.toLocaleTimeString("en-IN")
  };

  try {
    await apiPost(payload);
    if (mode === "checkin") {
      store.set("ci_" + currentEmp.name, {
        time: now.toLocaleTimeString("en-IN"),
        ms: now.getTime()
      });
      toast("Check-in ho gaya! ✓", "success");
      refreshDash();
    } else {
      toast("Visit save ho gaya! ✓", "success");
    }
    document.getElementById("visitModal").classList.remove("show");
    visitPhoto = null;
    resetModalPhoto();
  } catch (e) {
    toast("Error: " + e.message, "error");
  } finally {
    btn.classList.remove("loading");
    btn.textContent = mode === "checkin" ? "✓ Save & Check-In" : "✓ Save Visit";
  }
}

// ══════════════════════════════════════════
// CHECKOUT
// ══════════════════════════════════════════
function doCheckout() {
  if (!currentEmp) return;
  const sv = store.get("ci_" + currentEmp.name);
  if (!sv) { toast("Pehle check-in karo", "error"); return; }

  const diffMs = Date.now() - sv.ms;
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const dur = h + "h " + m + "m";

  if (!confirm("Check-out karna chahte ho?\nTime on field: " + dur)) return;

  apiPost({
    action:    "checkout",
    name:      currentEmp.name,
    timestamp: new Date().toLocaleTimeString("en-IN"),
    duration:  dur
  }).then(() => {
    store.del("ci_" + currentEmp.name);
    toast("Check-out ho gaya! ✓", "success");
    stopGps();
    stopTimer();
    refreshDash();
  }).catch(err => toast("Error: " + err.message, "error"));
}

// ══════════════════════════════════════════
// QUICK PHOTO
// ══════════════════════════════════════════
function doQuickPhoto() {
  camMode = "quick";
  document.getElementById("camTitle").textContent = "Quick Photo";
  show("s-cam");
  startCam();
}

// ══════════════════════════════════════════
// CAMERA
// ══════════════════════════════════════════
function startCam() {
  stopCam();
  const constraints = {
    video: { facingMode: camFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  };
  navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    camStream = stream;
    const v = document.getElementById("video");
    v.srcObject = stream;
    v.style.display = "block";
    document.getElementById("photoPreview").style.display = "none";
    document.getElementById("btnCap").style.display = "block";
    document.getElementById("btnNext").style.display = "none";
    document.getElementById("btnRe").style.display = "none";
  }).catch(err => {
    toast("Camera error: " + err.message, "error");
    closeCam();
  });
  getGps();
}

function stopCam() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
}

function flipCam() {
  camFacing = camFacing === "environment" ? "user" : "environment";
  startCam();
}

function capturePhoto() {
  const v = document.getElementById("video");
  const c = document.getElementById("canvas");
  const p = document.getElementById("photoPreview");
  c.width  = v.videoWidth  || 640;
  c.height = v.videoHeight || 480;
  c.getContext("2d").drawImage(v, 0, 0);
  const data = c.toDataURL("image/jpeg", 0.6);
  p.src = data;
  p.style.display = "block";
  v.style.display = "none";
  document.getElementById("btnCap").style.display = "none";
  document.getElementById("btnNext").style.display = "block";
  document.getElementById("btnRe").style.display = "block";
}

function retakePhoto() {
  const v = document.getElementById("video");
  const p = document.getElementById("photoPreview");
  v.style.display = "block";
  p.style.display = "none";
  document.getElementById("btnCap").style.display = "block";
  document.getElementById("btnNext").style.display = "none";
  document.getElementById("btnRe").style.display = "none";
}

function acceptPhoto() {
  const data = document.getElementById("photoPreview").src;
  stopCam();
  if (camMode === "visit") {
    visitPhoto = data;
    const img  = document.getElementById("mPhotoImg");
    const icon = document.getElementById("mPhotoIcon");
    img.src = data;
    img.style.display = "block";
    icon.style.display = "none";
    show("s-dash");
    document.getElementById("visitModal").classList.add("show");
    toast("Photo li gayi ✓", "success");
  } else {
    sendQuickPhoto(data);
    show("s-dash");
  }
}

function closeCam() {
  stopCam();
  if (camMode === "visit") {
    show("s-dash");
    document.getElementById("visitModal").classList.add("show");
  } else {
    show("s-dash");
  }
}

function sendQuickPhoto(data) {
  if (!currentEmp) return;
  toast("Photo bheja ja raha hai...", "info");
  apiPost({
    action:  "quick_photo",
    name:    currentEmp.name,
    contact: currentEmp.contact,
    photo:   data,
    lat:     gpsPos ? gpsPos.lat : "",
    lng:     gpsPos ? gpsPos.lng : ""
  }).then(() => toast("Photo save ho gaya ✓", "success"))
    .catch(() => toast("Photo bhejne mein error", "error"));
}

// ══════════════════════════════════════════
// GPS
// ══════════════════════════════════════════
function getGps() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const b = document.getElementById("gpsBadge");
    if (b) {
      b.textContent = "📍 " + gpsPos.lat.toFixed(5) + ", " + gpsPos.lng.toFixed(5);
      b.classList.add("show");
    }
    updateDistance(gpsPos);
  }, () => {}, { enableHighAccuracy: true });
}

function startGps() {
  stopGps();
  gpsInterval = setInterval(() => {
    if (!currentEmp) return;
    if (!store.get("ci_" + currentEmp.name)) return;
    navigator.geolocation.getCurrentPosition(pos => {
      gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateDistance(gpsPos);
      apiPost({
        action:   "gps_ping",
        name:     currentEmp.name,
        lat:      gpsPos.lat,
        lng:      gpsPos.lng,
        accuracy: pos.coords.accuracy,
        status:   "tracking"
      }).catch(() => {});
    }, () => {}, { enableHighAccuracy: true });
  }, GPS_INTERVAL);
}

function stopGps() {
  if (gpsInterval) { clearInterval(gpsInterval); gpsInterval = null; }
}

// ══════════════════════════════════════════
// DISTANCE
// ══════════════════════════════════════════
function updateDistance(pos) {
  if (lastGpsPos) {
    const d = haversine(lastGpsPos.lat, lastGpsPos.lng, pos.lat, pos.lng);
    if (d > 20) {
      totalDist += d;
      store.set("dist_" + currentEmp.name + "_" + todayKey(), totalDist);
    }
  }
  lastGpsPos = pos;
  loadDist();
}

function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2) * Math.sin(dLat/2) +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function loadDist() {
  if (!currentEmp) return;
  const range   = document.getElementById("distRange").value;
  const dateRow = document.getElementById("distDateRow");
  const valEl   = document.getElementById("distVal");
  dateRow.style.display = range === "date" ? "block" : "none";

  let metres = 0;
  if (range === "today") {
    metres = parseFloat(store.get("dist_" + currentEmp.name + "_" + todayKey()) || 0);
  } else if (range === "total") {
    for (const k in localStorage) {
      if (k.startsWith("dist_" + currentEmp.name + "_")) {
        metres += parseFloat(localStorage[k] || 0);
      }
    }
  } else if (range === "date") {
    const d = document.getElementById("distDate").value;
    if (!d) { valEl.textContent = "--"; return; }
    const parts = d.split("-");
    const key   = parts[0] + "-" + parseInt(parts[1]) + "-" + parseInt(parts[2]);
    metres = parseFloat(store.get("dist_" + currentEmp.name + "_" + key) || 0);
  }

  valEl.textContent = metres < 1000
    ? Math.round(metres) + " m"
    : (metres / 1000).toFixed(2) + " km";
}

// ══════════════════════════════════════════
// TIMER
// ══════════════════════════════════════════
function startTimer(startMs) {
  stopTimer();
  function tick() {
    const diff = Date.now() - startMs;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById("tDisp").textContent =
      String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
  }
  tick();
  timerInt = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerInt) { clearInterval(timerInt); timerInt = null; }
}

// COUNTDOWN before checkout enabled
function startCD(startMs) {
  if (cdInt) clearInterval(cdInt);
  cdInt = setInterval(() => {
    const elapsed = Date.now() - startMs;
    const rem     = MIN_CHECKOUT - elapsed;
    if (rem <= 0) {
      clearInterval(cdInt);
      document.getElementById("bCO").classList.remove("dis");
      document.getElementById("cdBadge").classList.remove("show");
    } else {
      document.getElementById("cdBadge").textContent = Math.ceil(rem / 1000) + "s";
    }
  }, 500);
}

// ══════════════════════════════════════════
// AUTO CHECKOUT — 10 PM
// ══════════════════════════════════════════
function scheduleAutoCheckout() {
  const now    = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(22, 0, 0, 0);
  if (now >= cutoff) cutoff.setDate(cutoff.getDate() + 1);
  const ms = cutoff.getTime() - now.getTime();
  setTimeout(() => {
    if (!currentEmp) return;
    const sv = store.get("ci_" + currentEmp.name);
    if (!sv) return;
    const diff = Date.now() - sv.ms;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    apiPost({
      action:    "checkout",
      name:      currentEmp.name,
      timestamp: "10:00 PM (Auto)",
      duration:  h + "h " + m + "m (auto)"
    }).then(() => {
      store.del("ci_" + currentEmp.name);
      stopGps();
      toast("Auto check-out ho gaya (10 PM)", "info");
      refreshDash();
    }).catch(() => {});
  }, ms);
}

// ══════════════════════════════════════════
// PWA
// ══════════════════════════════════════════
var deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem("pwa_done")) {
    setTimeout(() => document.getElementById("pwaBanner").classList.add("show"), 3000);
  }
});
window.addEventListener("appinstalled", () => {
  document.getElementById("pwaBanner").classList.remove("show");
  localStorage.setItem("pwa_done", "1");
});

function installPWA() {
  if (!deferredPrompt) { toast("Safari: Share → Add to Home Screen", "info"); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(r => {
    if (r.outcome === "accepted") localStorage.setItem("pwa_done", "1");
    deferredPrompt = null;
    document.getElementById("pwaBanner").classList.remove("show");
  });
}

function dismissPWA() {
  document.getElementById("pwaBanner").classList.remove("show");
  localStorage.setItem("pwa_done", "1");
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
(function init() {
  applyLang();
  const saved = store.get("emp");
  if (saved) {
    currentEmp = saved;
    totalDist  = parseFloat(store.get("dist_" + saved.name + "_" + todayKey()) || 0);
    goToDash();
  }
})();
