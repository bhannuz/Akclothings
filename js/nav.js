// Header behaviour shared by pages: cart count + login button / user menu.
import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { cartCount } from "./cart.js";
import { ADMIN_EMAILS } from "./config.js";
import { display, realEmail, mobileOf } from "./id.js";

export function updateCount() {
  const el = document.getElementById("count");
  if (el) el.textContent = cartCount();
}
updateCount();

const css = document.createElement("style");
css.textContent = `.menu{position:relative}.dd{position:absolute;right:0;top:calc(100% + 8px);background:#fff;border:1px solid #e4e1db;border-radius:0;min-width:220px;padding:8px;display:grid;gap:4px;z-index:60}.dd[hidden]{display:none}.dd a,.dd button{display:block;text-align:left;padding:8px 10px;border:0;background:none;font-weight:700;color:#111;text-decoration:none;cursor:pointer}.dd a:hover,.dd button:hover{background:#f4f1ff}#menuBtn{max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dd{max-width:calc(100vw - 24px)}.dd .who{padding:6px 10px;font-size:.82rem;color:#5a5670;word-break:break-all}`;
document.head.appendChild(css);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const btn = document.getElementById("authBtn");
const hello = document.getElementById("hello");
let menu = null;
onAuthStateChanged(auth, user => {
  if (!btn) return;
  menu?.remove(); menu = null;
  if (user) {
    const name = user.displayName || realEmail(user).split("@")[0] || mobileOf(user.email) || user.phoneNumber;
    hello.textContent = ""; btn.style.display = "none";
    menu = document.createElement("div"); menu.className = "menu";
    menu.innerHTML = `<button class="btn white sm" id="menuBtn">👤 ${esc(name)} ▾</button>
      <div class="dd" hidden>
        <div class="who">${esc(display(user))}</div>
        <a href="profile.html">My profile &amp; address</a>
        <a href="profile.html#orders">My orders</a>
        ${ADMIN_EMAILS.includes(user.email) ? '<a href="admin.html">Admin panel</a>' : ""}
        <button id="menuOut">Log out</button>
      </div>`;
    btn.before(menu);
    const dd = menu.querySelector(".dd");
    menu.querySelector("#menuBtn").onclick = e => { e.stopPropagation(); dd.hidden = !dd.hidden; };
    menu.querySelector("#menuOut").onclick = () => signOut(auth);
  } else {
    hello.textContent = ""; btn.style.display = "";
    btn.textContent = "Log in";
    btn.onclick = () => { location.href = "login.html"; };
  }
});
document.addEventListener("click", () => { const d = menu?.querySelector(".dd"); if (d) d.hidden = true; });
