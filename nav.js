// Header behaviour shared by pages: cart count + login/logout button.
import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { cartCount } from "./cart.js";

export function updateCount() {
  const el = document.getElementById("count");
  if (el) el.textContent = cartCount();
}
updateCount();

const btn = document.getElementById("authBtn");
const hello = document.getElementById("hello");
onAuthStateChanged(auth, user => {
  if (!btn) return;
  if (user) {
    hello.textContent = "Hi, " + (user.displayName || user.email.split("@")[0]);
    btn.textContent = "Log out";
    btn.onclick = () => signOut(auth);
  } else {
    hello.textContent = "";
    btn.textContent = "Log in";
    btn.onclick = () => { location.href = "login.html"; };
  }
});
