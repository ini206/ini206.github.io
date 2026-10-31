// Her shopping page: wish bubbles, undo, smarter send, live "bought" glow. Runs only after auth confirms her account.
import { db, requireRole, logout } from "./firebase.js?v=20261031e";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { TO_NAME } from "./config.js?v=20261031e";

const user = await requireRole("her");
document.documentElement.dataset.auth = "ok";
const $ = id => document.getElementById(id);
$("bye").addEventListener("click", () => logout(""));

// Firestore rules re-check every field server-side; this is just the honest client.
const sendWishlist = (items, note) =>
  addDoc(collection(db, "wishlists"), { items, note, by: user.uid, sentAt: serverTimestamp() });

/* ---------- time of day (scene lives in world.js) ---------- */
const icons = h => h < 5 || h >= 20.4 ? "☾" : h < 6.5 ? "🌅" : h < 17.5 ? "☀" : h < 19.2 ? "🌇" : "☾";
function syncTimeUI() {
  const L = window.Lake; if (!L) return;
  $("timeIcon").textContent = icons(L.hour);
  $("timeBtn").title = L.phaseName(L.hour) + (L.follow ? " (Vietnam time)" : "");
  document.querySelectorAll("#timeMenu button").forEach(b =>
    b.classList.toggle("on", b.id === "autoTime" ? L.follow : !L.follow && Math.abs(+b.dataset.jump - L.hour) < .01));
  $("autoTime").textContent = L.follow ? "Auto ✓" : "Auto";
}
function toggleMenu(open) { const m = $("timeMenu"); m.hidden = open === undefined ? !m.hidden : !open; $("timeBtn").setAttribute("aria-expanded", String(!m.hidden)); }
$("timeBtn").addEventListener("click", e => { e.stopPropagation(); toggleMenu(); });
document.querySelectorAll("#timeMenu [data-jump]").forEach(b => b.addEventListener("click", () => { window.Lake?.pick(+b.dataset.jump); syncTimeUI(); toggleMenu(false); }));
$("autoTime").addEventListener("click", () => { window.Lake?.auto(); syncTimeUI(); toggleMenu(false); });
addEventListener("click", e => { if (!$("corner").contains(e.target)) toggleMenu(false); });
syncTimeUI(); setInterval(syncTimeUI, 60000);

/* ---------- wishlist ---------- */
const KEY = "lakeside-wishlist-" + user.uid;
let items = [];
try { const s = localStorage.getItem(KEY); if (s) items = JSON.parse(s); } catch (e) {}
// Older saves had no per-wish "sent" flag: treat them as sent if they match the last send.
try {
  const last = JSON.parse(localStorage.getItem("lakeside-wishlist-sent-" + user.uid) || "[]");
  items.forEach(i => { if (i.sent === undefined) i.sent = Array.isArray(last) && last.includes(i.text); });
} catch (e) { items.forEach(i => { if (i.sent === undefined) i.sent = false; }); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }
const norm = t => String(t).trim().toLowerCase();
let boughtTexts = new Set();

const intro = $("intro"), main = $("main"), fabs = $("fabs"), fab = $("fab"), sendBtn = $("send"), board = $("board"), countEl = $("count"),
  sheet = $("sheet"), form = $("form"), txt = $("txt"), title = $("sheetTitle"), toast = $("toast");
let editing = null, justAdded = null, tapTimer = null, tapId = null, started = false;

function begin() { if (started) return; started = true; intro.hidden = true; main.hidden = false; fabs.hidden = false; render(); }
$("start").addEventListener("pointerdown", e => { if (e.button === 0 || e.pointerType !== "mouse") begin(); });
$("start").addEventListener("click", begin);
addEventListener("keydown", e => { if (!started && (e.key === "Enter" || e.key === " ")) begin(); });

function render() {
  board.replaceChildren(); countEl.textContent = items.length;
  const fresh = items.filter(i => !i.sent).length;
  sendBtn.disabled = !fresh; $("sendBadge").textContent = fresh; $("sendBadge").hidden = !fresh;
  $("sentTag").hidden = !(items.length && !fresh);
  if (!items.length) { const e = document.createElement("div"); e.className = "empty px"; e.textContent = "Your list is empty. Tap + to add your first wish!"; board.append(e); return; }
  items.forEach(it => {
    const b = document.createElement("button"); b.type = "button";
    const got = boughtTexts.has(norm(it.text));
    b.className = "bubble px" + (it.id === justAdded ? " new" : "") + (got ? " got" : "") + (it.sent ? " was-sent" : "");
    const cw = document.createElement("span"); cw.className = "capw"; cw.setAttribute("aria-hidden", "true");
    cw.append(Object.assign(document.createElement("span"), { className: "cap" }));
    const fl = Object.assign(document.createElement("span"), { className: "flake" }); fl.setAttribute("aria-hidden", "true");
    const tx = Object.assign(document.createElement("span"), { className: "t", textContent: it.text });
    b.append(cw, fl, tx);
    if (it.sent) { const m = Object.assign(document.createElement("span"), { className: "sentmark", textContent: "✓", title: "Already sent" }); b.append(m); }
    for (let k = 0; k < 3; k++) { const sp = document.createElement("span"); sp.className = "spark"; sp.setAttribute("aria-hidden", "true"); b.append(sp); }
    b.style.animationDelay = it.id === justAdded ? "" : (-(it.id % 7) * .45) + "s";
    b.setAttribute("aria-label", it.text + (got ? " (taken care of)" : "") + (it.sent ? ", sent" : ", not sent yet") + ". Tap to edit, double tap to pop.");
    b.addEventListener("pointerdown", () => b.classList.add("hold")); b.addEventListener("pointerleave", () => b.classList.remove("hold"));
    b.addEventListener("click", () => tap(it.id, b));
    b.addEventListener("keydown", e => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(it.id, b); } });
    board.append(b);
  });
  justAdded = null;
}
function tap(id, el) {
  if (tapId === id && tapTimer) { clearTimeout(tapTimer); tapTimer = null; tapId = null; remove(id, el); return; }
  clearTimeout(tapTimer); tapId = id; tapTimer = setTimeout(() => { tapTimer = null; tapId = null; openSheet(id); }, 280);
}

