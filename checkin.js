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

let ciCurrentEmp = null;
let ciPhotos = [];
let ciOdometerStart = null;
let ciPhotoData = null;
let ciCamStream = null;
let ciCamFacing = "user";
let ciGpsPos = null;

/* ════════════════════════════════════════════════════════════════
   TOAST
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
   STATE MANAGEMENT
   ════════════════════════════════════════════════════════════════ */

function setCiState(name) {
  document.querySelectorAll(".ci-state").forEach(el => {
    el.classList.remove("active");
  });

  const el = document.getElementById("ci-state-" + name);
  if (el) {
    el.classList.add("active");
  }
}

/* ════════════════════════════════════════════════════════════════
   CAMERA FUNCTIONS
   ════════════════════════════════════════════════════════════════ */

function ciStartCamera() {
  ciStopCamera();

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: ciCamFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(stream => {
    ciCamStream = stream;
    document.getElementById("ciVideo").srcObject = stream;
    document.getElementById("ciVideo").style.display = "block";
    document.getElementById("ci-preview").style.display = "none";
    setCiState("capture");
    ciGetGps();
  }).catch(err => {
    toast("Camera access error: " + err.message, "error");
  });
}

function ciStopCamera() {
  if (ciCamStream) {
    ciCamStream.getTracks().forEach(t => t.stop());
    ciCamStream = null;
  }

  const v = document.getElementById("ciVideo");
  if (v) v.srcObject = null;
}

window.ciFlipCamera = function () {
  ciCamFacing = ciCamFacing === "user" ? "environment" : "user";
  ciStartCamera();
};

