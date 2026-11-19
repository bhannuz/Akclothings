// Admin: dashboard (profit/loss), orders, users, stock.
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ADMIN_EMAILS } from "./config.js";

const $ = id => document.getElementById(id);
const say = (t, ok = false) => { $("msg").textContent = t; $("msg").className = "msg" + (ok ? " ok" : ""); };
const gsay = t => { $("gmsg").textContent = t; };
const fmt = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const when = t => t?.toDate ? t.toDate().toLocaleString("en-IN") : "-";
const STATUSES = ["new", "shipped", "delivered", "cancelled"];
let products = [], orders = [], users = [], expenses = [];

onAuthStateChanged(auth, user => {
  if (!user) { location.href = "login.html?next=admin.html"; return; }
  if (!ADMIN_EMAILS.includes(user.email)) {
    $("gate").textContent = "This page is only for the store admin. You are logged in as " + user.email + ".";
    $("panel").hidden = true; return;
  }
  $("gate").hidden = true; $("panel").hidden = false;
  loadAll();
});
$("logout").onclick = () => signOut(auth).then(() => { location.href = "index.html"; });

$("tabs").onclick = e => {
  const t = e.target.dataset.tab; if (!t) return;
  document.querySelectorAll("#tabs .chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === t));
  ["dash", "orders", "users", "stock"].forEach(n => { $("tab-" + n).hidden = n !== t; });
};

async function load(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function loadAll() {
  gsay("");
  try {
    [products, orders, users, expenses] = await Promise.all(["products", "orders", "users", "expenses"].map(load));
  } catch (err) {
    console.error(err);
    gsay(err.message.includes("permission") ? "Permission denied. Update your Firestore rules (admin must read orders, users, expenses)." : err.message);
  }
  render();
}

const live = () => orders.filter(o => o.status !== "cancelled");
const sold = id => live().reduce((n, o) => n + (o.items || []).filter(i => i.id === id).reduce((m, i) => m + i.qty, 0), 0);

function render() {
  // Dashboard
  const revenue = live().reduce((n, o) => n + (o.total || 0), 0);
  const cogs = live().reduce((n, o) => n + (o.items || []).reduce((m, i) => m + (i.cost ?? products.find(p => p.id === i.id)?.cost ?? 0) * i.qty, 0), 0);
  const exp = expenses.reduce((n, e) => n + (e.amount || 0), 0);
  const gross = revenue - cogs, net = gross - exp;
  const stockVal = products.reduce((n, p) => n + Math.max(0, (p.stock || 0) - sold(p.id)) * (p.cost || 0), 0);
  const stat = (l, v, cls = "") => `<div class="stat ${cls}"><span class="meta">${l}</span><b>${v}</b></div>`;
  $("stats").innerHTML = stat("Revenue", fmt(revenue)) + stat("Cost of goods sold", fmt(cogs)) + stat("Gross profit", fmt(gross), gross >= 0 ? "good" : "bad") +
    stat("Expenses", fmt(exp)) + stat(net >= 0 ? "Net profit" : "Net loss", fmt(Math.abs(net)), net >= 0 ? "good" : "bad") +
    stat("Stock value (at cost)", fmt(stockVal)) + stat("Orders", live().length + " / " + orders.length) + stat("Users", users.length);
  $("expList").innerHTML = `<tr><th>Date</th><th>Description</th><th>Amount</th><th></th></tr>` + (expenses.length ? expenses.map(e =>
    `<tr><td>${when(e.createdAt)}</td><td>${esc(e.desc)}</td><td>${fmt(e.amount)}</td><td><button class="btn sm white" data-delexp="${e.id}">Delete</button></td></tr>`).join("") : `<tr><td colspan="4">No expenses yet.</td></tr>`);

  // Orders
  const os = [...orders].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  $("orderList").innerHTML = `<tr><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>` + (os.length ? os.map(o =>
    `<tr><td>${when(o.createdAt)}</td><td>${esc(o.email)}</td><td>${(o.items || []).map(i => `${esc(i.name)} (${esc(i.size)}) ×${i.qty}`).join("<br>")}</td><td>${fmt(o.total)}</td>
    <td><select data-status="${o.id}">${STATUSES.map(s => `<option${s === o.status ? " selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("") : `<tr><td colspan="5">No orders yet.</td></tr>`);

  // Users
  const us = [...users].sort((a, b) => (b.lastLogin?.seconds || 0) - (a.lastLogin?.seconds || 0));
  $("userList").innerHTML = `<tr><th>Email</th><th>Name</th><th>First seen</th><th>Last login</th><th>Logins</th><th>Orders</th></tr>` + (us.length ? us.map(u =>
    `<tr><td>${esc(u.email)}</td><td>${esc(u.name || "-")}</td><td>${when(u.createdAt)}</td><td>${when(u.lastLogin)}</td><td>${u.loginCount || 0}</td><td>${orders.filter(o => o.uid === u.id).length}</td></tr>`).join("") : `<tr><td colspan="6">No users yet.</td></tr>`);

  // Stock
  $("cats").innerHTML = [...new Set(products.map(r => r.cat))].map(c => `<option value="${esc(c)}">`).join("");
  $("list").innerHTML = `<tr><th></th><th>Product</th><th>Cost</th><th>Price</th><th>Stock in</th><th>Sold</th><th>Balance</th><th>Add stock</th><th></th></tr>` + (products.length ? products.map(p => {
    const s = sold(p.id), bal = (p.stock || 0) - s;
    return `<tr><td><div class="thumb" style="background:${esc(p.color || "#fff")}">${p.image ? `<img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover">` : ""}</div></td>
      <td><strong>${esc(p.name)}</strong><div class="meta">${esc(p.cat)}</div></td><td>${fmt(p.cost)}</td><td>${fmt(p.price)}</td><td>${p.stock || 0}</td><td>${s}</td>
      <td class="${bal <= 5 ? "low" : ""}">${bal}</td>
      <td><input type="number" min="1" id="add${p.id}" placeholder="qty"> <button class="btn sm pink" data-addstock="${p.id}">Add</button></td>
      <td><button class="btn sm white" data-del="${p.id}">Delete</button></td></tr>`;
  }).join("") : `<tr><td colspan="9">No products yet. Add your first one above.</td></tr>`);
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
    if (d.addstock) {
      const q = Number($("add" + d.addstock).value);
      if (!q) return gsay("Enter a quantity.");
      await updateDoc(doc(db, "products", d.addstock), { stock: increment(q) }); loadAll();
    }
  } catch (err) { gsay(err.message); }
});
document.addEventListener("change", async e => {
  const id = e.target.dataset?.status; if (!id) return;
  try { await updateDoc(doc(db, "orders", id), { status: e.target.value }); loadAll(); }
  catch (err) { gsay(err.message); }
});
