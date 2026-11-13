// Firebase wiring: Realtime Database. All data lives under ROOT_NODE, with
// one child node per respondent (keyed by their rdud). Data is written as the
// survey happens. Reloading the page starts the survey over and replaces that
// respondent's node, so it always holds just their latest run.
//
//   <ROOT_NODE>/<rdud>/
//     rdud, state, inbound_code, user_agent, brand_order, started_at
//     completed_at        — only if they finished
//     responses/<pushId>  — one entry per trial, written as it's answered

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

const ROOT_NODE = "implicit_localiza_survey";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Node key for a respondent: their rdud (with characters Firebase doesn't
// allow in keys replaced). Without an rdud, e.g. opening the page directly
// while testing, each page load gets its own "no_rdud_" node.
export function respondentKeyFor(rdud) {
  return rdud ? rdud.replace(/[.#$[\]/]/g, "_") : `no_rdud_${crypto.randomUUID()}`;
}

// set (not update) replaces the whole node, so if a respondent reloads and
// starts over, their earlier data is cleared and only the latest run is kept.
export async function startSession(respondentKey, meta) {
  await set(ref(db, `${ROOT_NODE}/${respondentKey}`), {
    ...meta,
    started_at: serverTimestamp(),
  });
}

export async function logTrial(respondentKey, trialData) {
  await set(push(ref(db, `${ROOT_NODE}/${respondentKey}/responses`)), {
    ...trialData,
    recorded_at: serverTimestamp(),
  });
}

export async function completeSession(respondentKey) {
  await update(ref(db, `${ROOT_NODE}/${respondentKey}`), {
    completed_at: serverTimestamp(),
  });
}
