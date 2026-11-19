// Login id helpers: one box accepts an email or a 10-digit mobile number.
// A mobile number is stored in Firebase as <number>@mobile.vakon.app (never shown to users).
export const DOMAIN = "mobile.vakon.app";
export const isMobileEmail = e => !!e && e.endsWith("@" + DOMAIN);
export const mobileOf = e => isMobileEmail(e) ? e.split("@")[0] : "";
export const realEmail = u => (u && u.email && !isMobileEmail(u.email)) ? u.email : "";
export const display = u => realEmail(u) || mobileOf(u && u.email) || (u && u.phoneNumber) || "";
export function toLoginEmail(input) {
  const v = String(input || "").trim();
  if (v.includes("@")) return v;
  const d = v.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? d + "@" + DOMAIN : null;
}
