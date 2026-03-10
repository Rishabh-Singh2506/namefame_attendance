// ══════════════════════════════════════════
// CONFIG — GitHub se change karo
// ══════════════════════════════════════════
const SCRIPT_URL  = "https://script.google.com/macros/s/AKfycbw-iaQPU7vcA4WX1Z-U8T8mx2aIjBcAaaPmCvm0w8NYdG0GKRzPHU15DyHpyqggzHE/exec";
const ORDER_URL   = "order.html";
const PAYMENT_URL = "payment.html";
const ADMIN_URL   = "admin.html";
const MIN_CHECKOUT = 10 * 1000; // 10 seconds minimum
const GPS_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ══════════════════════════════════════════
// STORAGE HELPER
// ══════════════════════════════════════════
const store = {
  set: (k,v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  get: (k)   => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return null; } },
  del: (k)   => { try{ localStorage.removeItem(k); }catch(e){} }
};

// ══════════════════════════════════════════
// API CALL — Apps Script ko bhejo
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
function toast(msg, type="info") {
  const el = document.getElementById("toast");
  if(!el) return;
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
    const mw = 720, sc = im.width > mw ? mw/im.width : 1;
    cv.width  = (im.width  || 640) * sc;
    cv.height = (im.height || 480) * sc;
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.5);
  } catch(e) { return dataUrl; }
}
