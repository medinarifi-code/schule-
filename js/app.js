// Schülerseite: Abstimmen + Wünsche senden (ohne sichtbare Anmeldung).
import { auth, db, animateNumber, toast } from "./firebase.js";
import {
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const productsEl = document.getElementById("products");
const statusEl = document.getElementById("vote-status");
const totalBadge = document.getElementById("total-badge");
const totalNum = document.getElementById("total-num");
const wishForm = document.getElementById("wish-form");
const wishText = document.getElementById("wish-text");
const wishCount = document.getElementById("wish-count");

let uid = null;
let round = undefined; // undefined = noch nicht geladen, null = nicht gestartet
let products = null; // null = noch nicht geladen
let votes = new Map(); // uid -> productId
let pendingVote = null; // sofort angezeigte Stimme, bevor der Server bestätigt
let unsubVotes = null;
const rows = new Map(); // productId -> DOM-Element

function setStatus(text) {
  if (statusEl.textContent !== text) statusEl.textContent = text;
}

function createRow(p) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "product enter";
  btn.dataset.id = p.id;
  btn.innerHTML = `
    <span class="bar"></span>
    <span class="product-name"></span>
    <span class="product-right">
      <span class="check" aria-hidden="true">✓</span>
      <span class="product-count">0%</span>
    </span>`;
  btn.addEventListener("animationend", () => btn.classList.remove("enter"), { once: true });
  return btn;
}

function render() {
  if (round === undefined || products === null) return; // Skelett bleiben lassen

  if (round === null || products.length === 0) {
    productsEl.innerHTML = `<div class="empty">
      <div class="empty-emoji">🍩</div>
      <div>${round === null ? "Die Abstimmung startet bald." : "Noch keine Auswahl – schau später nochmal vorbei!"}</div>
    </div>`;
    rows.clear();
    totalBadge.hidden = true;
    setStatus("");
    return;
  }
  productsEl.querySelectorAll(".skeleton, .empty").forEach((el) => el.remove());

  // Stimmen zählen
  const ids = new Set(products.map((p) => p.id));
  const counts = {};
  let total = 0;
  for (const pid of votes.values()) {
    if (!ids.has(pid)) continue;
    counts[pid] = (counts[pid] || 0) + 1;
    total++;
  }
  const serverVote = uid ? votes.get(uid) : undefined;
  if (pendingVote && !serverVote && ids.has(pendingVote)) {
    counts[pendingVote] = (counts[pendingVote] || 0) + 1;
    total++;
  }
  const myVote = serverVote ?? pendingVote ?? undefined;
  const hasVoted = myVote !== undefined;

  productsEl.classList.toggle("voted", hasVoted);
  setStatus(hasVoted ? "Danke für deine Stimme! So sieht's gerade aus:" : "Tippe auf deinen Favoriten:");
  totalBadge.hidden = !hasVoted;
  if (hasVoted) animateNumber(totalNum, total);

  // Zeilen aktualisieren statt neu zu bauen → keine Flacker-Effekte
  for (const [id, el] of rows) {
    if (!ids.has(id)) {
      el.remove();
      rows.delete(id);
    }
  }
  products.forEach((p, i) => {
    let el = rows.get(p.id);
    if (!el) {
      el = createRow(p);
      el.style.setProperty("--i", i);
      rows.set(p.id, el);
    }
    if (productsEl.children[i] !== el) productsEl.insertBefore(el, productsEl.children[i] || null);

    const nameEl = el.querySelector(".product-name");
    if (nameEl.textContent !== p.name) nameEl.textContent = p.name;

    const c = counts[p.id] || 0;
    const pct = total ? Math.round((c / total) * 100) : 0;
    el.querySelector(".bar").style.transform = `scaleX(${hasVoted ? pct / 100 : 0})`;
    const countEl = el.querySelector(".product-count");
    if (hasVoted) animateNumber(countEl, pct, "%");
    el.title = hasVoted ? `${c} Stimme${c === 1 ? "" : "n"}` : "";
    el.classList.toggle("mine", myVote === p.id);
    el.disabled = hasVoted;
    el.setAttribute("aria-pressed", myVote === p.id ? "true" : "false");
  });
}

productsEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button.product");
  if (!btn || btn.disabled || !uid || !round) return;
  const productId = btn.dataset.id;
  const votedRound = round;

  // Sofort anzeigen, im Hintergrund speichern
  pendingVote = productId;
  render();
  confetti(btn);
  if (navigator.vibrate) navigator.vibrate(15);

  try {
    await setDoc(doc(db, "rounds", String(votedRound), "votes", uid), {
      productId,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    if (round === votedRound && !votes.get(uid)) {
      pendingVote = null;
      render();
      toast("Abstimmen hat nicht geklappt – bitte nochmal versuchen.", "error");
    }
  }
});

function watchVotes() {
  if (unsubVotes) unsubVotes();
  votes = new Map();
  pendingVote = null;
  if (!round) return render();
  unsubVotes = onSnapshot(collection(db, "rounds", String(round), "votes"), (snap) => {
    votes = new Map(snap.docs.map((d) => [d.id, d.data().productId]));
    if (uid && votes.has(uid)) pendingVote = null;
    render();
  });
}

function start() {
  onSnapshot(doc(db, "config", "main"), (snap) => {
    const newRound = snap.exists() ? snap.data().round : null;
    if (newRound !== round) {
      const wasReset = round !== undefined && round !== null;
      round = newRound;
      watchVotes();
      if (wasReset) toast("Neue Runde – du kannst wieder abstimmen! 🎉");
    }
  });
  onSnapshot(query(collection(db, "products"), orderBy("createdAt")), (snap) => {
    products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    const first = uid === null;
    uid = user.uid;
    if (first) start();
  } else {
    signInAnonymously(auth).catch((err) => {
      console.error(err);
      setStatus("Verbindung fehlgeschlagen. Bitte Seite neu laden.");
    });
  }
});

// ---------- Konfetti ----------
function confetti(origin) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = origin.getBoundingClientRect();
  const colors = ["#ff7a3d", "#ffc23d", "#ff5e8a", "#4fd1a5", "#6c8cff"];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("span");
    s.className = "confetti";
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 90;
    s.style.left = rect.left + rect.width / 2 + "px";
    s.style.top = rect.top + rect.height / 2 + "px";
    s.style.background = colors[i % colors.length];
    s.style.setProperty("--x", Math.cos(angle) * dist + "px");
    s.style.setProperty("--y", Math.sin(angle) * dist - 40 + "px");
    s.style.setProperty("--r", Math.random() * 720 - 360 + "deg");
    document.body.appendChild(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
  }
}

// ---------- Wünsche ----------
wishText.addEventListener("input", () => {
  const n = wishText.value.length;
  wishCount.textContent = `${n} / 200`;
  wishCount.classList.toggle("warn", n > 180);
});

wishForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = wishText.value.trim();
  if (!text) return;
  if (!uid) return toast("Einen Moment, Verbindung wird aufgebaut…", "error");
  const btn = wishForm.querySelector("button");
  btn.disabled = true;
  btn.classList.add("loading");
  try {
    await addDoc(collection(db, "wishes"), { text, createdAt: serverTimestamp() });
    wishText.value = "";
    wishCount.textContent = "0 / 200";
    toast("Danke! Dein Wunsch ist angekommen. 🎉");
    confetti(btn);
  } catch (err) {
    console.error(err);
    toast("Senden fehlgeschlagen. Bitte nochmal versuchen.", "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
  }
});

