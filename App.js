"use strict";
// ╔══════════════════════════════════════════════════════════════╗
// ║                    App.js — NAMEFAME                        ║
// ║   Ye file dono pages ka JS handle karti hai:                ║
// ║   1. index.html  — Landing, Login, Dashboard, Visit Modal   ║
// ║   2. checkin.html — Camera Check-In Page                    ║
// ╚══════════════════════════════════════════════════════════════╝

// ══════════════════════════════════════════
// SECTION A: SHARED CONFIG & UTILITIES
// ══════════════════════════════════════════

var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz6WBAIGox6yRF4VNbN80zFDkjqL4DQy8F0YlJzVoW41jHAwWJyosm9s-u_sbBsEN4/exec";


var ciPhotos = [];  // Array to store up to 2 photos
var ciOdometerStart = null;
var checkoutPhotoData = null;
var checkoutCamStream = null;

var GPS_INTERVAL = 5 * 60 * 1000;
var MIN_CHECKOUT = 30 * 1000;

// Page detect
var IS_INDEX   = !!document.getElementById("s-land");
var IS_CHECKIN = !!document.getElementById("ciPage");

// ── Index State Vars ──
var currentEmp     = null;
var camStream      = null;
var vCamStream     = null;
var gpsInterval    = null;
var gpsPos         = null;
var timerInt       = null;
var cdInt          = null;
var clockInt       = null;
var totalDist      = 0;
var lastGpsPos     = null;
var allEmployees   = [];
var visitPhotoData = null;
var deferredPrompt = null;

// ── Checkin State Vars ──
var ciCurrentEmp = null;
var ciCamStream  = null;
var ciCamFacing  = "user";
var ciGpsPos     = null;
var ciPhotoData  = null;

// ── LocalStorage Helper ──
var store = {
  get: function(k) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e) { return null; }
  },
  set: function(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
  },
  del: function(k) {
    try { localStorage.removeItem(k); } catch(e) {}
  }
};

// ── API Post ──
function apiPost(data) {
  return fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(data)
  }).then(function(r) { return r.json(); });
}

// ── Toast ──
var toastTimer = null;
function toast(msg, type) {
  var el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast show" + (type ? " " + type : "");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove("show"); }, 3000);
}

// ── Date/Time Formatters ──
function fmtDate(v) {
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return "";
  return d.getDate().toString().padStart(2,"0") + "-" +
    (d.getMonth()+1).toString().padStart(2,"0") + "-" + d.getFullYear();
}

