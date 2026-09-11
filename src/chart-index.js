// FLAT, SEARCHABLE INDEX of every interactive chart — the data layer behind mobile discovery
// (search, topic chips, the Saved / Recent / New rails). charts-catalog.js stays the single source
// of truth for what exists; this adds the plain-language layer on top of it.
import { CHART_GROUPS, AEON_GROUPS, CITY_GROUPS } from "./charts-catalog.js";
import { CHART_AGES } from "./chart-ages.js";

// Every chart, one shape, one list. `dev` charts are direct-link-only and never listed.
export const CHART_INDEX = [
  ...CHART_GROUPS.flatMap(g => g.charts.map(c => ({ ...c, group: g.title, color: g.color, section: "charts" }))),
  ...AEON_GROUPS.flatMap(g => g.charts.map(c => ({ ...c, group: g.title, color: g.color, section: "aeon" }))),
  ...CITY_GROUPS.flatMap(g => g.charts.map(c => ({ ...c, group: g.title, color: g.color, section: "city" }))),
].filter(c => !c.dev).map(c => ({ ...c, href: `/?chart=${c.id}` }));

// ── Plain-language topics ────────────────────────────────────────────────────
// The group names are house vocabulary ("Cost Basis & Profit", "Markets & Positioning"); these are
// the words a visitor would actually use. Mostly derived from the group, with a short override list
// for charts that sit in one group but answer another question. A chart can carry several topics.
const BY_GROUP = {
  "Valuation": ["Valuation"],
  "Performance": ["Price"],
  "Holders": ["Holders"],
  "Cost Basis & Profit": ["Profit"],
  "Whales & Survivors": ["Whales"],
  "Exchanges": ["Exchanges"],
  "Markets & Positioning": ["Price"],
  "Races": ["Price"],
  "Market": ["NFTs"],
  "Rarity": ["NFTs"],
  "SPX City": ["City"],
};
// id → extra topics. Kept SHORT on purpose: a chip that returns half the catalogue is not a filter.
// Each chart takes ONE topic from its group; only genuinely cross-cutting subjects get a second.
const EXTRA = {
  // "is this dangerous right now" spans several groups
  risk: ["Risk"], riskcolor: ["Risk"], riskheat: ["Risk"], drawdown: ["Risk"],
  quantilefan: ["Risk"], picycle: ["Risk"], longshort: ["Risk"],
  // the 3D cities live in other groups but people look for them as "the city"
  clustercity: ["City"], whaleswatching: ["City"], aeonskyline: ["City"],
};
// Aeon has its own "Holders" group, but an AEON holder is not an SPX holder — the NFT track stays
// under one chip so the SPX chips answer SPX questions.
const topicsFor = c => (c.section === "aeon"
  ? ["NFTs", ...(EXTRA[c.id] || [])]
  : [...new Set([...(BY_GROUP[c.group] || []), ...(EXTRA[c.id] || [])])]);

for (const c of CHART_INDEX) c.topics = topicsFor(c);

// Chip order: the questions people arrive with, commonest first. Only chips that match something.
export const TOPICS = ["Valuation", "Price", "Holders", "Profit", "Whales", "Exchanges", "Risk", "City", "NFTs"]
  .filter(t => CHART_INDEX.some(c => c.topics.includes(t)));

export const chartsForTopic = t => CHART_INDEX.filter(c => c.topics.includes(t));

// ── Search ───────────────────────────────────────────────────────────────────
// Deliberately simple and predictable: every whitespace-separated term must appear somewhere in the
// chart's text. Ranking prefers a title hit over a description hit so "whale" leads with the whale
// charts, not every chart that mentions whales in passing.
const norm = s => String(s || "").toLowerCase();
export function searchCharts(query, list = CHART_INDEX) {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return list
    .map(c => {
      const title = norm(c.title), hay = `${title} ${norm(c.desc)} ${norm(c.group)} ${norm(c.topics.join(" "))} ${norm(c.id)}`;
      if (!terms.every(t => hay.includes(t))) return null;
      let score = 0;
      for (const t of terms) {
        if (title === t) score += 100;
        else if (title.startsWith(t)) score += 50;
        else if (title.includes(t)) score += 25;
        else if (norm(c.group).includes(t) || c.topics.some(x => norm(x).includes(t))) score += 8;
        else score += 1;                      // description-only hit
      }
      return { c, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.c.title.localeCompare(b.c.title))
    .map(r => r.c);
}

// ── Rails ────────────────────────────────────────────────────────────────────
// "New" is REPRODUCIBLE, not editorial: chart-ages.js is generated from git — the commit that first
// introduced each id into charts-catalog.js (scripts/build-chart-ages.mjs). Empty (so the rail
// hides) when history isn't available, e.g. a shallow CI clone.
export function newestCharts(n = 6) {
  return CHART_INDEX.filter(c => CHART_AGES[c.id])
    .sort((a, b) => (CHART_AGES[b.id] || "").localeCompare(CHART_AGES[a.id] || ""))
    .slice(0, n);
}
export const addedOn = id => CHART_AGES[id] || null;

// A CURATED shortlist, labelled as such in the UI. There is deliberately no "Popular" rail: visit
// counts live behind /api/intel, which needs a KV store the project hasn't connected, and inventing
// a popularity ranking would be exactly the unverifiable number this project refuses to ship.
export const START_HERE = ["channel", "valuation", "mvrv", "hodlwaves", "whales", "cexflow"]
  .map(id => CHART_INDEX.find(c => c.id === id)).filter(Boolean);
