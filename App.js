"use strict";
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("stateSelect")
    .addEventListener("change", loadDistricts);

  document.getElementById("districtSelect")
    .addEventListener("change", loadRoutes);

  document.getElementById("routeSelect")
    .addEventListener("change", loadAreas);
});
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

document.getElementById("stateLoading").style.display = "none";
document.getElementById("stateList-wrap").style.display = "block";

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
  const districtGroup = document.getElementById("districtGroup");
  const districtSelect = document.getElementById("districtSelect");
  const routeGroup = document.getElementById("routeGroup");
  const routeSelect = document.getElementById("routeSelect");

  if (!state) {
    if (districtGroup) districtGroup.style.display = "none";
    if (routeGroup) routeGroup.style.display = "none";
    if (districtSelect) districtSelect.innerHTML = '<option value="">-- District chunein --</option>';
    return;
  }

  try {
    // Get all routes first (no filter on state)
    const { data: allData, error: allError } = await supabase
      .from("routes")
      .select("state, district");

    if (allError) {
      console.error("District load error:", allError);
      toast("District load nahi ho sake", "error");
      if (districtGroup) districtGroup.style.display = "none";
      return;
    }

    // Filter on client side with case-insensitive comparison
    const filtered = allData.filter(r => 
      r.state && r.district && r.state.toUpperCase() === state.toUpperCase()
    );

    if (!filtered || filtered.length === 0) {
      toast("Koi district nahi mila is state ke liye", "error");
      if (districtGroup) districtGroup.style.display = "none";
      return;
    }

    console.log("Raw district data from DB:", filtered);
    console.log("Total entries:", filtered.length);
    
    // Get unique districts (case-insensitive deduplication)
    const districtMap = {};
    filtered.forEach(r => {
      const key = r.district.toUpperCase();
      if (!districtMap[key]) {
        districtMap[key] = r.district; // Store original case
      }
    });
    
    const districts = Object.values(districtMap).sort();
    
    console.log("Unique districts after filter:", districts);

    if (districtSelect) {
      districtSelect.innerHTML = '<option value="">-- District chunein --</option>';

      districts.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        districtSelect.appendChild(opt);
      });
    }

    if (districtGroup) districtGroup.style.display = "block";
    if (routeGroup) routeGroup.style.display = "none";
    if (routeSelect) routeSelect.innerHTML = '<option value="">-- Route chunein --</option>';
    
    toast("Districts load ho gaye ✓ (" + districts.length + " unique)", "success");
  } catch (err) {
    console.error("Exception in loadDistricts:", err);
    toast("Kuch galat hua: " + err.message, "error");
    if (districtGroup) districtGroup.style.display = "none";
  }
};

/* ════════════════════════════════════════════════════════════════
   LOAD ROUTES
   ════════════════════════════════════════════════════════════════ */

window.loadRoutes = async function () {
  const state = document.getElementById("stateSelect").value;
  const district = document.getElementById("districtSelect").value;
  const routeSelect = document.getElementById("routeSelect");
  const routeGroup = document.getElementById("routeGroup");

  if (!state || !district) {
    if (routeGroup) routeGroup.style.display = "none";
    if (routeSelect) routeSelect.innerHTML = '<option value="">-- Route chunein --</option>';
    return;
  }

  try {
    // Get all routes
    const { data: allData, error: allError } = await supabase
      .from("routes")
      .select("state, district, working_route");

    if (allError) {
      console.error("Route load error:", allError);
      toast("Route load nahi ho sake", "error");
      return;
    }

    // Filter on client side with case-insensitive comparison
    const filtered = allData.filter(r => 
      r.state && r.district && r.working_route &&
      r.state.toUpperCase() === state.toUpperCase() &&
      r.district.toUpperCase() === district.toUpperCase()
    );

    if (!filtered || filtered.length === 0) {
      toast("Koi route nahi mila is district ke liye", "error");
      if (routeGroup) routeGroup.style.display = "none";
      return;
    }

    console.log("Raw route data from DB:", filtered);
    console.log("Total entries:", filtered.length);
    
    // Get unique routes (case-insensitive deduplication)
    const routeMap = {};
    filtered.forEach(r => {
      const key = r.working_route.toUpperCase();
      if (!routeMap[key]) {
        routeMap[key] = r.working_route; // Store original case
      }
    });
    
    const routes = Object.values(routeMap).sort();
    
    console.log("Unique routes after filter:", routes);

    if (routeSelect) {
      routeSelect.innerHTML = '<option value="">-- Route chunein --</option>';

      routes.forEach(route => {
        const opt = document.createElement("option");
        opt.value = route;
        opt.textContent = route;
        routeSelect.appendChild(opt);
      });
    }

    if (routeGroup) routeGroup.style.display = "block";
    
    toast("Routes load ho gaye ✓ (" + routes.length + " unique)", "success");
  } catch (err) {
    console.error("Exception in loadRoutes:", err);
    toast("Kuch galat hua: " + err.message, "error");
  }
};

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

  try {
    // Get all routes
    const { data: allData, error: allError } = await supabase
      .from("routes")
      .select("state, district, working_route, area");

    if (allError) {
      console.error("Area load error:", allError);
      return;
    }

    // Filter on client side with case-insensitive comparison
    const filtered = allData.filter(r => 
      r.state && r.district && r.working_route && r.area &&
      r.state.toUpperCase() === state.toUpperCase() &&
      r.district.toUpperCase() === district.toUpperCase() &&
      r.working_route.toUpperCase() === route.toUpperCase()
    );

    console.log("Raw area data from DB:", filtered);
    
    // Get unique areas (case-insensitive deduplication)
    const areaMap = {};
    filtered.forEach(r => {
      const key = r.area.toUpperCase();
      if (!areaMap[key]) {
        areaMap[key] = r.area; // Store original case
      }
    });
    
    allRoutes = filtered || [];
    
    console.log("Unique areas:", Object.values(areaMap));
  } catch (err) {
    console.error("Exception in loadAreas:", err);
  }
};

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

  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*");

    if (error) {
      load.textContent = "⚠️ Network error. Try again.";
      console.error("Employee load error:", error);
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
  } catch (err) {
    load.textContent = "⚠️ Error: " + err.message;
    console.error("Exception in loadEmployees:", err);
  }
}

