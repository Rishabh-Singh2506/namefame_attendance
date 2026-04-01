"use strict";

/* ════════════════════════════════════════════════════════════════
   SUPABASE CONFIG
   ════════════════════════════════════════════════════════════════ */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://qhikqbrfojdlmdwsdota.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoaWtxYnJmb2pkbG1kd3Nkb3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjcxMDgsImV4cCI6MjA5MDMwMzEwOH0.lYiBLoXPdNO_kfilcbX-OfbvJcXsjM841HG2ffwQT3Y";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ════════════════════════════════════════════════════════════════
   GLOBAL STATE
   ════════════════════════════════════════════════════════════════ */

let currentEmp = null;
let currentAttendanceId = null;
let currentVisitId = null;
let allEmployees = [];
let camStream = null;
let vCamStream = null;
let checkoutCamStream = null;
let visitPhotoData = null;
let checkoutPhotoData = null;
let timerInterval = null;
let gpsInterval = null;
let gpsPos = null;
let visitStartMs = null;
let visitCdInt = null;
let visitDurationInt = null; // ✅ Live timer for visit out modal
let selectedRating = 0;
let currentShopsData = []; // ✅ Store full shop data for auto-fill

const GPS_INTERVAL = 5 * 60 * 1000;
//const MIN_SHOP_CHECKOUT = 3 * 60 * 1000; // 3 minutes
// 10 seconds in milliseconds
const MIN_SHOP_CHECKOUT = 10 * 1000; 


/* ════════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
   ════════════════════════════════════════════════════════════════ */
function normalize(str) {
  return str
    ?.toString()
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
}

function toast(msg, type = "") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast";
  if (type) el.classList.add(type);
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

/* ════════════════════════════════════════════════════════════════
   SCREEN NAVIGATION
   ════════════════════════════════════════════════════════════════ */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}
window.showScreen = showScreen;

/* ════════════════════════════════════════════════════════════════
   LOAD STATES (for login page)
   ════════════════════════════════════════════════════════════════ */

async function loadStates() {
  const stateWrap = document.getElementById("stateList-wrap");
  const stateLoad = document.getElementById("stateLoading");

  if (!stateWrap || !stateLoad) return;

  stateWrap.style.display = "none";
  stateLoad.style.display = "block";

  const { data, error } = await supabase.from("routes").select("state");

  if (error) {
    stateLoad.textContent = "⚠️ Error loading states";
    return;
  }

  const states = [...new Set(data.map(r => r.state))].sort();
  const sel = document.getElementById("stateSelect");
  sel.innerHTML = '<option value="">-- State chunein --</option>';
  states.forEach(state => {
    const opt = document.createElement("option");
    opt.value = state;
    opt.textContent = state;
    sel.appendChild(opt);
  });

  stateWrap.style.display = "block";
  stateLoad.style.display = "none";
}

/* ════════════════════════════════════════════════════════════════
   LOAD DISTRICTS (login page — only state+district needed for login)
   ════════════════════════════════════════════════════════════════ */

window.loadDistricts = async function () {
  const state = document.getElementById("stateSelect").value;
  const districtGroup = document.getElementById("districtGroup");
  const districtSelect = document.getElementById("districtSelect");

  if (!state) {
    if (districtGroup) districtGroup.style.display = "none";
    if (districtSelect) districtSelect.innerHTML = '<option value="">-- District chunein --</option>';
    return;
  }

  try {
    const { data: allData, error } = await supabase.from("routes").select("state, district");
    if (error) { toast("District load nahi ho sake", "error"); return; }

    const filtered = allData.filter(r => r.state && r.district && r.state.toUpperCase() === state.toUpperCase());
    const districtMap = {};
    filtered.forEach(r => { const k = r.district.toUpperCase(); if (!districtMap[k]) districtMap[k] = r.district; });
    const districts = Object.values(districtMap).sort();

    districtSelect.innerHTML = '<option value="">-- District chunein --</option>';
    districts.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      districtSelect.appendChild(opt);
    });

    districtGroup.style.display = "block";
  } catch (err) {
    toast("Kuch galat hua: " + err.message, "error");
  }
};

// ✅ Just a stub — route select is now on dashboard
window.loadDistricts_done = function () { /* Nothing needed */ };

/* ════════════════════════════════════════════════════════════════
   LOAD ROUTES (dashboard — after login)
   ════════════════════════════════════════════════════════════════ */

