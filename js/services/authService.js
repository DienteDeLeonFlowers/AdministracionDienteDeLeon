import { auth } from '../config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const CORREO_PERMITIDO = "soportedientedeleontlapacoyan@gmail.com"; 

export async function login(email, password) {
    if (email !== CORREO_PERMITIDO) {
        throw new Error("Acceso no autorizado.");
    }
    return await signInWithEmailAndPassword(auth, email, password);
}

export const logout = () => signOut(auth);
export const monitorAuthState = (callback) => onAuthStateChanged(auth, callback);