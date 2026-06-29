import { db, storage } from '../config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export async function addOccasion(nombre, imageUrl) {
  return await addDoc(collection(db, 'ocasiones'), { nombre, imageUrl, activo: true, fecha: serverTimestamp() });
}

export async function updateOccasion(id, nombre, imageUrl = null) {
  const data = { nombre };
  if (imageUrl !== null) data.imageUrl = imageUrl;
  return await updateDoc(doc(db, 'ocasiones', id), data);
}

export async function toggleOccasionStatus(id, status) {
  return await updateDoc(doc(db, 'ocasiones', id), { activo: !status });
}

export async function deleteOccasion(id, imageUrl = '') {
  await deleteDoc(doc(db, 'ocasiones', id));
  if (imageUrl) {
    try { await deleteObject(ref(storage, imageUrl)); } catch (_) {}
  }
}