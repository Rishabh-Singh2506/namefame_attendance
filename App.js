"use strict";

/* ===========================
   SUPABASE CONFIG
=========================== */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://qhikqbrfojdlmdwsdota.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoaWtxYnJmb2pkbG1kd3Nkb3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjcxMDgsImV4cCI6MjA5MDMwMzEwOH0.lYiBLoXPdNO_kfilcbX-OfbvJcXsjM841HG2ffwQT3Y";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ===========================
   GLOBAL STATE
=========================== */

let currentEmp = null;

/* ===========================
   TOAST
=========================== */

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = msg;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 3000);
}

/* ===========================
   SCREEN SWITCH
=========================== */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
  });

  document.getElementById(id).classList.add("active");
}

/* ===========================
   LOAD EMPLOYEES
=========================== */

async function loadEmployees() {

  const select = document.getElementById("empSelect");

  select.innerHTML =
    '<option value="">-- Naam chunein --</option>';

  const { data, error } =
    await supabase
      .from("employees")
      .select("*");

  if (error) {
    toast("Employee load error");
    return;
  }

  data.forEach(emp => {

    const opt =
      document.createElement("option");

    opt.value = emp.emp_id;
    opt.textContent =
      emp.name + " (" + emp.emp_id + ")";

    select.appendChild(opt);

  });

}

/* ===========================
   LOGIN
=========================== */

async function doLogin() {

  const empId =
    document
      .getElementById("empSelect")
      .value;

  const pin =
    document
      .getElementById("pinInput")
      .value;

  if (!empId) {
    toast("Naam select karo");
    return;
  }

  const { data, error } =
    await supabase
      .from("employees")
      .select("*")
      .eq("emp_id", empId)
      .single();

  if (error || !data) {
    toast("Employee not found");
    return;
  }

  if (String(data.pin) !== String(pin)) {
    toast("Wrong PIN");
    return;
  }

  currentEmp = data;

  localStorage.setItem(
    "emp",
    JSON.stringify(data)
  );

  document.getElementById(
    "dashName"
  ).textContent = data.name;

  showScreen("s-dash");

}

/* ===========================
   CHECK-IN
=========================== */

async function doCheckin() {

  if (!currentEmp) {
    toast("Login karo");
    return;
  }

  const now =
    new Date().toISOString();

  const { error } =
    await supabase
      .from("attendance")
      .insert([
        {
          emp_id:
            currentEmp.emp_id,
          checkin_time: now
        }
      ]);

  if (error) {
    toast("Check-in error");
    return;
  }

  toast("Check-in ho gaya");

}

/* ===========================
   CHECK-OUT
=========================== */

async function doCheckout() {

  if (!currentEmp) return;

  const now =
    new Date().toISOString();

  const { data } =
    await supabase
      .from("attendance")
      .select("*")
      .eq(
        "emp_id",
        currentEmp.emp_id
      )
      .is(
        "checkout_time",
        null
      )
      .single();

  if (!data) {
    toast("No active check-in");
    return;
  }

  const { error } =
    await supabase
      .from("attendance")
      .update({
        checkout_time: now
      })
      .eq("id", data.id);

  if (error) {
    toast("Checkout error");
    return;
  }

  toast("Check-out done");

}

/* ===========================
   NEW VISIT
=========================== */

async function saveVisit() {

  if (!currentEmp) return;

  const shop =
    document
      .getElementById(
        "mShopName"
      )
      .value;

  const area =
    document
      .getElementById(
        "mArea"
      )
      .value;

  if (!shop) {
    toast("Shop name daalo");
    return;
  }

  const { error } =
    await supabase
      .from("visits")
      .insert([
        {
          emp_id:
            currentEmp.emp_id,
          shop_name: shop,
          area: area,
          visit_time:
            new Date()
        }
      ]);

  if (error) {
    toast("Visit save error");
    return;
  }

  toast("Visit saved");

}

/* ===========================
   START
=========================== */

window.addEventListener(
  "load",
  () => {

    const emp =
      localStorage.getItem("emp");

    if (emp) {

      currentEmp =
        JSON.parse(emp);

      document.getElementById(
        "dashName"
      ).textContent =
        currentEmp.name;

      showScreen("s-dash");

    }

    loadEmployees();

  }
);

/* ===========================
   GLOBAL
=========================== */

window.showScreen = showScreen;
window.doLogin = doLogin;
window.doCheckin = doCheckin;
window.doCheckout = doCheckout;
window.saveVisit = saveVisit;
window.loadEmployees = loadEmployees;
window.goVerify = () => {
  showScreen("s-verify");
  loadEmployees();
};
window.doLogout = () => {
  localStorage.removeItem("emp");
  location.reload();
};