function fmtDateLong(d) {
  d = d || new Date();
  var days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function fmtTime(s) {
  if (!s) return "";
  var full = s.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (full) {
    var h = parseInt(full[4]), mn = parseInt(full[5]);
    return (h%12||12) + ":" + String(mn).padStart(2,"0") + (h>=12?" PM":" AM");
  }
  var m = s.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
  if (!m) return s;
  var h = +m[1], mn = +m[2];
  if (m[3] && m[3].toUpperCase()==="PM" && h<12) h+=12;
  if (m[3] && m[3].toUpperCase()==="AM" && h===12) h=0;
  return (h%12||12) + ":" + String(mn).padStart(2,"0") + (h>=12?" PM":" AM");
}

function todayKey() {
  var d = new Date();
  return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
}

// ── Haversine ──
function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2-lat1)*Math.PI/180;
  var dLon = (lon2-lon1)*Math.PI/180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
    Math.sin(dLon/2)*Math.sin(dLon/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ══════════════════════════════════════════
// SECTION B: INDEX.HTML FUNCTIONS
// ══════════════════════════════════════════

function showScreen(id) {
  if (document.getElementById("s-cam") &&
      document.getElementById("s-cam").classList.contains("active") && id !== "s-cam") {
    stopCam();
  }
  document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
  var el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function setLang(l) {
  store.set("lang", l);
  document.querySelectorAll(".lang-chip").forEach(function(c, i) {
    c.classList.toggle("active", (i===0 && l==="hi") || (i===1 && l==="en"));
  });
}

function goVerify() {
  showScreen("s-verify");
  loadEmployees();
}

function loadEmployees() {
  var wrap = document.getElementById("empList-wrap");
  var load = document.getElementById("empLoading");
  if (!wrap || !load) return;
  wrap.style.display = "none";
  load.style.display = "block";
  load.textContent = "⏳ Loading...";

  var cached = store.get("empCache");
  if (cached && cached.length) {
    allEmployees = cached;
    populateEmpSelect(cached);
    wrap.style.display = "block";
    load.style.display = "none";
  }

  apiPost({ action: "get_employees" }).then(function(r) {
    if (r.employees && r.employees.length) {
      allEmployees = r.employees;
      store.set("empCache", r.employees);
      populateEmpSelect(r.employees);
    }
    wrap.style.display = "block";
    load.style.display = "none";
  }).catch(function() {
    if (!cached || !cached.length) load.textContent = "⚠️ Network error. Dobara try karein.";
    else { wrap.style.display = "block"; load.style.display = "none"; }
  });
}

function populateEmpSelect(list) {
  var sel = document.getElementById("empSelect");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Naam chunein --</option>';
  list.forEach(function(e) {
    var o = document.createElement("option");
    o.value = e.name;
    o.textContent = e.name + (e.designation ? " (" + e.designation + ")" : "");
    sel.appendChild(o);
  });
}

function togglePin() {
  var i = document.getElementById("pinInput");
  if (i) i.type = i.type === "password" ? "text" : "password";
}

function doLogin() {
  var name = document.getElementById("empSelect").value.trim();
  var pin  = document.getElementById("pinInput").value.trim();
  if (!name) { toast("Pehle apna naam chunein", "error"); return; }
  if (!pin)  { toast("PIN daalo", "error"); return; }

  var btn = document.getElementById("loginBtn");
  btn.classList.add("loading"); btn.textContent = "Checking...";

  var emp = allEmployees.find(function(e) { return e.name === name; });
  if (!emp || String(emp.pin) !== String(pin)) {
    btn.classList.remove("loading"); btn.textContent = "Login →";
    toast("Galat naam ya PIN", "error"); return;
  }
  currentEmp = emp;
  store.set("emp", emp);
  btn.classList.remove("loading"); btn.textContent = "Login →";
  document.getElementById("pinInput").value = "";
  goToDash();
}

function goToDash() {
  showScreen("s-dash");
  document.getElementById("dashName").textContent = currentEmp.name;
  document.getElementById("dashDate").textContent = fmtDate(new Date());
  totalDist = parseFloat(store.get("dist_" + currentEmp.name + "_" + todayKey()) || 0);
  refreshDash();
  startClock();
  loadDist();
  scheduleAutoCheckout();
}

function doLogout() {
  stopCam(); stopVCam(); stopGps(); stopTimer();
  currentEmp = null;
  store.del("emp");
  showScreen("s-land");
}

function startClock() {
  if (clockInt) clearInterval(clockInt);
  function tick() {
    var n = new Date(), h = n.getHours(), m = n.getMinutes();
    var el = document.getElementById("clockDisp");
    if (el) el.textContent = (h%12||12) + ":" + String(m).padStart(2,"0") + (h>=12?" PM":" AM");
  }
  tick(); clockInt = setInterval(tick, 1000);
}

function refreshDash() {
  if (!currentEmp) return;
  var sv   = store.get("ci_" + currentEmp.name);
  var isIn = !!sv;

  document.getElementById("statusDot").className = "dot" + (isIn ? " g" : "");
  document.getElementById("statusTxt").textContent = isIn ? "✅ Checked in — " + fmtTime(sv.time) : "Not checked in";
  document.getElementById("timerCard").classList.toggle("show", isIn);
  document.getElementById("distCard").classList.toggle("show", isIn);
  document.getElementById("gpsBar").classList.toggle("show", isIn);

  if (isIn) {
    document.getElementById("ciTime").textContent = "Check-in: " + fmtTime(sv.time);
    startTimer(sv.ms);
    startCD(sv.ms);
    startGps();
    loadDist();
    document.getElementById("bCI").classList.add("dis");
    document.getElementById("bCO").classList.remove("dis");
    document.getElementById("bRe").classList.remove("dis");
    document.getElementById("bOrd").classList.remove("dis");
    document.getElementById("bPay").classList.remove("dis");
    document.getElementById("bRet").classList.remove("dis");
    document.getElementById("bPh").classList.remove("dis");
  } else {
    stopTimer(); stopGps();
    document.getElementById("bCI").classList.remove("dis");
    document.getElementById("bCO").classList.add("dis");
    document.getElementById("bRe").classList.add("dis");
    document.getElementById("bOrd").classList.add("dis");
    document.getElementById("bPay").classList.add("dis");
    document.getElementById("bRet").classList.add("dis");
    document.getElementById("bPh").classList.add("dis");
  }
}

function doCheckin() {
  if (!currentEmp) { toast("Pehle login karo", "error"); return; }
  if (store.get("ci_" + currentEmp.name)) { toast("Aap pehle se check-in hain", "info"); return; }
  location.href = "checkin.html";
}

function doCheckout() {
  if (!currentEmp) return;
  var sv = store.get("ci_" + currentEmp.name);
  if (!sv) { toast("Pehle check-in karo", "error"); return; }
  
  // Show checkout modal
  document.getElementById("checkoutModal").classList.add("show");
  document.getElementById("checkoutOdometerInput").value = "";
  document.getElementById("checkoutPhotoPreview").style.display = "none";
  document.getElementById("checkoutVideo").style.display = "block";
  document.getElementById("checkoutBtnCap").style.display = "block";
  document.getElementById("checkoutBtnNext").style.display = "none";
  document.getElementById("checkoutBtnRe").style.display = "none";
  checkoutPhotoData = null;
  
  // Start camera
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(function(stream) {
    checkoutCamStream = stream;
    document.getElementById("checkoutVideo").srcObject = stream;
  }).catch(function(err) {
    toast("Camera error: " + err.message, "error");
    closeCheckoutModal();
  });
}

function captureCheckoutPhoto() {
  var v = document.getElementById("checkoutVideo");
  var c = document.getElementById("checkoutCanvas");
  var p = document.getElementById("checkoutPhotoPreview");
  c.width = v.videoWidth||640; c.height = v.videoHeight||480;
  c.getContext("2d").drawImage(v,0,0);
  var data = c.toDataURL("image/jpeg",0.7);
  p.src = data; p.style.display = "block"; v.style.display = "none";
  document.getElementById("checkoutBtnCap").style.display = "none";
  document.getElementById("checkoutBtnNext").style.display = "block";
  document.getElementById("checkoutBtnRe").style.display = "block";
  checkoutPhotoData = data;
}

function retakeCheckoutPhoto() {
  document.getElementById("checkoutVideo").style.display = "block";
  document.getElementById("checkoutPhotoPreview").style.display = "none";
  document.getElementById("checkoutBtnCap").style.display = "block";
  document.getElementById("checkoutBtnNext").style.display = "none";
  document.getElementById("checkoutBtnRe").style.display = "none";
  checkoutPhotoData = null;
}

function submitCheckout() {
  var odoInput = document.getElementById("checkoutOdometerInput").value.trim();
  
  if (!checkoutPhotoData) { toast("Photo lo pehle", "error"); return; }
  if (!odoInput || isNaN(odoInput)) { toast("Valid odometer daalo", "error"); return; }
  
  var odometerEnd = parseInt(odoInput);
  var sv = store.get("ci_" + currentEmp.name);
  var diff = Date.now() - sv.ms;
  var h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
  
  var btn = document.getElementById("checkoutSubmitBtn");
  btn.classList.add("loading"); btn.textContent = "Submitting...";
  
  apiPost({
    action: "checkout",
    name: currentEmp.name,
    timestamp: new Date().toLocaleTimeString("en-IN"),
    duration: h + "h " + m + "m",
    odometerEnd: odometerEnd,
    photo: checkoutPhotoData,
    areaCovered: m + " min field time"
  }).then(function() {
    store.del("ci_" + currentEmp.name);
    closeCheckoutModal();
    toast("Check-out ho gaya! ✓", "success");
    stopGps(); stopTimer(); refreshDash();
    btn.classList.remove("loading"); btn.textContent = "✓ Check-Out";
  }).catch(function(err) { 
    toast("Error: " + err.message, "error");
    btn.classList.remove("loading"); btn.textContent = "✓ Check-Out";
  });
}

function closeCheckoutModal() {
  if (checkoutCamStream) { 
    checkoutCamStream.getTracks().forEach(function(t) { t.stop(); }); 
    checkoutCamStream = null; 
  }
  document.getElementById("checkoutModal").classList.remove("show");
  checkoutPhotoData = null;
}

// Expose to window
window.doCheckout = doCheckout;
window.captureCheckoutPhoto = captureCheckoutPhoto;
window.retakeCheckoutPhoto = retakeCheckoutPhoto;
window.submitCheckout = submitCheckout;
window.closeCheckoutModal = closeCheckoutModal;
function doNewVisit() {
  if (!currentEmp) return;
  visitPhotoData = null;
  ["mShopName","mShopkeeperName","mShopkeeperContact","mArea","mNotes"].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = "";
  });
  document.getElementById("visitPhotoWrap").style.display = "none";
  document.getElementById("visitPhotoBtn").style.display = "flex";
  document.getElementById("visitModal").classList.add("show");
  getGps();
}

