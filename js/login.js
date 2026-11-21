// Login page: email or mobile + password. Sign up collects full customer details.
import { auth, db } from "./firebase.js";
import { doc, getDoc, setDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, updateProfile,
  GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { DOMAIN, realEmail, mobileOf } from "./id.js";

const $ = id => document.getElementById(id);
const ERRORS = {
  "auth/invalid-credential": "Wrong email/mobile or password.",
  "auth/email-already-in-use": "That email already has an account. Try logging in.",
  "auth/weak-password": "Password needs at least 6 characters.",
  "auth/invalid-email": "Enter a valid email or 10-digit mobile number.",
  "auth/popup-closed-by-user": "Google sign-in was closed.",
  "auth/operation-not-allowed": "Email/Password sign-in isn't turned on in Firebase yet.",
  "auth/too-many-requests": "Too many tries. Wait a bit and try again.",
  "auth/user-not-found": "No account found. Sign up first.",
  "auth/wrong-password": "Wrong email/mobile or password.",
  "auth/unauthorized-domain": "This website's domain isn't authorized in Firebase (Auth > Settings > Authorized domains).",
  "auth/network-request-failed": "Network problem. Check your connection.",
  "auth/configuration-not-found": "Authentication isn't set up in Firebase yet (Auth > Get started).",
  "auth/popup-blocked": "Popup was blocked. Allow popups and try again."
};
let mode = "login", busy = false;
const say = (text, ok = false) => { $("msg").textContent = text; $("msg").className = "msg" + (ok ? " ok" : ""); };
const fail = (err, fallback) => { console.error(err); say(ERRORS[err.code] || (fallback + " (" + (err.code || err.message) + ")")); };
const digits = v => String(v || "").replace(/\D/g, "").slice(-10);

function setMode(m) {
  mode = m;
  const su = m === "signup";
  $("title").textContent = su ? "Join Wear[M]e" : "Welcome back";
  $("submit").textContent = su ? "Create account" : "Log in";
  $("idLabel").textContent = su ? "Email" : "Email or mobile number";
  $("email").placeholder = su ? "you@mail.com" : "you@mail.com or 10-digit mobile";
  $("tabLogin").setAttribute("aria-pressed", !su);
  $("tabSignup").setAttribute("aria-pressed", su);
  $("password").autocomplete = su ? "new-password" : "current-password";
  document.querySelectorAll(".so").forEach(d => { d.style.display = su ? "grid" : "none"; });
  ["sName", "sPhone", "sAddr", "sCity", "sPin"].forEach(id => { $(id).required = su; });
  $("forgot").style.display = su ? "none" : "";
  say("");
}
$("tabLogin").onclick = () => setMode("login");
$("tabSignup").onclick = () => setMode("signup");

// Login id: an email, or a mobile number looked up to its email.
async function loginEmail(input) {
  const v = input.trim();
  if (v.includes("@")) return v;
  const d = digits(v);
  if (d.length < 10) return null;
  try { const s = await getDoc(doc(db, "phoneIndex", d)); if (s.exists() && s.data().email) return s.data().email; } catch (e) {}
  return d + "@" + DOMAIN; // older mobile-only accounts
}

$("form").onsubmit = async e => {
  e.preventDefault();
  const password = $("password").value;
  $("submit").disabled = true; say("One sec...", true);
  try {
    if (mode === "login") {
      const email = await loginEmail($("email").value);
      if (!email) say("Enter a valid email or 10-digit mobile number.");
      else await signInWithEmailAndPassword(auth, email, password);
    } else {
      const email = $("email").value.trim(), phone = digits($("sPhone").value), pincode = $("sPin").value.trim();
      if (!email.includes("@")) { say("Enter a valid email."); }
      else if (phone.length !== 10) { say("Enter a 10-digit mobile number."); }
      else if (!/^\d{6}$/.test(pincode)) { say("Pincode must be 6 digits."); }
      else {
        let taken = false;
        try { taken = (await getDoc(doc(db, "phoneIndex", phone))).exists(); } catch (x) {}
        if (taken) say("That mobile number already has an account. Log in instead.");
        else {
          busy = true;
          const name = $("sName").value.trim();
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: name }).catch(() => {});
          await finish(cred.user, { name, phone, address: $("sAddr").value.trim(), city: $("sCity").value.trim(), pincode, marketingOptIn: $("sOpt").checked });
        }
      }
    }
  } catch (err) { busy = false; fail(err, "Something went wrong."); }
  $("submit").disabled = false;
};
$("google").onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err) { fail(err, "Google sign-in failed."); }
};
$("forgot").onclick = async () => {
  const email = await loginEmail($("email").value);
  if (!email) return say("Type your email or mobile first, then tap Forgot password.");
  if (mobileOf(email)) return say("This account has no email. Contact the store to reset it.");
  try { await sendPasswordResetEmail(auth, email); say("Reset link sent. Check your inbox.", true); }
  catch (err) { fail(err, "Couldn't send the reset email."); }
};

// Save login info (and signup details), then go to the shop (or ?next=page.html).
const next = new URLSearchParams(location.search).get("next");
async function finish(user, extra = {}) {
  try {
    await setDoc(doc(db, "users", user.uid), {
      email: realEmail(user), ...(mobileOf(user.email) ? { phone: mobileOf(user.email) } : {}),
      ...(user.displayName ? { name: user.displayName } : {}), ...extra,
      createdAt: new Date(user.metadata.creationTime), lastLogin: serverTimestamp(), loginCount: increment(1)
    }, { merge: true });
    if (extra.phone) await setDoc(doc(db, "phoneIndex", extra.phone), { uid: user.uid, email: user.email }).catch(() => {});
  } catch (e) { console.warn("Could not save user profile", e); }
  location.href = /^[\w-]+\.html$/.test(next || "") ? next : "index.html";
}
onAuthStateChanged(auth, user => { if (user && !busy) finish(user); });
