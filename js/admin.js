// Admin-Seite: Produkte verwalten, Stimmen zurücksetzen, Wünsche ansehen.
import { auth, db, animateNumber, toast } from "./firebase.js";
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
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let round = null;
let products = [];
let votes = [];
let unsubs = [];
let unsubVotes = null;
const resultRows = new Map();

// ---------- Bestätigungs-Dialog ----------
function confirmBox(text, okLabel = "Ja, sicher") {
  const dlg = $("confirm-dialog");
  $("confirm-text").textContent = text;
  $("confirm-ok").textContent = okLabel;
  if (typeof dlg.showModal !== "function") return Promise.resolve(confirm(text));
  dlg.returnValue = "";
  dlg.showModal();
  return new Promise((resolve) =>
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "ok"), { once: true })
  );
}

function setBusy(btn, busy) {
  btn.disabled = busy;
  btn.classList.toggle("loading", busy);
}

// ---------- Login ----------
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter || $("login-form").querySelector("button");
  setBusy(btn, true);
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
  } catch (err) {
    console.error(err);
    toast("Anmeldung fehlgeschlagen – E-Mail oder Passwort falsch.", "error");
    $("login-form").classList.remove("shake");
    void $("login-form").offsetWidth;
    $("login-form").classList.add("shake");
  } finally {
    setBusy(btn, false);
  }
});

$("logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  unsubs.forEach((u) => u());
  unsubs = [];
  if (unsubVotes) unsubVotes();
  unsubVotes = null;
  round = null;

  const isAdmin = user && !user.isAnonymous;
  $("loading-section").hidden = true;
  $("login-section").hidden = !!isAdmin;
  $("admin-section").hidden = !isAdmin;
  $("logout").hidden = !isAdmin;
  if (!isAdmin) return;

  try {
    // Beim ersten Start die Abstimmungsrunde anlegen.
    const cfgRef = doc(db, "config", "main");
    const cfg = await getDoc(cfgRef);
    if (!cfg.exists()) await setDoc(cfgRef, { round: 1 });
  } catch (err) {
    console.error(err);
    toast("Kein Zugriff. Ist die Admin-E-Mail in firestore.rules richtig eingetragen?", "error");
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
  $("round-label").textContent = round ? `Runde ${round}` : "";
  if (!round) return renderResults();
  unsubVotes = onSnapshot(collection(db, "rounds", String(round), "votes"), (snap) => {
    votes = snap.docs.map((d) => d.data().productId);
    renderResults();
  });
}

// ---------- Produkte ----------
$("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("product-name");
  const name = input.value.trim();
  if (!name) return;
  input.value = "";
  input.focus();
  try {
    await addDoc(collection(db, "products"), { name, createdAt: serverTimestamp() });
  } catch (err) {
    console.error(err);
    input.value = name;
    toast("Hinzufügen fehlgeschlagen.", "error");
  }
});

function renderProducts() {
  animateNumber($("stat-products"), products.length);
  syncList(
    $("admin-products"),
    products,
    (p) => p.id,
    (p) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="li-text"></span>
        <button class="icon-btn" title="Löschen" aria-label="Löschen">🗑️</button>`;
      li.querySelector(".li-text").textContent = p.name;
      li.querySelector("button").addEventListener("click", async () => {
        if (!(await confirmBox(`„${p.name}" wirklich löschen?`, "Löschen"))) return;
        await removeAnimated(li);
        await deleteDoc(doc(db, "products", p.id)).catch(() => failRemove(li));
      });
      return li;
    },
    "Noch keine Produkte – füge oben eins hinzu."
  );
}

// ---------- Ergebnisse ----------
function renderResults() {
  const box = $("results");
  const ids = new Set(products.map((p) => p.id));
  const counts = {};
  let total = 0;
  for (const pid of votes) {
    if (!ids.has(pid)) continue;
    counts[pid] = (counts[pid] || 0) + 1;
    total++;
  }
  animateNumber($("stat-votes"), total);

  const sorted = [...products].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  const max = Math.max(1, ...sorted.map((p) => counts[p.id] || 0));

  if (!sorted.length) {
    box.innerHTML = `<div class="empty"><div class="empty-emoji">📭</div><div>Noch keine Produkte.</div></div>`;
    resultRows.clear();
    return;
  }
  box.querySelector(".empty")?.remove();

  // FLIP: alte Positionen merken, damit das Umsortieren animiert wird
  const before = new Map();
  for (const [id, el] of resultRows) before.set(id, el.getBoundingClientRect().top);

  for (const [id, el] of resultRows) {
    if (!ids.has(id)) {
      el.remove();
      resultRows.delete(id);
    }
  }

  sorted.forEach((p, i) => {
    let el = resultRows.get(p.id);
    if (!el) {
      el = document.createElement("div");
      el.className = "product static enter";
      el.innerHTML = `<span class="bar"></span><span class="rank"></span><span class="product-name"></span>
        <span class="product-right"><span class="product-count">0</span><span class="pct muted"></span></span>`;
      resultRows.set(p.id, el);
    }
    if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
    const c = counts[p.id] || 0;
    const pct = total ? Math.round((c / total) * 100) : 0;
    el.querySelector(".product-name").textContent = p.name;
    el.querySelector(".rank").textContent = c > 0 && i < 3 ? ["🥇", "🥈", "🥉"][i] : "";
    el.querySelector(".bar").style.transform = `scaleX(${c / max})`;
    animateNumber(el.querySelector(".product-count"), c);
    el.querySelector(".pct").textContent = `${pct}%`;
    el.classList.toggle("leader", i === 0 && c > 0);
  });

  if (!reduceMotion) {
    for (const [id, el] of resultRows) {
      const old = before.get(id);
      if (old === undefined) continue;
      const delta = old - el.getBoundingClientRect().top;
      if (!delta) continue;
      el.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
        duration: 450,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
    }
  }
}

