import { auth } from '../config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const CORREO_PERMITIDO = "soportedientedeleontlapacoyan@gmail.com";

export const FORCE_LOGOUT_KEY = 'force_logout';
export const LAST_ACTIVITY_KEY = 'last_activity';
export const INACTIVITY_TIME = 15 * 60 * 1000;

export async function login(email, password) {
  if (email !== CORREO_PERMITIDO) {
    throw new Error("Acceso no autorizado.");
  }
  localStorage.removeItem(FORCE_LOGOUT_KEY);
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now());
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  localStorage.setItem(FORCE_LOGOUT_KEY, '1');
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  sessionStorage.clear();
  await signOut(auth);
}

export function getAuthState() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user && localStorage.getItem(FORCE_LOGOUT_KEY) === '1') {
        signOut(auth);
        resolve(null);
        return;
      }
      const last = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (user && last && Date.now() - Number(last) > INACTIVITY_TIME) {
        signOut(auth);
        localStorage.setItem(FORCE_LOGOUT_KEY, '1');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        sessionStorage.clear();
        resolve(null);
        return;
      }
      resolve(user);
    });
  });
}

export const monitorAuthState = (callback) => onAuthStateChanged(auth, callback);