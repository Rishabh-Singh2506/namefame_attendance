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
let allRoutes = [];
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
let selectedRating = 0;

const GPS_INTERVAL = 5 * 60 * 1000;
const MIN_CHECKOUT = 30 * 1000;
const MIN_SHOP_CHECKOUT = 3 * 60 * 1000; // 3 minutes

/* ════════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
   ════════════════════════════════════════════════════════════════ */

function toast(msg, type = "") {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = msg;
  el.className = "toast";

  if (type) {
    el.classList.add(type);
  }

  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 2500);
}

/* ════════════════════════════════════════════════════════════════
   SCREEN NAVIGATION
   ════════════════════════════════════════════════════════════════ */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
  });

  const el = document.getElementById(id);
  if (el) {
    el.classList.add("active");
  }
}

/* ════════════════════════════════════════════════════════════════
   LOAD STATES
   ════════════════════════════════════════════════════════════════ */

async function loadStates() {
  const stateWrap = document.getElementById("stateList-wrap");
  const stateLoad = document.getElementById("stateLoading");

  if (!stateWrap || !stateLoad) return;

  stateWrap.style.display = "none";
  stateLoad.style.display = "block";

  const { data, error } = await supabase
    .from("routes")
    .select("state");

  if (error) {
    stateLoad.textContent = "⚠️ Error loading states";
    return;
  }

  const states = [...new Set(data.map(r => r.state))];

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
   LOAD DISTRICTS
   ════════════════════════════════════════════════════════════════ */

window.loadDistricts = async function () {
  const state = document.getElementById("stateSelect").value;

  if (!state) return;

  const { data, error } = await supabase
    .from("routes")
    .select("district")
    .eq("state", state.toLowerCase());

  if (error) return;

  const districts = [...new Set(data.map(d => d.district))];

  const sel = document.getElementById("districtSelect");
  sel.innerHTML = '<option value="">-- District chunein --</option>';

  districts.forEach(d => {
    sel.innerHTML += `<option value="${d}">${d}</option>`;
  });
};
/* ════════════════════════════════════════════════════════════════
   LOAD ROUTES
   ════════════════════════════════════════════════════════════════ */

window.loadRoutes = async function () {
const state = document.getElementById("stateSelect").value;
  const district = document.getElementById("districtSelect").value;

  if (!state || !district) {
    document.getElementById("routeSelect").style.display = "none";
    return;
  }

  const { data, error } = await supabase
    .from("routes")
    .select("working_route")
    .eq("state", state.toLowerCase())
    .eq("district", district.toLowerCase());

  if (error) return;

  const routes = [...new Set(data.map(r => r.working_route))];

  const sel = document.getElementById("routeSelect");
  sel.innerHTML = '<option value="">-- Route chunein --</option>';
  sel.style.display = "block";

  routes.forEach(route => {
    const opt = document.createElement("option");
    opt.value = route;
    opt.textContent = route;
    sel.appendChild(opt);
  });
}

/* ════════════════════════════════════════════════════════════════
   LOAD AREAS (For Visit Modal)
   ════════════════════════════════════════════════════════════════ */

window.loadAreas = async function () {
  const state = document.getElementById("stateSelect").value;
  const district = document.getElementById("districtSelect").value;
  const route = document.getElementById("routeSelect").value;

  if (!state || !district || !route) {
    return;
  }

  const { data, error } = await supabase
    .from("routes")
    .select("area")
    .eq("state", state.toLowerCase())
    .eq("district", district.toLowerCase())
   .eq("working_route", route.toLowerCase());

  if (error) return;

  allRoutes = data || [];
}

/* ════════════════════════════════════════════════════════════════
   LOAD EMPLOYEES
   ════════════════════════════════════════════════════════════════ */

async function loadEmployees() {
  const wrap = document.getElementById("empList-wrap");
  const load = document.getElementById("empLoading");

  if (!wrap || !load) return;

  wrap.style.display = "none";
  load.style.display = "block";
  load.textContent = "⏳ Loading...";

  const { data, error } = await supabase
    .from("employees")
    .select("*");

  if (error) {
    load.textContent = "⚠️ Network error. Try again.";
    return;
  }

  allEmployees = data || [];

  const sel = document.getElementById("empSelect");
  sel.innerHTML = '<option value="">-- Naam chunein --</option>';

  allEmployees.forEach(emp => {
    const opt = document.createElement("option");
    opt.value = emp.id;
    opt.textContent = emp.name + " (" + (emp.designation || "Field") + ")";
    sel.appendChild(opt);
  });

  wrap.style.display = "block";
  load.style.display = "none";
}

/* ════════════════════════════════════════════════════════════════
   LANDING & LOGIN
   ════════════════════════════════════════════════════════════════ */

window.goVerify = function () {
  showScreen("s-verify");
  loadStates();
  loadEmployees();
};

window.togglePin = function () {
  const input = document.getElementById("pinInput");
  if (input) {
    input.type = input.type === "password" ? "text" : "password";
  }
};

window.doLogin = async function () {
  const empId = document.getElementById("empSelect").value;
  const pin = document.getElementById("pinInput").value;

  if (!empId) {
    toast("Naam select karo", "error");
    return;
  }

  if (!pin) {
    toast("PIN daalo", "error");
    return;
  }

  const emp = allEmployees.find(e => e.id === empId);

  if (!emp || String(emp.pin) !== String(pin)) {
    toast("Galat PIN", "error");
    return;
  }
const state = document.getElementById("stateSelect").value;
const district = document.getElementById("districtSelect").value;
const route = document.getElementById("routeSelect").value;

if (!state || !district || !route) {
  toast("State, District, Route select karo", "error");
  return;
}

//localStorage.setItem("routeData", JSON.stringify({ state, district, route }));
 localStorage.setItem("routeData", JSON.stringify({
  state: state.toLowerCase(),
  district: district.toLowerCase(),
  route: route.toLowerCase()
}));
   currentEmp = emp;
  localStorage.setItem("emp", JSON.stringify(emp));

  document.getElementById("dashName").textContent = emp.name;
  document.getElementById("dashDate").textContent = new Date().toLocaleDateString("hi-IN");

  showScreen("s-dash");
  startClock();
  refreshDash();

  toast("Login successful", "success");
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

  showScreen("s-land");
  toast("Logged out", "info");
};

window.setLang = function (lang) {
  document.querySelectorAll(".lang-chip").forEach(chip => {
    chip.classList.remove("active");
  });

  event.target.classList.add("active");
  localStorage.setItem("lang", lang);

  toast("Language: " + (lang === "hi" ? "हिंदी" : "English"), "info");
};

/* ════════════════════════════════════════════════════════════════
   CLOCK & TIMER
   ════════════════════════════════════════════════════════════════ */

function startClock() {
  if (timerInterval) clearInterval(timerInterval);

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
    if (el) {
      el.textContent = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
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
  if (!currentEmp) {
    toast("Login karo", "error");
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
  if (!checkinData) {
    toast("Pehle check-in karo", "error");
    return;
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

  if (!checkoutPhotoData) {
    toast("Photo lo pehle", "error");
    return;
  }

  if (!odoInput || isNaN(odoInput)) {
    toast("Valid odometer daalo", "error");
    return;
  }

  const checkinData = JSON.parse(localStorage.getItem("checkin"));

  const diff = Date.now() - checkinData.ms;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);

  const btn = document.getElementById("checkoutSubmitBtn");
  btn.classList.add("loading");
  btn.textContent = "Submitting...";

  const photoUrl = await uploadPhoto(checkoutPhotoData, "CO_" + currentEmp.name);

const { error } = await supabase
  .from("attendance")
  .update({
    attendance_closed_time: new Date().toLocaleTimeString("en-IN"),
    odometer_end: parseInt(odoInput),
    distance_km: Math.abs(parseInt(odoInput) - (checkinData.odoStart || 0)),
    closed_odometer_photo: photoUrl || null,
    working_hours: h + "h " + m + "m"
  })
  .eq("id", checkinData.attendanceId);
   
  if (error) {
    toast("Checkout error: " + error.message, "error");
     console.log("Checkout photo URL:", photoUrl);
    btn.classList.remove("loading");
    btn.textContent = "✓ Check-Out";
    return;
  }

  localStorage.removeItem("checkin");
  currentAttendanceId = null;

  document.getElementById("checkoutModal").classList.remove("show");

  if (checkoutCamStream) {
    checkoutCamStream.getTracks().forEach(t => t.stop());
  }

  toast("Check-out ho gaya ✓", "success");
  refreshDash();

  btn.classList.remove("loading");
  btn.textContent = "✓ Check-Out";
};

window.closeCheckoutModal = function () {
  if (checkoutCamStream) {
    checkoutCamStream.getTracks().forEach(t => t.stop());
  }

  document.getElementById("checkoutModal").classList.remove("show");
  checkoutPhotoData = null;
};

/* ════════════════════════════════════════════════════════════════
   VISITS - VISIT IN
   ════════════════════════════════════════════════════════════════ */

window.doNewVisit = function () {
  if (!currentEmp) return;

  if (!localStorage.getItem("checkin")) {
    toast("Pehle check-in karo", "error");
    return;
  }

  visitPhotoData = null;

  ["visitAreaSelect", "mShopName", "mShopkeeperName", "mShopkeeperContact", "mNotes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("newShopName").style.display = "none";
  document.getElementById("visitPhotoWrap").style.display = "none";
  document.getElementById("visitPhotoBtn").style.display = "flex";
  document.getElementById("visitModal").classList.add("show");

  // Load areas
  loadVisitAreas();

  getGps();

  visitStartMs = Date.now();
  startVisitCD();
};

async function loadVisitAreas() {
  const routeData = JSON.parse(localStorage.getItem("routeData") || "{}");

  const { state, district, route } = routeData;

  if (!state || !district || !route) {
    toast("Route data missing. Login dubara karo", "error");
    return;
  }

  const { data, error } = await supabase
    .from("routes")
    .select("area")
    .eq("state", state.toLowerCase())
    .eq("district", district.toLowerCase())
    .eq("working_route", route.toLowerCase());

  if (error) return;

  const areas = [...new Set(data.map(r => r.area))];

  const sel = document.getElementById("visitAreaSelect");
  sel.innerHTML = '<option value="">-- Area chunein --</option>';

  areas.forEach(area => {
    sel.innerHTML += `<option value="${area}">${area}</option>`;
  });
}

window.loadShops = async function () {
  const routeData = JSON.parse(localStorage.getItem("routeData") || "{}");
  const { state, district, route } = routeData;

  const area = document.getElementById("visitAreaSelect").value;

  if (!state || !district || !route || !area) return;

  const { data, error } = await supabase
    .from("routes")
    .select("shop")
    .eq("state", state.toLowerCase())
    .eq("district", district.toLowerCase())
    .eq("working_route", route.toLowerCase())
   .eq("area", area.toLowerCase());

  if (error) return;

  const shops = [...new Set(data.map(r => r.shop))];

  const sel = document.getElementById("mShopName");
  sel.innerHTML = '<option value="">-- Shop chunein --</option>';

  shops.forEach(shop => {
    sel.innerHTML += `<option value="${shop}">${shop}</option>`;
  });
};

window.toggleAddNewShop = function () {
  const input = document.getElementById("newShopName");
  const sel = document.getElementById("mShopName");

  if (input.style.display === "none") {
    input.style.display = "block";
    sel.style.display = "none";
  } else {
    input.style.display = "none";
    sel.style.display = "block";
  }
};

window.cancelVisit = function () {
  document.getElementById("visitModal").classList.remove("show");
  visitPhotoData = null;
  stopVCam();
  if (visitCdInt) clearInterval(visitCdInt);
};

window.saveVisit = async function () {
  if (!currentEmp) {
    toast("Login expire hua", "error");
    return;
  }

  const area = document.getElementById("visitAreaSelect").value;
  let shopName = document.getElementById("mShopName").value;

  const newShopInput = document.getElementById("newShopName");
  if (newShopInput.style.display !== "none") {
    shopName = newShopInput.value.trim();
  }

  const shopkeeperName = document.getElementById("mShopkeeperName").value.trim();
  const shopkeeperContact = document.getElementById("mShopkeeperContact").value.trim();
  const notes = document.getElementById("mNotes").value.trim();

  if (!visitPhotoData) {
    toast("Photo lena zaroori hai", "error");
    return;
  }

  if (!shopName) {
    toast("Shop ka naam daalo", "error");
    return;
  }

  if (!area) {
    toast("Area select karo", "error");
    return;
  }

  const btn = document.getElementById("visitSaveBtn");
  btn.classList.add("loading");
  btn.textContent = "Saving...";

  const photoUrl = await uploadPhoto(visitPhotoData, "VISIT_" + currentEmp.name);

  const mapLink = gpsPos ? "https://maps.google.com/?q=" + gpsPos.lat + "," + gpsPos.lng : "";

  const { data, error } = await supabase
    .from("visits")
    .insert([
      {
        employee_name: currentEmp.name,
        employee_contact: currentEmp.contact || "",
        area: area,
        shop_name: shopName,
        shopkeeper_name: shopkeeperName,
        shopkeeper_contact: shopkeeperContact,
        visit_in_time: new Date().toLocaleTimeString("en-IN"),
        visit_date: new Date().toISOString().split("T")[0],
        map_link: mapLink
      }
    ])
    .select();

  if (error) {
    toast("Visit save error", "error");
    btn.classList.remove("loading");
    btn.textContent = "✓ Save Visit";
    return;
  }

  currentVisitId = data[0].id;

  // If new shop, add to routes
  if (newShopInput.style.display !== "none") {
    const routeData = JSON.parse(localStorage.getItem("routeData") || "{}");
    const { state, district, route } = routeData;
   
    await supabase
      .from("routes")
      .insert([
        {
          state: state,
          district: district,
          working_route: route,
          area: area,
          shop: shopName
        }
      ]);
  }

  btn.classList.remove("loading");
  btn.textContent = "✓ Save Visit";
  document.getElementById("visitModal").classList.remove("show");
  visitPhotoData = null;

  toast("Visit save ho gaya! ✓", "success");

  // Enable visit out after 3 minutes
  document.getElementById("bReOut").classList.remove("dis");
};

function startVisitCD() {
  if (visitCdInt) clearInterval(visitCdInt);

  visitCdInt = setInterval(() => {
    const rem = MIN_SHOP_CHECKOUT - (Date.now() - visitStartMs);
    const b = document.getElementById("bReIn");
    const badge = document.getElementById("visitCdBadge");

    if (rem <= 0) {
      clearInterval(visitCdInt);
      if (b) b.classList.remove("dis");
      if (badge) badge.classList.remove("show");
    } else {
      if (b) b.classList.add("dis");
      if (badge) {
        badge.textContent = Math.ceil(rem / 1000) + "s";
        badge.classList.add("show");
      }
    }
  }, 500);
}

/* ════════════════════════════════════════════════════════════════
   VISITS - VISIT OUT
   ════════════════════════════════════════════════════════════════ */

window.doShopCheckout = function () {
  if (!currentVisitId) {
    toast("Pehle visit in karo", "error");
    return;
  }

  selectedRating = 0;
  document.getElementById("visitOutNotes").value = "";
  document.getElementById("ratingDisplay").textContent = "Select rating";

  document.querySelectorAll(".star").forEach(star => {
    star.classList.remove("selected");
  });

  document.getElementById("visitOutModal").classList.add("show");
};

window.setRating = function (rating) {
  selectedRating = rating;

  document.querySelectorAll(".star").forEach((star, index) => {
    if (index < rating) {
      star.classList.add("selected");
    } else {
      star.classList.remove("selected");
    }
  });

  document.getElementById("ratingDisplay").textContent = rating + " star" + (rating > 1 ? "s" : "");
};

window.submitVisitOut = async function () {
  if (selectedRating === 0) {
    toast("Rating select karo", "error");
    return;
  }

  const notes = document.getElementById("visitOutNotes").value.trim();

  const btn = document.getElementById("visitOutBtn");
  btn.classList.add("loading");
  btn.textContent = "Submitting...";

  const { error } = await supabase
    .from("visits")
    .update({
      visit_out_time: new Date().toLocaleTimeString("en-IN"),
      visit_out_notes: notes,
      rating: selectedRating
    })
    .eq("id", currentVisitId);

  if (error) {
    toast("Visit out error", "error");
    btn.classList.remove("loading");
    btn.textContent = "✓ Visit Out";
    return;
  }

  currentVisitId = null;
  if (visitCdInt) clearInterval(visitCdInt);

  document.getElementById("visitOutModal").classList.remove("show");
  document.getElementById("bReOut").classList.add("dis");

  btn.classList.remove("loading");
  btn.textContent = "✓ Visit Out";

  toast("Visit out ho gaya! ✓", "success");
};

window.closeVisitOutModal = function () {
  document.getElementById("visitOutModal").classList.remove("show");
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
  if (vCamStream) {
    vCamStream.getTracks().forEach(t => t.stop());
    vCamStream = null;
  }

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

  if (!localStorage.getItem("checkin")) {
    toast("Pehle check-in karo", "error");
    return;
  }

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
  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }

  const v = document.getElementById("video");
  if (v) v.srcObject = null;
}

window.closeCam = function () {
  stopCam();
  showScreen("s-dash");
};

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

  const { error } = await supabase
    .from("visits")
    .insert([
      {
        employee_name: currentEmp.name,
        visit_date: new Date().toISOString().split("T")[0],
        visit_in_time: new Date().toLocaleTimeString("en-IN"),
        shop_name: "Quick Photo",
        visit_out_notes: photoUrl
      }
    ]);

  if (error) {
    toast("Photo save error", "error");
    return;
  }

  toast("Photo save ho gaya ✓", "success");
}

/* ════════════════════════════════════════════════════════════════
   GPS & DISTANCE
   ════════════════════════════════════════════════════════════════ */

function getGps() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      const b = document.getElementById("gpsBadge");
      if (b) {
        b.textContent = "📍 " + gpsPos.lat.toFixed(5) + ", " + gpsPos.lng.toFixed(5);
        b.classList.add("show");
      }
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
      pos => {
        gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, GPS_INTERVAL);
}

function stopGps() {
  if (gpsInterval) {
    clearInterval(gpsInterval);
    gpsInterval = null;
  }
}

window.loadDist = function () {
  toast("Distance tracking active", "info");
};

/* ════════════════════════════════════════════════════════════════
   PHOTO UPLOAD
   ════════════════════════════════════════════════════════════════ */

async function uploadPhoto(base64String, fileName) {
  try {
    const base64Data = base64String.split(",")[1] || base64String;

    const blob = await fetch("data:image/jpeg;base64," + base64Data).then(r => r.blob());

    const path = "public/" + fileName + "_" + Date.now() + ".jpg";
     
    const { error } = await supabase.storage.from("photos").upload(path, blob);

    if (error) {
      console.error("Photo upload error:", error);
      return "";
    }

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

window.installPWA = function () {
  toast("PWA install feature coming soon", "info");
};

window.dismissPWA = function () {
  const b = document.getElementById("pwaBanner");
  if (b) b.classList.remove("show");
};

window.addEventListener("load", () => {
  if (!localStorage.getItem("routeData")) {
    toast("Route select nahi hai, login karo", "error");
  }

  const emp = localStorage.getItem("emp");

  if (emp) {
    currentEmp = JSON.parse(emp);
    document.getElementById("dashName").textContent = currentEmp.name;
    showScreen("s-dash");
    startClock();
    refreshDash();
  } else {
    showScreen("s-land");
  }

  toast("App ready ✓", "success");
});
