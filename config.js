// Survey content configuration.
// Edit BRANDS, ATTRIBUTES, and TEXT to change what the survey tests and what
// respondents see — no other file needs to change.

// The brands being tested. Each respondent sees every brand, in a random
// order, and answers every attribute for one brand before moving on.
//   id    — stable identifier saved with the data (don't change mid-fieldwork)
//   label — brand name shown to respondents
//   image — logo path, relative to index.html (PNG/JPG/SVG all work)
// TODO: replace placeholders with the real brand names and logo files.
export const BRANDS = [
  { id: "brand_1", label: "Marca 1", image: "assets/images/brands/brand_1.svg" },
  { id: "brand_2", label: "Marca 2", image: "assets/images/brands/brand_2.svg" },
  { id: "brand_3", label: "Marca 3", image: "assets/images/brands/brand_3.svg" },
  { id: "brand_4", label: "Marca 4", image: "assets/images/brands/brand_4.svg" },
  { id: "brand_5", label: "Marca 5", image: "assets/images/brands/brand_5.svg" },
  { id: "brand_6", label: "Marca 6", image: "assets/images/brands/brand_6.svg" },
];

// Attribute words/phrases. Every brand is tested against every attribute,
// in a fresh random order for each brand.
// TODO: replace placeholders with the real ~50 attributes (in Portuguese).
export const ATTRIBUTES = [
  "Atributo 1", "Atributo 2", "Atributo 3", "Atributo 4", "Atributo 5",
  "Atributo 6", "Atributo 7", "Atributo 8", "Atributo 9", "Atributo 10",
  "Atributo 11", "Atributo 12", "Atributo 13", "Atributo 14", "Atributo 15",
  "Atributo 16", "Atributo 17", "Atributo 18", "Atributo 19", "Atributo 20",
  "Atributo 21", "Atributo 22", "Atributo 23", "Atributo 24", "Atributo 25",
  "Atributo 26", "Atributo 27", "Atributo 28", "Atributo 29", "Atributo 30",
  "Atributo 31", "Atributo 32", "Atributo 33", "Atributo 34", "Atributo 35",
  "Atributo 36", "Atributo 37", "Atributo 38", "Atributo 39", "Atributo 40",
  "Atributo 41", "Atributo 42", "Atributo 43", "Atributo 44", "Atributo 45",
  "Atributo 46", "Atributo 47", "Atributo 48", "Atributo 49", "Atributo 50",
];

// All respondent-facing text. HTML is allowed. `{brand}` is replaced with the
// current brand's label where it appears.
export const TEXT = {
  page_title: "Pesquisa de Associação",

  // Label shown beside the progress bar at the top of every screen.
  progress_bar_label: "Progresso",

  // Shown once, before the first brand.
  intro_html: `
    <h2>Instruções</h2>
    <p>Nesta pesquisa, você verá algumas marcas, uma de cada vez. Para cada
    marca, mostraremos uma série de palavras. Para cada palavra, escolha o mais
    rápido possível se ela <strong>Combina</strong> ou <strong>Não Combina</strong>
    com a sua impressão pessoal sobre a marca.</p>
    <p>Em um computador, você também pode pressionar <strong>E</strong> para
    Combina ou <strong>I</strong> para Não Combina.</p>
  `,
  intro_button: "Começar",

  // Shown before each brand's block, above/below the brand's logo and name.
  brand_intro_before_html: "<p>A próxima marca é:</p>",
  brand_intro_after_html: "<p>Clique em Começar quando estiver pronto(a).</p>",
  brand_intro_button: "Começar",

  // Response buttons. Order is fixed: Fits is always left (E key).
  fits_button: "Combina",
  does_not_fit_button: "Não Combina",

  too_fast_html: `<p class="too-fast-warning">Muito rápido — por favor, reserve um momento para considerar cada palavra antes de responder.</p>`,
  too_fast_button: "Continuar",

  thank_you_html: `
    <h2>Obrigado!</h2>
    <p>Suas respostas foram registradas. Clique no botão Continuar para seguir
    para a parte final do estudo. Não feche a janela do navegador.</p>
  `,
  thank_you_button: "Continuar",
};

// Minimum time, in milliseconds, a respondent must take before an answer is
// accepted on any trial. Responses faster than this are rejected and the same
// trial repeats. This guards against respondents rushing/spamming through the
// survey. Set to 0 to disable.
export const MIN_RESPONSE_TIME_MS = 200;

// Where respondents are sent after completing this survey (part 3 of 3).
// The `state` and `rdud` query params are captured from this survey's own
// inbound URL and appended automatically — don't include them here.
export const NEXT_SURVEY_URL = "https://sw2.decipherinc.com/survey/selfserve/34fd/260809";
