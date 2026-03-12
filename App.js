"use strict";
// ╔══════════════════════════════════════════════════════════════╗
// ║                    App.js — NAMEFAME                        ║
// ║   Ye file dono pages ka JS handle karti hai:                ║
// ║   1. index.html  — Landing, Login, Dashboard, Visit Modal   ║
// ║   2. checkin.html — Camera Check-In Page                    ║
// ║   Page detect karke apna init run hota hai automatically    ║
// ╚══════════════════════════════════════════════════════════════╝

// ══════════════════════════════════════════
// SECTION A: SHARED CONFIG & UTILITIES
// (Dono pages use karte hain ye sab)
// ══════════════════════════════════════════

var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztfxOJsfCSyza8OL9xkpw5t7ncJUJzeFhfmaOgmmh3QnNCZ9Vl3tAwa87FIbMnTlA00A/exec";
var GPS_INTERVAL = 5 * 60 * 1000; // 5 minutes
var MIN_CHECKOUT = 30 * 1000;      // 30 seconds

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

// ── Toast Notification ──
var toastTimer = null;
function toast(msg, type) {
  var el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast show" + (type ? " " + type : "");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove("show"); }, 3000);
}

// ── Date & Time Formatters ──
function fmtDate(v) {
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return "";
  return d.getDate().toString().padStart(2, "0") + "-" +
    (d.getMonth() + 1).toString().padStart(2, "0") + "-" + d.getFullYear();
}

