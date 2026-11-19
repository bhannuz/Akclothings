// Shop page: products, filters, cart drawer, checkout.
import { auth, db } from "./firebase.js";
import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SAMPLE_PRODUCTS } from "./data.js";
import { getCart, addItem, changeQty, removeItem, clearCart } from "./cart.js";
import { updateCount } from "./nav.js";

const $ = id => document.getElementById(id);
const fmt = n => "₹" + Number(n).toLocaleString("en-IN");
const shirt = `<svg viewBox="0 0 100 100"><path fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round" d="M35 12 22 18 6 34l12 12 8-6v46h48V40l8 6 12-12L78 18 65 12q-6 9-15 9t-15-9z"/></svg>`;

let PRODUCTS = SAMPLE_PRODUCTS, cat = "All", query = "", sort = "featured";
try {
  const snap = await getDocs(collection(db, "products"));
  const live = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (live.length) PRODUCTS = live;
} catch (e) { console.warn("Using sample products", e); }

function renderChips() {
  const cats = ["All", ...new Set(PRODUCTS.map(p => p.cat))];
  $("chips").innerHTML = cats.map(c => `<button class="chip" aria-pressed="${c === cat}" data-cat="${c}">${c}</button>`).join("");
}
function renderGrid() {
  const list = PRODUCTS.filter(p => (cat === "All" || p.cat === cat) && p.name.toLowerCase().includes(query));
  if (sort === "low") list.sort((a, b) => a.price - b.price);
  if (sort === "high") list.sort((a, b) => b.price - a.price);
  $("grid").innerHTML = list.length ? list.map(p => `
    <article class="card">
      <div class="art" style="background:${p.color}">${p.tag ? `<span class="tag">${p.tag}</span>` : ""}${shirt}</div>
      <div class="info">
        <h3>${p.name}</h3><span class="meta">${p.cat}</span>
        <div class="row"><span class="price">${fmt(p.price)}</span>
          <select aria-label="Size for ${p.name}" id="size${p.id}">${p.sizes.map(s => `<option>${s}</option>`).join("")}</select></div>
        <button class="btn pink sm" data-add="${p.id}">Add to bag</button>
      </div>
    </article>`).join("") : `<p class="empty">Nothing found. Try another word or category.</p>`;
}
function renderCart() {
  updateCount();
  let total = 0;
  const cart = getCart();
  $("items").innerHTML = cart.length ? cart.map((i, idx) => {
    const p = PRODUCTS.find(x => x.id === i.id); if (!p) return "";
    total += p.price * i.qty;
    return `<div class="item"><div class="thumb" style="background:${p.color}">${shirt}</div>
      <div><strong>${p.name}</strong><div class="meta">Size ${i.size} · ${fmt(p.price)}</div>
      <div class="qty"><button data-dec="${idx}" aria-label="Less">−</button>${i.qty}<button data-inc="${idx}" aria-label="More">+</button></div></div>
      <button class="rm" data-rm="${idx}">Remove</button></div>`;
  }).join("") : `<p class="empty">Your bag is empty. Go add some fits.</p>`;
  $("total").textContent = fmt(total);
  $("checkout").disabled = !cart.length;
}
function setCart(open) {
  $("drawer").classList.toggle("open", open);
  $("overlay").classList.toggle("open", open);
  $("drawer").setAttribute("aria-hidden", !open);
}
let tt;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2000); }

$("chips").onclick = e => { const c = e.target.dataset.cat; if (c) { cat = c; renderChips(); renderGrid(); } };
$("search").oninput = e => { query = e.target.value.trim().toLowerCase(); renderGrid(); };
$("sort").onchange = e => { sort = e.target.value; renderGrid(); };
$("grid").onclick = e => {
  const id = e.target.dataset.add; if (!id) return;
  addItem(id, $("size" + id).value); renderCart(); toast("Added to bag");
};
$("items").onclick = e => {
  const d = e.target.dataset;
  if (d.inc !== undefined) changeQty(+d.inc, 1);
  if (d.dec !== undefined) changeQty(+d.dec, -1);
  if (d.rm !== undefined) removeItem(+d.rm);
  renderCart();
};
$("openCart").onclick = () => setCart(true);
$("closeCart").onclick = $("overlay").onclick = () => setCart(false);
document.addEventListener("keydown", e => { if (e.key === "Escape") setCart(false); });

// Checkout needs a logged-in user. Saves the order to Firestore "orders".
// Add a payment gateway (Razorpay / Stripe) here before going live.
$("checkout").onclick = async () => {
  const user = auth.currentUser;
  if (!user) { toast("Log in to place your order"); setTimeout(() => { location.href = "login.html"; }, 900); return; }
  const items = getCart().map(i => {
    const p = PRODUCTS.find(x => x.id === i.id);
    return { id: i.id, name: p.name, size: i.size, qty: i.qty, price: p.price };
  });
  const total = items.reduce((n, i) => n + i.price * i.qty, 0);
  try {
    await addDoc(collection(db, "orders"), { uid: user.uid, email: user.email, items, total, status: "new", createdAt: serverTimestamp() });
    clearCart(); renderCart(); setCart(false); toast("Order placed. Thanks!");
  } catch (e) { console.error(e); toast("Order failed. Check your Firestore rules."); }
};

renderChips(); renderGrid(); renderCart();
