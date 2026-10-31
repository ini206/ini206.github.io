// Admin inbox: live lists from Firestore. Only loads after auth confirms the admin UID.
import { db, requireRole, logout, startIdleTimer } from "./firebase.js?v=20261031h";
import { collection, query, orderBy, onSnapshot, updateDoc, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const SEEN_KEY = "wishlist-admin-seen";
// Photos load only when you tap 👁, and stay open across live refreshes.
const openPics = new Set(), picCache = new Map();
const validImgId = id => typeof id === "string" && /^[0-9a-f]{32}$/.test(id);
async function loadPic(id) {
  if (picCache.has(id)) return picCache.get(id);
  const snap = await getDoc(doc(db, "images", id));
  const data = snap.exists() ? snap.data().data : null;
  const ok = typeof data === "string" && /^data:image\/(jpeg|webp);base64,/.test(data) ? data : null; // only real JPEG/WebP data URLs
  picCache.set(id, ok); return ok;
}
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
      li.append(lab);
      const imgId = (x.images || [])[i];
      if (validImgId(imgId)) {
        const key = d.id + ":" + i;
        const eye = document.createElement("button"); eye.type = "button"; eye.className = "eye px";
        const fig = document.createElement("figure"); fig.className = "pic"; fig.hidden = true;
        const show = async open => {
          if (open) openPics.add(key); else openPics.delete(key);
          eye.textContent = open ? "🙈 Hide" : "👁 Photo"; eye.setAttribute("aria-expanded", String(open));
          fig.hidden = !open; if (!open) return;
          if (!fig.firstChild) {
            fig.textContent = "Loading photo…";
            try {
              const src = await loadPic(imgId);
              fig.replaceChildren();
              if (src) { const im = document.createElement("img"); im.alt = "Photo for: " + String(text); im.src = src; fig.append(im); }
              else fig.textContent = "This photo is no longer available.";
            } catch (err) { fig.textContent = "Couldn't load the photo (" + (err.code || "error") + ")."; }
          }
        };
        eye.addEventListener("click", () => show(fig.hidden));
        li.append(eye, fig); show(openPics.has(key));
      }
      ul.append(li);
    });
    card.append(ul);
    const act = document.createElement("div"); act.className = "actions";
    const del = document.createElement("button"); del.type = "button"; del.className = "btn danger px";
    del.textContent = pendingDelete === d.id ? "Tap again to delete" : "Delete list";
    del.onclick = async () => {
      if (pendingDelete !== d.id) { pendingDelete = d.id; del.textContent = "Tap again to delete"; setTimeout(() => { if (pendingDelete === d.id) { pendingDelete = null; del.textContent = "Delete list"; } }, 4000); return; }
      pendingDelete = null; del.disabled = true;
      try { await deleteDoc(doc(db, "wishlists", d.id)); (x.images || []).filter(validImgId).forEach(id => deleteDoc(doc(db, "images", id)).catch(() => {})); } catch (err) { del.disabled = false; $("inboxMsg").textContent = friendly(err.code); }
    };
    const allGot = items.length > 0 && bought.size === items.length;
    const gotBtn = document.createElement("button"); gotBtn.type = "button"; gotBtn.className = "btn got px" + (allGot ? " on" : "");
    gotBtn.textContent = allGot ? "Bought ✓" : "Mark bought";
    gotBtn.title = allGot ? "Tap to unmark everything" : "Mark every wish in this list as bought (her bubbles will glow)";
    gotBtn.onclick = async () => {
      gotBtn.disabled = true;
      try { await updateDoc(doc(db, "wishlists", d.id), { bought: allGot ? [] : items.map((_, i) => i) }); }
      catch (err) { $("inboxMsg").textContent = friendly(err.code); }
      finally { gotBtn.disabled = false; }
    };
    const row = document.createElement("div"); row.className = "btn-row"; row.append(gotBtn, del);
    act.append(Object.assign(document.createElement("span"), { className: "muted", textContent: `${items.length} wish${items.length === 1 ? "" : "es"}` }), row);
    card.append(act); list.append(card);
  });
  // mark as seen after you've had a moment to look
  clearTimeout(window._seen);
  window._seen = setTimeout(() => { seenAt = newest; try { localStorage.setItem(SEEN_KEY, String(newest)); } catch (e) {} }, 4000);
}

onSnapshot(query(collection(db, "wishlists"), orderBy("sentAt", "desc")),
  snap => { $("inboxMsg").textContent = ""; render(snap.docs); },
  err => { $("inboxMsg").textContent = friendly(err.code); });