function fmtDateLong(d) {
  d = d || new Date();
  var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function fmtTime(s) {
  if (!s) return "";
  var full = s.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (full) {
    var h = parseInt(full[4]), mn = parseInt(full[5]);
    var ap = h >= 12 ? "PM" : "AM", h12 = h % 12 || 12;
    return h12 + ":" + String(mn).padStart(2, "0") + " " + ap;
  }
  var m = s.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
  if (!m) return s;
  var h = +m[1], mn = +m[2];
  if (m[3] && m[3].toUpperCase() === "PM" && h < 12) h += 12;
  if (m[3] && m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return (h % 12 || 12) + ":" + String(mn).padStart(2, "0") + (h >= 12 ? " PM" : " AM");
}

function todayKey() {
  var d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

// ── Haversine Distance ──
function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ══════════════════════════════════════════
// PAGE DETECT — Kon si page hai?
// ══════════════════════════════════════════
var IS_INDEX   = !!document.getElementById("s-land");   // index.html
var IS_CHECKIN = !!document.getElementById("ciPage");   // checkin.html

// ══════════════════════════════════════════
// SECTION B: INDEX.HTML — Full Code
// (Landing, Login, Dashboard, Visit, Quick Photo)
// ══════════════════════════════════════════
if (IS_INDEX) {

  // ── State Variables ──
  var currentEmp   = null;
  var camStream    = null;
  var vCamStream   = null;
  var gpsInterval  = null;
  var gpsPos       = null;
  var timerInt     = null;
  var cdInt        = null;
  var clockInt     = null;
  var totalDist    = 0;
  var lastGpsPos   = null;
  var allEmployees = [];
  var visitPhotoData = null;

  // ── Language ──
  var lang = store.get("lang") || "hi";
  function setLang(l) {
    lang = l;
    store.set("lang", l);
    document.querySelectorAll(".lang-chip").forEach(function(c, i) {
      c.classList.toggle("active", (i === 0 && l === "hi") || (i === 1 && l === "en"));
    });
  }

  // ── Screen Navigation ──
  function showScreen(id) {
    // Camera band karo agar camera screen se ja rahe hain
    if (document.getElementById("s-cam") &&
        document.getElementById("s-cam").classList.contains("active") && id !== "s-cam") {
      stopCam();
    }
    document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
    var el = document.getElementById(id);
    if (el) el.classList.add("active");
  }

  // ────────────────────────────────────────
  // LANDING → VERIFY
  // ────────────────────────────────────────
  function goVerify() {
    showScreen("s-verify");
    loadEmployees();
  }

  function loadEmployees() {
    var wrap = document.getElementById("empList-wrap");
    var load = document.getElementById("empLoading");
    wrap.style.display = "none";
    load.style.display = "block";
    load.textContent = "⏳ Loading...";

    // Cache se pehle dikhao
    var cached = store.get("empCache");
    if (cached && cached.length) {
      allEmployees = cached;
      populateEmpSelect(cached);
      wrap.style.display = "block";
      load.style.display = "none";
    }

    // Server se fresh data lo
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
    i.type = i.type === "password" ? "text" : "password";
  }

  // ────────────────────────────────────────
  // LOGIN
  // ────────────────────────────────────────
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

  // ────────────────────────────────────────
  // DASHBOARD
  // ────────────────────────────────────────
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
      var ap = h >= 12 ? "PM" : "AM", h12 = h % 12 || 12;
      document.getElementById("clockDisp").textContent = h12 + ":" + String(m).padStart(2, "0") + " " + ap;
    }
    tick(); clockInt = setInterval(tick, 1000);
  }

  function refreshDash() {
    if (!currentEmp) return;
    var sv = store.get("ci_" + currentEmp.name);
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
      // Buttons enable karo
      document.getElementById("bCI").classList.add("dis");
      document.getElementById("bCO").classList.remove("dis");
      document.getElementById("bRe").classList.remove("dis");
      document.getElementById("bOrd").classList.remove("dis");
      document.getElementById("bPay").classList.remove("dis");
      document.getElementById("bRet").classList.remove("dis");
      document.getElementById("bPh").classList.remove("dis");
    } else {
      stopTimer(); stopGps();
      // Buttons disable karo
      document.getElementById("bCI").classList.remove("dis");
      document.getElementById("bCO").classList.add("dis");
      document.getElementById("bRe").classList.add("dis");
      document.getElementById("bOrd").classList.add("dis");
      document.getElementById("bPay").classList.add("dis");
      document.getElementById("bRet").classList.add("dis");
      document.getElementById("bPh").classList.add("dis");
    }
  }

  // ────────────────────────────────────────
  // CHECK-IN → checkin.html pe redirect
  // ────────────────────────────────────────
  function doCheckin() {
    if (!currentEmp) { toast("Pehle login karo", "error"); return; }
    if (store.get("ci_" + currentEmp.name)) { toast("Aap pehle se check-in hain", "info"); return; }
    location.href = "checkin.html";
  }

  // ────────────────────────────────────────
  // CHECK-OUT
  // ────────────────────────────────────────
  function doCheckout() {
    if (!currentEmp) return;
    var sv = store.get("ci_" + currentEmp.name);
    if (!sv) { toast("Pehle check-in karo", "error"); return; }
    var diff = Date.now() - sv.ms;
    var h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
    if (!confirm("Check-out karna chahte ho?\nField time: " + h + "h " + m + "m")) return;
    apiPost({
      action: "checkout",
      name: currentEmp.name,
      timestamp: new Date().toLocaleTimeString("en-IN"),
      duration: h + "h " + m + "m"
    }).then(function() {
      store.del("ci_" + currentEmp.name);
      toast("Check-out ho gaya! ✓", "success");
      stopGps(); stopTimer(); refreshDash();
    }).catch(function(err) { toast("Error: " + err.message, "error"); });
  }

  // ────────────────────────────────────────
  // NEW VISIT MODAL
  // Sheet columns: shopName, shopkeeperName, shopkeeperContact, area, notes, photo, mapLink
  // ────────────────────────────────────────
  function doNewVisit() {
    if (!currentEmp) return;
    visitPhotoData = null;
    ["mShopName","mShopkeeperName","mShopkeeperContact","mArea","mNotes"].forEach(function(id) {
      document.getElementById(id).value = "";
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
    // Fields collect karo (sheet column names se match)
    var shopName          = document.getElementById("mShopName").value.trim();          // Col: Shop Name
    var shopkeeperName    = document.getElementById("mShopkeeperName").value.trim();    // Col: Shopkeeper Name
    var shopkeeperContact = document.getElementById("mShopkeeperContact").value.trim(); // Col: Shopkeeper Contact
    var area              = document.getElementById("mArea").value.trim();              // Col: Area of Visit
    var notes             = document.getElementById("mNotes").value.trim();             // Col: Additional Notes

    if (!visitPhotoData) { toast("Photo lena zaroori hai", "error"); return; }
    if (!shopName)        { toast("Shop ka naam daalo", "error"); return; }
    if (!area)            { toast("Area ka naam daalo", "error"); return; }

    var btn = document.getElementById("visitSaveBtn");
    btn.classList.add("loading"); btn.textContent = "Saving...";

    var mapLink = gpsPos ? "https://maps.google.com/?q=" + gpsPos.lat + "," + gpsPos.lng : "";

    apiPost({
      action:            "checkin",           // Code.gs: handleCheckin()
      name:              currentEmp.name,     // Col: Employee Name
      contact:           currentEmp.contact || "",  // Col: Employee Contact
      shopName:          shopName,            // Col: Shop Name
      shopkeeperName:    shopkeeperName,      // Col: Shopkeeper Name
      shopkeeperContact: shopkeeperContact,   // Col: Shopkeeper Contact
      area:              area,                // Col: Area of Visit
      notes:             notes,               // Col: Additional Notes
      mapLink:           mapLink,             // Col: Map Link
      photo:             visitPhotoData || "", // Col: Photo (Check-In)
      timestamp:         new Date().toLocaleTimeString("en-IN")
    }).then(function() {
      btn.classList.remove("loading"); btn.textContent = "✓ Save Visit";
      document.getElementById("visitModal").classList.remove("show");
      visitPhotoData = null;
      toast("Visit save ho gaya! ✓", "success");
    }).catch(function(err) {
      btn.classList.remove("loading"); btn.textContent = "✓ Save Visit";
      toast("Error: " + err.message, "error");
    });
  }

  // ────────────────────────────────────────
  // VISIT CAMERA (modal ke andar)
  // ────────────────────────────────────────
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
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0);
    var data = c.toDataURL("image/jpeg", 0.65);
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

  // ────────────────────────────────────────
  // QUICK PHOTO (camera screen, s-cam)
  // ────────────────────────────────────────
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
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0);
    var data = c.toDataURL("image/jpeg", 0.65);
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
      action: "quick_photo",        // Code.gs: saveQuickPhoto()
      name: currentEmp.name,
      contact: currentEmp.contact || "",
      photo: data,
      lat: gpsPos ? gpsPos.lat : "",
      lng: gpsPos ? gpsPos.lng : ""
    }).then(function() { toast("Photo save ho gaya ✓", "success"); })
      .catch(function() { toast("Photo bhejne mein error", "error"); });
  }

  // ────────────────────────────────────────
  // GPS (index.html)
  // ────────────────────────────────────────
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
          action: "gps_ping",       // Code.gs: saveGpsPing()
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
    var range = document.getElementById("distRange").value;
    var dateRow = document.getElementById("distDateRow"), valEl = document.getElementById("distVal");
    dateRow.style.display = range === "date" ? "block" : "none";
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
    valEl.textContent = m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(2) + " km";
  }

  // ────────────────────────────────────────
  // TIMER
  // ────────────────────────────────────────
  function startTimer(startMs) {
    stopTimer();
    function tick() {
      var diff = Date.now() - startMs;
      var h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      document.getElementById("tDisp").textContent =
        String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }
    tick(); timerInt = setInterval(tick, 1000);
  }
  function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }

  function startCD(startMs) {
    if (cdInt) clearInterval(cdInt);
    cdInt = setInterval(function() {
      var rem = MIN_CHECKOUT - (Date.now() - startMs);
      var b = document.getElementById("cdBadge");
      if (rem <= 0) {
        clearInterval(cdInt);
        document.getElementById("bCO").classList.remove("dis");
        if (b) b.classList.remove("show");
      } else if (b) {
        b.textContent = Math.ceil(rem / 1000) + "s";
        b.classList.add("show");
        document.getElementById("bCO").classList.add("dis");
      }
    }, 500);
  }

  // ────────────────────────────────────────
  // AUTO CHECKOUT — 10 PM
  // ────────────────────────────────────────
  function scheduleAutoCheckout() {
    var now = new Date(), cut = new Date(now);
    cut.setHours(22, 0, 0, 0);
    if (now >= cut) cut.setDate(cut.getDate() + 1);
    setTimeout(function() {
      if (!currentEmp) return;
      var sv = store.get("ci_" + currentEmp.name); if (!sv) return;
      var diff = Date.now() - sv.ms;
      var h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
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

  // ────────────────────────────────────────
  // PWA
  // ────────────────────────────────────────
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function(e) {
    e.preventDefault(); deferredPrompt = e;
    if (!localStorage.getItem("pwa_done"))
      setTimeout(function() { document.getElementById("pwaBanner").classList.add("show"); }, 3000);
  });
  window.addEventListener("appinstalled", function() {
    document.getElementById("pwaBanner").classList.remove("show");
    localStorage.setItem("pwa_done", "1");
  });
  function installPWA() {
    if (!deferredPrompt) { toast("Safari: Share → Add to Home Screen", "info"); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(r) {
      if (r.outcome === "accepted") localStorage.setItem("pwa_done", "1");
      deferredPrompt = null;
      document.getElementById("pwaBanner").classList.remove("show");
    });
  }
  function dismissPWA() {
    document.getElementById("pwaBanner").classList.remove("show");
    localStorage.setItem("pwa_done", "1");
  }

  // ────────────────────────────────────────
  // INDEX.HTML INIT
  // ────────────────────────────────────────
  (function indexInit() {
    document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
    // Agar checkin.html se wapas aaye
    store.del("checkinDone");
    var saved = store.get("emp");
    if (saved && saved.name) {
      currentEmp = saved;
      goToDash();
    } else {
      document.getElementById("s-land").classList.add("active");
    }
  })();

} // END INDEX.HTML SECTION


// ══════════════════════════════════════════
// SECTION C: CHECKIN.HTML — Full Code
// (Dedicated camera page for check-in selfie)
// ══════════════════════════════════════════
if (IS_CHECKIN) {

  // ── State Variables ──
  var ciCurrentEmp = null;
  var ciCamStream  = null;
  var ciCamFacing  = "user"; // front camera for selfie
  var ciGpsPos     = null;
  var ciPhotoData  = null;

  // ── Set CI State (capture / preview / loading / done) ──
  function setCiState(name) {
    document.querySelectorAll(".ci-state").forEach(function(el) {
      el.classList.remove("active");
    });
    var el = document.getElementById("ci-state-" + name);
    if (el) el.classList.add("active");
  }

  // ── Camera ──
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

  // ── Capture Photo ──
  function ciCapturePhoto() {
    var v = document.getElementById("ciVideo");
    var c = document.getElementById("ciCanvas");
    var p = document.getElementById("ci-preview");
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    var ctx = c.getContext("2d");
    // Mirror for front camera selfie
    if (ciCamFacing === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    ciPhotoData = c.toDataURL("image/jpeg", 0.7);
    p.src = ciPhotoData;
    p.style.display = "block";
    v.style.display = "none";
    setCiState("preview");
    // Flip button disable (preview mein flip nahi)
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

  // ── GPS ──
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
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  // ── Submit Check-In → Sheet ──
  function ciSubmitCheckin() {
    if (!ciPhotoData) { toast("Photo lo pehle", "error"); return; }
    if (!ciCurrentEmp) { toast("Session expired, wapas jao", "error"); return; }

    var btn = document.getElementById("ciSubmitBtn");
    if (btn) { btn.classList.add("loading"); btn.textContent = "Bhej raha hai..."; }
    setCiState("loading");

    var now = new Date();
    var timeStr = now.toLocaleTimeString("en-IN");
    var mapLink = ciGpsPos ? "https://maps.google.com/?q=" + ciGpsPos.lat + "," + ciGpsPos.lng : "";

    apiPost({
      action:            "checkin",              // Code.gs: handleCheckin()
      name:              ciCurrentEmp.name,      // Col: Employee Name
      contact:           ciCurrentEmp.contact || "", // Col: Employee Contact
      shopName:          "",                     // Col: Shop Name (checkin pe blank)
      shopkeeperName:    "",                     // Col: Shopkeeper Name
      shopkeeperContact: "",                     // Col: Shopkeeper Contact
      area:              "",                     // Col: Area of Visit
      notes:             "Check-in selfie",      // Col: Additional Notes
      mapLink:           mapLink,                // Col: Map Link
      photo:             ciPhotoData,            // Col: Photo (Check-In)
      timestamp:         timeStr
    }).then(function() {
      // LocalStorage mein checkin state save karo
      store.set("ci_" + ciCurrentEmp.name, {
        time: timeStr,
        ms: now.getTime()
      });
      store.set("checkinDone", "1"); // index.html ko pata chalega
      ciStopCamera();
      setCiState("done");
      var dm = document.getElementById("ciDoneMsg");
      if (dm) dm.textContent = ciCurrentEmp.name + " | " + timeStr + (ciGpsPos ? " | GPS ✓" : "");
    }).catch(function(err) {
      toast("Error: " + err.message, "error");
      setCiState("preview");
      if (btn) { btn.classList.remove("loading"); btn.textContent = "✓ Check-In Karo"; }
    });
  }

  // ────────────────────────────────────────
  // CHECKIN.HTML INIT
  // ────────────────────────────────────────
  (function checkinInit() {
    // Login check karo
    var saved = store.get("emp");
    if (!saved || !saved.name) {
      document.getElementById("ciPage").style.display = "none";
      document.getElementById("noLoginScreen").style.display = "flex";
      return;
    }
    ciCurrentEmp = saved;

    // Already checked in? Dashboard pe bhejo
    if (store.get("ci_" + ciCurrentEmp.name)) {
      toast("Aap pehle se check-in hain!", "info");
      setTimeout(function() { location.href = "index.html"; }, 1500);
      return;
    }

    // UI set karo
    var nameEl = document.getElementById("ciEmpName");
    var roleEl = document.getElementById("ciEmpRole");
    var dateEl = document.getElementById("ciTopDate");
    if (nameEl) nameEl.textContent = ciCurrentEmp.name;
    if (roleEl) roleEl.textContent = ciCurrentEmp.designation || "Field Employee";
    if (dateEl) dateEl.textContent = fmtDateLong(new Date());

    // Camera start karo
    ciStartCamera();
  })();

} // END CHECKIN.HTML SECTION
