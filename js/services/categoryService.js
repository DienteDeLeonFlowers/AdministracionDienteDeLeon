import { db, storage } from '../config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export async function addCategory(nombre, imageUrl) {
  return await addDoc(collection(db, 'categorias'), { nombre, imageUrl, activo: true, fecha: serverTimestamp() });
}

export async function updateCategory(id, nombre, imageUrl = null) {
  const data = { nombre };
  if (imageUrl !== null) data.imageUrl = imageUrl;
  return await updateDoc(doc(db, 'categorias', id), data);
}

export async function toggleCategoryStatus(id, status) {
  return await updateDoc(doc(db, 'categorias', id), { activo: !status });
}

export async function deleteCategory(id, imageUrl = '') {
  await deleteDoc(doc(db, 'categorias', id));
  if (imageUrl) {
    try { await deleteObject(ref(storage, imageUrl)); } catch (_) {}
  }
}