/* ---------- pop + undo ---------- */
let undoTimer = null, lastPopped = null;
function remove(id, el) {
  const idx = items.findIndex(i => i.id === id); if (idx < 0) return;
  lastPopped = { item: items[idx], idx };
  el.classList.add("pop");
  setTimeout(() => { items = items.filter(i => i.id !== id); save(); render(); showToast(lastPopped.item.text); }, 320);
}
function showToast(text) {
  $("toastText").textContent = "Popped “" + (text.length > 22 ? text.slice(0, 21) + "…" : text) + "”";
  toast.hidden = false; toast.classList.remove("out"); void toast.offsetWidth; toast.classList.add("in");
  clearTimeout(undoTimer); undoTimer = setTimeout(hideToast, 5000);
}
function hideToast() { toast.classList.add("out"); setTimeout(() => { toast.hidden = true; lastPopped = null; }, 250); }
$("undo").addEventListener("click", () => {
  if (!lastPopped) return;
  items.splice(Math.min(lastPopped.idx, items.length), 0, lastPopped.item); justAdded = lastPopped.item.id;
  save(); render(); clearTimeout(undoTimer); hideToast();
});

/* ---------- add / edit ---------- */
function openSheet(id) { editing = id; const it = items.find(i => i.id === id); title.textContent = it ? "EDIT WISH ✎" : "NEW WISH ✿";
  txt.value = it ? it.text : ""; sheet.hidden = false; setTimeout(() => txt.focus(), 30); }
function closeSheet() { sheet.hidden = true; editing = null; }
fab.onclick = () => openSheet(null);
$("cancel").onclick = closeSheet;
sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
txt.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
form.addEventListener("submit", e => {
  e.preventDefault(); const v = txt.value.trim();
  if (!v) { txt.placeholder = "Type something first ✿"; txt.focus(); return; }
  if (editing != null) { const it = items.find(i => i.id === editing); if (it && it.text !== v) { it.text = v; it.sent = false; } } // edited = needs re-sending
  else { const id = Date.now(); items.push({ id, text: v, sent: false }); justAdded = id; }
  save(); closeSheet(); render();
});

/* ---------- smarter send: only new or edited wishes go out ---------- */
const sendSheet = $("sendSheet"), sendForm = $("sendForm"), sentCard = $("sentCard"), note = $("note"), sendMsg = $("sendMsg"), sendGo = $("sendGo");
$("toName").textContent = TO_NAME.toUpperCase();
function openSend() {
  const fresh = items.filter(i => !i.sent), old = items.length - fresh.length; if (!fresh.length) return;
  $("sendSum").textContent = fresh.length + (fresh.length === 1 ? " new wish" : " new wishes") + " ready to go" + (old ? ` (${old} already sent, they won't repeat)` : "") + ".";
  $("sendList").replaceChildren(...fresh.map(i => Object.assign(document.createElement("li"), { textContent: i.text })));
  sendMsg.textContent = ""; sendForm.hidden = false; sentCard.hidden = true; sendSheet.hidden = false; setTimeout(() => note.focus(), 30);
}
function closeSend() { sendSheet.hidden = true; }
sendBtn.onclick = openSend;
$("sendCancel").onclick = closeSend; $("sentClose").onclick = closeSend;
sendSheet.addEventListener("click", e => { if (e.target === sendSheet) closeSend(); });
sendForm.addEventListener("submit", async e => {
  e.preventDefault();
  const fresh = items.filter(i => !i.sent); if (!fresh.length) return;
  sendGo.disabled = true; sendGo.textContent = "Sending…"; sendMsg.textContent = "";
  try {
    await sendWishlist(fresh.map(i => i.text.slice(0, 160)), note.value.trim().slice(0, 300));
    fresh.forEach(i => i.sent = true); save();
    note.value = ""; sendForm.hidden = true; sentCard.hidden = false; render();
  } catch (err) { sendMsg.textContent = "That didn't go through (" + (err && err.code || "network error") + "). Try again in a moment."; }
  finally { sendGo.disabled = false; sendGo.textContent = "Send ✉"; }
});
addEventListener("keydown", e => { if (e.key !== "Escape") return; if (!sheet.hidden) closeSheet(); else if (!sendSheet.hidden) closeSend(); else toggleMenu(false); });

/* ---------- glow sync: items he marked bought ---------- */
// Rules only let her read lists she sent, so the query must filter on "by".
onSnapshot(query(collection(db, "wishlists"), where("by", "==", user.uid)), snap => {
  const next = new Set();
  snap.docs.forEach(d => { const x = d.data(), its = x.items || []; (x.bought || []).forEach(i => { if (its[i] != null) next.add(norm(its[i])); }); });
  const changed = next.size !== boughtTexts.size || [...next].some(t => !boughtTexts.has(t));
  boughtTexts = next;
  if (changed && started && sheet.hidden) render();
}, () => { /* offline or rules not updated yet: bubbles just don't glow */ });
