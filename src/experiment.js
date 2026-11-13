import { initJsPsych } from "jspsych";
import htmlButtonResponse from "https://unpkg.com/@jspsych/plugin-html-button-response@1.1.3/dist/index.js";
import preload from "https://unpkg.com/@jspsych/plugin-preload@1.1.3/dist/index.js";

import { BRANDS, ATTRIBUTES, PRE_TEST, TEXT, MIN_RESPONSE_TIME_MS, NEXT_SURVEY_URL } from "../config.js";
import { respondentKeyFor, createAttemptId, startSession, logTrial, completeSession } from "./firebase.js";

document.title = TEXT.page_title;

// This survey is part 2 of 3. `rdud` and `state` arrive as query params on
// our own inbound URL and must be captured, saved, and passed through
// unchanged to part 3 (Decipher) when this survey finishes.
const inboundParams = new URLSearchParams(window.location.search);
const rdud = inboundParams.get("rdud") || "";
const surveyState = inboundParams.get("state") || "";
const inboundCode = inboundParams.get("inbound_code") || "";

// All of a respondent's data goes in one Firebase node keyed by rdud; each
// page load is a separate attempt within it (see firebase.js).
const respondentKey = respondentKeyFor(rdud);
const attemptId = createAttemptId();

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
    completeSession(respondentKey, attemptId)
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

// Lets desktop respondents press keys in addition to clicking/tapping.
// `keyMap` maps a key (event.key, lowercased; " " is the space bar) to a
// button index. Returns a cleanup function to remove the listener once the
// trial ends. Held-down key repeats are ignored.
function bindKeys(keyMap) {
  const handler = (event) => {
    if (event.repeat) return;
    const index = keyMap[event.key.toLowerCase()];
    if (index === undefined) return;
    event.preventDefault(); // stops the space bar from scrolling the page
    document.querySelector(`#jspsych-html-button-response-button-${index}`)?.click();
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

// Classic IAT keys: E = left button, I = right button.
const bindFitKeys = () => bindKeys({ e: 0, i: 1 });
const bindContinueKey = () => bindKeys({ " ": 0 });

// A button with its keyboard shortcut shown beneath it.
function buttonWithHint(className, hint) {
  return `
    <div class="button-with-hint">
      <button class="jspsych-btn ${className}">%choice%</button>
      <div class="key-hint">${hint}</div>
    </div>
  `;
}

const CONTINUE_BUTTON_HTML = buttonWithHint("", TEXT.space_key_hint);

// A single-button screen (intro, brand intro, thank you) that also advances
// with the space bar.
function continueScreen(stimulus, buttonLabel) {
  let cleanup = () => {};
  return {
    type: htmlButtonResponse,
    stimulus,
    choices: [buttonLabel],
    button_html: CONTINUE_BUTTON_HTML,
    on_load: () => {
      cleanup = bindContinueKey();
    },
    on_finish: () => cleanup(),
  };
}

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
    button_html: () => (trialState.phase === "warning" ? CONTINUE_BUTTON_HTML : buildButtonHtml()),
    data,
    on_load: () => {
      cleanupKeyboard = trialState.phase === "warning" ? bindContinueKey() : onLoad();
    },
    on_finish: (data) => {
      cleanupKeyboard();
      cleanupKeyboard = () => {};
      if (trialState.phase === "warning") {
        trialState.phase = "question";
        return;
      }
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
  { code: "fits", label: TEXT.fits_button, className: "fits-btn", hint: TEXT.fits_key_hint },
  { code: "does_not_fit", label: TEXT.does_not_fit_button, className: "does-not-fit-btn", hint: TEXT.does_not_fit_key_hint },
];

function buildBrandBlock(brand, brandIndex) {
  const brandIntro = continueScreen(
    `
      ${withBrand(TEXT.brand_intro_before_html, brand)}
      ${brandHeader(brand)}
      ${withBrand(TEXT.brand_intro_after_html, brand)}
    `,
    TEXT.brand_intro_button
  );

  const trials = shuffledCopy(ATTRIBUTES).map((attribute, attributeIndex) =>
    buildFitTrial({
      header: brandHeader(brand),
      attribute,
      data: {
        task: "fit_judgment",
        brand_id: brand.id,
        brand_label: brand.label,
        brand_index: brandIndex,
        attribute,
        attribute_index: attributeIndex,
      },
    })
  );

  return [brandIntro, ...trials];
}

// Practice round: one image + one word per item, in random order. Logged
// with task "pre_test" plus whether the answer matched the expected one, and
// not counted toward the progress bar.
function buildPreTestBlock() {
  const intro = continueScreen(TEXT.pre_test_intro_html, TEXT.pre_test_intro_button);

  const trials = shuffledCopy(PRE_TEST).map((item, itemIndex) =>
    buildFitTrial({
      header: `<img src="${item.image}" alt="" class="pre-test-image" />`,
      attribute: item.attribute,
      countsTowardProgress: false,
      data: {
        task: "pre_test",
        pre_test_item_id: item.id,
        attribute: item.attribute,
        attribute_index: itemIndex,
        expected_response: item.expected,
      },
    })
  );

  const done = continueScreen(TEXT.pre_test_done_html, TEXT.pre_test_done_button);
  return [intro, ...trials, done];
}

// A single Fits / Does Not Fit trial: `header` HTML (brand logo/name or a
// practice image) above the attribute word. Everything in `data` is saved to
// Firebase along with the response.
function buildFitTrial({ header, attribute, data, countsTowardProgress = true }) {
  return buildRepeatingTrial({
    data,
    buildStimulus: () => `
      ${header}
      <div class="attribute-word">${attribute}</div>
    `,
    buildChoices: () => FIT_RESPONSES.map((r) => r.label),
    buildButtonHtml: () => FIT_RESPONSES.map((r) => buttonWithHint(r.className, r.hint)),
    onLoad: bindFitKeys,
    onValidResponse: (trialData) => {
      const chosen = FIT_RESPONSES[trialData.response];
      trialData.response_code = chosen.code;
      trialData.response_label = chosen.label;
      if (countsTowardProgress) {
        completedJudgments += 1;
        jsPsych.setProgressBar(completedJudgments / TOTAL_JUDGMENTS);
      }
      const record = {
        ...data,
        response_code: chosen.code,
        response_label: chosen.label,
        rt_ms: trialData.rt,
      };
      if (data.expected_response) {
        record.correct = chosen.code === data.expected_response;
      }
      logTrial(respondentKey, attemptId, record).catch((error) => console.error("Failed to log trial:", error));
    },
  });
}

function run() {
  const brandOrder = shuffledCopy(BRANDS);

  // Fire-and-forget: a Firebase hiccup should never block the survey from
  // rendering for the respondent.
  startSession(respondentKey, attemptId, {
    respondent: {
      rdud,
      state: surveyState,
      inbound_code: inboundCode,
    },
    attempt: {
      user_agent: navigator.userAgent,
      brand_order: brandOrder.map((b) => b.id),
    },
  }).catch((error) => console.error("Failed to start Firebase session:", error));

  const timeline = [
    {
      type: preload,
      images: [...PRE_TEST.map((item) => item.image), ...BRANDS.map((b) => b.image)],
    },
    continueScreen(TEXT.intro_html, TEXT.intro_button),
    ...buildPreTestBlock(),
  ];

  brandOrder.forEach((brand, brandIndex) => {
    timeline.push(...buildBrandBlock(brand, brandIndex));
  });

  timeline.push(continueScreen(TEXT.thank_you_html, TEXT.thank_you_button));

  jsPsych.run(timeline);
}

run();
