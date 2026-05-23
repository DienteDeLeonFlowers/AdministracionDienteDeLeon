import { db } from '../config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function addOccasion(nombre) {
  return await addDoc(collection(db, 'ocasiones'), { nombre, activo: true, fecha: serverTimestamp() });
}

export async function updateOccasion(id, nombre) {
  return await updateDoc(doc(db, 'ocasiones', id), { nombre });
}

export async function toggleOccasionStatus(id, status) {
  return await updateDoc(doc(db, 'ocasiones', id), { activo: !status });
}

export async function deleteOccasion(id) {
  return await deleteDoc(doc(db, 'ocasiones', id));
}