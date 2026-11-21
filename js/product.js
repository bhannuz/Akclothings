// Product detail page (product.html?id=...): big image, size picker, add to bag / buy now, size chart.
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { SAMPLE_PRODUCTS } from "./data.js";
import { addItem } from "./cart.js";
import { updateCount } from "./nav.js";
import { FREE_SHIPPING_MIN, RETURN_DAYS } from "./config.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => "₹" + Number(n).toLocaleString("en-IN");
const shirt = `<svg viewBox="0 0 100 100"><path fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round" d="M35 12 22 18 6 34l12 12 8-6v46h48V40l8 6 12-12L78 18 65 12q-6 9-15 9t-15-9z"/></svg>`;
let tt;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2000); }
$("openCart").onclick = () => { location.href = "index.html#bag"; };

let sizeChartFor = () => null; // size chart is optional: the page still works if js/sizechart.js is missing
try { ({ sizeChartFor } = await import("./sizechart.js")); } catch (e) { console.warn("sizechart.js not found", e); }

const id = new URLSearchParams(location.search).get("id");
let p = null;
if (id) {
  try { const s = await Promise.race([getDoc(doc(db, "products", id)), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 7000))]); if (s.exists()) p = { id: s.id, ...s.data() }; } catch (e) {}
  if (!p) p = SAMPLE_PRODUCTS.find(x => x.id === id) || null;
}

if (!p) {
  $("detail").innerHTML = `<p class="empty">We couldn't find this product. <a href="index.html#shop" style="text-decoration:underline">Back to shop</a></p>`;
} else {
  document.title = `${p.name} – Wear[M]e`;
  const sizes = (p.sizes || []).map(String), chart = sizeChartFor(p);
  let sel = sizes.length === 1 ? sizes[0] : "";
  $("detail").innerHTML = `
    <nav class="crumb"><a href="index.html">Home</a> / <a href="index.html#shop">${esc(p.cat)}</a> / ${esc(p.name)}</nav>
    <div class="pd-grid">
      <div class="pd-img" style="background:${esc(p.color || "#eee")}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : shirt}</div>
      <div>
        ${p.tag ? `<span class="tag" style="position:static;display:inline-block">${esc(p.tag)}</span>` : ""}
        <h1>${esc(p.name)}</h1>
        <p class="meta">${esc(p.cat)}</p>
        <p class="pd-price">${fmt(p.price)}</p>
        <div class="row"><strong>Select size</strong><a href="#sizechart" style="text-decoration:underline">Size chart</a></div>
        <div class="sizes" id="sizes">${sizes.map(s => `<button type="button" class="sz" aria-pressed="${s === sel}" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <div class="pd-actions"><button class="btn dark" id="addBtn">Add to bag</button><button class="btn" id="buyBtn">Buy now</button></div>
        ${p.desc ? `<p>${esc(p.desc)}</p>` : ""}
        <ul class="pd-info"><li>Free shipping on orders over ₹${FREE_SHIPPING_MIN}</li><li>Easy returns within ${RETURN_DAYS} days of delivery</li><li>Pay with UPI or cash on delivery</li></ul>
      </div>
    </div>
    ${chart ? `<section class="chart" id="sizechart">
      <h2>${esc(chart.title)}</h2>
      <div style="overflow-x:auto"><table>
        <tr>${chart.head.map(h => `<th>${h}</th>`).join("")}</tr>
        ${chart.rows.map(r => `<tr data-s="${esc(r[0])}" class="${r[0] === sel ? "mine" : ""}">${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}
      </table></div>
      <p class="meta">${esc(chart.note)}</p>
      <h3 style="margin-top:22px">How to measure</h3>
      <ul class="tips">${chart.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    </section>` : ""}`;

  $("sizes").onclick = e => {
    const s = e.target.dataset.s; if (!s) return;
    sel = s;
    document.querySelectorAll(".sz").forEach(b => b.setAttribute("aria-pressed", b.dataset.s === s));
    document.querySelectorAll("#sizechart tr[data-s]").forEach(r => r.classList.toggle("mine", r.dataset.s === s));
  };
  const add = () => { if (!sel) { toast("Please select a size"); return false; } addItem(p.id, sel); updateCount(); return true; };
  $("addBtn").onclick = () => { if (add()) toast("Added to bag"); };
  $("buyBtn").onclick = () => { if (add()) location.href = "index.html#bag"; };
}
