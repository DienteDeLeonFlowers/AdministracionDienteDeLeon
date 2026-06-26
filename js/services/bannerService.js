import { db, storage } from '../config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const COL = 'banners';

export async function getBanners() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addBanner({ imageUrl, activo = false }) {
  return await addDoc(collection(db, COL), { imageUrl, activo });
}

export async function updateBanner(id, data) {
  await updateDoc(doc(db, COL, id), data);
}

export async function activateBanner(id, allBanners) {
  const batch = writeBatch(db);
  allBanners.forEach(b => {
    batch.update(doc(db, COL, b.id), { activo: b.id === id });
  });
  await batch.commit();
}

export async function deleteBanner(id, imageUrl) {
  await deleteDoc(doc(db, COL, id));
  if (imageUrl) {
    try { await deleteObject(ref(storage, imageUrl)); } catch (_) {}
  }
}