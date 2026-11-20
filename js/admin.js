// Admin: dashboard (profit/loss), orders, users, stock.
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, increment, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ADMIN_EMAILS } from "./config.js";

const $ = id => document.getElementById(id);
const say = (t, ok = false) => { $("msg").textContent = t; $("msg").className = "msg" + (ok ? " ok" : ""); };
const gsay = t => { $("gmsg").textContent = t; };
const fmt = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const when = t => t?.toDate ? t.toDate().toLocaleString("en-IN") : "-";
const STATUSES = ["new", "shipped", "delivered", "cancelled"];
let products = [], orders = [], users = [], expenses = [], cats = [], reqs = [];

onAuthStateChanged(auth, user => {
  if (!user) { location.href = "login.html?next=admin.html"; return; }
  if (!ADMIN_EMAILS.includes(user.email)) {
    $("gate").textContent = "This page is only for the store admin. You are logged in as " + user.email + ".";
    $("panel").hidden = true; return;
  }
  $("gate").hidden = true; $("panel").hidden = false;
  loadAll();
  cleanPresence(); refreshOnline(); setInterval(refreshOnline, 20000);
});
$("logout").onclick = () => signOut(auth).then(() => { location.href = "index.html"; });

$("tabs").onclick = e => {
  const t = e.target.dataset.tab; if (!t) return;
  document.querySelectorAll("#tabs .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === t));
  ["dash", "orders", "users", "reqs", "stock", "cats"].forEach(n => { $("tab-" + n).hidden = n !== t; });
};

async function load(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function loadAll() {
  gsay("");
  try {
    [products, orders, users, expenses, cats, reqs] = await Promise.all(["products", "orders", "users", "expenses", "categories", "requests"].map(load));
  } catch (err) {
    console.error(err);
    gsay(err.message.includes("permission") ? "Permission denied. Update your Firestore rules (admin must read orders, users, expenses)." : err.message);
  }
  render();
}

const live = () => orders.filter(o => o.status !== "cancelled" && o.returnStatus !== "refunded");
const sold = id => live().reduce((n, o) => n + (o.items || []).filter(i => i.id === id).reduce((m, i) => m + i.qty, 0), 0);

function render() {
  renderLive();
  // Dashboard
  const revenue = live().reduce((n, o) => n + (o.total || 0), 0);
  const cogs = live().reduce((n, o) => n + (o.items || []).reduce((m, i) => m + (i.cost ?? products.find(p => p.id === i.id)?.cost ?? 0) * i.qty, 0), 0);
  const exp = expenses.reduce((n, e) => n + (e.amount || 0), 0);
  const gross = revenue - cogs, net = gross - exp;
  const stockVal = products.reduce((n, p) => n + Math.max(0, (p.stock || 0) - sold(p.id)) * (p.cost || 0), 0);
  const stat = (l, v, cls = "") => `<div class="stat ${cls}"><span class="meta">${l}</span><b>${v}</b></div>`;
  $("stats").innerHTML = stat("Revenue", fmt(revenue)) + stat("Cost of goods sold", fmt(cogs)) + stat("Gross profit", fmt(gross), gross >= 0 ? "good" : "bad") +
    stat("Expenses", fmt(exp)) + stat(net >= 0 ? "Net profit" : "Net loss", fmt(Math.abs(net)), net >= 0 ? "good" : "bad") +
    stat("Stock value (at cost)", fmt(stockVal)) + stat("Orders", live().length + " / " + orders.length) + stat("Users", users.length) +
    stat("Payments received", fmt(live().filter(o => o.paymentStatus === "paid").reduce((n, o) => n + (o.total || 0), 0))) +
    stat("Returns pending", orders.filter(o => o.returnStatus === "requested").length, orders.some(o => o.returnStatus === "requested") ? "bad" : "") +
    stat("New customers (7 days)", users.filter(u => Date.now() - (u.createdAt?.seconds || 0) * 1000 < 7 * 864e5).length) +
    stat("Open requests", reqs.filter(r => r.status !== "resolved").length, reqs.some(r => r.status === "open") ? "bad" : "");
  $("expList").innerHTML = `<tr><th>Date</th><th>Description</th><th>Amount</th><th></th></tr>` + (expenses.length ? expenses.map(e =>
    `<tr><td>${when(e.createdAt)}</td><td>${esc(e.desc)}</td><td>${fmt(e.amount)}</td><td><button class="btn sm white" data-delexp="${e.id}">Delete</button></td></tr>`).join("") : `<tr><td colspan="4">No expenses yet.</td></tr>`);

  // Orders
  const os = [...orders].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const opt = (list, cur) => list.map(s => `<option${s === cur ? " selected" : ""}>${s}</option>`).join("");
  $("orderList").innerHTML = `<tr><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Return</th></tr>` + (os.length ? os.map(o =>
    `<tr><td>${when(o.createdAt)}</td><td>${esc(o.name || "")}<br>${esc(o.email || "")}<br>${esc(o.phone || "")}<br>${esc(o.address || "")}</td>
    <td>${(o.items || []).map(i => `${esc(i.name)} (${esc(i.size)}) ×${i.qty}`).join("<br>")}</td><td>${fmt(o.total)}</td>
    <td>${esc((o.paymentMethod || "-").toUpperCase())}<br>${esc(o.paymentRef || "")}<br><select data-pay="${o.id}">${opt(["pending", "paid", "failed"], o.paymentStatus || "pending")}</select></td>
    <td><select data-status="${o.id}">${opt(STATUSES, o.status)}</select></td>
    <td>${o.returnStatus ? `${esc(o.returnReason || "")}<br><select data-ret="${o.id}">${opt(["requested", "approved", "rejected", "refunded"], o.returnStatus)}</select>` : "-"}</td></tr>`).join("") : `<tr><td colspan="7">No orders yet.</td></tr>`);

  renderUsers(); renderReqs();

  // Stock
  const cur = $("cat").value;
  $("cat").innerHTML = cats.length ? cats.map(c => `<option>${esc(c.name)}</option>`).join("") : `<option value="">Add categories first</option>`;
  if (cur) $("cat").value = cur;
  $("catList").innerHTML = `<tr><th>Category</th><th>Products</th><th></th></tr>` + (cats.length ? cats.map(c =>
    `<tr><td>${esc(c.name)}</td><td>${products.filter(p => p.cat === c.name).length}</td><td><button class="btn sm white" data-delcat="${c.id}">Delete</button></td></tr>`).join("") : `<tr><td colspan="3">No categories yet.</td></tr>`);
  $("list").innerHTML = `<tr><th></th><th>Product</th><th>Photo size</th><th>Cost</th><th>Price</th><th>Stock in</th><th>Sold</th><th>Balance</th><th>Add stock</th><th></th></tr>` + (products.length ? products.map(p => {
    const s = sold(p.id), bal = (p.stock || 0) - s;
    return `<tr><td><div class="thumb" style="background:${esc(p.color || "#fff")}">${p.image ? `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover">` : ""}</div></td>
      <td><strong>${esc(p.name)}</strong><div class="meta">${esc(p.cat)}</div></td><td>${p.image ? fmtSize(p.image.length) : "-"}</td><td>${fmt(p.cost)}</td><td>${fmt(p.price)}</td><td>${p.stock || 0}</td><td>${s}</td>
      <td class="${bal <= 5 ? "low" : ""}">${bal}</td>
      <td><input type="number" min="1" id="add${p.id}" placeholder="qty"> <button class="btn sm pink" data-addstock="${p.id}">Add</button></td>
      <td><button class="btn sm white" data-del="${p.id}">Delete</button></td></tr>`;
  }).join("") : `<tr><td colspan="10">No products yet. Add your first one above.</td></tr>`);
}

// Photos are resized in the browser and saved inside the product document.
function compress(file, max = 700, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("That file isn't a valid image."));
    img.src = url;
  });
}
$("image").onchange = async e => {
  const f = e.target.files[0];
  if (!f) { $("preview").hidden = true; return; }
  try { $("preview").src = await compress(f); $("preview").hidden = false; }
  catch (err) { say(err.message); }
};
$("form").onsubmit = async e => {
  e.preventDefault();
  const file = $("image").files[0];
  if (!file) return say("Choose a photo first.");
  $("save").disabled = true; say("Saving...", true);
  try {
    const image = await compress(file);
    if (image.length > 900000) throw new Error("Photo is too large. Use a smaller image.");
    await addDoc(collection(db, "products"), {
      name: $("name").value.trim(), cat: $("cat").value.trim(),
      price: Number($("price").value), cost: Number($("cost").value), stock: Number($("stock").value),
      sizes: $("sizes").value.split(",").map(s => s.trim()).filter(Boolean),
      tag: $("tag").value.trim(), color: $("color").value, image, createdAt: serverTimestamp()
    });
    $("form").reset(); $("preview").hidden = true;
    say("Product added. It is live on the shop.", true);
    loadAll();
  } catch (err) {
    console.error(err);
    say(err.message.includes("permission") ? "Permission denied. Check your Firestore rules." : err.message);
  }
  $("save").disabled = false;
};

$("expForm").onsubmit = async e => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "expenses"), { desc: $("expDesc").value.trim(), amount: Number($("expAmt").value), createdAt: serverTimestamp() });
    $("expForm").reset(); loadAll();
  } catch (err) { gsay(err.message); }
};
document.addEventListener("click", async e => {
  const d = e.target.dataset || {};
  try {
    if (d.del && confirm("Delete this product?")) { await deleteDoc(doc(db, "products", d.del)); loadAll(); }
    if (d.delexp && confirm("Delete this expense?")) { await deleteDoc(doc(db, "expenses", d.delexp)); loadAll(); }
    if (d.delcat) {
      const c = cats.find(x => x.id === d.delcat);
      if (products.some(p => p.cat === c.name)) return gsay("Can't delete: products still use " + c.name + ".");
      if (confirm("Delete category " + c.name + "?")) { await deleteDoc(doc(db, "categories", d.delcat)); loadAll(); }
    }
    if (d.addstock) {
      const q = Number($("add" + d.addstock).value);
      if (!q) return gsay("Enter a quantity.");
      await updateDoc(doc(db, "products", d.addstock), { stock: increment(q) }); loadAll();
    }
  } catch (err) { gsay(err.message); }
});
document.addEventListener("change", async e => {
  const d = e.target.dataset || {}, v = e.target.value;
  const patch = d.req ? { status: v } : d.status ? { status: v, ...(v === "delivered" ? { deliveredAt: serverTimestamp() } : {}) } : d.pay ? { paymentStatus: v } : d.ret ? { returnStatus: v } : null;
  if (!patch) return;
  try { await updateDoc(doc(db, d.req ? "requests" : "orders", d.req || d.status || d.pay || d.ret), patch); loadAll(); }
  catch (err) { gsay(err.message); }
});
async function addCat(name) {
  if (cats.some(c => c.name.toLowerCase() === name.toLowerCase())) return;
  await addDoc(collection(db, "categories"), { name, order: Date.now() });
}
$("catForm").onsubmit = async e => {
  e.preventDefault();
  try { await addCat($("catName").value.trim()); $("catForm").reset(); loadAll(); } catch (err) { gsay(err.message); }
};
$("catDefaults").onclick = async () => {
  try { for (const n of ["Tees", "Bottoms", "Hoodies", "Jackets"]) await addCat(n); loadAll(); } catch (err) { gsay(err.message); }
};

// ---- Customers & requests ----
const phoneOf = u => u.phone || u.phoneNumber || "";
const byNew = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
function filteredUsers() {
  const q = $("userSearch").value.trim().toLowerCase();
  return [...users].sort(byNew).filter(u => !q || [u.name, u.email, phoneOf(u), u.city, u.pincode].join(" ").toLowerCase().includes(q));
}
function renderUsers() {
  const age = u => Date.now() - (u.createdAt?.seconds || 0) * 1000;
  const box = (l, v) => `<div class="stat"><span class="meta">${l}</span><b>${v}</b></div>`;
  $("userStats").innerHTML = box("Total customers", users.length) + box("New today", users.filter(u => age(u) < 864e5).length) +
    box("New this week", users.filter(u => age(u) < 7 * 864e5).length) + box("Alerts opted in", users.filter(u => u.marketingOptIn).length) +
    box("With address", users.filter(u => u.address).length);
  const us = filteredUsers();
  $("userList").innerHTML = `<tr><th>Name</th><th>Email</th><th>Mobile</th><th>Address</th><th>Joined</th><th>Last login</th><th>Logins</th><th>Orders</th><th>Alerts</th></tr>` + (us.length ? us.map(u =>
    `<tr><td>${esc(u.name || "-")}</td><td>${esc(u.email || "-")}</td><td>${esc(phoneOf(u) || "-")}</td><td>${esc([u.address, u.city, u.pincode].filter(Boolean).join(", ") || "-")}</td>
    <td>${when(u.createdAt)}</td><td>${when(u.lastLogin)}</td><td>${u.loginCount || 0}</td><td>${orders.filter(o => o.uid === u.id).length}</td><td>${u.marketingOptIn ? "Yes" : "No"}</td></tr>`).join("") : `<tr><td colspan="9">No customers found.</td></tr>`);
}
function renderReqs() {
  const rs = [...reqs].sort(byNew);
  const open = reqs.filter(r => r.status !== "resolved").length;
  document.querySelector('[data-tab="reqs"]').textContent = "Requests" + (open ? " (" + open + ")" : "");
  $("reqList").innerHTML = `<tr><th>Date</th><th>Customer</th><th>Type</th><th>Message</th><th>Status</th></tr>` + (rs.length ? rs.map(r =>
    `<tr><td>${when(r.createdAt)}</td><td>${esc(r.name || "")}<br>${esc(r.email || "")}<br>${esc(r.phone || "")}</td><td>${esc(r.type)}</td><td>${esc(r.message)}</td>
    <td><select data-req="${r.id}">${["open", "in progress", "resolved"].map(s => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("") : `<tr><td colspan="5">No requests yet.</td></tr>`);
}
$("userSearch").oninput = renderUsers;
function exportCsv(list, file) {
  const rows = [["Name", "Email", "Mobile", "Address", "City", "Pincode", "Joined", "Alerts"], ...list.map(u =>
    [u.name, u.email, phoneOf(u), u.address, u.city, u.pincode, when(u.createdAt), u.marketingOptIn ? "Yes" : "No"])];
  const csv = rows.map(r => r.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = file; a.click();
}
$("exAll").onclick = () => exportCsv(filteredUsers(), "customers.csv");
$("exOpt").onclick = () => exportCsv(filteredUsers().filter(u => u.marketingOptIn), "alert-list.csv");

// ---- Live visitors & image storage ----
const GB = 1024 ** 3;
const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(2) + " MB" : b >= 1024 ? (b / 1024).toFixed(1) + " KB" : Math.round(b) + " B";
let online = null; // { total, loggedIn }
function renderLive() {
  const sizes = products.filter(p => p.image).map(p => p.image.length); // stored size of each photo
  const total = sizes.reduce((n, b) => n + b, 0);
  const stat = (l, v, cls = "") => `<div class="stat ${cls}"><span class="meta">${l}</span><b>${v}</b></div>`;
  $("liveStats").innerHTML =
    stat("Online now", online ? online.total : "...", "good") +
    stat("Logged-in users online", online ? online.loggedIn : "...") +
    stat("Guests online", online ? online.total - online.loggedIn : "...") +
    stat("Image storage used", fmtSize(total)) +
    stat("Images uploaded", sizes.length) +
    stat("Average per image", sizes.length ? fmtSize(total / sizes.length) : "-") +
    stat("Largest image", sizes.length ? fmtSize(Math.max(...sizes)) : "-") +
    stat("Free 1 GB quota used", (total / GB * 100).toFixed(2) + "%");
}
async function refreshOnline() {
  try {
    const snap = await getDocs(query(collection(db, "presence"), where("ts", ">", Date.now() - 120000)));
    const rows = snap.docs.map(d => d.data());
    online = { total: rows.length, loggedIn: rows.filter(r => r.uid).length };
    $("liveNote").textContent = "Online = active in the last 2 minutes. Updates every 20 seconds.";
  } catch (err) {
    console.warn(err); online = null;
    $("liveNote").textContent = "Can't read live visitors yet. Add the presence rule in Firestore (see setup steps).";
  }
  renderLive();
}
async function cleanPresence() { // remove records older than 1 day
  try {
    const old = await getDocs(query(collection(db, "presence"), where("ts", "<", Date.now() - 864e5), limit(50)));
    await Promise.all(old.docs.map(d => deleteDoc(d.ref)));
  } catch (e) {}
}
