export interface ReviewCandidate {
  id: string;
  text: string;
  author: string;
  tags: string[];
}

export interface Snapshot {
  title: string;
  bounty: string;
  generatedAt: string;
  source: string;
  reviews: ReviewCandidate[];
}

export interface ReviewMetrics {
  restaurantVoice: number;
  mondaySpecificity: number;
  screenshotPunch: number;
  retypeBrevity: number;
  wearyTone: number;
  wordCount: number;
  charCount: number;
  compliant: boolean;
  overall: number;
}

export interface RankedReview extends ReviewCandidate {
  rank: number;
  wins: number;
  losses: number;
  winRate: number;
  score: number;
  metrics: ReviewMetrics;
}

export interface RadarAxis {
  key: keyof Pick<
    ReviewMetrics,
    | "restaurantVoice"
    | "mondaySpecificity"
    | "screenshotPunch"
    | "retypeBrevity"
    | "wearyTone"
  >;
  label: string;
  weight: number;
  average: number;
  leader: number;
}

export interface PairwiseMatchup {
  leftId: string;
  rightId: string;
  winnerId: string;
  margin: number;
  verdict: string;
}

export interface RadarSummary {
  total: number;
  compliant: number;
  avgWords: number;
  maxWords: number;
  topScore: number;
  winnerId: string;
  winnerText: string;
}

export interface RadarReport {
  title: string;
  subtitle: string;
  bounty: string;
  generatedAt: string;
  source: string;
  winner: RankedReview;
  topReview: string;
  line: string;
  reviews: RankedReview[];
  rankings: RankedReview[];
  items: RankedReview[];
  entries: RankedReview[];
  axes: RadarAxis[];
  matchups: PairwiseMatchup[];
  summary: RadarSummary;
}

const DEFAULT_GENERATED_AT = "2026-01-05T08:00:00Z";
const MAX_WORDS = 25;

export const DEFAULT_REVIEWS: ReviewCandidate[] = [
  {
    id: "mon-01",
    author: "desk-4b",
    tags: ["standing-reservation", "status-updates", "coffee"],
    text: "Host asked how my weekend was, then served lukewarm coffee and three hours of status updates. Awful experience. Sadly, I have a standing reservation.",
  },
  {
    id: "mon-02",
    author: "cubicle-north",
    tags: ["fluorescent", "unread-emails", "host"],
    text: "Cold coffee, aggressive fluorescent lighting, and the host immediately seats you next to fifteen unread emails. Somehow still required to come back next week.",
  },
  {
    id: "mon-03",
    author: "hr-survivor",
    tags: ["reservation", "waiter", "hr"],
    text: "Mandatory reservation at 8 AM, burnt coffee, and the waiter immediately dumps forty-seven unread emails on the table. Would leave zero stars if HR allowed.",
  },
  {
    id: "mon-04",
    author: "breadsticks-dept",
    tags: ["meeting", "breadsticks", "9am"],
    text: "Forced us in at 9 AM for lukewarm coffee and a two-hour meeting that could have been breadsticks. Nobody here wants to be open either.",
  },
  {
    id: "mon-05",
    author: "friday-leftovers",
    tags: ["ambiance", "chef", "leftovers"],
    text: "Zero ambiance, stale pastries, and the chef insists on circling back to last Friday's leftovers. Worse, my boss already booked us again for next week.",
  },
  {
    id: "mon-06",
    author: "early-opener",
    tags: ["special", "burnt-coffee", "weekend"],
    text: "Opens way too early, smells like burnt coffee, and the special is always last week's problems reheated. Host cheerfully asks how your weekend was anyway.",
  },
  {
    id: "mon-07",
    author: "sync-fatigue",
    tags: ["server", "sync", "sunday"],
    text: "Loud fluorescents, lukewarm water, and our server opened with a 45-minute sync before taking orders. Honestly feels like a punishment for enjoying Sunday.",
  },
  {
    id: "mon-08",
    author: "zero-stars",
    tags: ["waiter", "leftovers", "exhausted"],
    text: "Showed up exhausted; waiter immediately asked how my weekend was and served cold leftovers from Friday. One star only because zero isn't an option.",
  },
];

const RESTAURANT_TERMS = [
  "host",
  "waiter",
  "server",
  "reservation",
  "seated",
  "seats",
  "table",
  "coffee",
  "ambiance",
  "chef",
  "menu",
  "special",
  "leftovers",
  "pastries",
  "breadsticks",
  "orders",
  "served",
  "stars",
  "star",
  "booked",
  "open",
  "opens",
  "lighting",
  "water",
];