async function loadDashboardRoutes() {
  const emp = currentEmp;
  if (!emp) return;

  const savedRouteData = localStorage.getItem("routeData");
  const state = emp.state || (savedRouteData ? JSON.parse(savedRouteData).state : null);
  const district = emp.district || (savedRouteData ? JSON.parse(savedRouteData).district : null);

  if (!state || !district) {
    toast("State/District info nahi mili", "error");
    return;
  }

  try {
    const { data: allData, error } = await supabase.from("routes").select("state, district, working_route");
    if (error) { toast("Routes load nahi ho sake", "error"); return; }

    const filtered = allData.filter(r =>
  r.state && r.district && r.working_route &&
  normalize(r.state) === normalize(state) &&
  normalize(r.district) === normalize(district)
);

    const routeMap = {};
    filtered.forEach(r => { const k = r.working_route.toUpperCase(); if (!routeMap[k]) routeMap[k] = r.working_route; });
    const routes = Object.values(routeMap).sort();

    const sel = document.getElementById("dashRouteSelect");
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Route chunein --</option>';
    routes.forEach(route => {
      const opt = document.createElement("option");
      opt.value = route;
      opt.textContent = route;
      sel.appendChild(opt);
    });

    // Pre-select if already saved
    const saved = savedRouteData ? JSON.parse(savedRouteData) : null;
    if (saved && saved.route) {
      sel.value = saved.route;
      document.getElementById("routeSelectedMsg").style.display = "block";
    }

    document.getElementById("routeSelectCard").style.display = "block";
  } catch (err) {
    toast("Route load error: " + err.message, "error");
  }
}

window.saveDashRoute = function () {
  const route = document.getElementById("dashRouteSelect").value;
  if (!route) return;

  const saved = localStorage.getItem("routeData");
  const existing = saved ? JSON.parse(saved) : {};
  existing.route = route;
  localStorage.setItem("routeData", JSON.stringify(existing));

  document.getElementById("routeSelectedMsg").style.display = "block";
  toast("Route save ho gaya: " + route, "success");
};

/* ════════════════════════════════════════════════════════════════
   LOGIN
   ════════════════════════════════════════════════════════════════ */

window.goVerify = function () {
  showScreen("s-verify");
  loadStates();
};

window.togglePin = function () {
  const input = document.getElementById("pinInput");
  if (input) input.type = input.type === "password" ? "text" : "password";
};

window.doLogin = async function () {
  const empName = document.getElementById("empNameInput").value.trim();
  const pin = document.getElementById("pinInput").value;

  if (!empName) { toast("Naam likho", "error"); return; }
  if (!pin) { toast("PIN daalo", "error"); return; }

  // ✅ Only state + district needed at login — route selected on dashboard
  const state = document.getElementById("stateSelect").value;
  const district = document.getElementById("districtSelect").value;

  if (!state || !district) {
    toast("State aur District select karo", "error");
    return;
  }

  try {
    const { data: allEmployees, error: empError } = await supabase.from("employees").select("*");

    let employees = allEmployees || [];

    if (!employees || employees.length === 0) {
      employees = [
        { user_id: "test-1", name: "rishabh", emp_id: "EMP001", pin: "7800", contact: "9876543210", designation: "Field Manager", state: "U.P.", district: "Pratapgarh", joining_date: "2024-01-01", resigned_date: null },
        { user_id: "test-2", name: "RAHUL", emp_id: "EMP002", pin: "1234", contact: "9865954785", designation: "Field Officer", state: "U.P.", district: "Pratapgarh", joining_date: "2024-01-01", resigned_date: null }
      ];
      toast("Using test data (setup database properly)", "warning");
    }

    let emp = employees.find(e => e && e.name && e.name.toLowerCase() === empName.toLowerCase());
    if (!emp) emp = employees.find(e => e && e.name && e.name.toLowerCase().includes(empName.toLowerCase()));

    if (!emp) {
      toast("Employee nahi mila: '" + empName + "'", "error");
      return;
    }

    if (String(emp.pin) !== String(pin)) {
      toast("Galat PIN", "error");
      return;
    }

    // ✅ Save state+district in routeData. Route will be saved on dashboard.
    const existingRouteData = localStorage.getItem("routeData");
    const existingRoute = existingRouteData ? JSON.parse(existingRouteData).route : null;

    localStorage.setItem("routeData", JSON.stringify({
      state: state,
      district: district,
      route: existingRoute || "" // keep previous route if any
    }));

    currentEmp = emp;
    localStorage.setItem("emp", JSON.stringify(emp));

    document.getElementById("dashName").textContent = emp.name;
    document.getElementById("dashDate").textContent = new Date().toLocaleDateString("hi-IN");

    showScreen("s-dash");
    startClock();
    refreshDash();
    loadDashboardRoutes(); // ✅ Load routes on dashboard after login

    toast("Login successful ✓", "success");
  } catch (err) {
    toast("Error: " + err.message, "error");
  }
};

window.doLogout = function () {
  stopCam();
  stopVCam();
  stopGps();
  if (timerInterval) clearInterval(timerInterval);

  currentEmp = null;
  currentAttendanceId = null;
  currentVisitId = null;

  localStorage.removeItem("emp");
  localStorage.removeItem("checkin");
  localStorage.removeItem("visit");
  localStorage.removeItem("routeData");

  showScreen("s-land");
  toast("Logged out", "info");
};

window.setLang = function (lang) {
  document.querySelectorAll(".lang-chip").forEach(chip => chip.classList.remove("active"));
  event.target.classList.add("active");
  localStorage.setItem("lang", lang);
  toast("Language: " + (lang === "hi" ? "हिंदी" : "English"), "info");
};

/* ════════════════════════════════════════════════════════════════
   CLOCK & TIMER
   ════════════════════════════════════════════════════════════════ */

