import { auth } from '../config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const CORREO_PERMITIDO = "soportedientedeleontlapacoyan@gmail.com";
const FORCE_LOGOUT_KEY = 'force_logout';

export async function login(email, password) {
  if (email !== CORREO_PERMITIDO) {
    throw new Error("Acceso no autorizado.");
  }
  localStorage.removeItem(FORCE_LOGOUT_KEY);
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  localStorage.setItem(FORCE_LOGOUT_KEY, '1');
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
      } else {
        resolve(user);
      }
    });
  });
}

export const monitorAuthState = (callback) => onAuthStateChanged(auth, callback);