const MONDAY_TERMS = [
  "weekend",
  "friday",
  "sunday",
  "next week",
  "last week",
  "standing reservation",
  "unread emails",
  "emails",
  "status updates",
  "meeting",
  "sync",
  "8 am",
  "9 am",
  "hr",
  "boss",
  "circling back",
  "inbox",
  "standup",
  "calendar",
  "too early",
];

const WEARY_TERMS = [
  "lukewarm",
  "burnt",
  "cold",
  "stale",
  "forced",
  "mandatory",
  "sadly",
  "somehow",
  "exhausted",
  "awful",
  "punishment",
  "zero stars",
  "zero isn't",
  "reheated",
  "worse",
  "required",
  "nobody here",
];

const META_FILLER = [
  "as a restaurant",
  "if monday were",
  "one-star review of monday",
  "this review",
  "monday is like",
];

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function cleanLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  const cleaned = cleanLine(text);
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
}

function countMatches(lower: string, terms: string[]): number {
  let hits = 0;
  for (const term of terms) {
    if (lower.includes(term)) hits += 1;
  }
  return hits;
}

function normalizeCandidate(item: unknown, index: number): ReviewCandidate | null {
  if (typeof item === "string") {
    const text = cleanLine(item);
    if (!text) return null;
    return {
      id: `rev-${String(index + 1).padStart(2, "0")}`,
      text,
      author: "anonymous",
      tags: [],
    };
  }
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;
  const rawText =
    typeof rec.text === "string"
      ? rec.text
      : typeof rec.review === "string"
        ? rec.review
        : typeof rec.line === "string"
          ? rec.line
          : "";
  const text = cleanLine(rawText);
  if (!text) return null;
  const id =
    typeof rec.id === "string" && rec.id.trim()
      ? rec.id.trim()
      : `rev-${String(index + 1).padStart(2, "0")}`;
  const author =
    typeof rec.author === "string" && rec.author.trim()
      ? rec.author.trim()
      : "anonymous";
  const tags = Array.isArray(rec.tags)
    ? rec.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];
  return { id, text, author, tags };
}

export function parseSnapshot(raw?: unknown): Snapshot {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      parsed = null;
    } else if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = trimmed.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
      }
    } else {
      parsed = trimmed.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
    }
  }

  let title = "One Star for Monday — Review Radar";
  let bounty = "u-clever-harbor-75-one-star-for-monday-9ead4a61";
  let generatedAt = DEFAULT_GENERATED_AT;
  let source = "builtin-curated";
  let rawList: unknown[] = [];

  if (Array.isArray(parsed)) {
    rawList = parsed;
    source = "array-input";
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.title === "string" && obj.title.trim()) title = obj.title.trim();
    if (typeof obj.bounty === "string" && obj.bounty.trim()) bounty = obj.bounty.trim();
    if (typeof obj.generatedAt === "string" && obj.generatedAt.trim()) {
      generatedAt = obj.generatedAt.trim();
    }
    if (typeof obj.source === "string" && obj.source.trim()) source = obj.source.trim();
    else source = "snapshot-input";

    const listField = obj.reviews ?? obj.entries ?? obj.items ?? obj.candidates;
    if (Array.isArray(listField)) rawList = listField;
  }

  const normalized: ReviewCandidate[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawList.length; i += 1) {
    const candidate = normalizeCandidate(rawList[i], i);
    if (candidate && !seen.has(candidate.text.toLowerCase())) {
      seen.add(candidate.text.toLowerCase());
      normalized.push(candidate);
    }
  }

  const reviews = normalized.length > 0 ? normalized : DEFAULT_REVIEWS.map((r) => ({ ...r, tags: [...r.tags] }));
  return { title, bounty, generatedAt, source, reviews };
}

