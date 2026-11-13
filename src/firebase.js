// Firebase wiring: Realtime Database.
//
// Nothing is saved while the survey is in progress. When a respondent
// finishes, their whole session is written as ONE node:
//
//   implicit_localiza_survey/<rdud>/
//     rdud, state, inbound_code, user_agent, brand_order, completed_at
//     responses/0..N   — one entry per trial, in the order answered

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { firebaseConfig } from "../firebase-config.js";

const ROOT_NODE = "implicit_localiza_survey";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export async function saveSession(rdud, session) {
  // Node key is the rdud (with characters Firebase doesn't allow replaced);
  // without one, e.g. when testing, a random "no_rdud_" key is used.
  const key = rdud ? rdud.replace(/[.#$[\]/]/g, "_") : `no_rdud_${crypto.randomUUID()}`;
  await set(ref(db, `${ROOT_NODE}/${key}`), {
    ...session,
    completed_at: serverTimestamp(),
  });
}
