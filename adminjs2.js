/* ===== ROUTE SYSTEM V2 ===== */

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
