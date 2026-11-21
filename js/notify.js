// Optional: email you every time an order is placed (works even when the admin page is closed).
// Set up a free EmailJS account and fill EMAILJS in js/config.js. Leave it blank to switch this off.
import { EMAILJS } from "./config.js";

export async function notifyOwner(o) {
  if (!EMAILJS.serviceId || !EMAILJS.templateId || !EMAILJS.publicKey) return;
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS.serviceId, template_id: EMAILJS.templateId, user_id: EMAILJS.publicKey,
        template_params: {
          customer: o.name || "-", phone: o.phone || "-", address: o.address || "-",
          items: o.items.map(i => `${i.name} (${i.size}) x${i.qty}`).join(", "),
          total: "Rs " + o.total, payment: (o.method || "").toUpperCase(), utr: o.ref || "-"
        }
      })
    });
  } catch (e) { console.warn("Order email not sent", e); }
}