function startClock() {
  setInterval(() => {
    const el = document.getElementById("clockDisp");
    if (!el) return;
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    el.textContent = (h % 12 || 12) + ":" + String(m).padStart(2, "0") + (h >= 12 ? " PM" : " AM");
  }, 1000);
}

function startTimer(startMs) {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const diff = Date.now() - startMs;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = document.getElementById("tDisp");
    if (el) el.textContent = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

/* ════════════════════════════════════════════════════════════════
   HOLD TIME — Total time spent at shops today
   ════════════════════════════════════════════════════════════════ */

async function loadTodayHoldTime() {
  if (!currentEmp) return;

  const today = new Date().toISOString().split("T")[0];

  try {
    const { data, error } = await supabase
      .from("visits")
      .select("hold_time")
      .eq("employee_name", currentEmp.name)
      .eq("visit_date", today)
      .not("hold_time", "is", null);

    if (error || !data || data.length === 0) {
      document.getElementById("holdVal").textContent = "0h 0m";
      document.getElementById("holdVisitCount").textContent = "0 visits aaj";
      document.getElementById("holdCard").style.display = "block";
      return;
    }

    // ✅ Sum all hold_times for today
    let totalMinutes = 0;
    data.forEach(row => {
      if (row.hold_time) {
        // hold_time format: "HH:MM"
        const parts = row.hold_time.split(":");
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        totalMinutes += (h * 60) + m;
      }
    });

    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;

    document.getElementById("holdVal").textContent = totalH + "h " + totalM + "m";
    document.getElementById("holdVisitCount").textContent = data.length + " visit" + (data.length > 1 ? "s" : "") + " aaj";
    document.getElementById("holdCard").style.display = "block";
  } catch (err) {
    console.error("Hold time error:", err);
  }
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD REFRESH
   ════════════════════════════════════════════════════════════════ */

function refreshDash() {
  if (!currentEmp) return;

  const checkinData = localStorage.getItem("checkin");
  const isCheckedIn = !!checkinData;

  document.getElementById("statusDot").className = "dot" + (isCheckedIn ? " g" : "");
  document.getElementById("statusTxt").textContent = isCheckedIn ? "✅ Checked in" : "Not checked in";

  document.getElementById("timerCard").classList.toggle("show", isCheckedIn);
  document.getElementById("distCard").classList.toggle("show", isCheckedIn);
  document.getElementById("gpsBar").classList.toggle("show", isCheckedIn);

  if (isCheckedIn) {
    const data = JSON.parse(checkinData);
    startTimer(data.ms);
    startGps();
    loadTodayHoldTime(); // ✅ Load hold time

    document.getElementById("bCI").classList.add("dis");
    document.getElementById("bCO").classList.remove("dis");
    document.getElementById("bReIn").classList.remove("dis");
    document.getElementById("bPh").classList.remove("dis");
  } else {
    stopTimer();
    stopGps();

    document.getElementById("bCI").classList.remove("dis");
    document.getElementById("bCO").classList.add("dis");
    document.getElementById("bReIn").classList.add("dis");
    document.getElementById("bPh").classList.add("dis");
  }
}

/* ════════════════════════════════════════════════════════════════
   CHECK-IN
   ════════════════════════════════════════════════════════════════ */

window.doCheckin = function () {
  if (!currentEmp) { toast("Login karo", "error"); return; }

  const routeData = localStorage.getItem("routeData");
  if (!routeData || !JSON.parse(routeData).route) {
    toast("Pehle route select karo (upar)", "error");
    document.getElementById("dashRouteSelect").focus();
    return;
  }

  if (localStorage.getItem("checkin")) {
    toast("Aap pehle se check-in hain", "info");
    return;
  }

  location.href = "checkin.html";
};

/* ════════════════════════════════════════════════════════════════
   CHECK-OUT
   ════════════════════════════════════════════════════════════════ */

window.doCheckout = async function () {
  if (!currentEmp) return;

  const checkinData = localStorage.getItem("checkin");
  if (!checkinData) { toast("Pehle check-in karo", "error"); return; }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        localStorage.setItem("checkoutGPS", JSON.stringify(gps));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  document.getElementById("checkoutModal").classList.add("show");
  document.getElementById("checkoutOdometerInput").value = "";
  document.getElementById("checkoutPhotoPreview").style.display = "none";
  document.getElementById("checkoutVideo").style.display = "block";
  document.getElementById("checkoutBtnCap").style.display = "block";
  document.getElementById("checkoutBtnNext").style.display = "none";
  document.getElementById("checkoutBtnRe").style.display = "none";
  checkoutPhotoData = null;

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(stream => {
    checkoutCamStream = stream;
    document.getElementById("checkoutVideo").srcObject = stream;
  }).catch(err => {
    toast("Camera error: " + err.message, "error");
    document.getElementById("checkoutModal").classList.remove("show");
  });
};

window.captureCheckoutPhoto = function () {
  const v = document.getElementById("checkoutVideo");
  const c = document.getElementById("checkoutCanvas");
  const p = document.getElementById("checkoutPhotoPreview");

  c.width = v.videoWidth || 640;
  c.height = v.videoHeight || 480;
  c.getContext("2d").drawImage(v, 0, 0);
  checkoutPhotoData = c.toDataURL("image/jpeg", 0.7);
  p.src = checkoutPhotoData;
  p.style.display = "block";
  v.style.display = "none";

  document.getElementById("checkoutBtnCap").style.display = "none";
  document.getElementById("checkoutBtnNext").style.display = "block";
  document.getElementById("checkoutBtnRe").style.display = "block";
};

window.retakeCheckoutPhoto = function () {
  document.getElementById("checkoutVideo").style.display = "block";
  document.getElementById("checkoutPhotoPreview").style.display = "none";
  document.getElementById("checkoutBtnCap").style.display = "block";
  document.getElementById("checkoutBtnNext").style.display = "none";
  document.getElementById("checkoutBtnRe").style.display = "none";
  checkoutPhotoData = null;
};

window.submitCheckout = async function () {
  const odoInput = document.getElementById("checkoutOdometerInput").value.trim();
  if (!checkoutPhotoData) { toast("Photo lo pehle", "error"); return; }
  if (!odoInput || isNaN(odoInput)) { toast("Valid odometer daalo", "error"); return; }

  const checkinData = JSON.parse(localStorage.getItem("checkin"));
  const diff = Date.now() - checkinData.ms;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);

  const btn = document.getElementById("checkoutSubmitBtn");
  btn.classList.add("loading");
  btn.textContent = "Submitting...";

  const photoUrl = await uploadPhoto(checkoutPhotoData, "CO_" + currentEmp.name);

  const checkoutGPSData = localStorage.getItem("checkoutGPS");
  let mapLink = null;
  if (checkoutGPSData) {
    const gps = JSON.parse(checkoutGPSData);
    mapLink = "https://maps.google.com/?q=" + gps.lat + "," + gps.lng;
  }

  try {
    const { error } = await supabase.from("attendance").update({
      attendance_closed_time: new Date().toLocaleTimeString("en-IN"),
      odometer_end: parseInt(odoInput),
      distance_km: Math.abs(parseInt(odoInput) - (checkinData.odoStart || 0)),
      closed_odometer_photo: photoUrl || null,
      working_hours: h + "h " + m + "m",
      map_link: mapLink
    }).eq("id", checkinData.attendanceId);

    if (error) {
      toast("Checkout error: " + error.message, "error");
      btn.classList.remove("loading");
      btn.textContent = "✓ Check-Out";
      return;
    }

    localStorage.removeItem("checkin");
    currentAttendanceId = null;
    document.getElementById("checkoutModal").classList.remove("show");
    if (checkoutCamStream) checkoutCamStream.getTracks().forEach(t => t.stop());

    toast("Check-out ho gaya ✓", "success");
    refreshDash();
    btn.classList.remove("loading");
    btn.textContent = "✓ Check-Out";
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.classList.remove("loading");
    btn.textContent = "✓ Check-Out";
  }
};

window.closeCheckoutModal = function () {
  if (checkoutCamStream) checkoutCamStream.getTracks().forEach(t => t.stop());
  document.getElementById("checkoutModal").classList.remove("show");
  checkoutPhotoData = null;
};

/* ════════════════════════════════════════════════════════════════
   VISITS — FIXED FLOW
   Area → Shop (auto-fill shopkeeper) → Photo → Save
   ════════════════════════════════════════════════════════════════ */

window.doNewVisit = function () {
  if (!currentEmp) return;
  if (!localStorage.getItem("checkin")) { toast("Pehle check-in karo", "error"); return; }

  visitPhotoData = null;
  currentShopsData = [];

  // Reset form
  const selectors = ["visitAreaSelect", "mShopName", "mShopkeeperName", "mShopkeeperContact"];
  selectors.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  document.getElementById("addNewShopForm").style.display = "none";
  document.getElementById("shopkeeperSection").style.display = "none";
  document.getElementById("visitPhotoWrap").style.display = "none";
  document.getElementById("visitPhotoBtn").style.display = "flex";
  document.getElementById("visitModal").classList.add("show");

  loadVisitAreas();
  getGps();

  // ✅ Track visit start time
  visitStartMs = Date.now();
  localStorage.setItem("visitActive", JSON.stringify({ startTime: visitStartMs }));
  startVisitCD();
};

async function loadVisitAreas() {
  const routeData = JSON.parse(localStorage.getItem("routeData") || "{}");
  const { state, district, route } = routeData;

  if (!state || !district || !route) {
    toast("Route select nahi hai — dashboard pe route chunein", "error");
    return;
  }

  try {
    const { data: allData, error } = await supabase.from("routes").select("state, district, working_route, area");
    if (error) { toast("Areas load nahi ho sake", "error"); return; }

    const filtered = allData.filter(r =>
  r.state && r.district && r.working_route && r.area &&
  normalize(r.state) === normalize(state) &&
  normalize(r.district) === normalize(district) &&
  normalize(r.working_route) === normalize(route)
);

    const areaMap = {};
    filtered.forEach(r => { const k = r.area.toUpperCase(); if (!areaMap[k]) areaMap[k] = r.area; });
    const areas = Object.values(areaMap).sort();

    const sel = document.getElementById("visitAreaSelect");
    sel.innerHTML = '<option value="">-- Area chunein --</option>';
    areas.forEach(area => {
      const opt = document.createElement("option");
      opt.value = area;
      opt.textContent = area;
      sel.appendChild(opt);
    });
  } catch (err) {
    toast("Error: " + err.message, "error");
  }
}

// ✅ Load shops with full data for auto-fill
window.loadShops = async function () {
  const routeData = JSON.parse(localStorage.getItem("routeData") || "{}");
  const { state, district, route } = routeData;
  const area = document.getElementById("visitAreaSelect").value;

  // Reset shopkeeper section
  document.getElementById("shopkeeperSection").style.display = "none";
  document.getElementById("mShopkeeperName").value = "";
  document.getElementById("mShopkeeperContact").value = "";
  document.getElementById("mShopName").innerHTML = '<option value="">-- Shop chunein --</option>';

  if (!area) return;

  // Auto-fill area in add new shop form
  const areaDisplay = document.getElementById("newShopAreaDisplay");
  if (areaDisplay) areaDisplay.value = area;

  try {
    // ✅ Fetch shop + shopkeeper data together
    const { data: allData, error } = await supabase
      .from("routes")
      .select("state, district, working_route, area, shop, shopkeeper_name, shopkeeper_contact");

    if (error) { console.error("Shop load error:", error); return; }

    const filtered = allData.filter(r =>
  r.state && r.district && r.working_route && r.area && r.shop &&
  normalize(r.state) === normalize(state) &&
  normalize(r.district) === normalize(district) &&
  normalize(r.working_route) === normalize(route) &&
  normalize(r.area) === normalize(area)
);

     console.log("STATE:", state);
console.log("DISTRICT:", district);
console.log("ROUTE:", route);
console.log("FILTERED:", filtered);

    // ✅ Store full shop data for auto-fill
    const shopMap = {};
    filtered.forEach(r => {
      const k = r.shop.toUpperCase();
      if (!shopMap[k]) shopMap[k] = { shop: r.shop, shopkeeper_name: r.shopkeeper_name || "", shopkeeper_contact: r.shopkeeper_contact || "" };
    });
    currentShopsData = Object.values(shopMap);

    const sel = document.getElementById("mShopName");
    sel.innerHTML = '<option value="">-- Shop chunein --</option>';
    currentShopsData.sort((a, b) => a.shop.localeCompare(b.shop)).forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.shop;
      opt.textContent = item.shop;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("Exception in loadShops:", err);
  }
};

// ✅ Auto-fill shopkeeper name + contact when shop selected
window.autoFillShopkeeper = function () {
  const shopName = document.getElementById("mShopName").value;
  if (!shopName) {
    document.getElementById("shopkeeperSection").style.display = "none";
    return;
  }

  const shopData = currentShopsData.find(s => s.shop.toUpperCase() === shopName.toUpperCase());
  if (shopData) {
    document.getElementById("mShopkeeperName").value = shopData.shopkeeper_name || "";
    document.getElementById("mShopkeeperContact").value = shopData.shopkeeper_contact || "";
  }
  document.getElementById("shopkeeperSection").style.display = "block";
};

// ✅ Toggle Add New Shop form
window.toggleAddNewShop = function () {
  const form = document.getElementById("addNewShopForm");
  const shopSel = document.getElementById("mShopName");

  if (form.style.display === "none") {
    form.style.display = "block";
    shopSel.style.display = "none";

    // Auto-fill area
    const area = document.getElementById("visitAreaSelect").value;
    const areaDisplay = document.getElementById("newShopAreaDisplay");
    if (areaDisplay) areaDisplay.value = area || "-- Area pehle chunein --";

    document.getElementById("newShopName").value = "";
    document.getElementById("newShopkeeperName").value = "";
    document.getElementById("newShopkeeperContact").value = "";
  } else {
    cancelAddNewShop();
  }
};

window.cancelAddNewShop = function () {
  document.getElementById("addNewShopForm").style.display = "none";
  document.getElementById("mShopName").style.display = "block";
};

// ✅ Add new shop to database and auto-select it
window.addNewShopToDB = async function () {
  const routeData = JSON.parse(localStorage.getItem("routeData") || "{}");
  const { state, district, route } = routeData;
  const area = document.getElementById("visitAreaSelect").value;
  const shopName = document.getElementById("newShopName").value.trim();
  const shopkeeperName = document.getElementById("newShopkeeperName").value.trim();
  const shopkeeperContact = document.getElementById("newShopkeeperContact").value.trim();

  if (!area) { toast("Pehle area select karo", "error"); return; }
  if (!shopName) { toast("Shop ka naam daalo", "error"); return; }
  if (!state || !district || !route) { toast("Route data missing", "error"); return; }

  const btn = event.target;
  btn.textContent = "Adding...";
  btn.disabled = true;

  try {
    const { error } = await supabase.from("routes").insert([{
      state: state,
      district: district,
      working_route: route,
      area: area,
      shop: shopName,
      shopkeeper_name: shopkeeperName || null,
      shopkeeper_contact: shopkeeperContact || null
    }]);

    if (error) {
      toast("Shop add error: " + error.message, "error");
      btn.textContent = "✓ Add Shop to Database";
      btn.disabled = false;
      return;
    }

    toast("Shop add ho gaya ✓", "success");

    // ✅ Add to local data and select it
    currentShopsData.push({ shop: shopName, shopkeeper_name: shopkeeperName, shopkeeper_contact: shopkeeperContact });

    const sel = document.getElementById("mShopName");
    const opt = document.createElement("option");
    opt.value = shopName;
    opt.textContent = shopName;
    sel.appendChild(opt);

    // Close form, show shop select, auto-select new shop
    cancelAddNewShop();
    sel.value = shopName;

    // Auto-fill shopkeeper
    document.getElementById("mShopkeeperName").value = shopkeeperName || "";
    document.getElementById("mShopkeeperContact").value = shopkeeperContact || "";
    document.getElementById("shopkeeperSection").style.display = "block";

    btn.textContent = "✓ Add Shop to Database";
    btn.disabled = false;
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.textContent = "✓ Add Shop to Database";
    btn.disabled = false;
  }
};

window.cancelVisit = function () {
  document.getElementById("visitModal").classList.remove("show");
  visitPhotoData = null;
  stopVCam();
  if (visitCdInt) clearInterval(visitCdInt);
  localStorage.removeItem("visitActive");
};

window.saveVisit = async function () {
  if (!currentEmp) { toast("Login expire hua", "error"); return; }

  const area = document.getElementById("visitAreaSelect").value;
  const shopName = document.getElementById("mShopName").value;
  const shopkeeperName = document.getElementById("mShopkeeperName").value.trim();
  const shopkeeperContact = document.getElementById("mShopkeeperContact").value.trim();

  if (!visitPhotoData) { toast("Photo lena zaroori hai", "error"); return; }
  if (!shopName) { toast("Shop ka naam daalo", "error"); return; }
  if (!area) { toast("Area select karo", "error"); return; }

  const btn = document.getElementById("visitSaveBtn");
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const photoUrl = await uploadPhoto(visitPhotoData, "VISIT_" + currentEmp.name);
  const mapLink = gpsPos ? "https://maps.google.com/?q=" + gpsPos.lat + "," + gpsPos.lng : "";

  try {
    const { data, error } = await supabase.from("visits").insert([{
      employee_name: currentEmp.name,
      employee_contact: currentEmp.contact || "",
      area: area,
      shop_name: shopName,
      shopkeeper_name: shopkeeperName,
      shopkeeper_contact: shopkeeperContact,
      visit_in_time: new Date().toLocaleTimeString("en-IN"),
      visit_date: new Date().toISOString().split("T")[0],
      map_link: mapLink,
      visit_photo: photoUrl || null
    }]).select();

    if (error) {
      toast("Visit save error: " + error.message, "error");
      btn.classList.remove("loading");
      btn.textContent = "✓ Save Visit";
      return;
    }

    currentVisitId = data[0].id;

    btn.classList.remove("loading");
    btn.textContent = "✓ Save Visit";
    document.getElementById("visitModal").classList.remove("show");
    visitPhotoData = null;

    toast("Visit save ho gaya! ✓", "success");
    document.getElementById("bReOut").classList.remove("dis");
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.classList.remove("loading");
    btn.textContent = "✓ Save Visit";
  }
};

/* ════════════════════════════════════════════════════════════════
   VISIT COUNTDOWN (3 min minimum)
   ════════════════════════════════════════════════════════════════ */

function startVisitCD() {
  if (visitCdInt) clearInterval(visitCdInt);

  const bReIn = document.getElementById("bReIn");
  const bReOut = document.getElementById("bReOut");
  const visitCdBadge = document.getElementById("visitCdBadge");

  visitCdInt = setInterval(() => {
    const rem = MIN_SHOP_CHECKOUT - (Date.now() - visitStartMs);

    if (rem <= 0) {
      clearInterval(visitCdInt);
      if (visitCdBadge) visitCdBadge.classList.remove("show");
    } else {
      const seconds = Math.ceil(rem / 1000);
      if (visitCdBadge) {
        visitCdBadge.textContent = seconds + "s";
        visitCdBadge.classList.add("show");
      }
    }
  }, 500);
}

/* ════════════════════════════════════════════════════════════════
   VISITS — VISIT OUT
   ════════════════════════════════════════════════════════════════ */

window.doShopCheckout = function () {
  if (!currentVisitId) { toast("Pehle visit in karo", "error"); return; }

  selectedRating = 0;
  document.getElementById("ratingDisplay").textContent = "Select rating";
  document.querySelectorAll(".star").forEach(star => star.classList.remove("selected"));

  // ✅ Show live visit duration in Visit Out modal
  updateVisitDurationDisplay();
  if (visitDurationInt) clearInterval(visitDurationInt);
  visitDurationInt = setInterval(updateVisitDurationDisplay, 1000);

  document.getElementById("visitOutModal").classList.add("show");
};

function updateVisitDurationDisplay() {
  if (!visitStartMs) return;
  const el = document.getElementById("visitDurationDisplay");
  if (!el) return;

  const diffMs = Date.now() - visitStartMs;
  const totalSeconds = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    el.textContent = h + "h " + String(m).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s";
  } else {
    el.textContent = String(m).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s";
  }
}

