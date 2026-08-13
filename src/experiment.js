import { initJsPsych } from "jspsych";
import htmlButtonResponse from "https://unpkg.com/@jspsych/plugin-html-button-response@1.1.3/dist/index.js";
import preload from "https://unpkg.com/@jspsych/plugin-preload@1.1.3/dist/index.js";

import { CATEGORIES, ATTRIBUTES, PALETTES, MIN_RESPONSE_TIME_MS } from "../config.js";
import { createSessionId, startSession, logTrial, completeSession } from "./firebase.js";

const sessionId = createSessionId();

const jsPsych = initJsPsych({
  display_element: "jspsych-target",
  on_finish: () => {
    completeSession(sessionId).catch((error) => console.error("Failed to complete session:", error));
  },
});

function shuffledCopy(array) {
  return jsPsych.randomization.shuffle(array.slice());
}

// Lets desktop respondents answer with the classic IAT keys (E = left
// button, I = right button) in addition to clicking/tapping. Returns a
// cleanup function to remove the listener once the trial ends.
function bindKeyboardChoice() {
  const handler = (event) => {
    const key = event.key.toLowerCase();
    if (key === "e") {
      document.querySelector("#jspsych-html-button-response-button-0")?.click();
    } else if (key === "i") {
      document.querySelector("#jspsych-html-button-response-button-1")?.click();
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

const TOO_FAST_WARNING = `<p class="too-fast-warning">That was too fast — please take a moment to consider each word before responding.</p>`;
const DEFAULT_BUTTON_HTML = '<button class="jspsych-btn">%choice%</button>';

// Builds a single trial that alternates between two phases: the actual
// question, and (if answered too fast) a standalone warning screen shown on
// its own before the question repeats. Looping on ONE trial like this, with
// its own content chosen dynamically per phase, avoids relying on jsPsych's
// per-pass evaluation of a second sibling trial's conditional_function,
// which does not reliably see the value the *current* pass just set.
function buildRepeatingTrial({ data, buildStimulus, buildChoices, buildButtonHtml, onLoad, onValidResponse }) {
  const state = { phase: "question", done: false };
  let cleanupKeyboard = () => {};

  const trial = {
    type: htmlButtonResponse,
    stimulus: () => (state.phase === "warning" ? TOO_FAST_WARNING : buildStimulus()),
    choices: () => (state.phase === "warning" ? ["Continue"] : buildChoices()),
    button_html: () =>
      state.phase === "warning" ? DEFAULT_BUTTON_HTML : buildButtonHtml ? buildButtonHtml() : DEFAULT_BUTTON_HTML,
    data,
    on_load: () => {
      if (state.phase === "question" && onLoad) {
        cleanupKeyboard = onLoad();
      }
    },
    on_finish: (data) => {
      if (state.phase === "warning") {
        state.phase = "question";
        return;
      }
      cleanupKeyboard();
      cleanupKeyboard = () => {};
      const tooFast = data.rt !== null && data.rt < MIN_RESPONSE_TIME_MS;
      if (tooFast) {
        state.phase = "warning";
        return;
      }
      state.done = true;
      onValidResponse(data);
    },
  };

  return { timeline: [trial], loop_function: () => !state.done };
}

function buildFitBlock(category) {
  const instructions = {
    type: htmlButtonResponse,
    stimulus: `
      <h2>${category.label}</h2>
      <p>You'll see a series of words. For each one, choose as quickly as you
      can whether it <strong>Fits</strong> or <strong>Does Not Fit</strong>
      with "${category.label}".</p>
      <p>On a computer, you can also press <strong>E</strong> for Fits or
      <strong>I</strong> for Does Not Fit.</p>
    `,
    choices: ["Start"],
  };

  const choices = ["Fits", "Does Not Fit"];

  const trials = shuffledCopy(ATTRIBUTES).map((attribute) =>
    buildRepeatingTrial({
      data: {
        task: "fit_judgment",
        category_id: category.id,
        category_label: category.label,
        attribute,
      },
      buildStimulus: () => `
        <div class="category-label">${category.label}</div>
        <div class="attribute-word">${attribute}</div>
      `,
      buildChoices: () => choices,
      buildButtonHtml: () => [
        '<button class="jspsych-btn fits-btn">%choice%</button>',
        '<button class="jspsych-btn does-not-fit-btn">%choice%</button>',
      ],
      onLoad: () => bindKeyboardChoice(),
      onValidResponse: (data) => {
        data.response_label = choices[data.response];
        logTrial(sessionId, {
          task: data.task,
          category_id: data.category_id,
          category_label: data.category_label,
          attribute: data.attribute,
          response_label: data.response_label,
          rt_ms: data.rt,
        }).catch((error) => console.error("Failed to log trial:", error));
      },
    })
  );

  return [instructions, ...trials];
}

function buildPaletteBlock() {
  const instructions = {
    type: htmlButtonResponse,
    stimulus: `
      <h2>Color Match</h2>
      <p>For each word, choose the color palette you feel best fits it.</p>
      <p>On a computer, you can also press <strong>E</strong> for the left
      palette or <strong>I</strong> for the right palette.</p>
    `,
    choices: ["Start"],
  };

  // Shuffled once for the whole block (not per trial) so left/right position
  // stays fixed for this respondent — randomized across respondents to
  // counterbalance position bias, but stable within a session so choosing
  // isn't complicated by the palettes swapping sides every trial.
  const orderedPalettes = shuffledCopy(PALETTES);

  const trials = shuffledCopy(ATTRIBUTES).map((attribute) => {
    return buildRepeatingTrial({
      data: {
        task: "palette_choice",
        attribute,
      },
      buildStimulus: () => `<div class="attribute-word">${attribute}</div>`,
      buildChoices: () => orderedPalettes.map((p) => p.label),
      buildButtonHtml: () =>
        orderedPalettes.map(
          (p) => `<button class="jspsych-btn palette-btn"><img src="${p.image}" alt="${p.label}" /></button>`
        ),
      onLoad: () => bindKeyboardChoice(),
      onValidResponse: (data) => {
        const chosen = orderedPalettes[data.response];
        data.palette_id = chosen.id;
        data.palette_label = chosen.label;
        logTrial(sessionId, {
          task: data.task,
          attribute: data.attribute,
          palette_id: data.palette_id,
          palette_label: data.palette_label,
          rt_ms: data.rt,
        }).catch((error) => console.error("Failed to log trial:", error));
      },
    });
  });

  return [instructions, ...trials];
}

async function run() {
  const categoryOrder = shuffledCopy(CATEGORIES);

  // Fire-and-forget: a Firebase hiccup (or, right now, the placeholder
  // credentials in firebase-config.js) should never block the survey
  // from rendering for the respondent.
  startSession(sessionId, {
    user_agent: navigator.userAgent,
    category_order: categoryOrder.map((c) => c.id),
  }).catch((error) => console.error("Failed to start Firebase session:", error));

  const timeline = [
    {
      type: preload,
      images: PALETTES.map((p) => p.image),
    },
  ];

  categoryOrder.forEach((category) => {
    timeline.push(...buildFitBlock(category));
  });

  timeline.push(...buildPaletteBlock());

  timeline.push({
    type: htmlButtonResponse,
    stimulus: "<h2>Thank you!</h2><p>Your responses have been recorded.</p>",
    choices: ["Finish"],
  });

  jsPsych.run(timeline);
}

run();
