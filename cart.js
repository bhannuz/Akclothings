// Cart storage. Saved in the browser so it survives refresh.
const KEY = "vakon-cart";
let cart = [];
try { cart = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { cart = []; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };

export const getCart = () => cart;
export const cartCount = () => cart.reduce((n, i) => n + i.qty, 0);
export function addItem(id, size) {
  const found = cart.find(i => i.id === id && i.size === size);
  found ? found.qty++ : cart.push({ id, size, qty: 1 });
  save();
}
export function changeQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty < 1) cart.splice(idx, 1);
  save();
}
export function removeItem(idx) { cart.splice(idx, 1); save(); }
export function clearCart() { cart = []; save(); }