window.setRating = function (rating) {
  selectedRating = rating;
  document.querySelectorAll(".star").forEach((star, index) => {
    if (index < rating) star.classList.add("selected");
    else star.classList.remove("selected");
  });
  document.getElementById("ratingDisplay").textContent = rating + " star" + (rating > 1 ? "s" : "");
};

window.submitVisitOut = async function () {
  if (selectedRating === 0) { toast("Rating select karo", "error"); return; }
     const notes =
    document.getElementById("visitOutNotes")?.value.trim() || "";

  const btn = document.getElementById("visitOutBtn");
  btn.classList.add("loading");
  btn.textContent = "Submitting...";

  try {
    const visitOutTime = new Date();

    // ✅ CORRECT HOLD TIME = visit in time to visit out time only
    const diffMs = visitOutTime.getTime() - visitStartMs;
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const holdTime = String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");

    const { error } = await supabase.from("visits").update({
  visit_out_time: visitOutTime.toLocaleTimeString("en-IN"),
  rating: selectedRating,
  hold_time: holdTime,
  visit_out_notes: notes
}).eq("id", currentVisitId);

    if (error) {
      toast("Visit out error: " + error.message, "error");
      btn.classList.remove("loading");
      btn.textContent = "✓ Visit Out";
      return;
    }

    currentVisitId = null;
    if (visitCdInt) clearInterval(visitCdInt);
    if (visitDurationInt) { clearInterval(visitDurationInt); visitDurationInt = null; }
    localStorage.removeItem("visitActive");

    document.getElementById("visitOutModal").classList.remove("show");
    document.getElementById("bReOut").classList.add("dis");

    btn.classList.remove("loading");
    btn.textContent = "✓ Visit Out";

    toast("Visit out ho gaya! ✓ Hold time: " + holdTime, "success");

    // ✅ Refresh hold time display on dashboard
    loadTodayHoldTime();
  } catch (err) {
    toast("Error: " + err.message, "error");
    btn.classList.remove("loading");
    btn.textContent = "✓ Visit Out";
  }
};

