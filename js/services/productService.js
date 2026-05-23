import { db } from '../config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function addProduct(data) {
    return await addDoc(collection(db, "productos"), {
        ...data,
        fecha: serverTimestamp()
    });
}

export async function updateProduct(id, data) {
    return await updateDoc(doc(db, "productos", id), data);
}

export async function deleteProduct(id) {
    return await deleteDoc(doc(db, "productos", id));
}