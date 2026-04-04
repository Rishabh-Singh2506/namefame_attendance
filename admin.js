// ══════════════════════════════════════════════════
//  NAMEFAME ADMIN PANEL — admin.js (FIXED)
//  Supabase direct REST API
// ══════════════════════════════════════════════════

// ── CONFIG ──
var SUPABASE_URL  = "https://qhikqbrfojdlmdwsdota.supabase.co";
var SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoaWtxYnJmb2pkbG1kd3Nkb3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjcxMDgsImV4cCI6MjA5MDMwMzEwOH0.lYiBLoXPdNO_kfilcbX-OfbvJcXsjM841HG2ffwQT3Y";

// ── STATE ──
var allEmps       = [];
var allRoutes     = [];
var allAttRows    = [];
var allVisits     = [];
var allCustomers  = [];
var activeAttEmp  = "all";

// Route dropdown data
var routeStates          = [];
var routeDistricts       = [];
var routeWorkingRoutes   = [];
var routeAreas           = [];
var routeShops           = [];
var routeShopkeepers     = [];
var routeShopkeeperContacts = [];

// DEFAULT BRANDING CONFIG
var brandingConfig = {
  appName: "NAMEFAME",
  appDesc: "Field Attendance & Visit Tracking",
  appIcon: "🏢",
  companyName: "NAMEFAME",
  supportEmail: "support@namefame.com",
  primaryColor: "#6c63ff",
  secondaryColor: "#8b83ff"
};

// ══════════════════════════════
// LOAD BRANDING ON INIT
// ══════════════════════════════
function loadBrandingConfig() {
  var saved = localStorage.getItem("nf_branding");
  if (saved) {
    try { brandingConfig = JSON.parse(saved); } catch(e) {}
  }
}

function saveBrandingConfig() {
  localStorage.setItem("nf_branding", JSON.stringify(brandingConfig));
}

// ══════════════════════════════
// AUTH
// ══════════════════════════════
function doLogin() {
  var p   = document.getElementById("adminPass").value.trim();
  var btn = document.getElementById("loginBtn");
  if (!p) { toast("Password daalo", "err"); return; }

  btn.textContent = "⏳ Checking..."; btn.disabled = true;

  sbGet("admin_config", "select=value&name=eq.admin_password&limit=1")
    .then(function(rows) {
      btn.textContent = "🔓 Login Karo"; btn.disabled = false;
      var correct = rows && rows[0] ? rows[0].value : "admin1234";
      if (p === correct) {
        sessionStorage.setItem("nf_admin", "1");
        sessionStorage.setItem("nf_pass", p);
        loadBrandingConfig();
        showApp();
      } else {
        toast("Galat password!", "err");
        document.getElementById("adminPass").value = "";
      }
    })
    .catch(function() {
      btn.textContent = "🔓 Login Karo"; btn.disabled = false;
      if (p === "admin1234") {
        sessionStorage.setItem("nf_admin","1");
        loadBrandingConfig();
        showApp();
      } else {
        toast("Network error ya galat password", "err");
      }
    });
}

function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "block";
  initApp();
}

function doLogout() {
  confirmDialog("🚪 Logout", "Kya aap logout karna chahte hain?", function() {
    sessionStorage.clear();
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("app").style.display = "none";
    document.getElementById("adminPass").value = "";
  });
}

function changePass() {
  var cur  = document.getElementById("curPass").value.trim();
  var nw   = document.getElementById("newPass").value.trim();
  var conf = document.getElementById("confPass").value.trim();
  var saved = sessionStorage.getItem("nf_pass") || "admin1234";
  if (cur !== saved)  { toast("Current password galat hai", "err"); return; }
  if (nw.length < 4)  { toast("Password kam se kam 4 characters ka hona chahiye", "err"); return; }
  if (nw !== conf)    { toast("Passwords match nahi kar rahe", "err"); return; }

  sbUpsert("admin_config", { name: "admin_password", value: nw })
    .then(function() {
      sessionStorage.setItem("nf_pass", nw);
      ["curPass","newPass","confPass"].forEach(function(id){ document.getElementById(id).value = ""; });
      toast("Password badal gaya ✓", "ok");
    }).catch(function() { toast("Error. Dobara try karo.", "err"); });
}

function resetEmpPin() {
  var uid = document.getElementById("pinResetEmp").value;
  var pin = document.getElementById("pinResetVal").value.trim();
  if (!uid) { toast("Employee select karo", "err"); return; }
  if (!pin || pin.length < 4) { toast("Valid PIN daalo (min 4 digits)", "err"); return; }

  sbPatch("employees", "user_id=eq." + uid, { pin: pin })
    .then(function() { toast("PIN reset ho gaya ✓", "ok"); document.getElementById("pinResetVal").value = ""; })
    .catch(function() { toast("PIN reset nahi hua", "err"); });
}

// ══════════════════════════════
// BRANDING SETTINGS
// ══════════════════════════════
function openBrandingSettings() {
  document.getElementById("brandAppName").value    = brandingConfig.appName || "";
  document.getElementById("brandAppDesc").value    = brandingConfig.appDesc || "";
  document.getElementById("brandAppIcon").value    = brandingConfig.appIcon || "";
  document.getElementById("brandCompany").value    = brandingConfig.companyName || "";
  document.getElementById("brandEmail").value      = brandingConfig.supportEmail || "";
  document.getElementById("brandPrimary").value    = brandingConfig.primaryColor || "#6c63ff";
  document.getElementById("brandSecondary").value  = brandingConfig.secondaryColor || "#8b83ff";
  openModal("brandingModal");
}

function saveBrandingSettings() {
  brandingConfig.appName       = document.getElementById("brandAppName").value.trim();
  brandingConfig.appDesc       = document.getElementById("brandAppDesc").value.trim();
  brandingConfig.appIcon       = document.getElementById("brandAppIcon").value.trim();
  brandingConfig.companyName   = document.getElementById("brandCompany").value.trim();
  brandingConfig.supportEmail  = document.getElementById("brandEmail").value.trim();
  brandingConfig.primaryColor  = document.getElementById("brandPrimary").value;
  brandingConfig.secondaryColor= document.getElementById("brandSecondary").value;
  if (!brandingConfig.appName) { toast("App name zaroori hai", "err"); return; }
  saveBrandingConfig();
  closeModal("brandingModal");
  toast("Branding settings save ho gaya ✓", "ok");
}

// ══════════════════════════════
// INIT
// ══════════════════════════════
function initApp() {
  loadBrandingConfig();
  var now = new Date();
  document.getElementById("dashDate").textContent = fmtDateLong(now);
  setToday("attFrom", "attTo");
  setToday("visFrom", "visTo");
  loadDashboard();
  loadAllCustomers();
}

// ══════════════════════════════
// NAV
// ══════════════════════════════
function goScreen(name) {
  document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
  document.querySelectorAll(".nav-item").forEach(function(n) { n.classList.remove("active"); });
  document.getElementById("s-" + name).classList.add("active");
  document.getElementById("n-" + name).classList.add("active");

  if (name === "emp")    { loadEmployees(); }
  if (name === "routes") { loadRoutes(); }
  if (name === "visits") { loadVisits(); }
  if (name === "sec")    { loadSecurityScreen(); }
  if (name === "att")    { loadAttendance(); }
}

