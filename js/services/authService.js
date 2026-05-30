import { auth } from '../config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserSessionPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const CORREO_PERMITIDO = "soportedientedeleontlapacoyan@gmail.com";

export const LAST_ACTIVITY_KEY = 'last_activity';
export const INACTIVITY_TIME = 15 * 60 * 1000;

export async function login(email, password) {
  if (email !== CORREO_PERMITIDO) {
    throw new Error("Acceso no autorizado.");
  }
  await setPersistence(auth, browserSessionPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now());
  return result;
}

export async function logout() {
  sessionStorage.clear();
  await signOut(auth);
}

export function getAuthState() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) {
        resolve(null);
        return;
      }
      const last = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || '0');
      if (!last || Date.now() - last > INACTIVITY_TIME) {
        signOut(auth);
        sessionStorage.clear();
        resolve(null);
        return;
      }
      resolve(user);
    });
  });
}

export const monitorAuthState = (callback) => onAuthStateChanged(auth, callback);