function cancelVisit() {
  document.getElementById("visitModal").classList.remove("show");
  visitPhotoData = null;
  stopVCam();
}

function saveVisit() {
  if (!currentEmp) { 
    toast("Login expire hua, wapas login karo", "error"); 
    return; 
  }
  
  var shopName          = document.getElementById("mShopName").value.trim();
  var shopkeeperName    = document.getElementById("mShopkeeperName").value.trim();
  var shopkeeperContact = document.getElementById("mShopkeeperContact").value.trim();
  var area              = document.getElementById("mArea").value.trim();
  var notes             = document.getElementById("mNotes").value.trim();

  if (!visitPhotoData) { toast("Photo lena zaroori hai", "error"); return; }
  if (!shopName)        { toast("Shop ka naam daalo", "error"); return; }
  if (!area)            { toast("Area ka naam daalo", "error"); return; }

  var btn = document.getElementById("visitSaveBtn");
  btn.classList.add("loading"); 
  btn.textContent = "Saving...";
  
  var mapLink = gpsPos ? "https://maps.google.com/?q=" + gpsPos.lat + "," + gpsPos.lng : "";

  console.log("📸 Photo:", visitPhotoData ? "✓" : "✗");
  console.log("👤 Employee:", currentEmp.name);

  apiPost({
    action: "checkin",
    name: currentEmp.name,
    contact: currentEmp.contact || "",
    shopName: shopName,
    shopkeeperName: shopkeeperName,
    shopkeeperContact: shopkeeperContact,
    area: area,
    notes: notes,
    mapLink: mapLink,
    photo: visitPhotoData || "",
    timestamp: new Date().toLocaleTimeString("en-IN")
  }).then(function(r) {
    console.log("✅ API Response:", r); 
    
    btn.classList.remove("loading"); 
    btn.textContent = "✓ Save Visit";
    document.getElementById("visitModal").classList.remove("show");
    visitPhotoData = null;
    toast("Visit save ho gaya! ✓", "success");
    
    // Dashboard par jao
    setTimeout(function() {
      showScreen("s-dash");
    }, 1000);
    
  }).catch(function(err) {
    console.error("❌ API Error:", err);
    btn.classList.remove("loading"); 
    btn.textContent = "✓ Save Visit";
    toast("Error: " + err.message, "error");
  });
}

