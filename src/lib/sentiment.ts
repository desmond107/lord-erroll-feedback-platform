// Lightweight, dependency-free sentiment and theme extraction for guest comments.
// Combines the guest's own ratings (strongest signal) with a small English + Swahili lexicon.

const POSITIVE = [
  "excellent", "exceptional", "amazing", "wonderful", "delicious", "lovely", "beautiful", "perfect", "great", "fantastic",
  "superb", "outstanding", "attentive", "friendly", "warm", "elegant", "impeccable", "memorable", "loved", "love", "enjoyed",
  "brilliant", "best", "tasty", "fresh", "gracious", "professional", "welcoming", "charming", "magical", "recommend",
  "thank", "thanks", "polite", "stunning", "divine", "exquisite", "cosy", "cozy", "relaxing", "special", "kind", "good",
  "nzuri", "safi", "tamu", "bora", "asante", "poa", "furaha", "vizuri", "kupendeza", "ukarimu",
];
const NEGATIVE = [
  "slow", "cold", "rude", "dirty", "bland", "overpriced", "expensive", "disappointing", "disappointed", "poor", "bad",
  "terrible", "awful", "late", "waited", "wait", "waiting", "forgot", "forgotten", "wrong", "noisy", "loud", "salty",
  "overcooked", "undercooked", "raw", "burnt", "stale", "ignored", "unfriendly", "worst", "never", "mistake", "error",
  "complaint", "uncomfortable", "smell", "hair", "flies", "mosquitoes", "lukewarm", "tough", "dry", "small", "missing",
  "mbaya", "polepole", "chafu", "baridi", "ghali", "kuchelewa", "hasira",
];
const NEGATORS = new Set(["not", "no", "never", "hardly", "wasn't", "isnt", "isn't", "wasnt", "didn't", "didnt", "si", "haikuwa", "hakuna"]);

export const STOPWORDS = new Set(
  `a about above after again all also am an and any are as at be because been before being below between both but by
  can could did do does doing down during each few for from further had has have having he her here hers him his how
  i if in into is it its itself just me more most my no nor not of off on once only or other our ours out over own
  same she should so some such than that the their them then there these they this those through to too under until
  up very was we were what when where which while who whom why will with would you your yours us really much one get
  got also even still lord erroll restaurant place time visit came come went go would'nt dont don't im i'm we're it's
  arrived needed made took throughout little alone exactly drive worth thing things back next another every always though ever lot bit quite whole made make way well came almost nobody someone anything two three
  ya na kwa wa ni la za katika hii hiyo kama sana pia lakini tu au yetu yangu mimi sisi wewe hapa huko ilikuwa tulikuwa`
    .split(/\s+/)
    .filter(Boolean),
);

export type SentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export function tokenize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").split(/\s+/).filter(Boolean);
}

export function textSentiment(text: string) {
  const tokens = tokenize(text);
  let score = 0;
  tokens.forEach((t, i) => {
    const negated = NEGATORS.has(tokens[i - 1] ?? "") || NEGATORS.has(tokens[i - 2] ?? "");
    if (POSITIVE.includes(t)) score += negated ? -1 : 1;
    else if (NEGATIVE.includes(t)) score += negated ? 0.5 : -1;
  });
  return score;
}

export function classifySentiment(input: { overall: number; nps?: number | null; text: string }): SentimentLabel {
  const ratingSignal = (input.overall - 3) * 1.5 + (input.nps != null ? (input.nps - 7) * 0.3 : 0);
  const total = ratingSignal + Math.max(-3, Math.min(3, textSentiment(input.text)));
  if (total >= 1.5) return "POSITIVE";
  if (total <= -1) return "NEGATIVE";
  return "NEUTRAL";
}

// Themes: mapped topic buckets that are easy for an owner to act on.
export const THEMES: { key: string; label: string; words: string[] }[] = [
  { key: "food", label: "Food quality", words: ["food", "dish", "steak", "fillet", "lamb", "fish", "tilapia", "chicken", "flavour", "flavor", "taste", "tasty", "delicious", "bland", "seasoning", "salty", "chakula", "tamu", "menu", "starter", "main", "soup", "sauce", "overcooked", "undercooked"] },
  { key: "service", label: "Service and staff", words: ["service", "waiter", "waitress", "staff", "server", "attentive", "friendly", "rude", "polite", "manager", "host", "huduma", "mhudumu"] },
  { key: "speed", label: "Waiting times", words: ["slow", "wait", "waited", "waiting", "late", "quick", "fast", "prompt", "minutes", "hour", "polepole", "kuchelewa", "delay"] },
  { key: "ambience", label: "Ambience and setting", words: ["ambience", "ambiance", "atmosphere", "music", "decor", "garden", "gardens", "fireplace", "view", "cosy", "cozy", "elegant", "noisy", "loud", "lighting", "conservatory", "mandhari"] },
  { key: "drinks", label: "Drinks and bar", words: ["wine", "cocktail", "cocktails", "drink", "drinks", "bar", "beer", "whisky", "coffee", "tea", "mocktail", "vinywaji"] },
  { key: "value", label: "Price and value", words: ["price", "prices", "expensive", "overpriced", "value", "worth", "bill", "cost", "ghali", "bei"] },
  { key: "cleanliness", label: "Cleanliness", words: ["clean", "dirty", "washroom", "toilet", "bathroom", "spotless", "smell", "hygiene", "usafi", "safi", "chafu"] },
  { key: "dessert", label: "Desserts", words: ["dessert", "desserts", "cake", "pudding", "ice", "cream", "chocolate", "tart", "creme", "brulee"] },
  { key: "occasion", label: "Celebrations", words: ["birthday", "anniversary", "celebration", "celebrate", "proposal", "graduation", "sherehe"] },
  { key: "temperature", label: "Food temperature", words: ["cold", "lukewarm", "warm", "hot", "baridi"] },
  { key: "parking", label: "Parking and arrival", words: ["parking", "park", "security", "gate", "arrival", "maegesho"] },
];

export function themesFor(text: string) {
  const tokens = new Set(tokenize(text));
  return THEMES.filter((t) => t.words.some((w) => tokens.has(w))).map((t) => t.key);
}

export function wordFrequencies(texts: string[], limit = 50) {
  const freq = new Map<string, number>();
  for (const text of texts) {
    for (const t of new Set(tokenize(text))) {
      const w = t.replace(/^'+|'+$/g, "");
      if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([word, count]) => ({
    word,
    count,
    tone: POSITIVE.includes(word) ? "positive" : NEGATIVE.includes(word) ? "negative" : "neutral",
  }));
}
