// Live visitor count: each open tab writes a small "I'm here" record once a minute.
// Admin counts records from the last 2 minutes. No personal data is stored (random session id, optional user id, page name).
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let sid;
try { sid = sessionStorage.getItem("wm-sid") || crypto.randomUUID(); sessionStorage.setItem("wm-sid", sid); }
catch (e) { sid = Math.random().toString(36).slice(2) + Date.now(); }

const ref = doc(db, "presence", sid);
let uid = null;
function beat() {
  if (document.visibilityState === "hidden") return; // only count tabs people are looking at
  setDoc(ref, { ts: Date.now(), uid, page: location.pathname.split("/").pop() || "index.html" }).catch(() => {});
}
onAuthStateChanged(auth, u => { uid = u ? u.uid : null; beat(); });
beat();
setInterval(beat, 60000);
document.addEventListener("visibilitychange", beat);
addEventListener("pagehide", () => { deleteDoc(ref).catch(() => {}); });