window.closeVisitOutModal = function () {
  if (visitDurationInt) { clearInterval(visitDurationInt); visitDurationInt = null; }
  document.getElementById("visitOutModal").classList.remove("show");

     document.getElementById("visitOutNotes").value = "";

};

/* ════════════════════════════════════════════════════════════════
   VISIT CAMERA
   ════════════════════════════════════════════════════════════════ */

window.openVisitCamera = function () {
  document.getElementById("visitCamModal").classList.add("show");
  document.getElementById("vVideo").style.display = "block";
  document.getElementById("vPreview").style.display = "none";
  document.getElementById("vBtnCap").style.display = "block";
  document.getElementById("vBtnRe").style.display = "none";
  document.getElementById("vBtnNext").style.display = "none";

  stopVCam();

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(stream => {
    vCamStream = stream;
    document.getElementById("vVideo").srcObject = stream;
    getGps();
  }).catch(err => {
    toast("Camera error: " + err.message, "error");
    window.closeVisitCamera();
  });
};

window.closeVisitCamera = function () {
  stopVCam();
  document.getElementById("visitCamModal").classList.remove("show");
};

function stopVCam() {
  if (vCamStream) { vCamStream.getTracks().forEach(t => t.stop()); vCamStream = null; }
  const v = document.getElementById("vVideo");
  if (v) v.srcObject = null;
}