/* ════════════════════════════════════════════════════════════════
   LANDING & LOGIN
   ════════════════════════════════════════════════════════════════ */

window.goVerify = function () {
  showScreen("s-verify");
  loadStates();
  // Employee loading nahi chahiye ab
};

window.togglePin = function () {
  const input = document.getElementById("pinInput");
  if (input) {
    input.type = input.type === "password" ? "text" : "password";
  }
};

window.doLogin = async function () {
  const empName = document.getElementById("empNameInput").value.trim();
  const pin = document.getElementById("pinInput").value;

  if (!empName) {
    toast("Naam likho", "error");
    return;
  }

  if (!pin) {
    toast("PIN daalo", "error");
    return;
  }

  const state = document.getElementById("stateSelect").value;
  const district = document.getElementById("districtSelect").value;
  const route = document.getElementById("routeSelect").value;

  if (!state || !district || !route) {
    toast("State, District, Route select karo", "error");
    return;
  }

  try {
    console.log("Searching for employee:", empName);

    // Get all employees and filter on client side
    const { data: allEmployees, error: empError } = await supabase
      .from("employees")
      .select("*");

    if (empError) {
      toast("Database error: " + empError.message, "error");
      console.error("Employee query error:", empError);
      return;
    }

    if (!allEmployees || allEmployees.length === 0) {
      toast("Database mein koi employee nahi", "error");
      return;
    }

    console.log("All employees:", allEmployees);

    // Find matching employee (case-insensitive)
    let emp = allEmployees.find(e => 
      e.name && e.name.toLowerCase() === empName.toLowerCase()
    );

    if (!emp) {
      // Try partial match
      emp = allEmployees.find(e => 
        e.name && e.name.toLowerCase().includes(empName.toLowerCase())
      );
    }

    if (!emp) {
      console.log("No employee found with name:", empName);
      console.log("Available employees:", allEmployees.map(e => e.name));
      toast("Employee nahi mila: '" + empName + "'. Sahi naam likho", "error");
      return;
    }

    console.log("Found employee:", emp);

    // Check PIN
    if (String(emp.pin) !== String(pin)) {
      toast("Galat PIN", "error");
      return;
    }

    // All checks passed, login successful
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

    toast("Login successful ✓", "success");
  } catch (err) {
    console.error("Exception in doLogin:", err);
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

  // Redirect to check-in page
  location.href = "checkin.html";
};

function startAutomaticCheckoutTimer() {
  // Calculate time until 10 PM IST today
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0, 0); // 10 PM
  
  // If already past 10 PM, schedule for tomorrow
  if (now > today) {
    today.setDate(today.getDate() + 1);
  }

  const timeUntilCheckout = today.getTime() - now.getTime();
  
  console.log("Automatic checkout scheduled at 10 PM IST. Time remaining:", Math.round(timeUntilCheckout / 1000 / 60), "minutes");

  // Schedule automatic checkout
  setTimeout(() => {
    performAutomaticCheckout();
  }, timeUntilCheckout);
}