// ══════════════════════════════
// DASHBOARD
// ══════════════════════════════
function refreshDash() { loadDashboard(); loadAllCustomers(); }

function loadDashboard() {
  var today = new Date().toISOString().split("T")[0];

  Promise.all([
    sbGet("employees",   "select=count"),
    sbGet("visits",      "select=count&visit_date=eq." + today),
    sbGet("attendance",  "select=count&attendance_date=eq." + today),
    sbGet("routes",      "select=count")
  ]).then(function(results) {
    var empCount   = results[0] ? results[0].length : 0;
    var visToday   = results[1] ? results[1].length : 0;
    var attToday   = results[2] ? results[2].length : 0;
    var routeCount = results[3] ? results[3].length : 0;

    document.getElementById("dashStats").innerHTML =
      statCard("👥", empCount,   "Employees",      "") +
      statCard("📋", attToday,   "Aaj Attendance", "green") +
      statCard("🏪", visToday,   "Aaj Visits",     "orange") +
      statCard("🗺️", routeCount, "Routes",         "yellow");
  }).catch(function() {
    document.getElementById("dashStats").innerHTML =
      statCard("👥","—","Employees","") +
      statCard("📋","—","Aaj Attendance","green") +
      statCard("🏪","—","Aaj Visits","orange") +
      statCard("🗺️","—","Routes","yellow");
  });

  // ─────────────────────────────────────────────────────────
  // TODAY'S ATTENDANCE — FIXED LOGIC
  // Fetch all today's records, then per employee:
  //   1. If they have an ACTIVE record (open but not closed) → show that
  //   2. Else show their LATEST record (most recent open time)
  // This eliminates duplicate cards.
  // ─────────────────────────────────────────────────────────
  sbGet("attendance",
    "select=*&attendance_date=eq." + today +
    "&order=attendance_open_time.desc"
  ).then(function(rows) {
    if (!rows || !rows.length) {
      document.getElementById("todayCards").innerHTML =
        '<div class="empty"><span class="empty-ico">📭</span><div class="empty-txt">Aaj koi attendance nahi</div></div>';
      return;
    }

    // Per-employee: prefer active (no checkout), else latest
    var empMap = {};
    rows.forEach(function(r) {
      var key = (r.employee_name || "unknown").toLowerCase();
      if (!empMap[key]) {
        empMap[key] = r;
      } else {
        var existing = empMap[key];
        var existingActive = existing.attendance_open_time && !existing.attendance_closed_time;
        var newActive = r.attendance_open_time && !r.attendance_closed_time;
        // If existing is already active, keep it
        // If new is active and existing is not, replace
        if (newActive && !existingActive) {
          empMap[key] = r;
        }
        // Both closed or both active → keep earlier (already set, rows sorted desc so first = latest)
      }
    });

    var unique = Object.values(empMap);
    // Sort: active first, then by open time desc
    unique.sort(function(a, b) {
      var aActive = a.attendance_open_time && !a.attendance_closed_time ? 1 : 0;
      var bActive = b.attendance_open_time && !b.attendance_closed_time ? 1 : 0;
      return bActive - aActive;
    });

    renderTodayCards(unique);
  }).catch(function() {
    document.getElementById("todayCards").innerHTML =
      '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Load nahi hua</div></div>';
  });
}

function statCard(icon, val, lbl, cls) {
  return '<div class="stat-card ' + cls + '">'
    + '<div class="stat-icon">' + icon + '</div>'
    + '<div class="stat-val">' + val + '</div>'
    + '<div class="stat-lbl">' + lbl + '</div>'
    + '</div>';
}

function renderTodayCards(rows) {
  if (!rows.length) {
    document.getElementById("todayCards").innerHTML =
      '<div class="empty"><span class="empty-ico">📭</span><div class="empty-txt">Aaj koi attendance nahi</div></div>';
    return;
  }
  var html = "";
  rows.forEach(function(r) {
    var init  = initials(r.employee_name || "?");
    var isIn  = r.attendance_open_time && !r.attendance_closed_time;
    var isOut = r.attendance_open_time && r.attendance_closed_time;

    html += '<div class="card">'
      + '<div class="card-head">'
      + '<div class="avatar">' + init + '</div>'
      + '<div style="flex:1">'
      + '<div class="card-name">' + esc(r.employee_name || "—") + '</div>'
      + '<div class="card-sub">' + esc(r.working_route || "—") + '</div>'
      + '</div>'
      + '<span class="badge ' + (isIn ? "in" : (isOut ? "out" : "absent")) + '">'
      + (isIn ? "🟢 Active" : (isOut ? "🔴 Closed" : "⚪ —")) + '</span>'
      + '</div>'
      + '<div class="info-grid">'
      + infoItem("🕐 Check-In",  r.attendance_open_time   || "—", r.attendance_open_time   ? "g" : "")
      + infoItem("🕔 Check-Out", r.attendance_closed_time || "—", r.attendance_closed_time ? ""  : "o")
      + infoItem("📏 Distance",  r.distance_km ? r.distance_km + " km" : "—", r.distance_km ? "g" : "")
      + infoItem("⏱ Hours",      r.working_hours || "—", "")
      + '</div>'
      + (r.map_link
        ? '<a href="' + r.map_link + '" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:12px;font-weight:700;color:var(--accent2);border-top:1px solid var(--border);text-decoration:none;">🗺️ Location Dekho →</a>'
        : "")
      + '</div>';
  });
  document.getElementById("todayCards").innerHTML = html;
}

// ══════════════════════════════
// CUSTOMERS (Dashboard)
// ══════════════════════════════
function loadAllCustomers() {
  sbGet("routes",
    "select=*&order=state.asc,district.asc,working_route.asc,area.asc"
  ).then(function(rows) {
    // Only rows that have shop AND shopkeeper
    allCustomers = (rows || []).filter(function(r) {
      return r.shop && r.shopkeeper_name;
    });
    renderCustomersPreview();
  }).catch(function() {
    allCustomers = [];
    document.getElementById("customersPreview").innerHTML =
      '<div class="empty" style="grid-column:1/-1;">⚠️ Load nahi hua</div>';
  });
}

// ─────────────────────────────────────────────────────────
// CUSTOMERS RENDER — Tabular list (scrollable table)
// ─────────────────────────────────────────────────────────

// Filtered subset used by search
var _filteredCustomers = [];

function renderCustomersPreview() {
  _filteredCustomers = allCustomers.slice();
  _renderCustomerTable(_filteredCustomers);
}

function filterCustomerTable() {
  var q = (document.getElementById("custSearch") && document.getElementById("custSearch").value || "").toLowerCase();
  if (!q) {
    _filteredCustomers = allCustomers.slice();
  } else {
    _filteredCustomers = allCustomers.filter(function(c) {
      return [c.shop, c.shopkeeper_name, c.shopkeeper_contact, c.area, c.district, c.state, c.working_route]
        .some(function(v) { return v && v.toLowerCase().includes(q); });
    });
  }
  _renderCustomerTable(_filteredCustomers);
}