window.ciCapturePhoto = function () {
  const v = document.getElementById("ciVideo");
  const c = document.getElementById("ciCanvas");
  const p = document.getElementById("ci-preview");

  c.width = v.videoWidth || 640;
  c.height = v.videoHeight || 480;

  const ctx = c.getContext("2d");

  if (ciCamFacing === "user") {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(v, 0, 0);

  ciPhotoData = c.toDataURL("image/jpeg", 0.7);

  p.src = ciPhotoData;
  p.style.display = "block";
  v.style.display = "none";

  setCiState("preview");

  const fb = document.getElementById("ciFlipBtn");
  if (fb) {
    fb.style.opacity = "0.3";
    fb.style.pointerEvents = "none";
  }
};

window.ciRetakePhoto = function () {
  ciPhotoData = null;

  document.getElementById("ci-preview").style.display = "none";
  document.getElementById("ciVideo").style.display = "block";

  setCiState("capture");

  const fb = document.getElementById("ciFlipBtn");
  if (fb) {
    fb.style.opacity = "1";
    fb.style.pointerEvents = "auto";
  }

  if (!ciCamStream) {
    ciStartCamera();
  }
};

window.ciAcceptPhoto = function () {
  if (!ciPhotoData || ciPhotos.length >= 2) {
    toast("Photo save nahi ho paya", "error");
    return;
  }

  ciPhotos.push(ciPhotoData);

  // Display photo in grid
  if (ciPhotos.length === 1) {
    const img1 = document.getElementById("ciPhoto1Img");
    img1.src = ciPhotoData;
    img1.style.display = "block";
    document.getElementById("ciPhoto1Slot").querySelector(".ci-photo-placeholder").style.display = "none";
  } else if (ciPhotos.length === 2) {
    const img2 = document.getElementById("ciPhoto2Img");
    img2.src = ciPhotoData;
    img2.style.display = "block";
    document.getElementById("ciPhoto2Slot").querySelector(".ci-photo-placeholder").style.display = "none";
  }

  // Update counter
  const counter = document.getElementById("ciPhotoCount");
  if (counter) {
    counter.textContent = ciPhotos.length;
  }

  if (ciPhotos.length === 2) {
    ciPhotoData = null;
    ciStopCamera();

    setTimeout(() => {
      setCiState("odometer");
      document.getElementById("ciOdometerInput").focus();
    }, 500);
  } else {
    ciPhotoData = null;
    setCiState("photo-collection");
  }
};

window.ciTakeAnotherPhoto = function () {
  ciPhotoData = null;
  ciStopCamera();

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(stream => {
    ciCamStream = stream;
    document.getElementById("ciVideo").srcObject = stream;
    document.getElementById("ciVideo").style.display = "block";
    document.getElementById("ci-preview").style.display = "none";
    setCiState("capture");
    ciGetGps();
  }).catch(err => {
    toast("Camera error: " + err.message, "error");
  });

  const fb = document.getElementById("ciFlipBtn");
  if (fb) {
    fb.style.opacity = "1";
    fb.style.pointerEvents = "auto";
  }
};

/* ════════════════════════════════════════════════════════════════
   GPS
   ════════════════════════════════════════════════════════════════ */

function ciGetGps() {
  const b = document.getElementById("ciGpsBadge");

  if (b) {
    b.textContent = "📍 GPS fetch ho raha hai...";
    b.classList.add("show");
  }

  if (!navigator.geolocation) {
    if (b) b.textContent = "📍 GPS not available";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      ciGpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      if (b) {
        b.textContent = "📍 " + ciGpsPos.lat.toFixed(5) + ", " + ciGpsPos.lng.toFixed(5) +
          " (±" + Math.round(pos.coords.accuracy) + "m)";
      }
    },
    () => {
      if (b) b.textContent = "📍 GPS unavailable";
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}

/* ════════════════════════════════════════════════════════════════
   ODOMETER
   ════════════════════════════════════════════════════════════════ */

window.ciSubmitOdometer = function () {
  const odoInput = document.getElementById("ciOdometerInput");
  const odoVal = odoInput.value.trim();

  if (!odoVal || isNaN(odoVal)) {
    toast("Valid odometer reading daalo", "error");
    return;
  }

  ciOdometerStart = parseInt(odoVal);
  odoInput.value = "";

  ciSubmitCheckin();
};

/* ════════════════════════════════════════════════════════════════
   SUBMIT CHECK-IN
   ════════════════════════════════════════════════════════════════ */

async function ciSubmitCheckin() {
  // Validate photos
  if (ciPhotos.length < 2) {
    toast("Dono photos zaroori hain", "error");
    return;
  }

  if (!ciCurrentEmp) {
    toast("Session expired, wapas jao", "error");
    return;
  }

  // Wait for GPS
  if (!ciGpsPos) {
    toast("GPS fetch ho raha hai... ruko", "info");
    setTimeout(() => {
      ciSubmitCheckin();
    }, 3000);
    return;
  }

  // Validate odometer
  if (ciOdometerStart === null) {
    toast("Odometer reading daalo", "error");
    return;
  }

  setCiState("loading");

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN");
  const mapLink = ciGpsPos ? "https://maps.google.com/?q=" + ciGpsPos.lat + "," + ciGpsPos.lng : "";

  try {
    // Upload photos
    const photo1Url = await uploadPhoto(ciPhotos[0], "CI_SELFIE_" + ciCurrentEmp.name);
    const photo2Url = await uploadPhoto(ciPhotos[1], "CI_ODOMETER_" + ciCurrentEmp.name);

    // Insert attendance record
    const { data, error } = await supabase
      .from("attendance")
      .insert([
        {
          attendance_date: now.toISOString().split("T")[0],
          employee_name: ciCurrentEmp.name,
          employee_contact: ciCurrentEmp.contact || "",
          attendance_open_time: timeStr,
          odometer_start: ciOdometerStart,
          open_selfie_photo: photo1Url,
          open_odometer_photo: photo2Url,
          map_link: mapLink
        }
      ])
      .select();

    if (error) {
      toast("Check-in error: " + error.message, "error");
      setCiState("preview");
      return;
    }

    // Store in localStorage
    localStorage.setItem("checkin", JSON.stringify({
      time: timeStr,
      ms: now.getTime(),
      odoStart: ciOdometerStart,
      attendanceId: data[0].id
    }));

    localStorage.setItem("currentAttendanceId", data[0].id);

    ciStopCamera();

    setCiState("done");

    const dm = document.getElementById("ciDoneMsg");
    if (dm) {
      dm.textContent = ciCurrentEmp.name + " | " + timeStr +
        " | Odometer: " + ciOdometerStart + " km" +
        (ciGpsPos ? " | GPS ✓" : "");
    }

    toast("Check-in successful ✓", "success");

  } catch (err) {
    console.error("Error:", err);
    toast("Error: " + err.message, "error");
    setCiState("preview");
  }
}

/* ════════════════════════════════════════════════════════════════
   PHOTO UPLOAD
   ════════════════════════════════════════════════════════════════ */

async function uploadPhoto(base64String, fileName) {
  try {
    const base64Data = base64String.split(",")[1] || base64String;
    const blob = await fetch("data:image/jpeg;base64," + base64Data).then(r => r.blob());

    // ✅ FIXED PATH
    const path = "public/" + fileName + "_" + Date.now() + ".jpg";

    const { error } = await supabase.storage.from("photos").upload(path, blob);

    if (error) {
      console.error("Photo upload error:", error);
      return null; // ❗ better than ""
    }

    const { data } = supabase.storage.from("photos").getPublicUrl(path);

    return data.publicUrl;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
}

/* ════════════════════════════════════════════════════════════════
   RESET PHOTO COLLECTION
   ════════════════════════════════════════════════════════════════ */

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

  const counter = document.getElementById("ciPhotoCount");
  if (counter) counter.textContent = "0";
}

/* ════════════════════════════════════════════════════════════════
   INITIALIZATION
   ════════════════════════════════════════════════════════════════ */

window.addEventListener("load", () => {
  const empSaved = localStorage.getItem("emp");

  if (!empSaved || !JSON.parse(empSaved).name) {
    document.getElementById("ciPage").style.display = "none";
    document.getElementById("noLoginScreen").style.display = "flex";
    return;
  }

  ciCurrentEmp = JSON.parse(empSaved);

  // Check if already checked in
  if (localStorage.getItem("checkin")) {
    toast("Aap pehle se check-in hain!", "info");
    setTimeout(() => {
      location.href = "index.html";
    }, 1500);
    return;
  }

  // Display employee info
  const nameEl = document.getElementById("ciEmpName");
  const roleEl = document.getElementById("ciEmpRole");
  const dateEl = document.getElementById("ciTopDate");

  if (nameEl) nameEl.textContent = ciCurrentEmp.name;
  if (roleEl) roleEl.textContent = ciCurrentEmp.designation || "Field Employee";
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("hi-IN");

  resetCiPhotoCollection();
  ciStartCamera();
});
