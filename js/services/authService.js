import { auth } from '../config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserSessionPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const CORREO_PERMITIDO = "soportedientedeleontlapacoyan@gmail.com";

export const LAST_ACTIVITY_KEY = 'session_last_activity';
export const SESSION_ID_KEY = 'session_id';
export const INACTIVITY_TIME = 15 * 60 * 1000;

export async function login(email, password) {
  if (email !== CORREO_PERMITIDO) {
    throw new Error("Acceso no autorizado.");
  }
  await setPersistence(auth, browserSessionPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  const sid = crypto.randomUUID();
  sessionStorage.setItem(SESSION_ID_KEY, sid);
  localStorage.setItem(SESSION_ID_KEY, sid);
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  return result;
}

export async function logout() {
  sessionStorage.clear();
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.setItem('logout_event', Date.now().toString());
  try { await signOut(auth); } catch (_) {}
  localStorage.removeItem('logout_event');
}

export function getAuthState() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) { resolve(null); return; }

      const localSid = localStorage.getItem(SESSION_ID_KEY);
      const sessionSid = sessionStorage.getItem(SESSION_ID_KEY);
      
      if (!localSid || !sessionSid || localSid !== sessionSid) {
        logout().then(() => resolve(null));
        return;
      }

      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
      if (!last || Date.now() - last > INACTIVITY_TIME) {
        logout().then(() => resolve(null));
        return;
      }

      resolve(user);
    });
  });
}

export const monitorAuthState = (callback) => onAuthStateChanged(auth, callback);