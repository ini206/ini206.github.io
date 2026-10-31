// Shared Firebase setup + auth guard for every page.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeAuth, indexedDBLocalPersistence, browserSessionPersistence,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ROLES, ADMIN_IDLE_MINUTES } from "./config.js?v=20261031e";

export const app = initializeApp(firebaseConfig);
// initializeAuth without a popup/redirect resolver: no hidden auth iframe gets loaded.
// Admin signs in with session-only persistence (gone when the tab closes); she uses local persistence.
export const auth = initializeAuth(app, { persistence: [browserSessionPersistence, indexedDBLocalPersistence] });
export const db = getFirestore(app);

export const roleOf = user => !user ? null : user.uid === ROLES.admin ? "admin" : user.uid === ROLES.her ? "her" : "unknown";
// Same tag as the ?v= on every file: redirects always land on a fresh page after a deploy.
const V = "20261031e";
export const pageFor = role => (role === "admin" ? "admin.html" : role === "her" ? "shop.html" : "index.html") + "?v=" + V;

export async function logout(reason) {
  try { await signOut(auth); } catch (e) {}
  try { sessionStorage.setItem("lakeside-logout-reason", reason || ""); } catch (e) {}
  location.replace(pageFor(null));
}

/** Resolve once auth state is known. If the user isn't `want`, bounce them to the right page. */
export function requireRole(want) {
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, async user => {
      const role = roleOf(user);
      if (role === want) { resolve(user); return; }
      stop();
      if (role === "unknown") return logout("This account isn't allowed here.");
      location.replace(pageFor(role));
    });
  });
}

/** Sign the admin out after inactivity. */
export function startIdleTimer(minutes = ADMIN_IDLE_MINUTES) {
  let t;
  const reset = () => { clearTimeout(t); t = setTimeout(() => logout("Signed out after " + minutes + " minutes of inactivity."), minutes * 60000); };
  ["pointerdown", "keydown", "scroll", "visibilitychange"].forEach(ev => addEventListener(ev, reset, { passive: true }));
  reset();
}