function scoreReview(candidate: ReviewCandidate): ReviewMetrics {
  const text = cleanLine(candidate.text);
  const lower = text.toLowerCase();
  const wordCount = countWords(text);
  const charCount = text.length;
  const singleLine = !candidate.text.includes("\n");
  const compliant = singleLine && wordCount >= 5 && wordCount <= MAX_WORDS;

  const restHits = countMatches(lower, RESTAURANT_TERMS);
  const monHits = countMatches(lower, MONDAY_TERMS);
  const wearyHits = countMatches(lower, WEARY_TERMS);
  const metaPenalty = countMatches(lower, META_FILLER) * 25;

  const restaurantVoice = clamp(Math.round(32 + restHits * 15 - metaPenalty), 0, 100);
  const mondaySpecificity = clamp(Math.round(30 + monHits * 18 - metaPenalty), 0, 100);
  const wearyTone = clamp(Math.round(36 + wearyHits * 16), 0, 100);

  let retypeBrevity = 95;
  if (wordCount === 0) retypeBrevity = 0;
  else if (wordCount > MAX_WORDS) retypeBrevity = clamp(45 - (wordCount - MAX_WORDS) * 12, 0, 45);
  else if (wordCount < 10) retypeBrevity = 65;
  else if (charCount <= 155) retypeBrevity = 98;
  else if (charCount <= 175) retypeBrevity = 90;
  else retypeBrevity = 82;

  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const hasTwistEnding = sentences.length >= 2 && sentences[sentences.length - 1].length <= 68;
  const hasContrast = /\b(sadly|somehow|worse|anyway|only because|instead|still|honestly)\b/i.test(text);
  const hasConcreteDetail = /\b(\d+|lukewarm|burnt|fluorescent|breadsticks|leftovers|standing reservation)\b/i.test(text);
  const screenshotPunch = clamp(
    Math.round(
      46 +
        (hasTwistEnding ? 20 : 6) +
        (hasContrast ? 16 : 4) +
        (hasConcreteDetail ? 14 : 4) -
        metaPenalty,
    ),
    0,
    100,
  );

  let overall =
    restaurantVoice * 0.28 +
    mondaySpecificity * 0.28 +
    screenshotPunch * 0.2 +
    retypeBrevity * 0.12 +
    wearyTone * 0.12;
  if (!compliant) overall = Math.max(0, overall - 35);

  return {
    restaurantVoice,
    mondaySpecificity,
    screenshotPunch,
    retypeBrevity,
    wearyTone,
    wordCount,
    charCount,
    compliant,
    overall: round2(overall),
  };
}

function compareScored(a: RankedReview, b: RankedReview): number {
  if (a.metrics.compliant !== b.metrics.compliant) {
    return a.metrics.compliant ? -1 : 1;
  }
  if (a.metrics.overall !== b.metrics.overall) {
    return b.metrics.overall - a.metrics.overall;
  }
  const aCore = a.metrics.restaurantVoice + a.metrics.mondaySpecificity;
  const bCore = b.metrics.restaurantVoice + b.metrics.mondaySpecificity;
  if (aCore !== bCore) return bCore - aCore;
  if (a.metrics.charCount !== b.metrics.charCount) {
    return a.metrics.charCount - b.metrics.charCount;
  }
  return a.id.localeCompare(b.id);
}

function isRadarReport(value: unknown): value is RadarReport {
  return Boolean(
    value &&
      typeof value === "object" &&
      "winner" in value &&
      "rankings" in value &&
      "axes" in value,
  );
}

