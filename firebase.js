// Firebase setup. Every other file imports from here.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHvLKALVUeofgvgnJZ3lmkHLzfpuQXEY0",
  authDomain: "ak-clothing-a9813.firebaseapp.com",
  projectId: "ak-clothing-a9813",
  storageBucket: "ak-clothing-a9813.firebasestorage.app",
  messagingSenderId: "810101915854",
  appId: "1:810101915854:web:2743e7b35157f9b40a909f",
  measurementId: "G-L00414MBYQ"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
try { getAnalytics(app); } catch (e) { console.warn("Analytics unavailable", e); }
