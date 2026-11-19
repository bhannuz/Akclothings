// Login page: email/password, sign up, Google, password reset.
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = id => document.getElementById(id);
const ERRORS = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/email-already-in-use": "That email already has an account. Try logging in.",
  "auth/weak-password": "Password needs at least 6 characters.",
  "auth/invalid-email": "That email doesn't look right.",
  "auth/popup-closed-by-user": "Google sign-in was closed.",
  "auth/operation-not-allowed": "This sign-in method isn't turned on in Firebase yet.",
  "auth/too-many-requests": "Too many tries. Wait a bit and try again."
};
let mode = "login";
const say = (text, ok = false) => { $("msg").textContent = text; $("msg").className = "msg" + (ok ? " ok" : ""); };

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
  const email = $("email").value.trim(), password = $("password").value;
  $("submit").disabled = true; say("One sec...", true);
  try {
    mode === "login"
      ? await signInWithEmailAndPassword(auth, email, password)
      : await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) { say(ERRORS[err.code] || "Something went wrong. Try again."); }
  $("submit").disabled = false;
};
$("google").onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err) { say(ERRORS[err.code] || "Google sign-in failed. Try again."); }
};
$("forgot").onclick = async () => {
  const email = $("email").value.trim();
  if (!email) return say("Type your email first, then tap Forgot password.");
  try { await sendPasswordResetEmail(auth, email); say("Reset link sent. Check your inbox.", true); }
  catch (err) { say(ERRORS[err.code] || "Couldn't send the reset email."); }
};

// Already logged in (or just logged in): go to the shop.
onAuthStateChanged(auth, user => { if (user) location.href = "index.html"; });
