// 1) Paste your Firebase web config (Project settings → General → Your apps → Config).
//    Public by design: it only names your project. Firestore rules are the real lock.
export const firebaseConfig = {
  apiKey: "AIzaSyB96mQSS21nse1zQL7Wjd4bTcYx9qx1qnk",
  authDomain: "shopping-list-edc55.firebaseapp.com",
  projectId: "shopping-list-edc55",
  storageBucket: "shopping-list-edc55.firebasestorage.app",
  messagingSenderId: "632703507497",
  appId: "1:632703507497:web:4ac44ff25a8f9ff852d038"
};

// 2) Paste the two UIDs from Firebase Console → Authentication → Users.
//    These only decide which page to show; the Firestore rules enforce the same UIDs server-side.
export const ROLES = {
  admin: "QFJRZvqHsAY7IUSCcVJS6yhF4Di2",
  her: "XTR9TcajnTXxx4AM7lo5VwzCZWQ2"
};

// Usernames are turned into Firebase emails as  <username>@<LOGIN_DOMAIN>.
// Create the users in the console with exactly these emails (e.g. yourname@bocun.com).
export const LOGIN_DOMAIN = "bocun.com";

// Name shown on her Send popup.
export const TO_NAME = "DK";

// Admin is signed out after this many minutes without activity.
export const ADMIN_IDLE_MINUTES = 15;
