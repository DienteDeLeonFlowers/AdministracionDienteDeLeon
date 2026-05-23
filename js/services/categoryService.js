import { db } from '../config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function addCategory(nombre) {
  return await addDoc(collection(db, 'categorias'), { nombre, activo: true, fecha: serverTimestamp() });
}

export async function updateCategory(id, nombre) {
  return await updateDoc(doc(db, 'categorias', id), { nombre });
}

export async function toggleCategoryStatus(id, status) {
  return await updateDoc(doc(db, 'categorias', id), { activo: !status });
}

export async function deleteCategory(id) {
  return await deleteDoc(doc(db, 'categorias', id));
}