export function buildRadar(input?: unknown): RadarReport {
  const snapshot: Snapshot =
    input &&
    typeof input === "object" &&
    "reviews" in input &&
    Array.isArray((input as Snapshot).reviews) &&
    typeof (input as Snapshot).generatedAt === "string"
      ? (input as Snapshot)
      : parseSnapshot(input);

  const scored: RankedReview[] = snapshot.reviews.map((candidate) => {
    const metrics = scoreReview(candidate);
    return {
      ...candidate,
      rank: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      score: metrics.overall,
      metrics,
    };
  });

  const matchups: PairwiseMatchup[] = [];
  for (let i = 0; i < scored.length; i += 1) {
    for (let j = i + 1; j < scored.length; j += 1) {
      const left = scored[i];
      const right = scored[j];
      const cmp = compareScored(left, right);
      const winner = cmp <= 0 ? left : right;
      const loser = cmp <= 0 ? right : left;
      winner.wins += 1;
      loser.losses += 1;
      const margin = round2(Math.abs(left.score - right.score));
      matchups.push({
        leftId: left.id,
        rightId: right.id,
        winnerId: winner.id,
        margin,
        verdict: `Screenshot ${winner.id} over ${loser.id} (+${margin.toFixed(2)})`,
      });
    }
  }

  for (const item of scored) {
    const totalMatches = item.wins + item.losses;
    item.winRate = totalMatches > 0 ? round2((item.wins / totalMatches) * 100) : 100;
  }

  scored.sort((a, b) => {
    if (a.metrics.compliant !== b.metrics.compliant) {
      return a.metrics.compliant ? -1 : 1;
    }
    if (a.wins !== b.wins) return b.wins - a.wins;
    return compareScored(a, b);
  });

  scored.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  const axisSpecs: Array<{
    key: RadarAxis["key"];
    label: string;
    weight: number;
  }> = [
    { key: "restaurantVoice", label: "Restaurant Voice", weight: 0.28 },
    { key: "mondaySpecificity", label: "Monday Specificity", weight: 0.28 },
    { key: "screenshotPunch", label: "Group-Chat Punch", weight: 0.2 },
    { key: "retypeBrevity", label: "Retype Brevity", weight: 0.12 },
    { key: "wearyTone", label: "Weary Office Tone", weight: 0.12 },
  ];

  const winner = scored[0];
  const axes: RadarAxis[] = axisSpecs.map((spec) => {
    const sum = scored.reduce((acc, item) => acc + item.metrics[spec.key], 0);
    return {
      key: spec.key,
      label: spec.label,
      weight: spec.weight,
      average: scored.length > 0 ? round2(sum / scored.length) : 0,
      leader: winner ? winner.metrics[spec.key] : 0,
    };
  });

  const compliantCount = scored.filter((item) => item.metrics.compliant).length;
  const totalWords = scored.reduce((acc, item) => acc + item.metrics.wordCount, 0);
  const maxWords = scored.reduce((acc, item) => Math.max(acc, item.metrics.wordCount), 0);

  const summary: RadarSummary = {
    total: scored.length,
    compliant: compliantCount,
    avgWords: scored.length > 0 ? round2(totalWords / scored.length) : 0,
    maxWords,
    topScore: winner ? winner.score : 0,
    winnerId: winner ? winner.id : "",
    winnerText: winner ? winner.text : "",
  };

  return {
    title: snapshot.title,
    subtitle: "Pairwise screenshotability radar for one-star Monday restaurant reviews",
    bounty: snapshot.bounty,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    winner,
    topReview: winner.text,
    line: winner.text,
    reviews: scored,
    rankings: scored,
    items: scored,
    entries: scored,
    axes,
    matchups,
    summary,
  };
}

export function boardIssue(input?: unknown): string {
  const radar = isRadarReport(input) ? input : buildRadar(input);
  const lines: string[] = [
    `# ${radar.title}`,
    "",
    `- **Bounty:** \`${radar.bounty}\``,
    `- **Generated:** \`${radar.generatedAt}\``,
    `- **Entries Evaluated:** ${radar.summary.total} (${radar.summary.compliant} compliant <= ${MAX_WORDS} words)`,
    `- **Winning Review (${radar.winner.metrics.wordCount} words, score ${radar.winner.score.toFixed(2)}):**`,
    "",
    `> ${radar.winner.text}`,
    "",
    "## Leaderboard",
    "",
    "| Rank | ID | W-L | Score | Words | Rest. | Monday | Punch | Review |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const item of radar.rankings) {
    const safeText = item.text.replace(/\|/g, "\\|");
    lines.push(
      `| #${item.rank} | ${item.id} | ${item.wins}-${item.losses} | ${item.score.toFixed(2)} | ${item.metrics.wordCount} | ${item.metrics.restaurantVoice} | ${item.metrics.mondaySpecificity} | ${item.metrics.screenshotPunch} | ${safeText} |`,
    );
  }

  lines.push("", "## Radar Axes", "");
  for (const axis of radar.axes) {
    lines.push(
      `- **${axis.label}** (weight ${Math.round(axis.weight * 100)}%): leader ${axis.leader}/100, field avg ${axis.average.toFixed(1)}/100`,
    );
  }

  const topMatchups = radar.matchups.slice(0, 6);
  if (topMatchups.length > 0) {
    lines.push("", "## Sample Pairwise Verdicts", "");
    for (const match of topMatchups) {
      lines.push(`- ${match.verdict}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function escapeScriptJson(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function dataScript(input?: unknown, globalName = "__MONDAY_RADAR__"): string {
  const radar = isRadarReport(input) ? input : buildRadar(input);
  const safeName = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(globalName)
    ? globalName
    : "__MONDAY_RADAR__";
  const payload = escapeScriptJson(JSON.stringify(radar, null, 2));
  return [
    "(function () {",
    `  const payload = ${payload};`,
    `  globalThis[${JSON.stringify(safeName)}] = payload;`,
    "  if (typeof window !== \"undefined\") {",
    `    window[${JSON.stringify(safeName)}] = payload;`,
    "  }",
    "})();",
    "",
  ].join("\n");
}