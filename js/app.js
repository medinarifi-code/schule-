// Schülerseite: Abstimmen + Wünsche senden (ohne sichtbare Anmeldung).
import { auth, db, escapeHtml } from "./firebase.js";
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
const wishForm = document.getElementById("wish-form");
const wishText = document.getElementById("wish-text");
const wishCount = document.getElementById("wish-count");
const wishMsg = document.getElementById("wish-msg");

let uid = null;
let round = null;
let products = [];
let votes = new Map(); // uid -> productId
let unsubVotes = null;

function render() {
  if (round === null) {
    statusEl.textContent = "Die Abstimmung ist noch nicht gestartet.";
    productsEl.innerHTML = "";
    return;
  }
  if (products.length === 0) {
    statusEl.textContent = "Noch keine Auswahl vorhanden – schau später nochmal vorbei!";
    productsEl.innerHTML = "";
    return;
  }

  const productIds = new Set(products.map((p) => p.id));
  const counts = {};
  let total = 0;
  for (const pid of votes.values()) {
    if (!productIds.has(pid)) continue;
    counts[pid] = (counts[pid] || 0) + 1;
    total++;
  }
  const myVote = uid ? votes.get(uid) : undefined;
  const hasVoted = myVote !== undefined;

  statusEl.textContent = hasVoted
    ? `Danke! Du hast abgestimmt. Insgesamt ${total} Stimme${total === 1 ? "" : "n"}.`
    : "Tippe auf dein Lieblingsprodukt, um abzustimmen:";

  productsEl.innerHTML = products
    .map((p) => {
      const c = counts[p.id] || 0;
      const pct = total ? Math.round((c / total) * 100) : 0;
      const mine = myVote === p.id;
      return `
        <button class="product ${mine ? "mine" : ""}" data-id="${p.id}" ${hasVoted ? "disabled" : ""}>
          ${hasVoted ? `<span class="bar" style="width:${pct}%"></span>` : ""}
          <span class="product-name">${escapeHtml(p.name)}${mine ? " ✅" : ""}</span>
          ${hasVoted ? `<span class="product-count">${pct}% (${c})</span>` : ""}
        </button>`;
    })
    .join("");
}

productsEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button.product");
  if (!btn || btn.disabled || !uid || round === null) return;
  productsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await setDoc(doc(db, "rounds", String(round), "votes", uid), {
      productId: btn.dataset.id,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Du hast in dieser Runde schon abgestimmt.";
    render();
  }
});

function watchVotes() {
  if (unsubVotes) unsubVotes();
  votes = new Map();
  if (round === null) return render();
  unsubVotes = onSnapshot(collection(db, "rounds", String(round), "votes"), (snap) => {
    votes = new Map(snap.docs.map((d) => [d.id, d.data().productId]));
    render();
  });
}

function start() {
  onSnapshot(doc(db, "config", "main"), (snap) => {
    const newRound = snap.exists() ? snap.data().round : null;
    if (newRound !== round) {
      round = newRound;
      watchVotes();
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
      statusEl.textContent = "Verbindung fehlgeschlagen. Bitte Seite neu laden.";
    });
  }
});

// ---------- Wünsche ----------
wishText.addEventListener("input", () => {
  wishCount.textContent = `${wishText.value.length} / 200`;
});

wishForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = wishText.value.trim();
  if (!text || !uid) return;
  const btn = wishForm.querySelector("button");
  btn.disabled = true;
  try {
    await addDoc(collection(db, "wishes"), { text, createdAt: serverTimestamp() });
    wishText.value = "";
    wishCount.textContent = "0 / 200";
    showWishMsg("Danke! Dein Wunsch wurde gesendet. 🎉", false);
  } catch (err) {
    console.error(err);
    showWishMsg("Senden fehlgeschlagen. Bitte versuche es nochmal.", true);
  } finally {
    btn.disabled = false;
  }
});

function showWishMsg(text, isError) {
  wishMsg.textContent = text;
  wishMsg.className = isError ? "msg error" : "msg";
  wishMsg.hidden = false;
  setTimeout(() => (wishMsg.hidden = true), 4000);
}
