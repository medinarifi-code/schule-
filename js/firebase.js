// Gemeinsame Firebase-Initialisierung für Schüler- und Admin-Seite.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Zum lokalen Testen: Seite mit ?emulator öffnen → nutzt den Firebase-Emulator.
const useEmulator = new URLSearchParams(location.search).has("emulator");

export const app = initializeApp(
  useEmulator ? { apiKey: "demo", projectId: "demo-schulverkauf", authDomain: "localhost" } : firebaseConfig
);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