$("reset-votes").addEventListener("click", async () => {
  if (!round) return;
  if (!(await confirmBox("Wirklich ALLE Stimmen auf 0 setzen? Alle Schüler können danach neu abstimmen.", "Zurücksetzen")))
    return;
  const btn = $("reset-votes");
  setBusy(btn, true);
  const oldRound = round;
  try {
    // Neue Runde starten → Stimmen sofort auf 0, jedes Gerät darf wieder abstimmen.
    await setDoc(doc(db, "config", "main"), { round: oldRound + 1 });
    toast("Stimmen wurden auf 0 gesetzt. 🔄");
    // Alte Stimmen im Hintergrund aufräumen.
    deleteAll(collection(db, "rounds", String(oldRound), "votes")).catch(console.error);
  } catch (err) {
    console.error(err);
    toast("Zurücksetzen fehlgeschlagen.", "error");
  } finally {
    setBusy(btn, false);
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
  animateNumber($("stat-wishes"), docs.length);
  $("clear-wishes").hidden = docs.length === 0;
  syncList(
    $("wishes"),
    docs,
    (d) => d.id,
    (d) => {
      const w = d.data();
      const li = document.createElement("li");
      li.innerHTML = `<div class="li-text"><div class="wish-text"></div><small class="muted"></small></div>
        <button class="icon-btn" title="Erledigt / löschen" aria-label="Löschen">✕</button>`;
      li.querySelector(".wish-text").textContent = w.text;
      li.querySelector("small").textContent = formatDate(w.createdAt);
      li.querySelector("button").addEventListener("click", async () => {
        await removeAnimated(li);
        await deleteDoc(doc(db, "wishes", d.id)).catch(() => failRemove(li));
      });
      return li;
    },
    "Noch keine Wünsche.",
    (li, d) => {
      // Zeitstempel kommt kurz nach dem Erstellen vom Server
      const small = li.querySelector("small");
      const t = formatDate(d.data().createdAt);
      if (small.textContent !== t) small.textContent = t;
    }
  );
}

$("clear-wishes").addEventListener("click", async () => {
  if (!(await confirmBox("Wirklich ALLE Wünsche löschen?", "Alle löschen"))) return;
  const btn = $("clear-wishes");
  setBusy(btn, true);
  try {
    await deleteAll(collection(db, "wishes"));
    toast("Alle Wünsche gelöscht.");
  } catch (err) {
    console.error(err);
    toast("Löschen fehlgeschlagen.", "error");
  } finally {
    setBusy(btn, false);
  }
});

function formatDate(ts) {
  const d = ts?.toDate?.();
  if (!d) return "gerade eben";
  return d.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ---------- Hilfsfunktionen ----------
// Liste nach IDs abgleichen: nur Neues einfügen, Entferntes löschen → flüssig, kein Flackern.
function syncList(ul, items, keyOf, create, emptyText, update) {
  const existing = new Map([...ul.children].filter((li) => li.dataset.key).map((li) => [li.dataset.key, li]));
  ul.querySelector(".empty-li")?.remove();
  const keys = new Set(items.map(keyOf));
  for (const [k, li] of existing) if (!keys.has(k)) li.remove();
  items.forEach((item, i) => {
    const k = keyOf(item);
    let li = existing.get(k);
    if (!li) {
      li = create(item);
      li.dataset.key = k;
      li.classList.add("enter");
    } else if (update) update(li, item);
    if (ul.children[i] !== li) ul.insertBefore(li, ul.children[i] || null);
  });
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty-li muted";
    li.textContent = emptyText;
    ul.appendChild(li);
  }
}

function removeAnimated(el) {
  if (reduceMotion) return Promise.resolve();
  el.classList.add("leaving");
  return new Promise((r) => setTimeout(r, 220));
}

function failRemove(li) {
  li.classList.remove("leaving");
  toast("Löschen fehlgeschlagen.", "error");
}
