import { initJsPsych } from "jspsych";
import htmlButtonResponse from "https://unpkg.com/@jspsych/plugin-html-button-response@1.1.3/dist/index.js";
import preload from "https://unpkg.com/@jspsych/plugin-preload@1.1.3/dist/index.js";

import { BRANDS, ATTRIBUTES, TEXT, MIN_RESPONSE_TIME_MS, NEXT_SURVEY_URL } from "../config.js";
import { createSessionId, startSession, logTrial, completeSession } from "./firebase.js";

const sessionId = createSessionId();

document.title = TEXT.page_title;

// This survey is part 2 of 3. `rdud` and `state` arrive as query params on
// our own inbound URL and must be captured, saved, and passed through
// unchanged to part 3 (Decipher) when this survey finishes.
const inboundParams = new URLSearchParams(window.location.search);
const rdud = inboundParams.get("rdud") || "";
const surveyState = inboundParams.get("state") || "";
const inboundCode = inboundParams.get("inbound_code") || "";

function buildNextSurveyUrl() {
  const params = new URLSearchParams({ list: "1" });
  params.set("state", surveyState);
  params.set("rdud", rdud);
  return `${NEXT_SURVEY_URL}?${params.toString()}`;
}

// Progress is advanced manually (only on valid fit judgments) rather than
// auto-updated, because auto-update counts every trial — including intro
// screens and too-fast warning repeats — which would make the bar jump.
const TOTAL_JUDGMENTS = BRANDS.length * ATTRIBUTES.length;
let completedJudgments = 0;

const jsPsych = initJsPsych({
  display_element: "jspsych-target",
  show_progress_bar: true,
  auto_update_progress_bar: false,
  message_progress_bar: TEXT.progress_bar_label,
  on_finish: () => {
    completeSession(sessionId)
      .catch((error) => console.error("Failed to complete session:", error))
      .finally(() => {
        window.location.href = buildNextSurveyUrl();
      });
  },
});

function shuffledCopy(array) {
  return jsPsych.randomization.shuffle(array.slice());
}

function withBrand(text, brand) {
  return text.replaceAll("{brand}", brand.label);
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

const DEFAULT_BUTTON_HTML = '<button class="jspsych-btn">%choice%</button>';

// Builds a single trial that alternates between two phases: the actual
// question, and (if answered too fast) a standalone warning screen shown on
// its own before the question repeats. Looping on ONE trial like this, with
// its own content chosen dynamically per phase, avoids relying on jsPsych's
// per-pass evaluation of a second sibling trial's conditional_function,
// which does not reliably see the value the *current* pass just set.
function buildRepeatingTrial({ data, buildStimulus, buildChoices, buildButtonHtml, onLoad, onValidResponse }) {
  const trialState = { phase: "question", done: false };
  let cleanupKeyboard = () => {};

  const trial = {
    type: htmlButtonResponse,
    stimulus: () => (trialState.phase === "warning" ? TEXT.too_fast_html : buildStimulus()),
    choices: () => (trialState.phase === "warning" ? [TEXT.too_fast_button] : buildChoices()),
    button_html: () =>
      trialState.phase === "warning" ? DEFAULT_BUTTON_HTML : buildButtonHtml ? buildButtonHtml() : DEFAULT_BUTTON_HTML,
    data,
    on_load: () => {
      if (trialState.phase === "question" && onLoad) {
        cleanupKeyboard = onLoad();
      }
    },
    on_finish: (data) => {
      if (trialState.phase === "warning") {
        trialState.phase = "question";
        return;
      }
      cleanupKeyboard();
      cleanupKeyboard = () => {};
      const tooFast = data.rt !== null && data.rt < MIN_RESPONSE_TIME_MS;
      if (tooFast) {
        trialState.phase = "warning";
        return;
      }
      trialState.done = true;
      onValidResponse(data);
    },
  };

  return { timeline: [trial], loop_function: () => !trialState.done };
}

function brandHeader(brand) {
  return `
    <div class="brand-header">
      <img src="${brand.image}" alt="${brand.label}" class="brand-logo" />
      <div class="brand-label">${brand.label}</div>
    </div>
  `;
}

// Fixed order: Fits is always left (button 0 / E key).
const FIT_RESPONSES = [
  { code: "fits", label: TEXT.fits_button, className: "fits-btn" },
  { code: "does_not_fit", label: TEXT.does_not_fit_button, className: "does-not-fit-btn" },
];

function buildBrandBlock(brand, brandIndex) {
  const brandIntro = {
    type: htmlButtonResponse,
    stimulus: `
      ${withBrand(TEXT.brand_intro_before_html, brand)}
      ${brandHeader(brand)}
      ${withBrand(TEXT.brand_intro_after_html, brand)}
    `,
    choices: [TEXT.brand_intro_button],
  };

  const trials = shuffledCopy(ATTRIBUTES).map((attribute, attributeIndex) =>
    buildRepeatingTrial({
      data: {
        task: "fit_judgment",
        brand_id: brand.id,
        brand_label: brand.label,
        brand_index: brandIndex,
        attribute,
        attribute_index: attributeIndex,
      },
      buildStimulus: () => `
        ${brandHeader(brand)}
        <div class="attribute-word">${attribute}</div>
      `,
      buildChoices: () => FIT_RESPONSES.map((r) => r.label),
      buildButtonHtml: () =>
        FIT_RESPONSES.map((r) => `<button class="jspsych-btn ${r.className}">%choice%</button>`),
      onLoad: () => bindKeyboardChoice(),
      onValidResponse: (data) => {
        const chosen = FIT_RESPONSES[data.response];
        data.response_code = chosen.code;
        data.response_label = chosen.label;
        completedJudgments += 1;
        jsPsych.setProgressBar(completedJudgments / TOTAL_JUDGMENTS);
        logTrial(sessionId, {
          task: data.task,
          brand_id: data.brand_id,
          brand_label: data.brand_label,
          brand_index: data.brand_index,
          attribute: data.attribute,
          attribute_index: data.attribute_index,
          response_code: data.response_code,
          response_label: data.response_label,
          rt_ms: data.rt,
        }).catch((error) => console.error("Failed to log trial:", error));
      },
    })
  );

  return [brandIntro, ...trials];
}

function run() {
  const brandOrder = shuffledCopy(BRANDS);

  // Fire-and-forget: a Firebase hiccup should never block the survey from
  // rendering for the respondent.
  startSession(sessionId, {
    user_agent: navigator.userAgent,
    brand_order: brandOrder.map((b) => b.id),
    rdud,
    state: surveyState,
    inbound_code: inboundCode,
  }).catch((error) => console.error("Failed to start Firebase session:", error));

  const timeline = [
    {
      type: preload,
      images: BRANDS.map((b) => b.image),
    },
    {
      type: htmlButtonResponse,
      stimulus: TEXT.intro_html,
      choices: [TEXT.intro_button],
    },
  ];

  brandOrder.forEach((brand, brandIndex) => {
    timeline.push(...buildBrandBlock(brand, brandIndex));
  });

  timeline.push({
    type: htmlButtonResponse,
    stimulus: TEXT.thank_you_html,
    choices: [TEXT.thank_you_button],
  });

  jsPsych.run(timeline);
}

run();