function openVisitCamera() {
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
  }).then(function(stream) {
    vCamStream = stream;
    document.getElementById("vVideo").srcObject = stream;
    getGpsForVisit();
  }).catch(function(err) {
    toast("Camera error: " + err.message, "error");
    closeVisitCamera();
  });
}

function closeVisitCamera() {
  stopVCam();
  document.getElementById("visitCamModal").classList.remove("show");
}

function stopVCam() {
  if (vCamStream) { vCamStream.getTracks().forEach(function(t) { t.stop(); }); vCamStream = null; }
  var v = document.getElementById("vVideo"); if (v) v.srcObject = null;
}

function vCapture() {
  var v = document.getElementById("vVideo"), c = document.getElementById("vCanvas"), p = document.getElementById("vPreview");
  c.width = v.videoWidth||640; c.height = v.videoHeight||480;
  c.getContext("2d").drawImage(v,0,0);
  var data = c.toDataURL("image/jpeg",0.65);
  p.src = data; p.style.display = "block"; v.style.display = "none";
  document.getElementById("vBtnCap").style.display = "none";
  document.getElementById("vBtnRe").style.display = "block";
  document.getElementById("vBtnNext").style.display = "block";
}

function vRetake() {
  document.getElementById("vVideo").style.display = "block";
  document.getElementById("vPreview").style.display = "none";
  document.getElementById("vBtnCap").style.display = "block";
  document.getElementById("vBtnRe").style.display = "none";
  document.getElementById("vBtnNext").style.display = "none";
}

function vAccept() {
  visitPhotoData = document.getElementById("vPreview").src;
  document.getElementById("visitThumb").src = visitPhotoData;
  document.getElementById("visitPhotoWrap").style.display = "block";
  document.getElementById("visitPhotoBtn").style.display = "none";
  stopVCam();
  closeVisitCamera();
  toast("Photo ready ✓", "success");
}

function getGpsForVisit() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(function(pos) {
    gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    var b = document.getElementById("vGpsBadge");
    if (b) { b.textContent = "📍 " + gpsPos.lat.toFixed(5) + ", " + gpsPos.lng.toFixed(5); b.classList.add("show"); }
  }, function() {}, { enableHighAccuracy: true, timeout: 8000 });
}

function doQuickPhoto() {
  if (!currentEmp) return;
  if (!store.get("ci_" + currentEmp.name)) { toast("Pehle check-in karo", "error"); return; }
  document.getElementById("camTitle").textContent = "📸 Quick Photo";
  document.getElementById("video").style.display = "block";
  document.getElementById("photoPreview").style.display = "none";
  document.getElementById("btnCap").style.display = "block";
  document.getElementById("btnNext").style.display = "none";
  document.getElementById("btnRe").style.display = "none";
  document.getElementById("gpsBadge").classList.remove("show");
  showScreen("s-cam");
  stopCam();
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(function(stream) {
    camStream = stream;
    document.getElementById("video").srcObject = stream;
    getGps();
  }).catch(function(err) { toast("Camera error: " + err.message, "error"); showScreen("s-dash"); });
}

function stopCam() {
  if (camStream) { camStream.getTracks().forEach(function(t) { t.stop(); }); camStream = null; }
  var v = document.getElementById("video"); if (v) v.srcObject = null;
}