function _renderCustomerTable(list) {
  var preview = document.getElementById("customersPreview");
  var badge   = document.getElementById("custCountBadge");
  var num     = document.getElementById("custCountNum");

  if (badge) { badge.style.display = list.length ? "inline-flex" : "none"; }
  if (num)   { num.textContent = list.length; }

  if (!list.length) {
    preview.innerHTML =
      '<div class="empty">'
      + '<span class="empty-ico">🏪</span>'
      + '<div class="empty-txt">Koi customer nahi mila</div>'
      + '</div>';
    return;
  }

  var html = '<div class="cust-table-wrap">'
    + '<table class="cust-table">'
    + '<thead><tr>'
    + '<th>#</th>'
    + '<th>Shop Name</th>'
    + '<th>Shopkeeper</th>'
    + '<th>Contact</th>'
    + '<th>Area</th>'
    + '<th>District</th>'
    + '<th>State</th>'
    + '<th>Route</th>'
    + '</tr></thead>'
    + '<tbody>';

  list.forEach(function(c, i) {
    html += '<tr>'
      + '<td style="color:var(--text3);font-size:11px;">' + (i + 1) + '</td>'
      + '<td class="td-shop">🏪 ' + esc(c.shop || "—") + '</td>'
      + '<td class="td-keeper">' + esc(c.shopkeeper_name || "—") + '</td>'
      + '<td class="td-contact">'
      + (c.shopkeeper_contact
          ? '<a href="tel:' + esc(c.shopkeeper_contact) + '">📞 ' + esc(c.shopkeeper_contact) + '</a>'
          : '<span style="color:var(--text3);">—</span>')
      + '</td>'
      + '<td class="td-area">' + esc(c.area || "—") + '</td>'
      + '<td>' + esc(c.district || "—") + '</td>'
      + '<td>' + esc(c.state || "—") + '</td>'
      + '<td style="font-size:11.5px;color:var(--text3);">' + esc(c.working_route || "—") + '</td>'
      + '</tr>';
  });

  html += '</tbody></table></div>';
  preview.innerHTML = html;
}

