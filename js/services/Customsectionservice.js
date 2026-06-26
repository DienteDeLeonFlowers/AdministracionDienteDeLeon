import { db } from '../config.js';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COL = 'custom_sections';

export async function addSection(data) {
  return await addDoc(collection(db, COL), { ...data, activo: true });
}

export async function updateSection(id, data) {
  return await updateDoc(doc(db, COL, id), data);
}

export async function toggleSectionStatus(id, current) {
  return await updateDoc(doc(db, COL, id), { activo: !current });
}

export async function deleteSection(id) {
  return await deleteDoc(doc(db, COL, id));
}

export async function getSections() {
  const snap = await getDocs(query(collection(db, COL), orderBy('nombre')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}