function closeCam() { stopCam(); showScreen("s-dash"); }

function capturePhoto() {
  var v = document.getElementById("video"), c = document.getElementById("canvas"), p = document.getElementById("photoPreview");
  c.width = v.videoWidth||640; c.height = v.videoHeight||480;
  c.getContext("2d").drawImage(v,0,0);
  var data = c.toDataURL("image/jpeg",0.65);
  p.src = data; p.style.display = "block"; v.style.display = "none";
  document.getElementById("btnCap").style.display = "none";
  document.getElementById("btnNext").style.display = "block";
  document.getElementById("btnRe").style.display = "block";
}

function retakePhoto() {
  document.getElementById("video").style.display = "block";
  document.getElementById("photoPreview").style.display = "none";
  document.getElementById("btnCap").style.display = "block";
  document.getElementById("btnNext").style.display = "none";
  document.getElementById("btnRe").style.display = "none";
}

function acceptPhoto() {
  var data = document.getElementById("photoPreview").src;
  stopCam(); showScreen("s-dash");
  sendQuickPhoto(data);
}

function sendQuickPhoto(data) {
  if (!currentEmp) return;
  toast("Photo bheja ja raha hai...", "info");
  apiPost({
    action: "quick_photo",
    name: currentEmp.name,
    contact: currentEmp.contact || "",
    photo: data,
    lat: gpsPos ? gpsPos.lat : "",
    lng: gpsPos ? gpsPos.lng : ""
  }).then(function() { toast("Photo save ho gaya ✓", "success"); })
    .catch(function() { toast("Photo bhejne mein error", "error"); });
}

function getGps() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(function(pos) {
    gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    var b = document.getElementById("gpsBadge");
    if (b) { b.textContent = "📍 " + gpsPos.lat.toFixed(5) + ", " + gpsPos.lng.toFixed(5); b.classList.add("show"); }
    updateDistance(gpsPos);
  }, function() {}, { enableHighAccuracy: true, timeout: 10000 });
}

function startGps() {
  stopGps();
  gpsInterval = setInterval(function() {
    if (!currentEmp || !store.get("ci_" + currentEmp.name)) return;
    navigator.geolocation.getCurrentPosition(function(pos) {
      gpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateDistance(gpsPos);
      apiPost({
        action: "gps_ping",
        name: currentEmp.name,
        lat: gpsPos.lat, lng: gpsPos.lng,
        accuracy: pos.coords.accuracy,
        status: "tracking"
      }).catch(function() {});
    }, function() {}, { enableHighAccuracy: true, timeout: 10000 });
  }, GPS_INTERVAL);
}

function stopGps() { if (gpsInterval) { clearInterval(gpsInterval); gpsInterval = null; } }

function updateDistance(pos) {
  if (lastGpsPos && currentEmp) {
    var d = haversine(lastGpsPos.lat, lastGpsPos.lng, pos.lat, pos.lng);
    if (d > 20) {
      totalDist += d;
      store.set("dist_" + currentEmp.name + "_" + todayKey(), totalDist);
    }
  }
  lastGpsPos = pos;
  loadDist();
}

function loadDist() {
  if (!currentEmp) return;
  var rangeEl = document.getElementById("distRange");
  var dateRow = document.getElementById("distDateRow");
  var valEl   = document.getElementById("distVal");
  if (!rangeEl || !valEl) return;
  var range = rangeEl.value;
  if (dateRow) dateRow.style.display = range === "date" ? "block" : "none";
  var m = 0;
  if (range === "today") {
    m = parseFloat(store.get("dist_" + currentEmp.name + "_" + todayKey()) || 0);
  } else if (range === "total") {
    for (var k in localStorage) {
      if (k.startsWith("dist_" + currentEmp.name + "_")) m += parseFloat(localStorage[k] || 0);
    }
  } else if (range === "date") {
    var dv = document.getElementById("distDate").value;
    if (!dv) { valEl.textContent = "--"; return; }
    var pts = dv.split("-"), key = pts[0] + "-" + parseInt(pts[1]) + "-" + parseInt(pts[2]);
    m = parseFloat(store.get("dist_" + currentEmp.name + "_" + key) || 0);
  }
  valEl.textContent = m < 1000 ? Math.round(m) + " m" : (m/1000).toFixed(2) + " km";
}

function startTimer(startMs) {
  stopTimer();
  function tick() {
    var diff = Date.now() - startMs;
    var h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
    var el = document.getElementById("tDisp");
    if (el) el.textContent = String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
  }
  tick(); timerInt = setInterval(tick, 1000);
}

function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }

function startCD(startMs) {
  if (cdInt) clearInterval(cdInt);
  cdInt = setInterval(function() {
    var rem = MIN_CHECKOUT - (Date.now() - startMs);
    var b   = document.getElementById("cdBadge");
    var bco = document.getElementById("bCO");
    if (rem <= 0) {
      clearInterval(cdInt);
      if (bco) bco.classList.remove("dis");
      if (b) b.classList.remove("show");
    } else if (b) {
      b.textContent = Math.ceil(rem/1000) + "s";
      b.classList.add("show");
      if (bco) bco.classList.add("dis");
    }
  }, 500);
}

function scheduleAutoCheckout() {
  var now = new Date(), cut = new Date(now);
  cut.setHours(22,0,0,0);
  if (now >= cut) cut.setDate(cut.getDate()+1);
  setTimeout(function() {
    if (!currentEmp) return;
    var sv = store.get("ci_" + currentEmp.name); if (!sv) return;
    var diff = Date.now() - sv.ms;
    var h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
    apiPost({
      action: "checkout",
      name: currentEmp.name,
      timestamp: "10:00 PM (Auto)",
      duration: h + "h " + m + "m (auto)"
    }).then(function() {
      store.del("ci_" + currentEmp.name);
      stopGps();
      toast("Auto check-out ho gaya (10 PM)", "info");
      refreshDash();
    }).catch(function() {});
  }, cut.getTime() - now.getTime());
}

function installPWA() {
  if (!deferredPrompt) { toast("Safari: Share → Add to Home Screen", "info"); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function(r) {
    if (r.outcome === "accepted") localStorage.setItem("pwa_done","1");
    deferredPrompt = null;
    var b = document.getElementById("pwaBanner"); if (b) b.classList.remove("show");
  });
}