function exportCustomersCSV() {
  if (!allCustomers.length) { toast("Koi customer data nahi", "err"); return; }
  var hdr  = ["State","District","Route","Area","Shop","Shopkeeper","Contact"];
  var data = allCustomers.map(function(c) {
    return [c.state, c.district, c.working_route, c.area, c.shop, c.shopkeeper_name, c.shopkeeper_contact]
      .map(function(v) { return '"' + String(v || "").replace(/"/g,'""') + '"'; }).join(",");
  });
  downloadCSV([hdr.join(",")].concat(data).join("\n"),
    "Customers_" + new Date().toISOString().split("T")[0]);
}

function exportCustomersPDF() {
  if (!allCustomers.length) { toast("Koi customer data nahi", "err"); return; }
  var doc = "<h1>" + brandingConfig.appName + " - Customers Report</h1>"
    + "<p><strong>Generated:</strong> " + new Date().toLocaleDateString("en-IN") + "</p>"
    + "<table border='1' cellpadding='8' style='width:100%;border-collapse:collapse;'>"
    + "<tr style='background:#f0f0f0;'><th>State</th><th>District</th><th>Route</th><th>Area</th><th>Shop</th><th>Shopkeeper</th><th>Contact</th></tr>";
  allCustomers.forEach(function(c) {
    doc += "<tr>"
      + "<td>" + esc(c.state||"—") + "</td>"
      + "<td>" + esc(c.district||"—") + "</td>"
      + "<td>" + esc(c.working_route||"—") + "</td>"
      + "<td>" + esc(c.area||"—") + "</td>"
      + "<td>" + esc(c.shop||"—") + "</td>"
      + "<td>" + esc(c.shopkeeper_name||"—") + "</td>"
      + "<td>" + esc(c.shopkeeper_contact||"—") + "</td>"
      + "</tr>";
  });
  doc += "</table>";
  downloadPDF(doc, "Customers_" + new Date().toISOString().split("T")[0]);
}

// ══════════════════════════════
// ATTENDANCE
// ══════════════════════════════
function loadAttendance() {
  var from = document.getElementById("attFrom").value;
  var to   = document.getElementById("attTo").value;
  if (!from || !to) { toast("Date range select karo", "err"); return; }
  document.getElementById("attCards").innerHTML = '<div class="loading"><div class="spin"></div>Loading...</div>';
  document.getElementById("attSub").textContent = from + " → " + to;

  var query = "select=*&attendance_date=gte." + from
    + "&attendance_date=lte." + to
    + "&order=attendance_date.desc,attendance_open_time.desc";
  sbGet("attendance", query).then(function(rows) {
    allAttRows = rows || [];
    buildAttChips();
    activeAttEmp = "all";
    renderAttendance();
  }).catch(function() {
    document.getElementById("attCards").innerHTML =
      '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Data load nahi hua</div></div>';
  });
}

function buildAttChips() {
  var names = [];
  allAttRows.forEach(function(r) {
    var n = r.employee_name;
    if (n && names.indexOf(n) < 0) names.push(n);
  });
  var html = '<div class="chip active" onclick="filterAttEmp(\'all\',this)">👥 Sab</div>';
  names.forEach(function(n) {
    html += '<div class="chip" onclick="filterAttEmp(\'' + esc(n) + '\',this)">' + esc(n) + '</div>';
  });
  document.getElementById("attChips").innerHTML = html;
}

function filterAttEmp(name, el) {
  document.querySelectorAll("#attChips .chip").forEach(function(c) { c.classList.remove("active"); });
  el.classList.add("active");
  activeAttEmp = name;
  renderAttendance();
}

function renderAttendance() {
  var rows = activeAttEmp === "all"
    ? allAttRows
    : allAttRows.filter(function(r) { return r.employee_name === activeAttEmp; });

  var checkedIn = rows.filter(function(r) {
    return r.attendance_open_time && !r.attendance_closed_time;
  }).length;
  var totalDist = rows.reduce(function(a, r) { return a + (parseFloat(r.distance_km) || 0); }, 0);

  document.getElementById("aTot").textContent  = rows.length;
  document.getElementById("aIn").textContent   = checkedIn;
  document.getElementById("aVis").textContent  = rows.filter(function(r) { return r.working_route; }).length;
  document.getElementById("aDist").textContent = totalDist > 0 ? totalDist.toFixed(1) + " km" : "—";

  if (!rows.length) {
    document.getElementById("attCards").innerHTML =
      '<div class="empty"><span class="empty-ico">📭</span><div class="empty-txt">Is range mein koi data nahi</div></div>';
    return;
  }

  var html = "";
  rows.forEach(function(r) {
    var init  = initials(r.employee_name || "?");
    var isIn  = r.attendance_open_time && !r.attendance_closed_time;
    var isOut = r.attendance_open_time && r.attendance_closed_time;
    var bCls  = isIn ? "in" : (isOut ? "out" : "absent");
    var bTxt  = isIn ? "🟢 Active" : (isOut ? "🔴 Closed" : "⚪ —");

    html += '<div class="card">'
      + '<div class="card-head">'
      + '<div class="avatar">' + init + '</div>'
      + '<div style="flex:1"><div class="card-name">' + esc(r.employee_name || "—") + '</div>'
      + '<div class="card-sub">' + fmtDate(r.attendance_date) + ' · ' + esc(r.working_route || "—") + '</div></div>'
      + '<span class="badge ' + bCls + '">' + bTxt + '</span>'
      + '</div>'
      + '<div class="info-grid">'
      + infoItem("🕐 Check-In",   r.attendance_open_time   || "—", r.attendance_open_time   ? "g" : "")
      + infoItem("🕔 Check-Out",  r.attendance_closed_time || "—", r.attendance_closed_time ? ""  : "o")
      + infoItem("⏱ Working Hrs", r.working_hours          || "—", "")
      + infoItem("📏 Distance",   r.distance_km ? r.distance_km + " km" : "—", r.distance_km ? "g" : "")
      + '</div>'
      + (r.map_link
        ? '<a href="' + r.map_link + '" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:12px;font-weight:700;color:var(--accent2);border-top:1px solid var(--border);text-decoration:none;">🗺️ Location Dekho →</a>'
        : "")
      + '</div>';
  });
  document.getElementById("attCards").innerHTML = html;
}

function exportAttCSV() {
  var rows = activeAttEmp === "all"
    ? allAttRows
    : allAttRows.filter(function(r) { return r.employee_name === activeAttEmp; });
  if (!rows.length) { toast("Koi data nahi CSV ke liye", "err"); return; }
  var hdr  = ["Name","Contact","Date","Route","Check-In","Check-Out","Working Hours","Odo Start","Odo End","Distance(km)","Map Link","Notes"];
  var data = rows.map(function(r) {
    return [r.employee_name, r.employee_contact, r.attendance_date, r.working_route,
            r.attendance_open_time, r.attendance_closed_time, r.working_hours,
            r.odometer_start, r.odometer_end, r.distance_km, r.map_link, r.notes]
      .map(function(v) { return '"' + String(v||"").replace(/"/g,'""') + '"'; }).join(",");
  });
  downloadCSV([hdr.join(",")].concat(data).join("\n"),
    "Attendance_" + new Date().toISOString().split("T")[0]);
}

function exportAttPDF() {
  var rows = activeAttEmp === "all"
    ? allAttRows
    : allAttRows.filter(function(r) { return r.employee_name === activeAttEmp; });
  if (!rows.length) { toast("Koi data nahi PDF ke liye", "err"); return; }
  var doc = "<h1>" + brandingConfig.appName + " - Attendance Report</h1>"
    + "<p><strong>Date Range:</strong> " + document.getElementById("attFrom").value
    + " to " + document.getElementById("attTo").value + "</p>"
    + "<p><strong>Employee:</strong> " + (activeAttEmp === "all" ? "All" : activeAttEmp) + "</p>"
    + "<table border='1' cellpadding='8' style='width:100%;border-collapse:collapse;'>"
    + "<tr style='background:#f0f0f0;'><th>Name</th><th>Date</th><th>Route</th><th>Check-In</th><th>Check-Out</th><th>Hrs</th><th>Distance</th></tr>";
  rows.forEach(function(r) {
    doc += "<tr>"
      + "<td>" + esc(r.employee_name||"—") + "</td>"
      + "<td>" + r.attendance_date + "</td>"
      + "<td>" + esc(r.working_route||"—") + "</td>"
      + "<td>" + (r.attendance_open_time||"—") + "</td>"
      + "<td>" + (r.attendance_closed_time||"—") + "</td>"
      + "<td>" + (r.working_hours||"—") + "</td>"
      + "<td>" + (r.distance_km||"—") + "</td>"
      + "</tr>";
  });
  doc += "</table>";
  downloadPDF(doc, "Attendance_" + new Date().toISOString().split("T")[0]);
}

// ══════════════════════════════
// EMPLOYEES
// ══════════════════════════════
function loadEmployees() {
  document.getElementById("empListWrap").innerHTML =
    '<div class="loading"><div class="spin"></div>Loading...</div>';
  sbGet("employees", "select=*&order=name.asc")
    .then(function(rows) {
      allEmps = rows || [];
      document.getElementById("empSubLbl").textContent = allEmps.length + " employees";
      renderEmpList();
      populatePinSelect();
      populateVisitFilter();
    }).catch(function() {
      document.getElementById("empListWrap").innerHTML =
        '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Load nahi hua</div></div>';
    });
}

function renderEmpList() {
  if (!allEmps.length) {
    document.getElementById("empListWrap").innerHTML =
      '<div class="empty"><span class="empty-ico">👥</span><div class="empty-txt">Koi employee nahi</div></div>';
    return;
  }
  var html = "";
  allEmps.forEach(function(e) {
    var init = initials(e.name || "?");
    var statusBadge = e.employee_logout
      ? '<span class="badge locked">🔒 Locked</span>'
      : '<span class="badge active-b">✅ Active</span>';
    html += '<div class="card">'
      + '<div class="card-head">'
      + '<div class="avatar">' + init + '</div>'
      + '<div style="flex:1">'
      + '<div class="card-name">' + esc(e.name) + '</div>'
      + '<div class="card-sub">' + esc(e.designation || "Employee") + ' · EmpID: ' + esc(e.emp_id || "—") + '</div>'
      + '</div>' + statusBadge
      + '</div>'
      + '<div class="info-grid">'
      + infoItem("📱 Contact",  e.contact     || "—", "")
      + infoItem("🔑 PIN",      e.pin         || "—", "")
      + infoItem("📍 District", e.district    || "—", "")
      + infoItem("📅 Joining",  fmtDate(e.joining_date) || "—", "")
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="card-action-btn accent"  onclick="openEditEmployee(\'' + e.user_id + '\')">✏️ Edit</button>'
      + '<button class="card-action-btn ' + (e.employee_logout ? "success" : "danger") + '" onclick="toggleEmpLogout(\'' + e.user_id + '\',' + e.employee_logout + ',\'' + esc(e.name) + '\')">'
      + (e.employee_logout ? "🔓 Unlock" : "🔒 Lock") + '</button>'
      + '<button class="card-action-btn danger" onclick="deleteEmployee(\'' + e.user_id + '\',\'' + esc(e.name) + '\')">🗑 Delete</button>'
      + '</div>'
      + '</div>';
  });
  html += '<div style="text-align:center;padding:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'
    + '<button class="btn-green" onclick="exportEmpCSV()">⬇ CSV</button>'
    + '<button class="btn-green" onclick="exportEmpPDF()">📄 PDF</button>'
    + '</div>';
  document.getElementById("empListWrap").innerHTML = html;
}

function openAddEmployee() {
  document.getElementById("empModalTitle").textContent = "➕ Employee Add Karo";
  ["mEmpName","mEmpId","mEmpPin","mEmpContact","mEmpDesig","mEmpDistrict","mEmpState","mEmpAddress"]
    .forEach(function(id) { document.getElementById(id).value = ""; });
  document.getElementById("mEmpJoining").value     = "";
  document.getElementById("mEmpId_hidden").value   = "";
  openModal("empModal");
}

function openEditEmployee(uid) {
  var e = allEmps.find(function(x) { return x.user_id === uid; });
  if (!e) return;
  document.getElementById("empModalTitle").textContent = "✏️ Employee Edit Karo";
  document.getElementById("mEmpName").value     = e.name        || "";
  document.getElementById("mEmpId").value       = e.emp_id      || "";
  document.getElementById("mEmpPin").value      = e.pin         || "";
  document.getElementById("mEmpContact").value  = e.contact     || "";
  document.getElementById("mEmpDesig").value    = e.designation || "";
  document.getElementById("mEmpDistrict").value = e.district    || "";
  document.getElementById("mEmpState").value    = e.state       || "";
  document.getElementById("mEmpAddress").value  = e.address     || "";
  document.getElementById("mEmpJoining").value  = e.joining_date ? e.joining_date.split("T")[0] : "";
  document.getElementById("mEmpId_hidden").value = uid;
  openModal("empModal");
}

function saveEmployee() {
  var name    = document.getElementById("mEmpName").value.trim();
  var empId   = document.getElementById("mEmpId").value.trim();
  var pin     = document.getElementById("mEmpPin").value.trim();
  var contact = document.getElementById("mEmpContact").value.trim();
  var desig   = document.getElementById("mEmpDesig").value.trim();
  var dist    = document.getElementById("mEmpDistrict").value.trim();
  var state   = document.getElementById("mEmpState").value.trim();
  var addr    = document.getElementById("mEmpAddress").value.trim();
  var joining = document.getElementById("mEmpJoining").value;
  var uid     = document.getElementById("mEmpId_hidden").value;

  if (!name) { toast("Naam zaroori hai", "err"); return; }
  if (!pin)  { toast("PIN zaroori hai", "err"); return; }

  var payload = { name: name, emp_id: empId, pin: pin, contact: contact,
                  designation: desig, district: dist, state: state, address: addr };
  if (joining) payload.joining_date = joining;

  var p = uid
    ? sbPatch("employees", "user_id=eq." + uid, payload)
    : sbInsert("employees", payload);

  p.then(function() {
    closeModal("empModal");
    toast(uid ? "Employee update ho gaya ✓" : "Employee add ho gaya ✓", "ok");
    loadEmployees();
  }).catch(function(e) { toast("Error: " + (e.message || "Try again"), "err"); });
}

function deleteEmployee(uid, name) {
  confirmDialog("🗑 Delete Employee", name + " ko permanently delete karna hai?", function() {
    sbDelete("employees", "user_id=eq." + uid)
      .then(function() { toast(name + " delete ho gaya ✓", "ok"); loadEmployees(); })
      .catch(function() { toast("Delete nahi hua", "err"); });
  });
}

function toggleEmpLogout(uid, currentState, name) {
  var newState = !currentState;
  var msg = newState
    ? name + " ko LOCK karna hai? Woh login nahi kar payega."
    : name + " ka lock hatana hai? Woh login kar payega.";
  confirmDialog(newState ? "🔒 Employee Lock" : "🔓 Employee Unlock", msg, function() {
    sbPatch("employees", "user_id=eq." + uid, { employee_logout: newState })
      .then(function() {
        toast(name + (newState ? " lock ho gaya ✓" : " unlock ho gaya ✓"), "ok");
        loadEmployees();
      }).catch(function() { toast("Error. Dobara try karo.", "err"); });
  });
}

function populatePinSelect() {
  var sel = document.getElementById("pinResetEmp");
  sel.innerHTML = '<option value="">Employee select karo</option>';
  allEmps.forEach(function(e) {
    sel.innerHTML += '<option value="' + e.user_id + '">' + esc(e.name) + ' (' + (e.emp_id || e.pin) + ')</option>';
  });
}

function exportEmpCSV() {
  if (!allEmps.length) { toast("Koi employee data nahi", "err"); return; }
  var hdr  = ["Name","EmpID","PIN","Contact","Designation","District","State","Address","Joining Date","Status"];
  var data = allEmps.map(function(e) {
    return [e.name, e.emp_id, e.pin, e.contact, e.designation, e.district, e.state, e.address,
            e.joining_date, e.employee_logout ? "Locked" : "Active"]
      .map(function(v) { return '"' + String(v||"").replace(/"/g,'""') + '"'; }).join(",");
  });
  downloadCSV([hdr.join(",")].concat(data).join("\n"),
    "Employees_" + new Date().toISOString().split("T")[0]);
}

function exportEmpPDF() {
  if (!allEmps.length) { toast("Koi employee data nahi", "err"); return; }
  var doc = "<h1>" + brandingConfig.appName + " - Employees Report</h1>"
    + "<p><strong>Generated:</strong> " + new Date().toLocaleDateString("en-IN") + "</p>"
    + "<table border='1' cellpadding='8' style='width:100%;border-collapse:collapse;'>"
    + "<tr style='background:#f0f0f0;'><th>Name</th><th>EmpID</th><th>PIN</th><th>Contact</th><th>Designation</th><th>District</th><th>State</th><th>Joining</th><th>Status</th></tr>";
  allEmps.forEach(function(e) {
    doc += "<tr>"
      + "<td>" + esc(e.name||"—") + "</td>"
      + "<td>" + esc(e.emp_id||"—") + "</td>"
      + "<td>" + esc(e.pin||"—") + "</td>"
      + "<td>" + esc(e.contact||"—") + "</td>"
      + "<td>" + esc(e.designation||"—") + "</td>"
      + "<td>" + esc(e.district||"—") + "</td>"
      + "<td>" + esc(e.state||"—") + "</td>"
      + "<td>" + fmtDate(e.joining_date) + "</td>"
      + "<td>" + (e.employee_logout ? "Locked" : "Active") + "</td>"
      + "</tr>";
  });
  doc += "</table>";
  downloadPDF(doc, "Employees_" + new Date().toISOString().split("T")[0]);
}

// ══════════════════════════════
// ROUTES WITH DROPDOWNS
// ══════════════════════════════
function loadRoutes() {
  document.getElementById("routeTableWrap").innerHTML =
    '<div class="loading"><div class="spin"></div>Loading...</div>';
  sbGet("routes", "select=*&order=state.asc,district.asc,working_route.asc")
    .then(function(rows) {
      allRoutes = rows || [];
      buildRouteDropdowns();
      document.getElementById("routeSubLbl").textContent = allRoutes.length + " routes";
      renderRouteTable(allRoutes);
    }).catch(function() {
      document.getElementById("routeTableWrap").innerHTML =
        '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Load nahi hua</div></div>';
    });
}

function buildRouteDropdowns() {
  var states = [], districts = [], wRoutes = [], areas = [], shops = [], keepers = [], contacts = [];
  allRoutes.forEach(function(r) {
    if (r.state         && states.indexOf(r.state)                   < 0) states.push(r.state);
    if (r.district      && districts.indexOf(r.district)             < 0) districts.push(r.district);
    if (r.working_route && wRoutes.indexOf(r.working_route)          < 0) wRoutes.push(r.working_route);
    if (r.area          && areas.indexOf(r.area)                     < 0) areas.push(r.area);
    if (r.shop && r.shopkeeper_name) {
      if (shops.indexOf(r.shop)                         < 0) shops.push(r.shop);
      if (keepers.indexOf(r.shopkeeper_name)            < 0) keepers.push(r.shopkeeper_name);
      if (r.shopkeeper_contact && contacts.indexOf(r.shopkeeper_contact) < 0) contacts.push(r.shopkeeper_contact);
    }
  });
  routeStates              = states.sort();
  routeDistricts           = districts.sort();
  routeWorkingRoutes       = wRoutes.sort();
  routeAreas               = areas.sort();
  routeShops               = shops.sort();
  routeShopkeepers         = keepers.sort();
  routeShopkeeperContacts  = contacts.sort();
}

function filterRoutes() {
  var q = document.getElementById("routeSearch").value.toLowerCase();
  var filtered = allRoutes.filter(function(r) {
    return [r.state, r.district, r.working_route, r.area, r.shop, r.shopkeeper_name]
      .some(function(v) { return v && v.toLowerCase().includes(q); });
  });
  renderRouteTable(filtered);
}

function renderRouteTable(routes) {
  if (!routes.length) {
    document.getElementById("routeTableWrap").innerHTML =
      '<div class="empty"><span class="empty-ico">🗺️</span><div class="empty-txt">Koi route nahi</div></div>';
    return;
  }
  var html = '<div class="tbl-wrap"><table>'
    + '<thead><tr><th>State</th><th>District</th><th>Route</th><th>Area</th><th>Shop</th><th>Shopkeeper</th><th>Contact</th><th>Actions</th></tr></thead><tbody>';
  routes.forEach(function(r) {
    html += '<tr>'
      + '<td class="tbl-name">' + esc(r.state          || "—") + '</td>'
      + '<td>'                  + esc(r.district        || "—") + '</td>'
      + '<td>'                  + esc(r.working_route   || "—") + '</td>'
      + '<td>'                  + esc(r.area            || "—") + '</td>'
      + '<td>'                  + esc(r.shop            || "—") + '</td>'
      + '<td>'                  + esc(r.shopkeeper_name || "—") + '</td>'
      + '<td>'                  + esc(r.shopkeeper_contact || "—") + '</td>'
      + '<td><div class="tbl-actions">'
      + '<button class="btn-tbl edit" onclick="openEditRoute(\'' + r.id + '\')">✏️</button>'
      + '<button class="btn-tbl del"  onclick="deleteRoute(\'' + r.id + '\',\'' + esc(r.working_route || r.area || "Route") + '\')">🗑</button>'
      + '</div></td>'
      + '</tr>';
  });
  html += '</tbody></table></div>';
  document.getElementById("routeTableWrap").innerHTML = html;
}

function openAddRoute() {
  document.getElementById("routeModalTitle").textContent = "➕ Route Add Karo";
  ["mRState","mRDistrict","mRRoute"].forEach(function(id) {
    document.getElementById(id).value = "";
  });
  initRouteDropdowns("add");
  document.getElementById("mRId").value = "";
  openModal("routeModal");
}

function openEditRoute(id) {
  var r = allRoutes.find(function(x) { return x.id === id; });
  if (!r) return;
  document.getElementById("routeModalTitle").textContent = "✏️ Route Edit Karo";
  document.getElementById("mRState").value    = r.state         || "";
  document.getElementById("mRDistrict").value = r.district      || "";
  document.getElementById("mRRoute").value    = r.working_route || "";
  initRouteDropdowns("edit", r);
  document.getElementById("mRId").value = id;
  openModal("routeModal");
}

function initRouteDropdowns(mode, rd) {
  function fillSelect(id, arr, val) {
    var s = document.getElementById(id);
    s.innerHTML = '<option value="">Select / Enter ' + id.replace("mR","") + '</option>';
    arr.forEach(function(v) {
      s.innerHTML += '<option value="' + esc(v) + '">' + esc(v) + '</option>';
    });
    if (val) s.value = val;
  }
  fillSelect("mRState",    routeStates,             mode === "edit" && rd ? rd.state         : "");
  fillSelect("mRDistrict", routeDistricts,          mode === "edit" && rd ? rd.district      : "");
  fillSelect("mRRoute",    routeWorkingRoutes,      mode === "edit" && rd ? rd.working_route : "");
  fillSelect("mRArea",     routeAreas,              mode === "edit" && rd ? rd.area          : "");
  fillSelect("mRShop",     routeShops,              mode === "edit" && rd ? rd.shop          : "");
  fillSelect("mRKeeper",   routeShopkeepers,        mode === "edit" && rd ? rd.shopkeeper_name    : "");
  fillSelect("mRKContact", routeShopkeeperContacts, mode === "edit" && rd ? rd.shopkeeper_contact : "");

  // Re-attach datalist for free text entry
  document.getElementById("mRState").setAttribute("list", "stateList");
  document.getElementById("mRDistrict").setAttribute("list", "districtList");
  document.getElementById("mRRoute").setAttribute("list", "routeList");
}

function saveRoute() {
  var state  = document.getElementById("mRState").value.trim();
  var dist   = document.getElementById("mRDistrict").value.trim();
  var route  = document.getElementById("mRRoute").value.trim();
  var area   = document.getElementById("mRArea").value.trim();
  var shop   = document.getElementById("mRShop").value.trim();
  var keeper = document.getElementById("mRKeeper").value.trim();
  var kc     = document.getElementById("mRKContact").value.trim();
  var id     = document.getElementById("mRId").value;

  if (!state || !dist || !route || !area) {
    toast("State, District, Route, Area zaroori hai", "err"); return;
  }

  state  = state.toUpperCase();
  dist   = dist.toUpperCase();
  route  = route.toUpperCase();
  area   = area.toUpperCase();
  shop   = shop.toUpperCase();
  keeper = keeper.toUpperCase();

  if (kc) {
    var isDup = allRoutes.some(function(r) {
      if (id && r.id === id) return false;
      return r.shopkeeper_contact &&
             r.shopkeeper_contact.toLowerCase() === kc.toLowerCase();
    });
    if (isDup) { toast("Yeh contact pehle se exist hai. Dusra number daalo.", "err"); return; }
  }

  var payload = { state: state, district: dist, working_route: route, area: area,
                  shop: shop, shopkeeper_name: keeper, shopkeeper_contact: kc };
  var p = id
    ? sbPatch("routes", "id=eq." + id, Object.assign(payload, { updated_at: new Date().toISOString() }))
    : sbInsert("routes", payload);

  p.then(function() {
    closeModal("routeModal");
    toast(id ? "Route update ho gaya ✓" : "Route add ho gaya ✓", "ok");
    loadRoutes();
  }).catch(function(e) { toast("Error: " + (e.message || "Try again"), "err"); });
}

function deleteRoute(id, name) {
  confirmDialog("🗑 Delete Route", '"' + name + '" ko delete karna hai?', function() {
    sbDelete("routes", "id=eq." + id)
      .then(function() { toast("Route delete ho gaya ✓", "ok"); loadRoutes(); })
      .catch(function() { toast("Delete nahi hua", "err"); });
  });
}

function exportRouteCSV() {
  if (!allRoutes.length) { toast("Koi data nahi CSV ke liye", "err"); return; }
  var hdr  = ["State","District","Route","Area","Shop","Shopkeeper","Contact"];
  var data = allRoutes.map(function(r) {
    return [r.state, r.district, r.working_route, r.area, r.shop, r.shopkeeper_name, r.shopkeeper_contact]
      .map(function(v) { return '"' + String(v||"").replace(/"/g,'""') + '"'; }).join(",");
  });
  downloadCSV([hdr.join(",")].concat(data).join("\n"),
    "Routes_" + new Date().toISOString().split("T")[0]);
}

function exportRoutePDF() {
  if (!allRoutes.length) { toast("Koi data nahi PDF ke liye", "err"); return; }
  var doc = "<h1>" + brandingConfig.appName + " - Routes Report</h1>"
    + "<table border='1' cellpadding='8' style='width:100%;border-collapse:collapse;'>"
    + "<tr style='background:#f0f0f0;'><th>State</th><th>District</th><th>Route</th><th>Area</th><th>Shop</th><th>Shopkeeper</th><th>Contact</th></tr>";
  allRoutes.forEach(function(r) {
    doc += "<tr>"
      + "<td>" + esc(r.state          ||"—") + "</td>"
      + "<td>" + esc(r.district       ||"—") + "</td>"
      + "<td>" + esc(r.working_route  ||"—") + "</td>"
      + "<td>" + esc(r.area           ||"—") + "</td>"
      + "<td>" + esc(r.shop           ||"—") + "</td>"
      + "<td>" + esc(r.shopkeeper_name||"—") + "</td>"
      + "<td>" + esc(r.shopkeeper_contact||"—") + "</td>"
      + "</tr>";
  });
  doc += "</table>";
  downloadPDF(doc, "Routes_" + new Date().toISOString().split("T")[0]);
}

// ══════════════════════════════
// VISITS
// ══════════════════════════════
function loadVisits() {
  var from   = document.getElementById("visFrom").value;
  var to     = document.getElementById("visTo").value;
  var empFil = document.getElementById("visEmpFilter").value;
  if (!from || !to) { toast("Date range select karo", "err"); return; }

  document.getElementById("visitTableWrap").innerHTML =
    '<div class="loading"><div class="spin"></div>Loading...</div>';
  document.getElementById("visitSubLbl").textContent = from + " → " + to;

  var query = "select=*&visit_date=gte." + from + "&visit_date=lte." + to +
    "&order=visit_date.desc,visit_in_time.desc";
  if (empFil) query += "&employee_name=eq." + encodeURIComponent(empFil);

  sbGet("visits", query).then(function(rows) {
    allVisits = rows || [];
    populateVisitFilter();
    renderVisitsTable(allVisits);
  }).catch(function() {
    document.getElementById("visitTableWrap").innerHTML =
      '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Load nahi hua</div></div>';
  });
}

function populateVisitFilter() {
  var sel = document.getElementById("visEmpFilter");
  if (!sel) return;
  var cur = sel.value;
  var names = allEmps.map(function(e) { return e.name; }).filter(Boolean);
  sel.innerHTML = '<option value="">👥 Sab Employees</option>';
  names.forEach(function(n) {
    sel.innerHTML += '<option value="' + esc(n) + '" ' + (cur === n ? "selected" : "") + '>' + esc(n) + '</option>';
  });
}

function renderVisitsTable(visits) {
  if (!visits.length) {
    document.getElementById("visitTableWrap").innerHTML =
      '<div class="empty"><span class="empty-ico">🏪</span><div class="empty-txt">Koi visit nahi</div></div>';
    return;
  }
  var html = "";
  visits.forEach(function(v) {
    var ratingStars = v.rating ? "⭐".repeat(Math.min(v.rating, 5)) : "—";
    html += '<div class="card" style="margin-bottom:10px;">'
      + '<div class="card-head">'
      + '<div class="avatar" style="background:var(--orange-dim);color:var(--orange);">🏪</div>'
      + '<div style="flex:1">'
      + '<div class="card-name">' + esc(v.shop_name || "—") + '</div>'
      + '<div class="card-sub">' + fmtDate(v.visit_date) + ' · ' + esc(v.area || "—") + '</div>'
      + '</div>'
      + '<span class="badge ' + (v.visit_out_time ? "out" : "in") + '">'
      + (v.visit_out_time ? "✅ Done" : "🟢 Active") + '</span>'
      + '</div>'
      + '<div class="info-grid">'
      + infoItem("👤 Employee",     v.employee_name      || "—", "")
      + infoItem("📱 Emp Contact",  v.employee_contact   || "—", "")
      + infoItem("🧑‍💼 Shopkeeper",   v.shopkeeper_name    || "—", "")
      + infoItem("📞 Shop Contact", v.shopkeeper_contact || "—", "")
      + '</div>'
      + '<div class="info-grid">'
      + infoItem("🕐 Visit In",   v.visit_in_time  || "—", v.visit_in_time  ? "g" : "")
      + infoItem("🕔 Visit Out",  v.visit_out_time || "—", v.visit_out_time ? ""  : "o")
      + infoItem("⏸ Hold Time",   v.hold_time      || "—", "")
      + infoItem("⭐ Rating",      ratingStars,            "")
      + '</div>'
      + (v.visit_out_notes
        ? '<div style="padding:10px 14px;border-top:1px solid var(--border);font-size:12.5px;color:var(--text2);">'
          + '<span style="font-size:10px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;">📝 Visit Notes</span>'
          + '<div style="margin-top:4px;line-height:1.5;">' + esc(v.visit_out_notes) + '</div>'
          + '</div>'
        : "")
      + '<div style="display:flex;border-top:1px solid var(--border);">'
      + (v.visit_photo
        ? '<a href="' + v.visit_photo + '" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;font-size:12px;font-weight:700;color:var(--accent2);text-decoration:none;border-right:1px solid var(--border);">📸 Photo</a>'
        : '<span style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px;font-size:12px;color:var(--text3);border-right:1px solid var(--border);">📸 No Photo</span>')
      + (v.map_link
        ? '<a href="' + v.map_link + '" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;font-size:12px;font-weight:700;color:var(--accent2);text-decoration:none;">📍 Location</a>'
        : '<span style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px;font-size:12px;color:var(--text3);">📍 No Map</span>')
      + '</div>'
      + '</div>';
  });
  document.getElementById("visitTableWrap").innerHTML = html;
}

function exportVisitsCSV() {
  if (!allVisits.length) { toast("Koi data nahi", "err"); return; }
  var hdr  = ["Date","Employee","Contact","Area","Shop","Shopkeeper","Shopkeeper Contact","Visit In","Visit Out","Hold Time","Notes","Rating","Map Link"];
  var data = allVisits.map(function(v) {
    return [v.visit_date, v.employee_name, v.employee_contact, v.area, v.shop_name,
            v.shopkeeper_name, v.shopkeeper_contact, v.visit_in_time, v.visit_out_time,
            v.hold_time, v.visit_out_notes, v.rating, v.map_link]
      .map(function(x) { return '"' + String(x||"").replace(/"/g,'""') + '"'; }).join(",");
  });
  downloadCSV([hdr.join(",")].concat(data).join("\n"),
    "Visits_" + new Date().toISOString().split("T")[0]);
}

function exportVisitsPDF() {
  if (!allVisits.length) { toast("Koi data nahi PDF ke liye", "err"); return; }
  var doc = "<h1>" + brandingConfig.appName + " - Visits Report</h1>"
    + "<p><strong>Date Range:</strong> " + document.getElementById("visFrom").value
    + " to " + document.getElementById("visTo").value + "</p>"
    + "<table border='1' cellpadding='8' style='width:100%;border-collapse:collapse;'>"
    + "<tr style='background:#f0f0f0;'><th>Date</th><th>Employee</th><th>Shop</th><th>Area</th><th>In Time</th><th>Out Time</th><th>Hold Time</th><th>Rating</th></tr>";
  allVisits.forEach(function(v) {
    var stars = v.rating ? "⭐".repeat(Math.min(v.rating, 5)) : "—";
    doc += "<tr>"
      + "<td>" + v.visit_date + "</td>"
      + "<td>" + esc(v.employee_name||"—") + "</td>"
      + "<td>" + esc(v.shop_name||"—") + "</td>"
      + "<td>" + esc(v.area||"—") + "</td>"
      + "<td>" + (v.visit_in_time||"—") + "</td>"
      + "<td>" + (v.visit_out_time||"—") + "</td>"
      + "<td>" + (v.hold_time||"—") + "</td>"
      + "<td>" + stars + "</td>"
      + "</tr>";
  });
  doc += "</table>";
  downloadPDF(doc, "Visits_" + new Date().toISOString().split("T")[0]);
}

// ══════════════════════════════
// SECURITY SCREEN
// ══════════════════════════════
function loadSecurityScreen() {
  sbGet("employees", "select=user_id,name,employee_logout,pin&order=name.asc")
    .then(function(rows) {
      allEmps = rows || [];
      renderEmpLogoutToggles();
      populatePinSelect();
    }).catch(function() {
      document.getElementById("empLogoutToggles").innerHTML =
        '<div class="empty">⚠️ Load nahi hua</div>';
    });
}

function renderEmpLogoutToggles() {
  if (!allEmps.length) {
    document.getElementById("empLogoutToggles").innerHTML = '<div class="empty">Koi employee nahi</div>';
    return;
  }
  var html = "";
  allEmps.forEach(function(e) {
    html += '<div class="toggle-row">'
      + '<div class="toggle-info">'
      + '<div class="toggle-lbl">' + esc(e.name) + '</div>'
      + '<div class="toggle-sub">'
      + (e.employee_logout ? "🔒 Locked — Login disabled" : "✅ Active — Login allowed")
      + '</div>'
      + '</div>'
      + '<label class="toggle-sw">'
      + '<input type="checkbox" ' + (e.employee_logout ? "checked" : "")
      + ' onchange="toggleLogoutDirect(\'' + e.user_id + '\',\'' + esc(e.name) + '\',this)">'
      + '<span class="toggle-track"></span>'
      + '</label>'
      + '</div>';
  });
  document.getElementById("empLogoutToggles").innerHTML = html;
}

function toggleLogoutDirect(uid, name, el) {
  var newState = el.checked;
  sbPatch("employees", "user_id=eq." + uid, { employee_logout: newState })
    .then(function() {
      toast(name + (newState ? " locked ✓" : " unlocked ✓"), "ok");
      var emp = allEmps.find(function(e) { return e.user_id === uid; });
      if (emp) emp.employee_logout = newState;
      renderEmpLogoutToggles();
    }).catch(function() {
      el.checked = !newState;
      toast("Error. Dobara try karo.", "err");
    });
}

// ══════════════════════════════
// SUPABASE REST HELPERS
// ══════════════════════════════
function sbHeaders(extra) {
  var h = {
    "apikey":        SUPABASE_ANON,
    "Authorization": "Bearer " + SUPABASE_ANON,
    "Content-Type":  "application/json"
  };
  if (extra) Object.assign(h, extra);
  return h;
}

function sbGet(table, query) {
  var url = SUPABASE_URL + "/rest/v1/" + table + (query ? "?" + query : "");
  return fetch(url, { headers: sbHeaders() })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d.code) throw new Error(d.message || d.code);
      return d;
    });
}

function sbInsert(table, payload) {
  return fetch(SUPABASE_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: sbHeaders({ "Prefer": "return=minimal" }),
    body: JSON.stringify(payload)
  }).then(checkSbResp);
}

function sbPatch(table, filter, payload) {
  return fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + filter, {
    method: "PATCH",
    headers: sbHeaders({ "Prefer": "return=minimal" }),
    body: JSON.stringify(payload)
  }).then(checkSbResp);
}

function sbDelete(table, filter) {
  return fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + filter, {
    method: "DELETE",
    headers: sbHeaders({ "Prefer": "return=minimal" })
  }).then(checkSbResp);
}

function sbUpsert(table, payload) {
  return fetch(SUPABASE_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: sbHeaders({ "Prefer": "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(payload)
  }).then(checkSbResp);
}

function checkSbResp(r) {
  if (!r.ok) {
    return r.json().then(function(d) { throw new Error(d.message || "HTTP " + r.status); });
  }
  return r;
}

// ══════════════════════════════
// MODAL HELPERS
// ══════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add("show"); }
function closeModal(id) { document.getElementById(id).classList.remove("show"); }

document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll(".modal-ov").forEach(function(ov) {
    ov.addEventListener("click", function(e) {
      if (e.target === ov) ov.classList.remove("show");
    });
  });
});

// ══════════════════════════════
// CONFIRM DIALOG
// ══════════════════════════════
function confirmDialog(title, msg, onYes) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMsg").textContent   = msg;
  document.getElementById("confirmOv").classList.add("show");
  document.getElementById("confirmYes").onclick = function() {
    document.getElementById("confirmOv").classList.remove("show");
    onYes();
  };
  document.getElementById("confirmNo").onclick = function() {
    document.getElementById("confirmOv").classList.remove("show");
  };
}

// ══════════════════════════════
// DOWNLOAD HELPERS
// ══════════════════════════════
function downloadCSV(csv, filename) {
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var a    = document.createElement("a");
  a.href   = URL.createObjectURL(blob);
  a.download = filename + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast("CSV download ho raha hai ✓", "ok");
}

function downloadPDF(html, filename) {
  var w = window.open('', '', 'height=600,width=800');
  w.document.write('<html><head><title>' + filename + '</title>');
  w.document.write('<style>body{font-family:Arial,sans-serif;margin:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}h1{color:#333;}</style>');
  w.document.write('</head><body>');
  w.document.write(html);
  w.document.write('</body></html>');
  w.document.close();
  w.print();
  toast("PDF download ready ✓", "ok");
}

// ══════════════════════════════
// MISC HELPERS
// ══════════════════════════════
function setToday(fromId, toId) {
  var t = new Date().toISOString().split("T")[0];
  document.getElementById(fromId).value = t;
  document.getElementById(toId).value   = t;
}

function togglePw(inputId, btn) {
  var inp  = document.getElementById(inputId);
  inp.type = inp.type === "password" ? "text" : "password";
  btn.textContent = inp.type === "password" ? "👁" : "🙈";
}

function infoItem(lbl, val, cls) {
  return '<div class="info-item">'
    + '<div class="info-lbl">' + lbl + '</div>'
    + '<div class="info-val ' + (cls || "") + '">' + val + '</div>'
    + '</div>';
}

function initials(name) {
  return String(name || "?").split(" ")
    .map(function(w) { return w[0] || ""; })
    .join("").toUpperCase().slice(0, 2);
}

function fmtDate(v) {
  if (!v) return "—";
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return String(v);
  return d.getDate().toString().padStart(2,"0") + "-"
    + (d.getMonth()+1).toString().padStart(2,"0") + "-"
    + d.getFullYear();
}

function fmtDateLong(d) {
  var days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

var _tt = null;
function toast(msg, type) {
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = "toast show" + (type ? " " + type : "");
  if (_tt) clearTimeout(_tt);
  _tt = setTimeout(function() { el.classList.remove("show"); }, 3200);
}

// ══════════════════════════════
// AUTO LOGIN CHECK
// ══════════════════════════════
if (sessionStorage.getItem("nf_admin") === "1") {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display         = "block";
  initApp();
}
