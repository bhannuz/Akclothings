// Login page: one box for email or mobile + password. Sign up, Google, password reset.
import { auth, db } from "./firebase.js";
import { doc, setDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { toLoginEmail, realEmail, mobileOf } from "./id.js";

const $ = id => document.getElementById(id);
const ERRORS = {
  "auth/invalid-credential": "Wrong email/mobile or password.",
  "auth/email-already-in-use": "That email or mobile already has an account. Try logging in.",
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
let mode = "login";
const say = (text, ok = false) => { $("msg").textContent = text; $("msg").className = "msg" + (ok ? " ok" : ""); };
const fail = (err, fallback) => { console.error(err); say(ERRORS[err.code] || (fallback + " (" + (err.code || err.message) + ")")); };

function setMode(m) {
  mode = m;
  $("title").textContent = m === "login" ? "Welcome back" : "Join VAKON";
  $("submit").textContent = m === "login" ? "Log in" : "Create account";
  $("tabLogin").setAttribute("aria-pressed", m === "login");
  $("tabSignup").setAttribute("aria-pressed", m === "signup");
  $("password").autocomplete = m === "login" ? "current-password" : "new-password";
  say("");
}
$("tabLogin").onclick = () => setMode("login");
$("tabSignup").onclick = () => setMode("signup");

$("form").onsubmit = async e => {
  e.preventDefault();
  const email = toLoginEmail($("email").value), password = $("password").value;
  if (!email) return say("Enter a valid email or 10-digit mobile number.");
  $("submit").disabled = true; say("One sec...", true);
  try {
    mode === "login"
      ? await signInWithEmailAndPassword(auth, email, password)
      : await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) { fail(err, "Something went wrong."); }
  $("submit").disabled = false;
};
$("google").onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err) { fail(err, "Google sign-in failed."); }
};
$("forgot").onclick = async () => {
  const email = toLoginEmail($("email").value);
  if (!email) return say("Type your email first, then tap Forgot password.");
  if (mobileOf(email)) return say("Password reset by email only. For a mobile account, contact the store.");
  try { await sendPasswordResetEmail(auth, email); say("Reset link sent. Check your inbox.", true); }
  catch (err) { fail(err, "Couldn't send the reset email."); }
};

// Logged in: save login info, then go to the shop (or ?next=page.html).
const next = new URLSearchParams(location.search).get("next");
onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    await setDoc(doc(db, "users", user.uid), {
      email: realEmail(user), ...(mobileOf(user.email) ? { phone: mobileOf(user.email) } : {}),
      ...(user.displayName ? { name: user.displayName } : {}),
      createdAt: new Date(user.metadata.creationTime), lastLogin: serverTimestamp(), loginCount: increment(1)
    }, { merge: true });
  } catch (e) { console.warn("Could not save user profile", e); }
  location.href = /^[\w-]+\.html$/.test(next || "") ? next : "index.html";
});