window.vCapture = function () {
  const v = document.getElementById("vVideo");
  const c = document.getElementById("vCanvas");
  const p = document.getElementById("vPreview");

  c.width = v.videoWidth || 640;
  c.height = v.videoHeight || 480;
  c.getContext("2d").drawImage(v, 0, 0);

  const data = c.toDataURL("image/jpeg", 0.65);
  p.src = data;
  p.style.display = "block";
  v.style.display = "none";

  document.getElementById("vBtnCap").style.display = "none";
  document.getElementById("vBtnRe").style.display = "block";
  document.getElementById("vBtnNext").style.display = "block";
};

window.vRetake = function () {
  document.getElementById("vVideo").style.display = "block";
  document.getElementById("vPreview").style.display = "none";
  document.getElementById("vBtnCap").style.display = "block";
  document.getElementById("vBtnRe").style.display = "none";
  document.getElementById("vBtnNext").style.display = "none";
};

window.vAccept = function () {
  visitPhotoData = document.getElementById("vPreview").src;
  document.getElementById("visitThumb").src = visitPhotoData;
  document.getElementById("visitPhotoWrap").style.display = "block";
  document.getElementById("visitPhotoBtn").style.display = "none";

  stopVCam();
  window.closeVisitCamera();
  toast("Photo ready ✓", "success");
};

