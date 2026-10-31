# Lakeside Wishlist

A private, pixel-art shopping wishlist.

- **She** logs in → lands on the lake page → adds wishes → taps **Send**.
- **You** log in → land on the inbox → see her lists live → tick items as bought.
- **Everyone else** sees only a login box. Even calling the database directly gets `PERMISSION_DENIED`.

```
index.html        login (routes by account)
shop.html         her page
admin.html        your inbox
css/lake.css      her page + login styles
css/admin.css     inbox styles
js/config.js      Firebase config + the two UIDs   ← you edit
js/firebase.js    shared init, auth guard, logout, idle timer
js/login.js       login logic
js/shop.js        her page logic + send
js/world.js       the animated lake
js/admin.js       inbox logic
firestore.rules   server-side security rules          ← you edit + publish
```

---

## Setup (~15 min)

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com and click **Add project**. Analytics is optional; you can skip it.
2. Open **Build → Firestore Database → Create database**, choose **Production mode**, and pick a nearby region.
3. Open **Project settings ⚙ → General → Your apps** and add a **Web** app.
4. Copy its config into `firebaseConfig` in `js/config.js`.

### 2. Create the two accounts
1. Open **Build → Authentication → Get started**. Under **Sign-in method**, enable **Email/Password**.
2. In the **Users** tab, click **Add user** and create:

   | Account | Email to enter in Firebase           | Password |
   |---------|--------------------------------------|----------|
   | You     | `<your-username>@lakeside.example`   | 6+ characters (Firebase minimum) |
   | Her     | `<her-username>@lakeside.example`    | 6+ characters |

   The username is whatever comes before `@` (that's what you type on the login page). Never write real usernames or passwords in this repo: everything in it is publicly served.

3. Copy each account's **User UID**.
   - Paste them into `ROLES` in `js/config.js`.
   - Paste the same UIDs into `firestore.rules`.
4. Go to **Authentication → Settings → User actions** and **uncheck "Enable create (sign-up)"** and **"Enable delete"**. Now nobody can register a new account against your project.

### 3. Publish the rules
Paste `firestore.rules` (with your UIDs) into **Firestore → Rules** and click **Publish**.

### 4. Deploy to GitHub Pages
1. Create a repo and push everything to the root.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, then `main` and `/ (root)`.
3. In Firebase, add `<you>.github.io` under **Authentication → Settings → Authorized domains**.
4. Send her `https://<you>.github.io/<repo>/`. You use the same link.

Bitbucket also works. Name the repo `<workspace>.bitbucket.io` and add that domain in Authorized domains.

### 5. Verify it like an attacker
```js
// 1. Unauthenticated read of the database. Expect PERMISSION_DENIED.
fetch("https://firestore.googleapis.com/v1/projects/<projectId>/databases/(default)/documents/wishlists")
  .then(r => r.json()).then(console.log)
```
- Open `shop.html` or `admin.html` in a private window. You should be bounced to the login page.
- Log in as her, then open `/admin.html`. You should be bounced back to the shop page.

---

## Security model

**Authorization lives in `firestore.rules`, not in the pages.** The HTML/JS is public, so anyone can read it. The rules are what actually stop people:
- Only her UID can **create** a list, with exactly the fields `items`, `note`, `by` and `sentAt`:
  - `by` must equal her UID.
  - `sentAt` must be the server time.
  - 1–50 items; the note is capped at 300 characters.
- Only your UID can **read** or **delete** lists. You can **update** only the `bought` field, never her text.
- Everything else is denied.
- Page routing by UID in `config.js` is only for UX. UIDs aren't secrets.

**No credentials in the code.** Passwords are checked by Firebase Auth. Usernames map to `<username>@lakeside.example` internally. Wrong user and wrong password give the same error, so the login doesn't reveal which usernames exist.

**XSS**
- All user text is rendered with `textContent`, never `innerHTML`. Tested with `<img onerror>` and `<script>` payloads: both render as text.
- There's a strict **Content-Security-Policy** on every page:
  - `script-src 'self' https://www.gstatic.com`: no inline scripts and no `eval`, so injected markup can't run.
  - `connect-src` only allows Firestore and Firebase Auth, so even a successful injection couldn't send tokens anywhere else.
  - `base-uri`, `object-src` and `form-action` are locked down.

**Session hijacking**
- Firebase keeps sessions as short-lived ID tokens (1 h) plus a refresh token in browser storage. There are no cookies, so CSRF doesn't apply. The real theft path would be XSS, which the CSP + `textContent` close off.
- **Admin:** the session is stored for **this tab only** (`browserSessionPersistence`), so closing the tab logs you out. You're also auto-logged out after **15 min idle**.
- **Her:** she stays signed in on her device for convenience. The ⏻ BYE button logs her out.
- `initializeAuth` is used without a popup/redirect resolver, so no hidden Firebase auth iframe is loaded.
- `referrer` is set to `no-referrer`, and pages are `noindex`.

**Brute force**
- Firebase Auth throttles failed logins server-side (`auth/too-many-requests`).
- The login page also backs off after 5 failures. That's cosmetic; the server-side throttle is the real limit.

### Known limits / next hardening ideas
- GitHub Pages can't send real HTTP headers. CSP is set via `<meta>`, which can't set `frame-ancestors`, so clickjacking protection would need a host with headers, such as Cloudflare Pages or Netlify, plus `X-Frame-Options`/HSTS.
- **Firebase App Check** with reCAPTCHA Enterprise would make Firestore reject requests that don't come from your real site.
- Add **Subresource Integrity** by self-hosting the Firebase SDK files. gstatic's ES modules can't take SRI hashes directly.
- To kill sessions everywhere, revoke refresh tokens with the Admin SDK, or disable/re-enable the user in the console.
