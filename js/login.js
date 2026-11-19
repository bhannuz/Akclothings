// Login page: email/password, sign up, Google, password reset.
import { auth, db } from "./firebase.js";
import { doc, setDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, RecaptchaVerifier, signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = id => document.getElementById(id);
const ERRORS = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/email-already-in-use": "That email already has an account. Try logging in.",
  "auth/weak-password": "Password needs at least 6 characters.",
  "auth/invalid-email": "That email doesn't look right.",
  "auth/popup-closed-by-user": "Google sign-in was closed.",
  "auth/operation-not-allowed": "This sign-in method isn't turned on in Firebase yet.",
  "auth/too-many-requests": "Too many tries. Wait a bit and try again.",
  "auth/user-not-found": "No account with that email. Sign up first.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/unauthorized-domain": "This website's domain isn't authorized in Firebase (Auth > Settings > Authorized domains).",
  "auth/network-request-failed": "Network problem. Check your connection.",
  "auth/configuration-not-found": "Authentication isn't set up in Firebase yet (Auth > Get started).",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase API key is invalid.",
  "auth/invalid-phone-number": "That mobile number doesn't look right.",
  "auth/invalid-verification-code": "Wrong OTP. Try again.",
  "auth/code-expired": "OTP expired. Send a new one.",
  "auth/captcha-check-failed": "Verification failed. Refresh and try again.",
  "auth/billing-not-enabled": "SMS login needs the Firebase Blaze plan, or use a test number.",
  "auth/popup-blocked": "Popup was blocked. Allow popups and try again."
};
const fail = (err, fallback) => { console.error(err); say(ERRORS[err.code] || (fallback + " (" + (err.code || err.message) + ")")); };
let mode = "login";
const say = (text, ok = false) => { $("msg").textContent = text; $("msg").className = "msg" + (ok ? " ok" : ""); };

function setMode(m) {
  mode = m;
  $("title").textContent = m === "login" ? "Welcome back" : m === "phone" ? "Login with mobile" : "Join VAKON";
  $("emailBox").style.display = m === "phone" ? "none" : "grid";
  $("phoneBox").style.display = m === "phone" ? "grid" : "none";
  $("tabPhone").setAttribute("aria-pressed", m === "phone");
  $("submit").textContent = m === "login" ? "Log in" : "Create account";
  $("tabLogin").setAttribute("aria-pressed", m === "login");
  $("tabSignup").setAttribute("aria-pressed", m === "signup");
  $("password").autocomplete = m === "login" ? "current-password" : "new-password";
  say("");
}
$("tabLogin").onclick = () => setMode("login");
$("tabSignup").onclick = () => setMode("signup");
$("tabPhone").onclick = () => setMode("phone");

$("form").onsubmit = async e => {
  e.preventDefault();
  if (mode === "phone") return $(confirmation ? "verifyOtp" : "sendOtp").click();
  const email = $("email").value.trim(), password = $("password").value;
  $("submit").disabled = true; say("One sec...", true);
  try {
    mode === "login"
      ? await signInWithEmailAndPassword(auth, email, password)
      : await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) { fail(err, "Something went wrong."); }
  $("submit").disabled = false;
};
let confirmation = null, verifier = null;
$("sendOtp").onclick = async () => {
  const raw = $("phone").value.replace(/\D/g, "");
  if (raw.length < 10) return say("Enter your 10-digit mobile number.");
  $("sendOtp").disabled = true; say("Sending OTP...", true);
  try {
    verifier = verifier || new RecaptchaVerifier(auth, "sendOtp", { size: "invisible" });
    confirmation = await signInWithPhoneNumber(auth, "+91" + raw.slice(-10), verifier);
    $("otpLabel").hidden = false; $("verifyOtp").hidden = false; $("sendOtp").textContent = "Resend OTP";
    say("OTP sent. Enter it below.", true); $("otp").focus();
  } catch (err) { try { verifier?.clear(); } catch (e) {} verifier = null; fail(err, "Couldn't send OTP."); }
  $("sendOtp").disabled = false;
};
$("verifyOtp").onclick = async () => {
  if (!confirmation) return;
  say("Checking...", true);
  try { await confirmation.confirm($("otp").value.trim()); }
  catch (err) { fail(err, "Couldn't verify OTP."); }
};
$("google").onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err) { fail(err, "Google sign-in failed."); }
};
$("forgot").onclick = async () => {
  const email = $("email").value.trim();
  if (!email) return say("Type your email first, then tap Forgot password.");
  try { await sendPasswordResetEmail(auth, email); say("Reset link sent. Check your inbox.", true); }
  catch (err) { fail(err, "Couldn't send the reset email."); }
};

// Already logged in (or just logged in): go to the shop.
const next = new URLSearchParams(location.search).get("next");
onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    await setDoc(doc(db, "users", user.uid), { email: user.email || "", phoneNumber: user.phoneNumber || "", ...(user.displayName ? { name: user.displayName } : {}), createdAt: new Date(user.metadata.creationTime), lastLogin: serverTimestamp(), loginCount: increment(1) }, { merge: true });
  } catch (e) { console.warn("Could not save user profile", e); }
  location.href = /^[\w-]+\.html$/.test(next || "") ? next : "index.html";
});