/* ════════════════════════════════════════════════════════════════
   QUICK PHOTO
   ════════════════════════════════════════════════════════════════ */

window.doQuickPhoto = function () {
  if (!currentEmp) return;
  if (!localStorage.getItem("checkin")) { toast("Pehle check-in karo", "error"); return; }

  document.getElementById("camTitle").textContent = "📸 Quick Photo";
  document.getElementById("video").style.display = "block";
  document.getElementById("photoPreview").style.display = "none";
  document.getElementById("btnCap").style.display = "block";
  document.getElementById("btnNext").style.display = "none";
  document.getElementById("btnRe").style.display = "none";

  showScreen("s-cam");
  stopCam();

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(stream => {
    camStream = stream;
    document.getElementById("video").srcObject = stream;
    getGps();
  }).catch(err => {
    toast("Camera error: " + err.message, "error");
    showScreen("s-dash");
  });
};

function stopCam() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  const v = document.getElementById("video");
  if (v) v.srcObject = null;
}

window.closeCam = function () { stopCam(); showScreen("s-dash"); };

window.capturePhoto = function () {
  const v = document.getElementById("video");
  const c = document.getElementById("canvas");
  const p = document.getElementById("photoPreview");

  c.width = v.videoWidth || 640;
  c.height = v.videoHeight || 480;
  c.getContext("2d").drawImage(v, 0, 0);

  const data = c.toDataURL("image/jpeg", 0.65);
  p.src = data;
  p.style.display = "block";
  v.style.display = "none";

  document.getElementById("btnCap").style.display = "none";
  document.getElementById("btnNext").style.display = "block";
  document.getElementById("btnRe").style.display = "block";
};

