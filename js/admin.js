// Admin-Seite: Produkte verwalten, Stimmen zurücksetzen, Wünsche ansehen.
import { auth, db, escapeHtml } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const loginSection = $("login-section");
const adminSection = $("admin-section");
const logoutBtn = $("logout");

let round = null;
let products = [];
let votes = [];
let unsubs = [];
let unsubVotes = null;

// ---------- Login ----------
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-msg").hidden = true;
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
  } catch (err) {
    console.error(err);
    $("login-msg").textContent = "Anmeldung fehlgeschlagen – E-Mail oder Passwort falsch.";
    $("login-msg").hidden = false;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  unsubs.forEach((u) => u());
  unsubs = [];
  if (unsubVotes) unsubVotes();
  unsubVotes = null;
  round = null;

  const isAdmin = user && !user.isAnonymous;
  loginSection.hidden = !!isAdmin;
  adminSection.hidden = !isAdmin;
  logoutBtn.hidden = !isAdmin;
  if (!isAdmin) return;

  try {
    // Beim ersten Start die Abstimmungsrunde anlegen.
    const cfgRef = doc(db, "config", "main");
    const cfg = await getDoc(cfgRef);
    if (!cfg.exists()) await setDoc(cfgRef, { round: 1 });
  } catch (err) {
    console.error(err);
    alert("Kein Zugriff. Ist die Admin-E-Mail in firestore.rules richtig eingetragen?");
    return;
  }
  startListeners();
});

function startListeners() {
  unsubs.push(
    onSnapshot(doc(db, "config", "main"), (snap) => {
      const r = snap.exists() ? snap.data().round : null;
      if (r !== round) {
        round = r;
        watchVotes();
      }
    }),
    onSnapshot(query(collection(db, "products"), orderBy("createdAt")), (snap) => {
      products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderProducts();
      renderResults();
    }),
    onSnapshot(query(collection(db, "wishes"), orderBy("createdAt", "desc")), (snap) => {
      renderWishes(snap.docs);
    })
  );
}

function watchVotes() {
  if (unsubVotes) unsubVotes();
  votes = [];
  $("round-label").textContent = round ? `(Runde ${round})` : "";
  if (!round) return renderResults();
  unsubVotes = onSnapshot(collection(db, "rounds", String(round), "votes"), (snap) => {
    votes = snap.docs.map((d) => d.data().productId);
    renderResults();
  });
}

// ---------- Produkte ----------
$("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("product-name").value.trim();
  if (!name) return;
  await addDoc(collection(db, "products"), { name, createdAt: serverTimestamp() });
  $("product-name").value = "";
});

function renderProducts() {
  $("admin-products").innerHTML = products.length
    ? products
        .map(
          (p) => `<li><span>${escapeHtml(p.name)}</span>
            <button class="btn small danger ghost" data-del-product="${p.id}">Löschen</button></li>`
        )
        .join("")
    : `<li class="muted">Noch keine Produkte. Füge oben eins hinzu.</li>`;
}

$("admin-products").addEventListener("click", async (e) => {
  const id = e.target.dataset.delProduct;
  if (!id) return;
  const p = products.find((x) => x.id === id);
  if (confirm(`"${p?.name}" wirklich löschen?`)) await deleteDoc(doc(db, "products", id));
});

// ---------- Ergebnisse ----------
function renderResults() {
  const ids = new Set(products.map((p) => p.id));
  const counts = {};
  let total = 0;
  for (const pid of votes) {
    if (!ids.has(pid)) continue;
    counts[pid] = (counts[pid] || 0) + 1;
    total++;
  }
  $("total-votes").textContent = `${total} Stimme${total === 1 ? "" : "n"} insgesamt`;
  const sorted = [...products].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  $("results").innerHTML = sorted
    .map((p) => {
      const c = counts[p.id] || 0;
      const pct = total ? Math.round((c / total) * 100) : 0;
      return `<div class="product static">
        <span class="bar" style="width:${pct}%"></span>
        <span class="product-name">${escapeHtml(p.name)}</span>
        <span class="product-count">${c} (${pct}%)</span>
      </div>`;
    })
    .join("");
}

$("reset-votes").addEventListener("click", async () => {
  if (!round) return;
  if (!confirm("Wirklich ALLE Stimmen auf 0 setzen? Alle Schüler können danach neu abstimmen.")) return;
  const btn = $("reset-votes");
  btn.disabled = true;
  const oldRound = round;
  try {
    // Neue Runde starten → Stimmen sofort auf 0, jedes Gerät darf wieder abstimmen.
    await setDoc(doc(db, "config", "main"), { round: oldRound + 1 });
    // Alte Stimmen aufräumen.
    await deleteAll(collection(db, "rounds", String(oldRound), "votes"));
  } catch (err) {
    console.error(err);
    alert("Zurücksetzen fehlgeschlagen.");
  } finally {
    btn.disabled = false;
  }
});

async function deleteAll(colRef) {
  const snap = await getDocs(colRef);
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// ---------- Wünsche ----------
function renderWishes(docs) {
  $("wish-total").textContent = `(${docs.length})`;
  $("wishes").innerHTML = docs.length
    ? docs
        .map((d) => {
          const w = d.data();
          const date = w.createdAt?.toDate?.().toLocaleString("de-DE", {
            dateStyle: "short",
            timeStyle: "short",
          }) ?? "";
          return `<li><div><div>${escapeHtml(w.text)}</div><small class="muted">${date}</small></div>
            <button class="btn small danger ghost" data-del-wish="${d.id}">✕</button></li>`;
        })
        .join("")
    : `<li class="muted">Noch keine Wünsche.</li>`;
}

$("wishes").addEventListener("click", async (e) => {
  const id = e.target.dataset.delWish;
  if (id) await deleteDoc(doc(db, "wishes", id));
});

$("clear-wishes").addEventListener("click", async () => {
  if (!confirm("Wirklich ALLE Wünsche löschen?")) return;
  await deleteAll(collection(db, "wishes"));
});