function dismissPWA() {
  var b = document.getElementById("pwaBanner"); if (b) b.classList.remove("show");
  localStorage.setItem("pwa_done","1");
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION C (UPDATED): CHECKIN.HTML FUNCTIONS - WITH 2-PHOTO & ODOMETER
// ══════════════════════════════════════════════════════════════════════════════

// Photo collection state
var ciPhotos = [];  // Array to store up to 2 photos
var ciOdometerStart = null;  // Store odometer reading

function setCiState(name) {
  document.querySelectorAll(".ci-state").forEach(function(el) { el.classList.remove("active"); });
  var el = document.getElementById("ci-state-" + name);
  if (el) el.classList.add("active");
}

function ciStartCamera() {
  ciStopCamera();
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: ciCamFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(function(stream) {
    ciCamStream = stream;
    document.getElementById("ciVideo").srcObject = stream;
    document.getElementById("ciVideo").style.display = "block";
    document.getElementById("ci-preview").style.display = "none";
    setCiState("capture");
    ciGetGps();
  }).catch(function(err) {
    toast("Camera access nahi mili: " + err.message, "error");
  });
}

function ciStopCamera() {
  if (ciCamStream) { ciCamStream.getTracks().forEach(function(t) { t.stop(); }); ciCamStream = null; }
  var v = document.getElementById("ciVideo"); if (v) v.srcObject = null;
}

function ciFlipCamera() {
  ciCamFacing = ciCamFacing === "user" ? "environment" : "user";
  ciStartCamera();
}

function ciCapturePhoto() {
  var v = document.getElementById("ciVideo");
  var c = document.getElementById("ciCanvas");
  var p = document.getElementById("ci-preview");
  c.width = v.videoWidth||640; c.height = v.videoHeight||480;
  var ctx = c.getContext("2d");
  if (ciCamFacing === "user") { ctx.translate(c.width,0); ctx.scale(-1,1); }
  ctx.drawImage(v,0,0);
  ciPhotoData = c.toDataURL("image/jpeg",0.7);
  p.src = ciPhotoData; p.style.display = "block"; v.style.display = "none";
  setCiState("preview");
  var fb = document.getElementById("ciFlipBtn");
  if (fb) { fb.style.opacity = "0.3"; fb.style.pointerEvents = "none"; }
}

function ciRetakePhoto() {
  ciPhotoData = null;
  document.getElementById("ci-preview").style.display = "none";
  document.getElementById("ciVideo").style.display = "block";
  setCiState("capture");
  var fb = document.getElementById("ciFlipBtn");
  if (fb) { fb.style.opacity = "1"; fb.style.pointerEvents = "auto"; }
  if (!ciCamStream) ciStartCamera();
}

// NEW: Accept photo and add to collection
function ciAcceptPhoto() {
  if (!ciPhotoData || ciPhotos.length >= 2) {
    toast("Photo save nahi ho paya", "error");
    return;
  }
  
  ciPhotos.push(ciPhotoData);
  
  // Display photo in grid
  if (ciPhotos.length === 1) {
    var img1 = document.getElementById("ciPhoto1Img");
    img1.src = ciPhotoData;
    img1.style.display = "block";
    document.getElementById("ciPhoto1Slot").querySelector(".ci-photo-placeholder").style.display = "none";
  } else if (ciPhotos.length === 2) {
    var img2 = document.getElementById("ciPhoto2Img");
    img2.src = ciPhotoData;
    img2.style.display = "block";
    document.getElementById("ciPhoto2Slot").querySelector(".ci-photo-placeholder").style.display = "none";
  }
  
  // Update counter
  var counter = document.getElementById("ciPhotoCount");
  if (counter) counter.textContent = ciPhotos.length;
  
  // If 2 photos taken, show odometer input
  if (ciPhotos.length === 2) {
    ciPhotoData = null;
    ciStopCamera();
    setTimeout(function() {
      setCiState("odometer");
      document.getElementById("ciEmpRole").textContent = "Odometer Reading";
      document.getElementById("ciOdometerInput").focus();
    }, 500);
  } else {
    // Take another photo
    ciPhotoData = null;
    setCiState("photo-collection");
  }
}

// NEW: Take another photo after first one accepted
function ciTakeAnotherPhoto() {
  ciPhotoData = null;
  ciStopCamera();
  
  // Checkout वाली logic copy करो
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(function(stream) {
    ciCamStream = stream;
    document.getElementById("ciVideo").srcObject = stream;
    document.getElementById("ciVideo").style.display = "block";
    document.getElementById("ci-preview").style.display = "none";
    setCiState("capture");
    ciGetGps();
  }).catch(function(err) {
    toast("Camera error: " + err.message, "error");
  });
  
  var fb = document.getElementById("ciFlipBtn");
  if (fb) { fb.style.opacity = "1"; fb.style.pointerEvents = "auto"; }
}

// NEW: Handle odometer submission
function ciSubmitOdometer() {
  var odoInput = document.getElementById("ciOdometerInput");
  var odoVal = odoInput.value.trim();
  
  if (!odoVal || isNaN(odoVal)) {
    toast("Valid odometer reading daalo", "error");
    return;
  }
  
  ciOdometerStart = parseInt(odoVal);
  odoInput.value = "";

  
  // Move to submit check-in
  ciSubmitCheckin();
}

function ciGetGps() {
  var b = document.getElementById("ciGpsBadge");
  if (b) { b.textContent = "📍 GPS fetch ho raha hai..."; b.classList.add("show"); }
  if (!navigator.geolocation) { if (b) b.textContent = "📍 GPS not available"; return; }
  navigator.geolocation.getCurrentPosition(function(pos) {
    ciGpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (b) b.textContent = "📍 " + ciGpsPos.lat.toFixed(5) + ", " + ciGpsPos.lng.toFixed(5) +
      " (±" + Math.round(pos.coords.accuracy) + "m)";
  }, function() {
    if (b) b.textContent = "📍 GPS unavailable";
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0});
}

function ciSubmitCheckin() {
  // Check if we have both photos
  if (ciPhotos.length < 2) {
    toast("Dono photos zaroori hain", "error");
    return;
  }
  
  if (!ciCurrentEmp) {
    toast("Session expired, wapas jao", "error");
    return;
  }

  // GPS nahi aaya to 3 sec wait karo
  if (!ciGpsPos) {
    toast("GPS fetch ho raha hai... ruko", "info");
    setTimeout(function() { ciSubmitCheckin(); }, 3000);
    return;
  }

  // Odometer nahi set kiya
  if (ciOdometerStart === null) {
    toast("Odometer reading daalo", "error");
    return;
  }

  var btn = document.getElementById("ciSubmitBtn");
  if (btn) { btn.classList.add("loading"); btn.textContent = "Bhej raha hai..."; }
  setCiState("loading");

  var now     = new Date();
  var timeStr = now.toLocaleTimeString("en-IN");
  var mapLink = ciGpsPos ? "https://maps.google.com/?q=" + ciGpsPos.lat + "," + ciGpsPos.lng : "";

  // Send both photos + odometer data
  apiPost({
    action: "checkin",
    name: ciCurrentEmp.name,
    contact: ciCurrentEmp.contact || "",
    shopName: "", shopkeeperName: "", shopkeeperContact: "",
    area: "", notes: "Check-in selfies",
    mapLink: mapLink,
    photo1: ciPhotos[0] || "",      // First photo
    photo2: ciPhotos[1] || "",      // Second photo
    odometerStart: ciOdometerStart,  // Odometer reading
    timestamp: timeStr
  }).then(function() {
    store.set("ci_" + ciCurrentEmp.name, { time: timeStr, ms: now.getTime() });
    store.set("odoStart_" + ciCurrentEmp.name + "_" + todayKey(), ciOdometerStart);
    store.set("checkinDone", "1");
    ciStopCamera();
    setCiState("done");
    var dm = document.getElementById("ciDoneMsg");
    if (dm) {
      dm.textContent = ciCurrentEmp.name + " | " + timeStr + 
        " | Odometer: " + ciOdometerStart + " km" + 
        (ciGpsPos ? " | GPS ✓" : "");
    }
  }).catch(function(err) {
    toast("Error: " + err.message, "error");
    setCiState("preview");
    if (btn) { btn.classList.remove("loading"); btn.textContent = "✓ Check-In Karo"; }
  });
}

// Reset photo collection on page reload
function resetCiPhotoCollection() {
  ciPhotos = [];
  ciOdometerStart = null;
  ciPhotoData = null;
  document.getElementById("ciPhoto1Img").style.display = "none";
  document.getElementById("ciPhoto1Img").src = "";
  document.getElementById("ciPhoto1Slot").querySelector(".ci-photo-placeholder").style.display = "block";
  document.getElementById("ciPhoto2Img").style.display = "none";
  document.getElementById("ciPhoto2Img").src = "";
  document.getElementById("ciPhoto2Slot").querySelector(".ci-photo-placeholder").style.display = "block";
  var counter = document.getElementById("ciPhotoCount");
  if (counter) counter.textContent = "0";
}

// ══════════════════════════════════════════
// INIT — Page ke hisaab se run hoga
// ══════════════════════════════════════════

if (IS_INDEX) {
  window.addEventListener("beforeinstallprompt", function(e) {
    e.preventDefault(); deferredPrompt = e;
    if (!localStorage.getItem("pwa_done"))
      setTimeout(function() {
        var b = document.getElementById("pwaBanner"); if (b) b.classList.add("show");
      }, 3000);
  });
  window.addEventListener("appinstalled", function() {
    var b = document.getElementById("pwaBanner"); if (b) b.classList.remove("show");
    localStorage.setItem("pwa_done","1");
  });

  document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
  store.del("checkinDone");
  var _empSaved = store.get("emp");
  if (_empSaved && _empSaved.name) {
    currentEmp = _empSaved;
    goToDash();
  } else {
    document.getElementById("s-land").classList.add("active");
  }
}

if (IS_CHECKIN) {
  var _empSaved = store.get("emp");
  if (!_empSaved || !_empSaved.name) {
    document.getElementById("ciPage").style.display = "none";
    document.getElementById("noLoginScreen").style.display = "flex";
  } else {
    ciCurrentEmp = _empSaved;
    if (store.get("ci_" + ciCurrentEmp.name)) {
      toast("Aap pehle se check-in hain!", "info");
      setTimeout(function() { location.href = "index.html"; }, 1500);
    } else {
      var nameEl = document.getElementById("ciEmpName");
      var roleEl = document.getElementById("ciEmpRole");
      var dateEl = document.getElementById("ciTopDate");
      if (nameEl) nameEl.textContent = ciCurrentEmp.name;
      if (roleEl) roleEl.textContent = ciCurrentEmp.designation || "Field Employee";
      if (dateEl) dateEl.textContent = fmtDateLong(new Date());
      
      // Reset photo collection on fresh load
      resetCiPhotoCollection();
      
      ciStartCamera();
    }
  }
}

// ══════════════════════════════════════════
// GLOBAL EXPOSE — HTML onclick ke liye
// (Sab functions globally available hain — koi if wrapper nahi)
// ══════════════════════════════════════════
window.showScreen       = showScreen;
window.setLang          = setLang;
window.goVerify         = goVerify;
window.doLogin          = doLogin;
window.togglePin        = togglePin;
window.doLogout         = doLogout;
window.doCheckin        = doCheckin;
window.doCheckout       = doCheckout;
window.doNewVisit       = doNewVisit;
window.cancelVisit      = cancelVisit;
window.saveVisit        = saveVisit;
window.openVisitCamera  = openVisitCamera;
window.closeVisitCamera = closeVisitCamera;
window.vCapture         = vCapture;
window.vRetake          = vRetake;
window.vAccept          = vAccept;
window.doQuickPhoto     = doQuickPhoto;
window.closeCam         = closeCam;
window.capturePhoto     = capturePhoto;
window.retakePhoto      = retakePhoto;
window.acceptPhoto      = acceptPhoto;
window.loadDist         = loadDist;
window.installPWA       = installPWA;
window.dismissPWA       = dismissPWA;
window.ciFlipCamera     = ciFlipCamera;
window.ciCapturePhoto   = ciCapturePhoto;
window.ciRetakePhoto    = ciRetakePhoto;
window.ciAcceptPhoto       = ciAcceptPhoto;
window.ciTakeAnotherPhoto  = ciTakeAnotherPhoto;
window.ciSubmitOdometer    = ciSubmitOdometer;
window.ciSubmitCheckin     = ciSubmitCheckin;
window.resetCiPhotoCollection = resetCiPhotoCollection;