window.retakePhoto = function () {
  document.getElementById("video").style.display = "block";
  document.getElementById("photoPreview").style.display = "none";
  document.getElementById("btnCap").style.display = "block";
  document.getElementById("btnNext").style.display = "none";
  document.getElementById("btnRe").style.display = "none";
};

window.acceptPhoto = function () {
  const data = document.getElementById("photoPreview").src;
  stopCam();
  showScreen("s-dash");
  sendQuickPhoto(data);
};

async function sendQuickPhoto(data) {
  if (!currentEmp) return;
  toast("Photo bheja ja raha hai...", "info");

  const photoUrl = await uploadPhoto(data, "QP_" + currentEmp.name);

  try {
    const { error } = await supabase.from("visits").insert([{
      employee_name: currentEmp.name,
      visit_date: new Date().toISOString().split("T")[0],
      visit_in_time: new Date().toLocaleTimeString("en-IN"),
      shop_name: "Quick Photo",
      visit_out_notes: photoUrl
    }]);

    if (error) { toast("Photo save error", "error"); return; }
    toast("Photo save ho gaya ✓", "success");
  } catch (err) {
    toast("Error: " + err.message, "error");
  }
}

/* ════════════════════════════════════════════════════════════════
   GPS
   ════════════════════════════════════════════════════════════════ */

function getGps() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const b = document.getElementById("gpsBadge");
      if (b) { b.textContent = "📍 " + gpsPos.lat.toFixed(5) + ", " + gpsPos.lng.toFixed(5); b.classList.add("show"); }
    },
    () => {},
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function startGps() {
  stopGps();
  gpsInterval = setInterval(() => {
    if (!currentEmp || !localStorage.getItem("checkin")) return;
    navigator.geolocation.getCurrentPosition(
      pos => { gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, GPS_INTERVAL);
}

function stopGps() {
  if (gpsInterval) { clearInterval(gpsInterval); gpsInterval = null; }
}

window.loadDist = function () { toast("Distance tracking active", "info"); };

/* ════════════════════════════════════════════════════════════════
   PHOTO UPLOAD
   ════════════════════════════════════════════════════════════════ */

async function uploadPhoto(base64String, fileName) {
  try {
    const base64Data = base64String.split(",")[1] || base64String;
    const blob = await fetch("data:image/jpeg;base64," + base64Data).then(r => r.blob());
    const path = "public/" + fileName + "_" + Date.now() + ".jpg";
    const { error } = await supabase.storage.from("photos").upload(path, blob);
    if (error) { console.error("Photo upload error:", error); return ""; }
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("Upload error:", err);
    return "";
  }
}

/* ════════════════════════════════════════════════════════════════
   PWA & MISC
   ════════════════════════════════════════════════════════════════ */

window.installPWA = function () { toast("PWA install feature coming soon", "info"); };
window.dismissPWA = function () { const b = document.getElementById("pwaBanner"); if (b) b.classList.remove("show"); };

window.addEventListener("load", () => {
  const emp = localStorage.getItem("emp");

  if (emp) {
    currentEmp = JSON.parse(emp);
    document.getElementById("dashName").textContent = currentEmp.name;
    showScreen("s-dash");
    startClock();
    refreshDash();
    loadDashboardRoutes(); // ✅ Load routes when returning to dashboard
  } else {
    showScreen("s-land");
  }

  toast("App ready ✓", "success");
});