async function performAutomaticCheckout() {
  const checkinData = localStorage.getItem("checkin");
  
  if (!checkinData) {
    console.log("No active checkin, skipping automatic checkout");
    return;
  }

  try {
    const data = JSON.parse(checkinData);
    const checkoutTime = new Date();

    const { error } = await supabase
      .from("attendance")
      .update({
        attendance_closed_time: checkoutTime.toLocaleTimeString("en-IN"),
        auto_checkout: true,
        notes: "Automatic checkout at 10 PM IST"
      })
      .eq("id", data.attendanceId);

    if (error) {
      console.error("Automatic checkout error:", error);
      return;
    }

    localStorage.removeItem("checkin");
    console.log("Automatic checkout completed at 10 PM IST");
    
    // Refresh dashboard if user is still on app
    if (currentEmp) {
      refreshDash();
    }
  } catch (err) {
    console.error("Exception in performAutomaticCheckout:", err);
  }
}

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

  // Get GPS location for checkout
  let checkoutGPS = null;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        checkoutGPS = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        console.log("Checkout GPS captured:", checkoutGPS);
        localStorage.setItem("checkoutGPS", JSON.stringify(checkoutGPS));
      },
      (err) => {
        console.warn("GPS error:", err.message);
      },
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

  const checkoutGPSData = localStorage.getItem("checkoutGPS");
  let mapLink = null;
  if (checkoutGPSData) {
    const gps = JSON.parse(checkoutGPSData);
    mapLink = "https://maps.google.com/?q=" + gps.lat + "," + gps.lng;
  }

  const updatePayload = {
    attendance_closed_time: new Date().toLocaleTimeString("en-IN"),
    odometer_end: parseInt(odoInput),
    distance_km: Math.abs(parseInt(odoInput) - (checkinData.odoStart || 0)),
    closed_odometer_photo: photoUrl || null,
    working_hours: h + "h " + m + "m",
    map_link: mapLink
  };

  try {
    const { error } = await supabase
      .from("attendance")
      .update(updatePayload)
      .eq("id", checkinData.attendanceId);

    if (error) {
      toast("Checkout error: " + error.message, "error");
      console.error("Checkout error details:", error);
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
  } catch (err) {
    console.error("Exception in submitCheckout:", err);
    toast("Error: " + err.message, "error");
    btn.classList.remove("loading");
    btn.textContent = "✓ Check-Out";
  }
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

  // Check if there's an active visit in localStorage
  const visitStorage = localStorage.getItem("visitActive");
  if (visitStorage) {
    const visitInfo = JSON.parse(visitStorage);
    visitStartMs = visitInfo.startTime;
    console.log("Resuming visit after page refresh. Start time:", new Date(visitStartMs));
  } else {
    visitStartMs = Date.now();
    localStorage.setItem("visitActive", JSON.stringify({ startTime: visitStartMs }));
  }
  
  startVisitCD();
};

async function loadVisitAreas() {
  const routeData = JSON.parse(localStorage.getItem("routeData") || "{}");

  const { state, district, route } = routeData;

  if (!state || !district || !route) {
    toast("Route data missing. Login dubara karo", "error");
    return;
  }

  try {
    // Get all routes
    const { data: allData, error: allError } = await supabase
      .from("routes")
      .select("state, district, working_route, area");

    if (allError) {
      console.error("Visit areas error:", allError);
      toast("Areas load nahi ho sake", "error");
      return;
    }

    // Filter on client side with case-insensitive comparison
    const filtered = allData.filter(r => 
      r.state && r.district && r.working_route && r.area &&
      r.state.toUpperCase() === state.toUpperCase() &&
      r.district.toUpperCase() === district.toUpperCase() &&
      r.working_route.toUpperCase() === route.toUpperCase()
    );

    console.log("Raw visit area data from DB:", filtered);

    // Get unique areas (case-insensitive deduplication)
    const areaMap = {};
    filtered.forEach(r => {
      const key = r.area.toUpperCase();
      if (!areaMap[key]) {
        areaMap[key] = r.area; // Store original case
      }
    });
    
    const areas = Object.values(areaMap).sort();

    const sel = document.getElementById("visitAreaSelect");
    sel.innerHTML = '<option value="">-- Area chunein --</option>';

    areas.forEach(area => {
      const opt = document.createElement("option");
      opt.value = area;
      opt.textContent = area;
      sel.appendChild(opt);
    });
    
    console.log("Unique areas loaded:", areas);
  } catch (err) {
    console.error("Exception in loadVisitAreas:", err);
    toast("Error: " + err.message, "error");
  }
}

