// TypeSafe "Jev" — a System One model: unstructured state in, TYPED decisions out.
// https://docs.typesafe.ai/  ·  POST https://api.typesafe.ai/v1/systemone
//
// Unlike the OpenRouter LLM in llm-copy.mjs, this returns no prose. Three question types:
//   choice — pick one of N options → { choice, probabilities{}, confidence }
//   score  — rate against ordered levels → { score (continuous), legend{}, confidence }
//   noul   — a yes/no statement → { noul } (probability it is true, no confidence)
//
// ⭐ WHY IT SUITS THIS PROJECT. The whole moat is that a number can be checked. An LLM's paragraph
// cannot be audited; a Jev answer can — you get the full probability distribution, so the decision
// AND its uncertainty can be committed next to the result and re-read later. Its own docs prescribe
// three confidence bands (act / flag for review / route to a human), which is already this repo's
// human-in-the-loop rule.
//
// ⚠ HARD RULE: Jev must NEVER produce a number we publish. It decides WHICH honest thing to surface
// and WHETHER something is safe or worth a human's attention. Every figure on a card stays
// reproducible from the on-chain pipeline alone.
//
// Fails soft by design: no key, a network error, a bad status or a malformed body all return null,
// and every caller treats null as "fall back to what we did before".

const ENDPOINT = process.env.TYPESAFE_URL || "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.TYPESAFE_MODEL || "jev-latest";

export const hasKey = () => !!process.env.TYPESAFE_API_KEY;

/** Question builders — thin, so a caller reads like the docs. */
export const choice = (instructions, criteria) => ({ type: "choice", instructions, criteria });
export const score = (instructions, criteria) => ({ type: "score", instructions, criteria });
export const noul = instructions => ({ type: "noul", instructions });

/**
 * Ask Jev one or more typed questions about a piece of state.
 * @param {string|object} state        what the model should look at (a string, or an object we JSON it)
 * @param {object} questions           { name: choice()|score()|noul() }
 * @param {object} [opts]              { fetchImpl, timeoutMs, model }
 * @returns {Promise<object|null>}     { answers, usage, model } or null on ANY failure
 */
export async function ask(state, questions, opts = {}) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key || !questions || !Object.keys(questions).length) return null;
  const f = opts.fetchImpl || globalThis.fetch;
  if (typeof f !== "function") return null;

  const body = {
    state: typeof state === "string" ? state : JSON.stringify(state),
    model: opts.model || MODEL,
    questions,
  };
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), opts.timeoutMs ?? 20000) : null;
  try {
    const r = await f(ENDPOINT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl?.signal,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.answers ? j : null;
  } catch { return null; }
  finally { if (timer) clearTimeout(timer); }
}

/**
 * The docs' three confidence bands, named once so every caller gates the same way and a reader can
 * see what the thresholds were. Noul answers carry no confidence — judge those on the probability.
 */
export const BANDS = { act: 0.75, review: 0.45 };
export const band = conf =>
  (!Number.isFinite(conf) ? "unknown" : conf >= BANDS.act ? "act" : conf >= BANDS.review ? "review" : "ask-a-human");

/** The exact request that WOULD be sent — so a run with no key still shows its work. */
export const preview = (state, questions, opts = {}) => ({
  endpoint: ENDPOINT,
  body: { state: typeof state === "string" ? state : JSON.stringify(state), model: opts.model || MODEL, questions },
});
