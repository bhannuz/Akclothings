// Profile page: edit name/phone/address, see my orders.
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, addDoc, serverTimestamp, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const say = (t, ok = false) => { $("msg").textContent = t; $("msg").className = "msg" + (ok ? " ok" : ""); };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const FIELDS = ["name", "phone", "address", "city", "pincode"];
import { RETURN_DAYS } from "./config.js";
import { display, realEmail, mobileOf } from "./id.js";
let user;

$("logout").onclick = () => signOut(auth).then(() => { location.href = "index.html"; });
onAuthStateChanged(auth, async u => {
  if (!u) { location.href = "login.html?next=profile.html"; return; }
  user = u; $("gate").hidden = true; $("panel").hidden = false;
  $("email").value = display(u);
  try {
    const d = (await getDoc(doc(db, "users", u.uid))).data() || {};
    FIELDS.forEach(f => { $(f).value = d[f] || (f === "name" ? u.displayName || "" : f === "phone" ? mobileOf(u.email) || (u.phoneNumber || "").replace("+91", "") : ""); });
    $("opt").checked = !!d.marketingOptIn;
  } catch (e) { console.warn(e); }
  loadOrders(); loadReqs();
});

$("form").onsubmit = async e => {
  e.preventDefault(); say("Saving...", true);
  const data = { email: realEmail(user) };
  FIELDS.forEach(f => { data[f] = $(f).value.trim(); });
  data.marketingOptIn = $("opt").checked;
  try { await setDoc(doc(db, "users", user.uid), data, { merge: true }); say("Saved.", true);
    const ph = data.phone.replace(/\D/g, "").slice(-10);
    if (ph.length === 10) setDoc(doc(db, "phoneIndex", ph), { uid: user.uid, email: user.email }).catch(() => {}); }
  catch (err) { console.error(err); say(err.message.includes("permission") ? "Permission denied. Check your Firestore rules." : err.message); }
};

async function loadOrders() {
  try {
    const snap = await getDocs(query(collection(db, "orders"), where("uid", "==", user.uid)));
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const canReturn = o => o.status === "delivered" && !o.returnStatus && ((o.deliveredAt || o.createdAt)?.seconds || 0) * 1000 + RETURN_DAYS * 864e5 > Date.now();
    $("list").innerHTML = `<tr><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Return</th></tr>` + (rows.length ? rows.map(o =>
      `<tr><td>${o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-IN") : "-"}</td>
      <td>${(o.items || []).map(i => `${esc(i.name)} (${esc(i.size)}) ×${i.qty}`).join("<br>")}</td><td>${fmt(o.total)}</td>
      <td>${esc((o.paymentMethod || "-").toUpperCase())}<br>${esc(o.paymentStatus || "")}</td><td>${esc(o.status)}</td>
      <td>${o.returnStatus ? esc(o.returnStatus) : canReturn(o) ? `<button class="btn sm white" data-return="${o.id}">Request return</button>` : "-"}</td></tr>`).join("") : `<tr><td colspan="6">No orders yet.</td></tr>`);
  } catch (err) { console.error(err); $("list").innerHTML = `<tr><td>Couldn't load orders. Check Firestore rules.</td></tr>`; }
}

$("list").onclick = async e => {
  const id = e.target.dataset.return; if (!id) return;
  const reason = prompt("Reason for return?"); if (!reason) return;
  try { await updateDoc(doc(db, "orders", id), { returnStatus: "requested", returnReason: reason.trim(), returnRequestedAt: serverTimestamp() }); loadOrders(); }
  catch (err) { console.error(err); alert("Couldn't request return. Check Firestore rules."); }
};

async function loadReqs() {
  try {
    const snap = await getDocs(query(collection(db, "requests"), where("uid", "==", user.uid)));
    const rows = snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    $("reqList").innerHTML = `<tr><th>Date</th><th>Type</th><th>Message</th><th>Status</th></tr>` + (rows.length ? rows.map(r =>
      `<tr><td>${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString("en-IN") : "-"}</td><td>${esc(r.type)}</td><td>${esc(r.message)}</td><td>${esc(r.status)}</td></tr>`).join("") : `<tr><td colspan="4">No requests yet.</td></tr>`);
  } catch (err) { console.error(err); }
}
$("reqForm").onsubmit = async e => {
  e.preventDefault();
  try {
    await addDoc(collection(db, "requests"), {
      uid: user.uid, name: $("name").value.trim(), email: user.email || "", phone: $("phone").value.trim(),
      type: $("rType").value, message: $("rMsg").value.trim(), status: "open", createdAt: serverTimestamp()
    });
    $("reqForm").reset(); $("rmsg").textContent = "Sent. We'll get back to you."; $("rmsg").className = "msg ok"; loadReqs();
  } catch (err) { console.error(err); $("rmsg").textContent = "Couldn't send. Check Firestore rules."; $("rmsg").className = "msg"; }
};
