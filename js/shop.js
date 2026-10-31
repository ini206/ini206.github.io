// Her shopping page: wish bubbles, undo, smarter send, live "bought" glow. Runs only after auth confirms her account.
import { db, requireRole, logout } from "./firebase.js?v=20261031g";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { TO_NAME } from "./config.js?v=20261031g";

const user = await requireRole("her");
document.documentElement.dataset.auth = "ok";
const $ = id => document.getElementById(id);
// Bye asks first, so a stray tap doesn't log her out.
$("bye").addEventListener("click", () => { $("byeSheet").hidden = false; setTimeout(() => $("byeStay").focus(), 30); });
$("byeStay").addEventListener("click", () => { $("byeSheet").hidden = true; });
$("byeGo").addEventListener("click", () => logout(""));
$("byeSheet").addEventListener("click", e => { if (e.target === $("byeSheet")) $("byeSheet").hidden = true; });

// Firestore rules re-check every field server-side; this is just the honest client.
const sendWishlist = (items, images, note) =>
  addDoc(collection(db, "wishlists"), { items, images, note, by: user.uid, sentAt: serverTimestamp() });

/* ---------- photos: compressed on her phone, stored as their own Firestore doc ---------- */
const MAX_DATA = 700000; // ~500 KB image; the rules allow up to 750k characters
async function compressPhoto(file) {
  if (!file || !/^image\//.test(file.type)) throw { code: "not-image" };
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej({ code: "read-failed" }); r.readAsDataURL(file); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej({ code: "bad-image" }); i.src = url; });
  let max = 1100, q = .82;
  for (let k = 0; k < 7; k++) {
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(img.naturalWidth * sc)); cv.height = Math.max(1, Math.round(img.naturalHeight * sc));
    const g = cv.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
    const out = cv.toDataURL("image/jpeg", q);
    if (out.length <= MAX_DATA) return out;
    max *= .8; q = Math.max(.5, q - .08);
  }
  throw { code: "too-big" };
}
const newImgId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
const imgCache = new Map();
async function loadPhoto(id) {
  if (imgCache.has(id)) return imgCache.get(id);
  const snap = await getDoc(doc(db, "images", id));
  const data = snap.exists() ? snap.data().data : null;
  if (typeof data === "string" && /^data:image\/(jpeg|webp);base64,/.test(data)) { imgCache.set(id, data); return data; }
  return null;
}
async function uploadPhoto(data) {
  const id = newImgId();
  await setDoc(doc(db, "images", id), { data, by: user.uid, createdAt: serverTimestamp() });
  imgCache.set(id, data); return id;
}
const dropPhoto = id => { if (id) deleteDoc(doc(db, "images", id)).catch(() => {}); imgCache.delete(id); };

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
    if (it.img) { const pc = Object.assign(document.createElement("span"), { className: "pic", textContent: "📷", title: "Has a photo" }); b.append(pc); }
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
// pending photo while the sheet is open: {data} = newly chosen, {removed:true} = taken off, null = unchanged
let pendingPhoto = null;
function showPreview(src) { $("photoImg").src = src || ""; $("photoPrev").hidden = !src; $("photoAdd").textContent = src ? "🔄 Change photo" : "＋ 📷 Add photo"; }
function openSheet(id) {
  editing = id; pendingPhoto = null; $("sheetMsg").textContent = ""; $("photoIn").value = "";
  const it = items.find(i => i.id === id); title.textContent = it ? "EDIT WISH ✎" : "NEW WISH ✿";
  txt.value = it ? it.text : ""; showPreview(null); sheet.hidden = false; setTimeout(() => txt.focus(), 30);
  if (it && it.img) { $("photoAdd").textContent = "Loading photo…"; loadPhoto(it.img).then(src => { if (editing === id && !pendingPhoto) showPreview(src); }).catch(() => showPreview(null)); }
}
function closeSheet() { sheet.hidden = true; editing = null; pendingPhoto = null; }
$("photoAdd").addEventListener("click", () => $("photoIn").click());
$("photoIn").addEventListener("change", async () => {
  const f = $("photoIn").files[0]; if (!f) return;
  $("photoAdd").disabled = true; $("sheetMsg").textContent = "";
  try { const data = await compressPhoto(f); pendingPhoto = { data }; showPreview(data); }
  catch (e) { $("sheetMsg").textContent = e.code === "not-image" ? "That file isn't a photo. Pick a JPG or PNG." : e.code === "too-big" ? "That photo is too large even after shrinking. Try a screenshot or crop." : "Couldn't open that photo. Try another one."; }
  finally { $("photoAdd").disabled = false; $("photoIn").value = ""; }
});
$("photoDel").addEventListener("click", () => { pendingPhoto = { removed: true }; showPreview(null); });
fab.onclick = () => openSheet(null);
$("cancel").onclick = closeSheet;
sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
txt.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
let saving = false;
form.addEventListener("submit", async e => {
  e.preventDefault(); if (saving) return; const v = txt.value.trim();
  if (!v) { txt.placeholder = "Type something first ✿"; txt.focus(); return; }
  const it = editing != null ? items.find(i => i.id === editing) : null;
  let imgId = it ? it.img || null : null, changed = false;
  if (pendingPhoto && pendingPhoto.data) {
    saving = true; $("saveBtn").disabled = true; $("saveBtn").textContent = "Saving photo…"; $("sheetMsg").textContent = "";
    try { const nid = await uploadPhoto(pendingPhoto.data); if (imgId) dropPhoto(imgId); imgId = nid; changed = true; }
    catch (err) { $("sheetMsg").textContent = "The photo didn't upload (" + (err && err.code || "network error") + "). Check your internet and tap Save again."; return; }
    finally { saving = false; $("saveBtn").disabled = false; $("saveBtn").textContent = "Save"; }
  } else if (pendingPhoto && pendingPhoto.removed && imgId) { dropPhoto(imgId); imgId = null; changed = true; }
  if (it) { if (it.text !== v || changed) { it.text = v; it.img = imgId; it.sent = false; } } // edited = needs re-sending
  else { const id = Date.now(); items.push({ id, text: v, img: imgId, sent: false }); justAdded = id; }
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
    await sendWishlist(fresh.map(i => i.text.slice(0, 160)), fresh.map(i => i.img || ""), note.value.trim().slice(0, 300));
    fresh.forEach(i => i.sent = true); save();
    note.value = ""; sendForm.hidden = true; sentCard.hidden = false; render();
  } catch (err) { sendMsg.textContent = "That didn't go through (" + (err && err.code || "network error") + "). Try again in a moment."; }
  finally { sendGo.disabled = false; sendGo.textContent = "Send ✉"; }
});
addEventListener("keydown", e => { if (e.key !== "Escape") return; if (!$("byeSheet").hidden) $("byeSheet").hidden = true; else if (!sheet.hidden) closeSheet(); else if (!sendSheet.hidden) closeSend(); else toggleMenu(false); });

/* ---------- glow sync: items he marked bought ---------- */
// Rules only let her read lists she sent, so the query must filter on "by".
onSnapshot(query(collection(db, "wishlists"), where("by", "==", user.uid)), snap => {
  const next = new Set();
  snap.docs.forEach(d => { const x = d.data(), its = x.items || []; (x.bought || []).forEach(i => { if (its[i] != null) next.add(norm(its[i])); }); });
  const changed = next.size !== boughtTexts.size || [...next].some(t => !boughtTexts.has(t));
  boughtTexts = next;
  if (changed && started && sheet.hidden) render();
}, () => { /* offline or rules not updated yet: bubbles just don't glow */ });
