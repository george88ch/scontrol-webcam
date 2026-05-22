// src/boot/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "webcam");
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

export const login = async (email, pw) => {
  return signInWithEmailAndPassword(auth, email, pw);
};

export const register = async (email, pw) => {
  return createUserWithEmailAndPassword(auth, email, pw);
};

export const resetPw = async (email) => {
  return sendPasswordResetEmail(auth, email);
};

export const logout = async () => {
  return signOut(auth);
};
export const onAuthChange = (cb) => {
  return onAuthStateChanged(auth, cb);
};

export const read = async (path) => {
  const d = doc(db, path);
  const snap = await getDoc(d);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const write = async (path, data) => {
  const d = doc(db, path);
  return setDoc(d, data, { merge: true });
};
export const listen = (path, cb) => {
  const d = doc(db, path);
  return onSnapshot(d, (snap) => cb({ id: snap.id, ...snap.data() }));
};

export const addMember = (sessionPath, memberId) => {
  const d = doc(db, sessionPath);
  return updateDoc(d, { members: arrayUnion(memberId) });
};

export const upload = async (path, file) => {
  const r = ref(storage, path);
  await uploadBytes(r, file);
  return getDownloadURL(r);
};
export const getUrl = (path) => {
  const r = ref(storage, path);
  return getDownloadURL(r);
};
export const deleteFile = (path) => {
  const r = ref(storage, path);
  return deleteObject(r);
};
export const userImagePath = (uid, filename) => {
  return `users/${uid}/images/${filename}`;
};
