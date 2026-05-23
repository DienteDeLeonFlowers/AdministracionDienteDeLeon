import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjX8on25XqMZBTIZ9Rw1KK5KkZuqzk0iA",
  authDomain: "floreriadientedeleon-365c9.firebaseapp.com",
  projectId: "floreriadientedeleon-365c9",
  storageBucket: "floreriadientedeleon-365c9.firebasestorage.app",
  messagingSenderId: "593791307660",
  appId: "1:593791307660:web:34c7d0077063fcb6c810a9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);