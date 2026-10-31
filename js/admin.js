// Admin inbox: live lists from Firestore. Only loads after auth confirms the admin UID.
import { db, requireRole, logout, startIdleTimer } from "./firebase.js?v=20261031c";
import { collection, query, orderBy, onSnapshot, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const SEEN_KEY = "wishlist-admin-seen";
let seenAt = 0, pendingDelete = null;
try { seenAt = +localStorage.getItem(SEEN_KEY) || 0; } catch (e) {}

await requireRole("admin");
document.documentElement.dataset.auth = "ok";
startIdleTimer();
$("out").onclick = () => logout("");

const friendly = code => ({
  "permission-denied": "The database refused this account. Check the admin UID in your Firestore rules."
}[code] || ("Something went wrong (" + (code || "unknown") + ")."));

function render(docs) {
  const list = $("list"); list.replaceChildren();
  const totalItems = docs.reduce((n, d) => n + (d.data().items || []).length, 0);
  const totalBought = docs.reduce((n, d) => n + (d.data().bought || []).length, 0);
  $("stats").replaceChildren(...[`${docs.length} list${docs.length === 1 ? "" : "s"}`, `${totalItems} wishes`, `${totalBought} bought`]
    .map(t => Object.assign(document.createElement("span"), { textContent: t })));
  if (!docs.length) {
    const e = document.createElement("div"); e.className = "empty px";
    e.textContent = "No lists yet. When she taps Send, it shows up here instantly."; list.append(e); return;
  }
  let newest = seenAt;
  docs.forEach(d => {
    const x = d.data(), ts = x.sentAt?.toMillis?.() || Date.now(), items = x.items || [], bought = new Set(x.bought || []);
    newest = Math.max(newest, ts);
    const card = document.createElement("article"); card.className = "letter px" + (ts > seenAt ? " unseen" : "");
    const top = document.createElement("div"); top.className = "letter-top";
    const h = document.createElement("h2"); h.textContent = new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    if (ts > seenAt) h.append(Object.assign(document.createElement("span"), { className: "new", textContent: "NEW" }));
    top.append(h, Object.assign(document.createElement("span"), { className: "muted", textContent: `${bought.size}/${items.length} bought` }));
    card.append(top);
    if (x.note) card.append(Object.assign(document.createElement("p"), { className: "note", textContent: "“" + x.note + "”" }));
    const ul = document.createElement("ul");
    items.forEach((text, i) => {
      const li = document.createElement("li"); li.className = bought.has(i) ? "done" : "";
      const lab = document.createElement("label"), cb = document.createElement("input");
      cb.type = "checkbox"; cb.id = `${d.id}-${i}`; cb.checked = bought.has(i);
      cb.addEventListener("change", async () => {
        const next = new Set(bought); cb.checked ? next.add(i) : next.delete(i);
        try { await updateDoc(doc(db, "wishlists", d.id), { bought: [...next].sort((a, b) => a - b) }); }
        catch (err) { cb.checked = !cb.checked; $("inboxMsg").textContent = friendly(err.code); }
      });
      lab.append(cb, Object.assign(document.createElement("span"), { textContent: String(text) }));
      li.append(lab); ul.append(li);
    });
    card.append(ul);
    const act = document.createElement("div"); act.className = "actions";
    const del = document.createElement("button"); del.type = "button"; del.className = "btn danger px";
    del.textContent = pendingDelete === d.id ? "Tap again to delete" : "Delete list";
    del.onclick = async () => {
      if (pendingDelete !== d.id) { pendingDelete = d.id; del.textContent = "Tap again to delete"; setTimeout(() => { if (pendingDelete === d.id) { pendingDelete = null; del.textContent = "Delete list"; } }, 4000); return; }
      pendingDelete = null; del.disabled = true;
      try { await deleteDoc(doc(db, "wishlists", d.id)); } catch (err) { del.disabled = false; $("inboxMsg").textContent = friendly(err.code); }
    };
    act.append(Object.assign(document.createElement("span"), { className: "muted", textContent: `${items.length} wish${items.length === 1 ? "" : "es"}` }), del);
    card.append(act); list.append(card);
  });
  // mark as seen after you've had a moment to look
  clearTimeout(window._seen);
  window._seen = setTimeout(() => { seenAt = newest; try { localStorage.setItem(SEEN_KEY, String(newest)); } catch (e) {} }, 4000);
}

onSnapshot(query(collection(db, "wishlists"), orderBy("sentAt", "desc")),
  snap => { $("inboxMsg").textContent = ""; render(snap.docs); },
  err => { $("inboxMsg").textContent = friendly(err.code); });
