// Admin page: add products with photos, delete products.
// Photos are resized in the browser and saved inside the Firestore product document (no paid Storage plan needed).
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ADMIN_EMAILS } from "./config.js";

const $ = id => document.getElementById(id);
const say = (t, ok = false) => { $("msg").textContent = t; $("msg").className = "msg" + (ok ? " ok" : ""); };

onAuthStateChanged(auth, user => {
  if (!user) { location.href = "login.html?next=admin.html"; return; }
  if (!ADMIN_EMAILS.includes(user.email)) {
    $("gate").textContent = "This page is only for the store admin. You are logged in as " + user.email + ".";
    $("panel").hidden = true; return;
  }
  $("gate").hidden = true; $("panel").hidden = false;
  loadList();
});
$("logout").onclick = () => signOut(auth).then(() => { location.href = "index.html"; });

// Resize and compress a photo to a small JPEG string.
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
      name: $("name").value.trim(),
      cat: $("cat").value.trim(),
      price: Number($("price").value),
      sizes: $("sizes").value.split(",").map(s => s.trim()).filter(Boolean),
      tag: $("tag").value.trim(),
      color: $("color").value,
      image,
      createdAt: serverTimestamp()
    });
    $("form").reset(); $("preview").hidden = true;
    say("Product added. It is live on the shop.", true);
    loadList();
  } catch (err) {
    console.error(err);
    say(err.message.includes("permission") ? "Permission denied. Check your Firestore rules." : err.message);
  }
  $("save").disabled = false;
};

async function loadList() {
  const snap = await getDocs(collection(db, "products"));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  $("cats").innerHTML = [...new Set(rows.map(r => r.cat))].map(c => `<option value="${c}">`).join("");
  $("list").innerHTML = rows.length ? rows.map(p => `
    <div class="prow">
      <div class="thumb" style="background:${p.color || "#fff"}">${p.image ? `<img src="${p.image}" alt="">` : ""}</div>
      <div><strong>${p.name}</strong><div class="meta">${p.cat} · ₹${p.price}</div></div>
      <button class="btn sm white" data-del="${p.id}">Delete</button>
    </div>`).join("") : `<p class="meta">No products yet. Add your first one above.</p>`;
}
$("list").onclick = async e => {
  const id = e.target.dataset.del;
  if (id && confirm("Delete this product?")) { await deleteDoc(doc(db, "products", id)); loadList(); }
};
