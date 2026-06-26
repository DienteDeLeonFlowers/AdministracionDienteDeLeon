import { db, storage } from '../config.js';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const COL = 'custom_options';

export async function addOption(data) {
  return await addDoc(collection(db, COL), { ...data, activo: true });
}

export async function updateOption(id, data) {
  return await updateDoc(doc(db, COL, id), data);
}

export async function toggleOptionStatus(id, current) {
  return await updateDoc(doc(db, COL, id), { activo: !current });
}

export async function deleteOption(id, imageUrl) {
  await deleteDoc(doc(db, COL, id));
  if (imageUrl) {
    try {
      await deleteObject(ref(storage, imageUrl));
    } catch (_) {}
  }
}

export async function getOptionsBySection(seccionId) {
  const snap = await getDocs(
    query(collection(db, COL), where('seccionId', '==', seccionId))
  );
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return docs.sort((a, b) => a.nombre.localeCompare(b.nombre));
}