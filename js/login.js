// Login: username + password → Firebase Auth → route by UID.
import { auth, roleOf, pageFor } from "./firebase.js";
import {
  signInWithEmailAndPassword, setPersistence, signOut,
  browserSessionPersistence, indexedDBLocalPersistence, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { LOGIN_DOMAIN } from "./config.js";

const form = document.getElementById("loginForm"), userEl = document.getElementById("user"), passEl = document.getElementById("pass"),
  msg = document.getElementById("loginMsg"), go = document.getElementById("loginGo");

// A reason left by logout() (e.g. idle timeout) is shown once.
try { const r = sessionStorage.getItem("lakeside-logout-reason"); if (r) msg.textContent = r; sessionStorage.removeItem("lakeside-logout-reason"); } catch (e) {}

// Usernames: 2-40 lowercase letters, digits, dot, dash, underscore. Anything else never reaches Firebase.
const USERNAME = /^[a-z0-9._-]{2,40}$/;
let busy = false, fails = 0, lockedUntil = 0;

// Already signed in? Go straight to the right page.
const stop = onAuthStateChanged(auth, user => {
  stop();
  const role = roleOf(user);
  if (role === "admin" || role === "her") { location.replace(pageFor(role)); return; }
  if (role === "unknown") signOut(auth);
  go.disabled = false; go.textContent = "Log in ▶"; userEl.focus();
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  const now = Date.now();
  if (now < lockedUntil) { msg.textContent = `Too many tries. Wait ${Math.ceil((lockedUntil - now) / 1000)}s.`; return; }
  const username = userEl.value.trim().toLowerCase(), password = passEl.value;
  if (!USERNAME.test(username) || !password) { msg.textContent = "Enter your username and password."; return; }

  busy = true; go.disabled = true; go.textContent = "Checking…"; msg.textContent = "";
  try {
    // Everyone starts with a tab-only session; only her account is then moved to device storage.
    // Roles come from the UID, so no usernames live in this public code.
    await setPersistence(auth, browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, `${username}@${LOGIN_DOMAIN}`, password);
    passEl.value = "";
    const role = roleOf(cred.user);
    if (role === "unknown") { await signOut(auth); throw { code: "not-allowed" }; }
    if (role === "her") await setPersistence(auth, indexedDBLocalPersistence);
    location.replace(pageFor(role));
  } catch (err) {
    fails++;
    if (fails >= 5) { lockedUntil = Date.now() + 30000 * (fails - 4); }
    // Same message for wrong user and wrong password: don't confirm which usernames exist.
    msg.textContent = err.code === "auth/network-request-failed" ? "No connection. Check your internet."
      : err.code === "auth/too-many-requests" ? "Too many tries. Wait a few minutes."
      : "That username or password isn't right.";
    passEl.value = ""; passEl.focus();
  } finally {
    busy = false; go.disabled = false; go.textContent = "Log in ▶";
  }
});