window.loadShops = async function () {
  const routeData = JSON.parse(localStorage.getItem("routeData") || "{}");
  const { state, district, route } = routeData;

  const area = document.getElementById("visitAreaSelect").value;

  if (!state || !district || !route || !area) return;

  try {
    // Get all routes
    const { data: allData, error: allError } = await supabase
      .from("routes")
      .select("state, district, working_route, area, shop");

    if (allError) {
      console.error("Shop load error:", allError);
      return;
    }

    // Filter on client side with case-insensitive comparison
    const filtered = allData.filter(r => 
      r.state && r.district && r.working_route && r.area && r.shop &&
      r.state.toUpperCase() === state.toUpperCase() &&
      r.district.toUpperCase() === district.toUpperCase() &&
      r.working_route.toUpperCase() === route.toUpperCase() &&
      r.area.toUpperCase() === area.toUpperCase()
    );

    console.log("Raw shop data from DB:", filtered);
    console.log("Total entries:", filtered.length);
    
    // Get unique shops (case-insensitive deduplication)
    const shopMap = {};
    filtered.forEach(r => {
      const key = r.shop.toUpperCase();
      if (!shopMap[key]) {
        shopMap[key] = r.shop; // Store original case
      }
    });
    
    const shops = Object.values(shopMap).sort();

    console.log("Unique shops after filter:", shops);

    const sel = document.getElementById("mShopName");
    sel.innerHTML = '<option value="">-- Shop chunein --</option>';

    shops.forEach(shop => {
      const opt = document.createElement("option");
      opt.value = shop;
      opt.textContent = shop;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("Exception in loadShops:", err);
  }
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
  localStorage.removeItem("visitActive");
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

  try {
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
      toast("Visit save error: " + error.message, "error");
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
    localStorage.removeItem("visitActive");

    toast("Visit save ho gaya! ✓", "success");

    // Enable visit out after 3 minutes
    document.getElementById("bReOut").classList.remove("dis");
  } catch (err) {
    console.error("Exception in saveVisit:", err);
    toast("Error: " + err.message, "error");
    btn.classList.remove("loading");
    btn.textContent = "✓ Save Visit";
  }
};

function startVisitCD() {
  if (visitCdInt) clearInterval(visitCdInt);

  const bReIn = document.getElementById("bReIn");
  const bReOut = document.getElementById("bReOut");
  const visitCdBadge = document.getElementById("visitCdBadge");
  const checkoutBadge = document.getElementById("visitCdBadge"); // Same badge for checkout

  visitCdInt = setInterval(() => {
    const rem = MIN_SHOP_CHECKOUT - (Date.now() - visitStartMs);

    if (rem <= 0) {
      clearInterval(visitCdInt);
      
      // Enable both buttons after 3 minutes
      if (bReIn) bReIn.classList.remove("dis");
      if (bReOut) bReOut.classList.remove("dis");
      if (visitCdBadge) visitCdBadge.classList.remove("show");
      
      console.log("Visit minimum time completed. Buttons enabled.");
    } else {
      // Keep buttons disabled
      if (bReIn) bReIn.classList.add("dis");
      if (bReOut) bReOut.classList.add("dis");
      
      if (visitCdBadge) {
        const seconds = Math.ceil(rem / 1000);
        visitCdBadge.textContent = seconds + "s";
        visitCdBadge.classList.add("show");
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

  try {
    // Get current time
    const visitOutTime = new Date();
    const visitOutTimeStr = visitOutTime.toLocaleTimeString("en-IN");

    // Calculate hold time from visitStartMs
    const diffMs = visitOutTime.getTime() - visitStartMs;
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const holdTime = String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");

    console.log("Visit hold time calculation:");
    console.log("Start time:", new Date(visitStartMs));
    console.log("End time:", visitOutTime);
    console.log("Total seconds:", totalSeconds);
    console.log("Hold time:", holdTime);

    const { error } = await supabase
      .from("visits")
      .update({
        visit_out_time: visitOutTimeStr,
        visit_out_notes: notes,
        rating: selectedRating,
        hold_time: holdTime
      })
      .eq("id", currentVisitId);

    if (error) {
      toast("Visit out error: " + error.message, "error");
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
  } catch (err) {
    console.error("Exception in submitVisitOut:", err);
    toast("Error: " + err.message, "error");
    btn.classList.remove("loading");
    btn.textContent = "✓ Visit Out";
  }
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

  try {
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
      console.error("Quick photo error:", error);
      return;
    }

    toast("Photo save ho gaya ✓", "success");
  } catch (err) {
    console.error("Exception in sendQuickPhoto:", err);
    toast("Error: " + err.message, "error");
  }
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
