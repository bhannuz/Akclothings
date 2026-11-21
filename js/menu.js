// Header menu on every page: 3-line button opens a left slide-in menu; search icon jumps to search.
import { db, auth } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ADMIN_EMAILS, FREE_SHIPPING_MIN, RETURN_DAYS } from "./config.js";

const toggle = document.getElementById("menuToggle");
if (toggle) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ov = document.createElement("div"); ov.className = "moverlay";
  const side = document.createElement("aside"); side.className = "sidemenu"; side.id = "sideMenu"; side.setAttribute("aria-hidden", "true");
  side.innerHTML = `
    <div class="dh"><strong>Menu</strong><button class="rm" id="menuClose" type="button">Close</button></div>
    <nav class="mlinks">
      <a href="index.html">Home</a>
      <a href="index.html#shop">Shop all</a>
      <div class="mgroup">Shop by category</div>
      <div id="menuCats"></div>
      <div class="mgroup">My account</div>
      <a href="profile.html">My profile &amp; address</a>
      <a href="profile.html#orders">My orders &amp; track order</a>
      <a href="profile.html#reqForm">Returns, exchange &amp; contact</a>
      <a id="menuAdmin" href="admin.html" hidden>Admin panel</a>
      <a id="menuLogin" href="login.html">Log in / Register</a>
      <button id="menuLogout" type="button" hidden>Log out</button>
    </nav>
    <div class="mfoot">Free shipping over ₹${FREE_SHIPPING_MIN} · Easy ${RETURN_DAYS}-day returns · UPI &amp; COD</div>`;
  document.body.append(ov, side);

  const set = open => {
    side.classList.toggle("open", open); ov.classList.toggle("open", open);
    side.setAttribute("aria-hidden", !open); toggle.setAttribute("aria-expanded", open);
  };
  toggle.onclick = () => set(!side.classList.contains("open"));
  ov.onclick = side.querySelector("#menuClose").onclick = () => set(false);
  document.addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
  side.addEventListener("click", e => { if (e.target.closest("a")) set(false); });

  // Categories come from the same list you manage in the admin panel
  (async () => {
    try {
      const snap = await getDocs(collection(db, "categories"));
      const names = snap.docs.map(d => d.data()).sort((a, b) => (a.order || 0) - (b.order || 0)).map(c => c.name).filter(Boolean);
      side.querySelector("#menuCats").innerHTML = names.map(n => `<a href="index.html?cat=${encodeURIComponent(n)}#shop">${esc(n)}</a>`).join("");
    } catch (e) { console.warn("Menu categories not loaded", e); }
  })();

  onAuthStateChanged(auth, user => {
    side.querySelector("#menuLogin").hidden = !!user;
    side.querySelector("#menuLogout").hidden = !user;
    side.querySelector("#menuAdmin").hidden = !(user && ADMIN_EMAILS.includes(user.email));
  });
  side.querySelector("#menuLogout").onclick = () => signOut(auth).then(() => location.reload());

  const sb = document.getElementById("searchBtn");
  if (sb) sb.onclick = () => {
    const box = document.getElementById("search");
    if (box) { document.getElementById("shop").scrollIntoView({ behavior: "smooth" }); setTimeout(() => box.focus(), 400); }
    else location.href = "index.html#shop";
  };
}
