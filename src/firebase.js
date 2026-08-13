// Firebase wiring: Realtime Database. All of this survey's data lives under
// the ROOT_NODE path so it doesn't collide with other data in the same
// database. One node per session, one push-keyed child per trial response.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  push,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { firebaseConfig } from "../firebase-config.js";

const ROOT_NODE = "implicit_color_survey";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export function createSessionId() {
  return crypto.randomUUID();
}

export async function startSession(sessionId, meta) {
  await set(ref(db, `${ROOT_NODE}/sessions/${sessionId}`), {
    ...meta,
    started_at: serverTimestamp(),
  });
}

export async function logTrial(sessionId, trialData) {
  const trialRef = push(ref(db, `${ROOT_NODE}/sessions/${sessionId}/responses`));
  await set(trialRef, {
    ...trialData,
    recorded_at: serverTimestamp(),
  });
}

export async function completeSession(sessionId) {
  await update(ref(db, `${ROOT_NODE}/sessions/${sessionId}`), {
    completed_at: serverTimestamp(),
  });
}
