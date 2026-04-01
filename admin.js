// ═══════════════════════════════════════════════
//  NAMEFAME ADMIN PANEL — admin.js
//  Supabase direct REST API
// ═══════════════════════════════════════════════

// ── CONFIG ── (apna Supabase URL aur anon key yahan daalo)
var SUPABASE_URL  = "https://qhikqbrfojdlmdwsdota.supabase.co";
var SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoaWtxYnJmb2pkbG1kd3Nkb3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjcxMDgsImV4cCI6MjA5MDMwMzEwOH0.lYiBLoXPdNO_kfilcbX-OfbvJcXsjM841HG2ffwQT3Y";



// ── STATE ──
var allEmps       = [];
var allRoutes     = [];
var allAttRows    = [];
var allVisits     = [];
var activeAttEmp  = "all";

// ══════════════════════════════
// AUTH
// ══════════════════════════════
function doLogin() {
  var p   = document.getElementById("adminPass").value.trim();
  var btn = document.getElementById("loginBtn");
  if (!p) { toast("Password daalo", "err"); return; }

  btn.textContent = "⏳ Checking..."; btn.disabled = true;

  // AdminConfig table se password read karo
  sbGet("admin_config", "select=value&name=eq.admin_password&limit=1")
    .then(function(rows) {
      btn.textContent = "🔓 Login Karo"; btn.disabled = false;
      var correct = rows && rows[0] ? rows[0].value : null;
      if (!correct) {
        // Table nahi hai ya row nahi — default 'admin1234'
        correct = "admin1234";
      }
      if (p === correct) {
        sessionStorage.setItem("nf_admin", "1");
        sessionStorage.setItem("nf_pass", p);
        showApp();
      } else {
        toast("Galat password!", "err");
        document.getElementById("adminPass").value = "";
      }
    })
    .catch(function() {
      btn.textContent = "🔓 Login Karo"; btn.disabled = false;
      // Fallback: agar table nahi to default pass se login karo
      if (p === "admin1234") { sessionStorage.setItem("nf_admin","1"); showApp(); }
      else toast("Network error ya galat password", "err");
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

  // Upsert admin_config
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
// INIT
// ══════════════════════════════
function initApp() {
  var now = new Date();
  document.getElementById("dashDate").textContent = fmtDateLong(now);
  setToday("attFrom", "attTo");
  setToday("visFrom", "visTo");
  loadDashboard();
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
function refreshDash() { loadDashboard(); }

function loadDashboard() {
  var today = new Date().toISOString().split("T")[0];

  Promise.all([
    sbGet("employees",   "select=count"),
    sbGet("visits",      "select=count&visit_date=eq." + today),
    sbGet("attendance",  "select=count&date=eq." + today),
    sbGet("routes",      "select=count")
  ]).then(function(results) {
    var empCount   = results[0] ? results[0].length : 0;
    var visToday   = results[1] ? results[1].length : 0;
    var attToday   = results[2] ? results[2].length : 0;
    var routeCount = results[3] ? results[3].length : 0;

    document.getElementById("dashStats").innerHTML =
      statCard("👥", empCount,   "Employees",     "") +
      statCard("📋", attToday,   "Aaj Attendance","green") +
      statCard("🏪", visToday,   "Aaj Visits",    "orange") +
      statCard("🗺️", routeCount, "Routes",        "yellow");
  }).catch(function() {
    document.getElementById("dashStats").innerHTML =
      statCard("👥","—","Employees","") +
      statCard("📋","—","Aaj Attendance","green") +
      statCard("🏪","—","Aaj Visits","orange") +
      statCard("🗺️","—","Routes","yellow");
  });

  // Today's attendance cards
  sbGet("attendance", "select=*&date=eq." + today + "&order=checkin_time.desc&limit=20")
    .then(function(rows) {
      renderTodayCards(rows || []);
    }).catch(function() {
      document.getElementById("todayCards").innerHTML = '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Load nahi hua</div></div>';
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
    document.getElementById("todayCards").innerHTML = '<div class="empty"><span class="empty-ico">📭</span><div class="empty-txt">Aaj koi attendance nahi</div></div>';
    return;
  }
  var html = "";
  rows.slice(0, 5).forEach(function(r) {
    var init = initials(r.employee_name || r.name || "?");
    var isIn = r.checkin_time && !r.checkout_time;
    html += '<div class="card">'
      + '<div class="card-head">'
      + '<div class="avatar">' + init + '</div>'
      + '<div><div class="card-name">' + esc(r.employee_name || r.name || "—") + '</div>'
      + '<div class="card-sub">' + fmtDate(r.date) + '</div></div>'
      + '<span class="badge ' + (isIn ? "in" : "out") + '">' + (isIn ? "🟢 In" : "🔴 Out") + '</span>'
      + '</div>'
      + '<div class="info-grid">'
      + infoItem("Check-In",  r.checkin_time  || "—", r.checkin_time  ? "g" : "")
      + infoItem("Check-Out", r.checkout_time || "—", r.checkout_time ? "" : "o")
      + '</div>'
      + '</div>';
  });
  document.getElementById("todayCards").innerHTML = html;
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

  var query = "select=*&date=gte." + from + "&date=lte." + to + "&order=date.desc,checkin_time.desc";
  sbGet("attendance", query).then(function(rows) {
    allAttRows = rows || [];
    buildAttChips();
    activeAttEmp = "all";
    renderAttendance();
  }).catch(function() {
    document.getElementById("attCards").innerHTML = '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Data load nahi hua</div></div>';
  });
}

function buildAttChips() {
  var names = [];
  allAttRows.forEach(function(r) {
    var n = r.employee_name || r.name;
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
  var rows = activeAttEmp === "all" ? allAttRows : allAttRows.filter(function(r) { return (r.employee_name || r.name) === activeAttEmp; });

  var checkedIn = rows.filter(function(r) { return r.checkin_time && !r.checkout_time; }).length;
  var visits    = rows.filter(function(r) { return r.shop_name && r.shop_name !== "—"; }).length;
  var totalDist = rows.reduce(function(a, r) { return a + (parseFloat(r.distance) || 0); }, 0);

  document.getElementById("aTot").textContent  = rows.length;
  document.getElementById("aIn").textContent   = checkedIn;
  document.getElementById("aVis").textContent  = visits;
  document.getElementById("aDist").textContent = totalDist > 0 ? totalDist.toFixed(1) + " km" : "—";

  if (!rows.length) {
    document.getElementById("attCards").innerHTML = '<div class="empty"><span class="empty-ico">📭</span><div class="empty-txt">Is range mein koi data nahi</div></div>';
    return;
  }

  var html = "";
  rows.forEach(function(r) {
    var init  = initials(r.employee_name || r.name || "?");
    var isIn  = r.checkin_time && !r.checkout_time;
    var isOut = r.checkin_time && r.checkout_time;
    var bCls  = isIn ? "in" : (isOut ? "out" : "absent");
    var bTxt  = isIn ? "🟢 In" : (isOut ? "🔴 Out" : "⚪ —");

    html += '<div class="card">'
      + '<div class="card-head">'
      + '<div class="avatar">' + init + '</div>'
      + '<div><div class="card-name">' + esc(r.employee_name || r.name || "—") + '</div>'
      + '<div class="card-sub">' + fmtDate(r.date) + '</div></div>'
      + '<span class="badge ' + bCls + '">' + bTxt + '</span>'
      + '</div>'
      + '<div class="info-grid">'
      + infoItem("🕐 Check-In",  r.checkin_time  || "—", r.checkin_time  ? "g" : "")
      + infoItem("🕔 Check-Out", r.checkout_time || "—", r.checkout_time ? "" : "o")
      + infoItem("⏱ Duration",   r.duration      || "—", "")
      + infoItem("📏 Distance",  r.distance ? r.distance + " km" : "—", r.distance ? "g" : "")
      + '</div>'
      + (r.map_link ? '<a href="' + r.map_link + '" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:12px;font-weight:700;color:var(--accent2);border-top:1px solid var(--border);text-decoration:none;">🗺️ Location Dekho →</a>' : "")
      + '</div>';
  });
  document.getElementById("attCards").innerHTML = html;
}

function exportAttCSV() {
  var rows = activeAttEmp === "all" ? allAttRows : allAttRows.filter(function(r) { return (r.employee_name || r.name) === activeAttEmp; });
  if (!rows.length) { toast("Koi data nahi CSV ke liye", "err"); return; }
  var hdr = ["Name","Date","Check-In","Check-Out","Duration","Distance","Shop","Area","Map Link"];
  var data = rows.map(function(r) {
    return [r.employee_name||r.name, r.date, r.checkin_time, r.checkout_time, r.duration, r.distance, r.shop_name, r.area, r.map_link]
      .map(function(v) { return '"' + String(v || "").replace(/"/g, '""') + '"'; }).join(",");
  });
  downloadCSV([hdr.join(",")].concat(data).join("\n"), "NAMEFAME_Attendance_" + new Date().toISOString().split("T")[0]);
}

// ══════════════════════════════
// EMPLOYEES
// ══════════════════════════════
function loadEmployees() {
  document.getElementById("empListWrap").innerHTML = '<div class="loading"><div class="spin"></div>Loading...</div>';
  sbGet("employees", "select=*&order=name.asc")
    .then(function(rows) {
      allEmps = rows || [];
      document.getElementById("empSubLbl").textContent = allEmps.length + " employees";
      renderEmpList();
      populatePinSelect();
      populateVisitFilter();
    }).catch(function() {
      document.getElementById("empListWrap").innerHTML = '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Load nahi hua</div></div>';
    });
}

function renderEmpList() {
  if (!allEmps.length) {
    document.getElementById("empListWrap").innerHTML = '<div class="empty"><span class="empty-ico">👥</span><div class="empty-txt">Koi employee nahi</div></div>';
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
      + '</div>'
      + statusBadge
      + '</div>'
      + '<div class="info-grid">'
      + infoItem("📱 Contact", e.contact || "—", "")
      + infoItem("🔑 PIN", e.pin || "—", "")
      + infoItem("📍 District", e.district || "—", "")
      + infoItem("📅 Joining", fmtDate(e.joining_date) || "—", "")
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="card-action-btn accent" onclick="openEditEmployee(\'' + e.user_id + '\')">✏️ Edit</button>'
      + '<button class="card-action-btn ' + (e.employee_logout ? "success" : "danger") + '" onclick="toggleEmpLogout(\'' + e.user_id + '\',' + e.employee_logout + ',\'' + esc(e.name) + '\')">' + (e.employee_logout ? "🔓 Unlock" : "🔒 Lock") + '</button>'
      + '<button class="card-action-btn danger" onclick="deleteEmployee(\'' + e.user_id + '\',\'' + esc(e.name) + '\')">🗑 Delete</button>'
      + '</div>'
      + '</div>';
  });
  document.getElementById("empListWrap").innerHTML = html;
}

function openAddEmployee() {
  document.getElementById("empModalTitle").textContent = "➕ Employee Add Karo";
  ["mEmpName","mEmpId","mEmpPin","mEmpContact","mEmpDesig","mEmpDistrict","mEmpState","mEmpAddress"].forEach(function(id) {
    document.getElementById(id).value = "";
  });
  document.getElementById("mEmpJoining").value = "";
  document.getElementById("mEmpId_hidden").value = "";
  openModal("empModal");
}

function openEditEmployee(uid) {
  var e = allEmps.find(function(x) { return x.user_id === uid; });
  if (!e) return;
  document.getElementById("empModalTitle").textContent = "✏️ Employee Edit Karo";
  document.getElementById("mEmpName").value    = e.name || "";
  document.getElementById("mEmpId").value      = e.emp_id || "";
  document.getElementById("mEmpPin").value     = e.pin || "";
  document.getElementById("mEmpContact").value = e.contact || "";
  document.getElementById("mEmpDesig").value   = e.designation || "";
  document.getElementById("mEmpDistrict").value= e.district || "";
  document.getElementById("mEmpState").value   = e.state || "";
  document.getElementById("mEmpAddress").value = e.address || "";
  document.getElementById("mEmpJoining").value = e.joining_date ? e.joining_date.split("T")[0] : "";
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

  var payload = { name: name, emp_id: empId, pin: pin, contact: contact, designation: desig, district: dist, state: state, address: addr };
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

// ══════════════════════════════
// ROUTES
// ══════════════════════════════
function loadRoutes() {
  document.getElementById("routeTableWrap").innerHTML = '<div class="loading"><div class="spin"></div>Loading...</div>';
  sbGet("routes", "select=*&order=state.asc,district.asc,working_route.asc")
    .then(function(rows) {
      allRoutes = rows || [];
      document.getElementById("routeSubLbl").textContent = allRoutes.length + " routes";
      renderRouteTable(allRoutes);
    }).catch(function() {
      document.getElementById("routeTableWrap").innerHTML = '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Load nahi hua</div></div>';
    });
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
    document.getElementById("routeTableWrap").innerHTML = '<div class="empty"><span class="empty-ico">🗺️</span><div class="empty-txt">Koi route nahi</div></div>';
    return;
  }
  var html = '<div class="tbl-wrap"><table>'
    + '<thead><tr><th>State</th><th>District</th><th>Route</th><th>Area</th><th>Shop</th><th>Shopkeeper</th><th>Contact</th><th>Actions</th></tr></thead><tbody>';
  routes.forEach(function(r) {
    html += '<tr>'
      + '<td class="tbl-name">' + esc(r.state || "—") + '</td>'
      + '<td>' + esc(r.district || "—") + '</td>'
      + '<td>' + esc(r.working_route || "—") + '</td>'
      + '<td>' + esc(r.area || "—") + '</td>'
      + '<td>' + esc(r.shop || "—") + '</td>'
      + '<td>' + esc(r.shopkeeper_name || "—") + '</td>'
      + '<td>' + esc(r.shopkeeper_contact || "—") + '</td>'
      + '<td><div class="tbl-actions">'
      + '<button class="btn-tbl edit" onclick="openEditRoute(\'' + r.id + '\')">✏️</button>'
      + '<button class="btn-tbl del" onclick="deleteRoute(\'' + r.id + '\',\'' + esc(r.working_route || r.area || "Route") + '\')">🗑</button>'
      + '</div></td>'
      + '</tr>';
  });
  html += '</tbody></table></div>';
  document.getElementById("routeTableWrap").innerHTML = html;
}

function openAddRoute() {
  document.getElementById("routeModalTitle").textContent = "➕ Route Add Karo";
  ["mRState","mRDistrict","mRRoute","mRArea","mRShop","mRKeeper","mRKContact"].forEach(function(id) {
    document.getElementById(id).value = "";
  });
  document.getElementById("mRId").value = "";
  openModal("routeModal");
}

function openEditRoute(id) {
  var r = allRoutes.find(function(x) { return x.id === id; });
  if (!r) return;
  document.getElementById("routeModalTitle").textContent = "✏️ Route Edit Karo";
  document.getElementById("mRState").value    = r.state || "";
  document.getElementById("mRDistrict").value = r.district || "";
  document.getElementById("mRRoute").value    = r.working_route || "";
  document.getElementById("mRArea").value     = r.area || "";
  document.getElementById("mRShop").value     = r.shop || "";
  document.getElementById("mRKeeper").value   = r.shopkeeper_name || "";
  document.getElementById("mRKContact").value = r.shopkeeper_contact || "";
  document.getElementById("mRId").value = id;
  openModal("routeModal");
}

function saveRoute() {
  var state   = document.getElementById("mRState").value.trim();
  var dist    = document.getElementById("mRDistrict").value.trim();
  var route   = document.getElementById("mRRoute").value.trim();
  var area    = document.getElementById("mRArea").value.trim();
  var shop    = document.getElementById("mRShop").value.trim();
  var keeper  = document.getElementById("mRKeeper").value.trim();
  var kc      = document.getElementById("mRKContact").value.trim();
  var id      = document.getElementById("mRId").value;

  if (!state || !dist || !route || !area) { toast("State, District, Route, Area zaroori hai", "err"); return; }

  var payload = { state: state, district: dist, working_route: route, area: area, shop: shop, shopkeeper_name: keeper, shopkeeper_contact: kc };

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

// ══════════════════════════════
// VISITS
// ══════════════════════════════
function loadVisits() {
  var from   = document.getElementById("visFrom").value;
  var to     = document.getElementById("visTo").value;
  var empFil = document.getElementById("visEmpFilter").value;
  if (!from || !to) { toast("Date range select karo", "err"); return; }

  document.getElementById("visitTableWrap").innerHTML = '<div class="loading"><div class="spin"></div>Loading...</div>';
  document.getElementById("visitSubLbl").textContent = from + " → " + to;

  var query = "select=*&visit_date=gte." + from + "&visit_date=lte." + to + "&order=visit_date.desc,visit_in_time.desc";
  if (empFil) query += "&employee_name=eq." + encodeURIComponent(empFil);

  sbGet("visits", query).then(function(rows) {
    allVisits = rows || [];
    populateVisitFilter();
    renderVisitsTable(allVisits);
  }).catch(function() {
    document.getElementById("visitTableWrap").innerHTML = '<div class="empty"><span class="empty-ico">⚠️</span><div class="empty-txt">Load nahi hua</div></div>';
  });
}

function populateVisitFilter() {
  var sel = document.getElementById("visEmpFilter");
  if (!sel) return;
  var cur = sel.value;
  var names = [];
  allEmps.forEach(function(e) { if (e.name) names.push(e.name); });
  sel.innerHTML = '<option value="">👥 Sab Employees</option>';
  names.forEach(function(n) {
    sel.innerHTML += '<option value="' + esc(n) + '" ' + (cur === n ? "selected" : "") + '>' + esc(n) + '</option>';
  });
}

function renderVisitsTable(visits) {
  if (!visits.length) {
    document.getElementById("visitTableWrap").innerHTML = '<div class="empty"><span class="empty-ico">🏪</span><div class="empty-txt">Koi visit nahi</div></div>';
    return;
  }
  var html = '<div class="visit-table-wrap"><div class="tbl-wrap"><table>'
    + '<thead><tr><th>Date</th><th>Employee</th><th>Area</th><th>Shop</th><th>In</th><th>Out</th><th>Rating</th><th>Map</th></tr></thead><tbody>';
  visits.forEach(function(v) {
    var ratingStars = v.rating ? "⭐".repeat(Math.min(v.rating, 5)) : "—";
    html += '<tr>'
      + '<td>' + fmtDate(v.visit_date) + '</td>'
      + '<td class="tbl-name">' + esc(v.employee_name || "—") + '</td>'
      + '<td>' + esc(v.area || "—") + '</td>'
      + '<td>' + esc(v.shop_name || "—") + '</td>'
      + '<td class="info-val g">' + esc(v.visit_in_time || "—") + '</td>'
      + '<td>' + esc(v.visit_out_time || "—") + '</td>'
      + '<td>' + ratingStars + '</td>'
      + '<td>' + (v.map_link ? '<a href="' + v.map_link + '" target="_blank" style="color:var(--accent2);font-size:16px;">📍</a>' : "—") + '</td>'
      + '</tr>';
  });
  html += '</tbody></table></div></div>';
  document.getElementById("visitTableWrap").innerHTML = html;
}

function exportVisitsCSV() {
  if (!allVisits.length) { toast("Koi data nahi", "err"); return; }
  var hdr = ["Date","Employee","Contact","Area","Shop","Shopkeeper","Shopkeeper Contact","Visit In","Visit Out","Hold Time","Notes","Rating","Map Link"];
  var data = allVisits.map(function(v) {
    return [v.visit_date, v.employee_name, v.employee_contact, v.area, v.shop_name, v.shopkeeper_name, v.shopkeeper_contact, v.visit_in_time, v.visit_out_time, v.hold_time, v.visit_out_notes, v.rating, v.map_link]
      .map(function(x) { return '"' + String(x || "").replace(/"/g, '""') + '"'; }).join(",");
  });
  downloadCSV([hdr.join(",")].concat(data).join("\n"), "NAMEFAME_Visits_" + new Date().toISOString().split("T")[0]);
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
      document.getElementById("empLogoutToggles").innerHTML = '<div class="empty">⚠️ Load nahi hua</div>';
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
      + '<div class="toggle-sub">' + (e.employee_logout ? "🔒 Locked — Login disabled" : "✅ Active — Login allowed") + '</div>'
      + '</div>'
      + '<label class="toggle-sw">'
      + '<input type="checkbox" ' + (e.employee_logout ? "checked" : "") + ' onchange="toggleLogoutDirect(\'' + e.user_id + '\',\'' + esc(e.name) + '\',this)">'
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
      // Update local state
      var emp = allEmps.find(function(e) { return e.user_id === uid; });
      if (emp) emp.employee_logout = newState;
      // Re-render subtitles
      renderEmpLogoutToggles();
    }).catch(function() {
      el.checked = !newState; // revert
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
function openModal(id) { document.getElementById(id).classList.add("show"); }
function closeModal(id) { document.getElementById(id).classList.remove("show"); }

// Close modal on overlay click
document.querySelectorAll && document.addEventListener("DOMContentLoaded", function() {
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
  document.getElementById("confirmMsg").textContent = msg;
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
// MISC HELPERS
// ══════════════════════════════
function setToday(fromId, toId) {
  var t = new Date().toISOString().split("T")[0];
  document.getElementById(fromId).value = t;
  document.getElementById(toId).value   = t;
}

function togglePw(inputId, btn) {
  var inp = document.getElementById(inputId);
  inp.type = inp.type === "password" ? "text" : "password";
  btn.textContent = inp.type === "password" ? "👁" : "🙈";
}

function infoItem(lbl, val, cls) {
  return '<div class="info-item"><div class="info-lbl">' + lbl + '</div><div class="info-val ' + (cls || "") + '">' + val + '</div></div>';
}

function initials(name) {
  return String(name || "?").split(" ").map(function(w) { return w[0] || ""; }).join("").toUpperCase().slice(0, 2);
}

function fmtDate(v) {
  if (!v) return "—";
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return String(v);
  return d.getDate().toString().padStart(2, "0") + "-" + (d.getMonth() + 1).toString().padStart(2, "0") + "-" + d.getFullYear();
}

function fmtDateLong(d) {
  var days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

var _tt = null;
function toast(msg, type) {
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = "toast show" + (type ? " " + type : "");
  if (_tt) clearTimeout(_tt);
  _tt = setTimeout(function() { el.classList.remove("show"); }, 3200);
}

function downloadCSV(csv, filename) {
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast("CSV download ho raha hai ✓", "ok");
}

// ══════════════════════════════
// AUTO LOGIN CHECK
// ══════════════════════════════
if (sessionStorage.getItem("nf_admin") === "1") {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "block";
  initApp();
}
