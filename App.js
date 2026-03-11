// ══════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════
const SCRIPT_URL   = "https://script.google.com/macros/s/AKfycbztfxOJsfCSyza8OL9xkpw5t7ncJUJzeFhfmaOgmmh3QnNCZ9Vl3tAwa87FIbMnTlA00A/exec";
const ORDER_URL    = "order.html";
const PAYMENT_URL  = "payment.html";
const RETURN_URL   = "return.html";
const ADMIN_URL    = "admin.html";
const MIN_CHECKOUT = 10 * 1000;       // 10 seconds minimum before checkout allowed
const GPS_INTERVAL = 5 * 60 * 1000;  // 5 minutes GPS ping interval

// ══════════════════════════════════════════
// STORAGE HELPER
// ══════════════════════════════════════════
const store = {
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} },
  get: (k)    => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch(e) { return null; } },
  del: (k)    => { try { localStorage.removeItem(k); } catch(e) {} }
};

// ══════════════════════════════════════════
// API CALL
// ══════════════════════════════════════════
async function apiPost(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast " + type + " show";
  setTimeout(() => el.classList.remove("show"), 4000);
}

// ══════════════════════════════════════════
// PHOTO COMPRESS
// ══════════════════════════════════════════
function compressPhoto(dataUrl) {
  try {
    const cv = document.createElement("canvas");
    const im = new Image();
    im.src = dataUrl;
    const mw = 720, sc = im.width > mw ? mw / im.width : 1;
    cv.width  = (im.width  || 640) * sc;
    cv.height = (im.height || 480) * sc;
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.5);
  } catch(e) { return dataUrl; }
}

// ══════════════════════════════════════════
// DATE FORMAT — dd-M-yyyy
// ══════════════════════════════════════════
function fmtDate(val) {
  if (!val) return "";
  let d;
  if (val instanceof Date) {
    d = val;
  } else {
    const s = val.toString();
    // yyyy-MM-dd
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) d = new Date(+m1[1], +m1[2]-1, +m1[3]);
    // dd-MM-yyyy
    const m2 = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (!d && m2) d = new Date(+m2[3], +m2[2]-1, +m2[1]);
    if (!d) d = new Date(s);
  }
  if (isNaN(d)) return val.toString();
  return d.getDate() + "-" + (d.getMonth()+1) + "-" + d.getFullYear();
}

// ══════════════════════════════════════════
// TIME FORMAT — HH:MM AM/PM
// ══════════════════════════════════════════
function fmtTime(val) {
  if (!val) return "";
  const s = val.toString();
  // Already readable like "10:30:00"
  const m = s.match(/(\d+):(\d+):?(\d+)?\s*(AM|PM)?/i);
  if (!m) return s;
  let h = +m[1], mn = +m[2];
  if (m[4]) {
    // already AM/PM
  } else {
    // 24h to 12h
  }
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return h12 + ":" + String(mn).padStart(2,"0") + " " + ampm;
}
