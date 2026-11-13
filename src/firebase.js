// Firebase wiring: Realtime Database. All of this survey's data lives under
// the ROOT_NODE path so it doesn't collide with other data in the same
// database.
//
// Each respondent gets exactly ONE node directly under ROOT_NODE, keyed by
// their Decipher `rdud`. If they reload the page or reopen the link, the new
// visit is recorded as another "attempt" inside the same node rather than as
// a new node:
//
//   <ROOT_NODE>/<rdud>/
//     rdud, state, inbound_code     — latest values from the inbound URL
//     last_attempt_id
//     completed_at                  — set when any attempt finishes
//     attempts/<attemptId>/         — one per page load
//       user_agent, brand_order, started_at, completed_at
//     responses/<pushId>/           — one per trial, from every attempt
//       ...trial fields, attempt_id, recorded_at
//
// Every write is an update/push (never a whole-node set), so a later attempt
// never wipes out an earlier one's data.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  update,
  push,
  set,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { firebaseConfig } from "../firebase-config.js";

const ROOT_NODE = "implicit_localiza_survey";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Realtime Database keys can't contain . # $ [ ] /
function toSafeKey(value) {
  return value.replace(/[.#$[\]/]/g, "_");
}

// Node key for a respondent: their rdud when present. Without one (e.g.
// opening the page directly while testing) there's nothing to tie visits
// together, so each load gets its own clearly labelled node.
export function respondentKeyFor(rdud) {
  return rdud ? toSafeKey(rdud) : `no_rdud_${crypto.randomUUID()}`;
}

export function createAttemptId() {
  return crypto.randomUUID();
}

export async function startSession(respondentKey, attemptId, { respondent, attempt }) {
  await update(ref(db, `${ROOT_NODE}/${respondentKey}`), {
    ...respondent,
    last_attempt_id: attemptId,
    [`attempts/${attemptId}`]: {
      ...attempt,
      started_at: serverTimestamp(),
    },
  });
}

export async function logTrial(respondentKey, attemptId, trialData) {
  const trialRef = push(ref(db, `${ROOT_NODE}/${respondentKey}/responses`));
  await set(trialRef, {
    ...trialData,
    attempt_id: attemptId,
    recorded_at: serverTimestamp(),
  });
}

export async function completeSession(respondentKey, attemptId) {
  await update(ref(db, `${ROOT_NODE}/${respondentKey}`), {
    completed_at: serverTimestamp(),
    [`attempts/${attemptId}/completed_at`]: serverTimestamp(),
  });
}
