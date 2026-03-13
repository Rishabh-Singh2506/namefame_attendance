/* ===== ROUTE SYSTEM V2 ===== */

  
    // ══ CONFIG ══
    var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxWP-kxYkyBl0DhgmiK7DZuXzUug-UYJv4Z7D-N5AstUIh9gdjrByVXJ-vGJBOdNYz/exec";

    const store = {
      set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
      get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
      del: (k) => { try { localStorage.removeItem(k); } catch (e) { } }
    };

    async function apiPost(payload) {
      try {
        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        return res.json();
      } catch (e) {
        console.error("API Error:", e);
        return { status: "error", message: e.message };
      }
    }

    function toast(msg, type = "info") {
      const el = document.getElementById("toast");
      el.textContent = msg; el.className = "toast " + type + " show";
      setTimeout(() => el.classList.remove("show"), 4000);
    }

    function toggleEye(id, btn) {
      var inp = document.getElementById(id);
      if (inp.type === "password") {
        inp.type = "text";
        btn.textContent = "🙈";
      } else {
        inp.type = "password";
        btn.textContent = "👁️";
      }
    }

    function fmtDate(val) {
      if (!val) return "";
      let d;
      if (val instanceof Date) { d = val; }
      else if (typeof val === 'string') {
        const m1 = val.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m1) d = new Date(+m1[1], +m1[2] - 1, +m1[3]);
        const m2 = val.match(/^(\d{2})-(\d{2})-(\d{4})/); if (!d && m2) d = new Date(+m2[3], +m2[2] - 1, +m2[1]);
      }
      if (!d || isNaN(d)) return String(val);
      return d.getDate() + "-" + (d.getMonth() + 1) + "-" + d.getFullYear();
    }

    function fmtTime(val) {
      if (!val) return "";
      const s = String(val);
      const full = s.match(/\d{2}-\d{2}-\d{4}\s+(\d{2}):(\d{2})/);
      if (full) { let h = parseInt(full[1]), mn = parseInt(full[2]); const ampm = h >= 12 ? "PM" : "AM"; const h12 = h % 12 || 12; return h12 + ":" + String(mn).padStart(2, "0") + " " + ampm; }
      const m = s.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
      if (!m) return s;
      let h = +m[1], mn = +m[2];
      if (m[3] && m[3].toUpperCase() === "PM" && h < 12) h += 12;
      if (m[3] && m[3].toUpperCase() === "AM" && h === 12) h = 0;
      const ampm = h >= 12 ? "PM" : "AM"; const h12 = h % 12 || 12;
      return h12 + ":" + String(mn).padStart(2, "0") + " " + ampm;
    }

    // ══ LOGIN ══
    function doLogin() {
      var user = document.getElementById("lUser").value.trim();
      var pass = document.getElementById("lPass").value;
      var err = document.getElementById("loginErr"), btn = document.getElementById("loginBtn");
      if (!user || !pass) { err.textContent = "Username aur password darj karo"; err.classList.add("show"); return; }
      err.classList.remove("show");
      btn.classList.add("loading"); btn.textContent = "Logging in...";
      apiPost({ action: "admin_login", user, pass }).then(r => {
        btn.classList.remove("loading"); btn.textContent = "Login →";
        if (r.status === "success") {
          const adminSession = { user, token: r.token, t: Date.now() };
          store.set("adminSess", adminSession);
          startApp(adminSession);
        }
        else { err.textContent = r.message || "Galat credentials"; err.classList.add("show"); }
      }).catch(e => { btn.classList.remove("loading"); btn.textContent = "Login →"; err.textContent = "Server error"; err.classList.add("show"); });
    }

    function doLogout() { store.del("adminSess"); document.getElementById("appWrap").style.display = "none"; document.getElementById("loginWrap").style.display = "flex"; }

    // ══ APP START ══
    function startApp(sess) {
      document.getElementById("loginWrap").style.display = "none";
      document.getElementById("appWrap").style.display = "flex";
      document.getElementById("adminUserLbl").textContent = sess.user;
      loadEmployees();
      setDefaultDates();
    }

    function setDefaultDates() {
      var today = new Date().toISOString().split("T")[0];
      document.getElementById("att-from").value = today;
      document.getElementById("att-to").value = today;
      document.getElementById("rt-date").value = today;
    }

    // ══ TAB SWITCH ══
    function switchTab(name, el) {
      document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
      document.querySelectorAll(".desk-nav-item,.mob-nav-item").forEach(i => i.classList.remove("active"));
      document.getElementById("tab-" + name).classList.add("active");
      if (el) el.classList.add("active");
    }

    // ══ EMPLOYEES ══
    function loadEmployees() {
      apiPost({ action: "get_employees" }).then(r => {
        if (r.employees) {
          renderEmployees(r.employees);
          populateEmpSelects(r.employees);
        }
      });
    }

    function renderEmployees(emps) {
      var grid = document.getElementById("emp-grid"); grid.innerHTML = "";
      emps.forEach(e => {
        var card = document.createElement("div"); card.className = "emp-card";
        card.innerHTML = `
      <div class="emp-name">${e.name}</div>
      <div class="emp-meta">${e.designation || "--"} | ${e.contact || "--"}</div>
      <div class="emp-actions">
        <button class="emp-btn edit" onclick='openEmpModal(${JSON.stringify(e)})'>✏️ Edit</button>
        <button class="emp-btn del" onclick="deleteEmp('${e.name}')">🗑️ Delete</button>
      </div>
    `;
        grid.appendChild(card);
      });
    }

    function populateEmpSelects(emps) {
      var sel = document.getElementById("att-emp");
      var cur = sel.value;
      sel.innerHTML = '<option value="">All employees</option>';
      emps.forEach(e => { var o = document.createElement("option"); o.value = e.name; o.textContent = e.name; sel.appendChild(o); });
      sel.value = cur;
    }

    function openEmpModal(emp) {
      document.getElementById("empModalTitle").textContent = emp ? "Edit Employee" : "Add Employee";
      document.getElementById("empOldName").value = emp ? emp.name : "";
      document.getElementById("emName").value = emp ? emp.name : "";
      document.getElementById("emPin").value = emp ? emp.pin : "";
      document.getElementById("emContact").value = emp ? emp.contact : "";
      document.getElementById("emDesig").value = emp ? (emp.designation || "") : "";
      document.getElementById("empModal").classList.add("show");
    }

    function closeEmpModal() { document.getElementById("empModal").classList.remove("show"); }

    function saveEmployee() {
      var name = document.getElementById("emName").value.trim();
      var pin = document.getElementById("emPin").value.trim();
      var contact = document.getElementById("emContact").value.trim();
      var desig = document.getElementById("emDesig").value.trim();
      var oldName = document.getElementById("empOldName").value;

      if (!name || !pin || !contact) { toast("Name, PIN, Contact zaroori hai", "error"); return; }
      if (contact.length !== 10) { toast("10 digit contact darj karo", "error"); return; }

      var payload = oldName
        ? { action: "update_employee", oldName, name, pin, contact, designation: desig }
        : { action: "add_employee", name, pin, contact, designation: desig };

      apiPost(payload).then(r => {
        if (r.status === "success") { toast("Saved ✓", "success"); closeEmpModal(); loadEmployees(); }
        else toast(r.message || "Error", "error");
      });
    }

    function deleteEmp(name) {
      if (!confirm(name + " ko delete karna chahte ho?")) return;
      apiPost({ action: "delete_employee", name }).then(r => {
        if (r.status === "success") { toast("Deleted ✓", "success"); loadEmployees(); }
        else toast(r.message || "Error", "error");
      });
    }

    // ══ ATTENDANCE ══
    function loadAttendance() {
      var from = document.getElementById("att-from").value;
      var to = document.getElementById("att-to").value;
      var emp = document.getElementById("att-emp").value;
      var tbody = document.getElementById("att-tbody");
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">Loading...</td></tr>';

      apiPost({ action: "get_sheet_range", dateFrom: from, dateTo: to, empName: emp }).then(r => {
        if (!r.rows) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">No data</td></tr>'; return; }
        var rows = [...r.rows].reverse();
        document.getElementById("att-count").textContent = "(" + rows.length + " records)";
        tbody.innerHTML = "";
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">Koi data nahi</td></tr>'; return; }
        rows.forEach((row, i) => {
          var tr = document.createElement("tr");
          var badge = row.checkoutTime ? '<span class="badge red">Out</span>' : '<span class="badge green">In</span>';
          tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${fmtDate(row.date)}</td>
        <td><strong>${row.empName}</strong></td>
        <td>${fmtTime(row.checkinTime)}</td>
        <td>${row.checkoutTime ? fmtTime(row.checkoutTime) : "--"}</td>
        <td>${row.duration || "--"}</td>
        <td>${row.shopName || row.area || "--"}</td>
        <td>${badge}</td>
      `;
          tbody.appendChild(tr);
        });
      });
    }

    // ══ SETTINGS ══
    function changePass() {
      var oldU = document.getElementById("sOldUser").value.trim();
      var oldP = document.getElementById("sOldPass").value;
      var newU = document.getElementById("sNewUser").value.trim();
      var newP = document.getElementById("sNewPass").value;
      if (!oldU || !oldP || !newU || !newP) { toast("Sab fields bharein", "error"); return; }
      apiPost({ action: "admin_change_pass", currentUser: oldU, currentPass: oldP, newUser: newU, newPass: newP })
        .then(r => { if (r.status === "success") { toast("Password changed. Dobara login karo.", "success"); setTimeout(doLogout, 2000); } else toast(r.message || "Error", "error"); });
    }

    function testConnection() {
      var resultDiv = document.getElementById("test-result");
      resultDiv.innerHTML = '<div style="color:var(--muted);font-weight:600;">Testing...</div>';
      apiPost({ action: "get_employees" }).then(r => {
        if (r.status === "success") {
          resultDiv.innerHTML = '<div class="badge green" style="display:inline-block;padding:8px 12px;">✓ API Connection successful! Found ' + ((r.employees || []).length) + ' employees.</div>';
        } else {
          resultDiv.innerHTML = '<div class="badge red" style="display:inline-block;padding:8px 12px;">✗ Error: ' + (r.message || "Unknown error") + '</div>';
        }
      });
    }

    // ══ INIT ══
    (function init() {
      var sess = store.get("adminSess");
      if (sess && sess.t && (Date.now() - sess.t) < 8 * 3600 * 1000) { startApp(sess); }
    })();


async function loadEmployees(){

const res = await apiPost({
action:"get_employees"
})

const sel = document.getElementById("rt-emp")

(res.employees || []).forEach(e=>{

const opt = document.createElement("option")
opt.value = e
opt.textContent = e

sel.appendChild(opt)

})

}


/* LOAD ROUTE */

async function loadRoute(){

const emp = document.getElementById("rt-emp").value
const date = document.getElementById("rt-date").value
const map = document.getElementById("routeMap")

if(!emp || !date){
alert("Employee aur date select karo")
return
}

map.innerHTML='<div class="route-loading">Loading route...</div>'

try{

const routeRes = await apiPost({action:"get_route",name:emp,date:date})
const sheetRes = await apiPost({action:"get_sheet_range",dateFrom:date,dateTo:date,empName:emp})

const gpsPoints = routeRes.route || []
const visitRows = sheetRes.rows || []

if(!gpsPoints.length && !visitRows.length){
map.innerHTML='<div class="route-empty">No location data</div>'
return
}

let events=[]

/* GPS EVENTS */

gpsPoints.forEach(p=>{
events.push({
type:"tracking",
time:p.time,
lat:parseFloat(p.lat),
lng:parseFloat(p.lng)
})
})

/* VISIT EVENTS */

visitRows.forEach(v=>{
events.push({
type:"visit",
time:v.checkinTime,
area:v.shopName || v.area || "",
checkout:v.checkoutTime
})
})

/* SORT EVENTS */

events.sort((a,b)=>{
return timeToMin(a.time) - timeToMin(b.time)
})

/* DISTANCE */

let totalM = 0

for(let i=1;i<gpsPoints.length;i++){

let p1 = gpsPoints[i-1]
let p2 = gpsPoints[i]

totalM += haversine(
parseFloat(p1.lat),
parseFloat(p1.lng),
parseFloat(p2.lat),
parseFloat(p2.lng)
)

}

let distStr =
totalM < 1000 ?
Math.round(totalM)+" m" :
(totalM/1000).toFixed(2)+" km"


/* RENDER */

let html=''

html+=`
<div class="dist-summary">

<div>
<div class="dist-summary-lbl">Distance</div>
<div class="dist-summary-val">${distStr}</div>
</div>

<div>
<div class="dist-summary-lbl">GPS Points</div>
<div class="dist-summary-val">${gpsPoints.length}</div>
</div>

<div>
<div class="dist-summary-lbl">Visits</div>
<div class="dist-summary-val">${visitRows.length}</div>
</div>

</div>
`

events.forEach((ev,i)=>{

let dot="tracking"
let label="GPS Ping"

if(ev.type==="visit"){
dot="visit"
label="Visit: "+ev.area
}

html+=`
<div class="route-stop">

<div class="route-dot ${dot}"></div>

<div style="flex:1">

<div class="route-place">${label}</div>

<div class="route-time">${fmtTime(ev.time)||"--"}</div>

${ev.area?`<span class="route-area">${ev.area}</span>`:""}

${ev.lat?`<a class="route-map-btn" target="_blank"
href="https://maps.google.com/?q=${ev.lat},${ev.lng}">
Open Map
</a>`:""}

</div>

</div>
`

if(i<events.length-1)
html+='<div class="route-line"></div>'

})

map.innerHTML = html

}

catch(e){

map.innerHTML='<div class="route-empty">Route load error</div>'
console.error(e)

}

}


/* TIME PARSER */

function timeToMin(str){

if(!str) return 0

let m=str.match(/(\d+):(\d+)/)

if(!m) return 0

return parseInt(m[1])*60+parseInt(m[2])

}


/* DISTANCE */

function haversine(lat1,lon1,lat2,lon2){

const R=6371000

const dLat=(lat2-lat1)*Math.PI/180
const dLon=(lon2-lon1)*Math.PI/180

const a=
Math.sin(dLat/2)**2+
Math.cos(lat1*Math.PI/180)*
Math.cos(lat2*Math.PI/180)*
Math.sin(dLon/2)**2

return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

}
