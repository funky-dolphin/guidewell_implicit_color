// Firebase wiring: anonymous auth (so Firestore security rules can require
// request.auth != null without asking respondents to sign in) + one document
// per session, one subcollection doc per trial response.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "../firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const authReady = signInAnonymously(auth).catch((error) => {
  console.error("Anonymous sign-in failed:", error);
  throw error;
});

export function createSessionId() {
  return crypto.randomUUID();
}

export async function startSession(sessionId, meta) {
  await authReady;
  await setDoc(doc(db, "sessions", sessionId), {
    ...meta,
    uid: auth.currentUser.uid,
    started_at: serverTimestamp(),
  });
}

export async function logTrial(sessionId, trialData) {
  await authReady;
  const trialRef = doc(collection(db, "sessions", sessionId, "responses"));
  await setDoc(trialRef, {
    ...trialData,
    recorded_at: serverTimestamp(),
  });
}

export async function completeSession(sessionId) {
  await authReady;
  await setDoc(
    doc(db, "sessions", sessionId),
    { completed_at: serverTimestamp() },
    { merge: true }
  );
}
