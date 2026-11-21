// Gemeinsame Firebase-Initialisierung für Schüler- und Admin-Seite.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Zum lokalen Testen: Seite mit ?emulator öffnen → nutzt den Firebase-Emulator.
const useEmulator = new URLSearchParams(location.search).has("emulator");

export const app = initializeApp(
  useEmulator ? { apiKey: "demo", projectId: "demo-schulverkauf", authDomain: "localhost" } : firebaseConfig
);
export const auth = getAuth(app);

// Lokaler Zwischenspeicher: Beim nächsten Öffnen erscheinen die Daten sofort,
// noch bevor die Verbindung zum Server steht.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  db = initializeFirestore(app, {});
}
export { db };

if (useEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Zahl weich hochzählen lassen
export function animateNumber(el, to, suffix = "") {
  const from = Number(el.dataset.value || 0);
  el.dataset.value = to;
  if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = to + suffix;
    return;
  }
  const start = performance.now();
  const dur = 500;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Kleine Toast-Meldung unten auf dem Bildschirm
export function toast(text, type = "ok") {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3200);
}
