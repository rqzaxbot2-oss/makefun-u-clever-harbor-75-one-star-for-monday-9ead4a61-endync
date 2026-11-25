import { mkdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface RubricScores {
  restaurantAuthenticity: number;
  mondaySpecificity: number;
  screenshotPunch: number;
  retypeEase: number;
}

export interface ReviewCandidate {
  id: string;
  text: string;
  rubric: RubricScores;
  rationale: string;
}

export interface EvaluatedCandidate {
  rank: number;
  id: string;
  text: string;
  wordCount: number;
  strictTokenCount: number;
  charCount: number;
  singleLine: boolean;
  withinLimit: boolean;
  rubric: RubricScores;
  totalScore: number;
  rationale: string;
}

export interface BoardArtifact {
  bounty: string;
  maxWords: number;
  winnerId: string;
  winnerText: string;
  winnerWordCount: number;
  winnerCharCount: number;
  entries: EvaluatedCandidate[];
}

export interface EmittedFiles {
  outputDir: string;
  reviewPath: string;
  boardPath: string;
  dossierPath: string;
  dashboardPath: string;
  review: string;
}

export const BOUNTY_ID = "u-clever-harbor-75-one-star-for-monday-9ead4a61";
export const MAX_WORDS = 25;

const MAX_RUBRIC_SCORE = 10;
const MAX_TOTAL_SCORE = MAX_RUBRIC_SCORE * 4;

function freezeCandidate(candidate: ReviewCandidate): ReviewCandidate {
  return Object.freeze({
    ...candidate,
    rubric: Object.freeze({ ...candidate.rubric }),
  });
}

export const CANDIDATES: readonly ReviewCandidate[] = Object.freeze(
  [
    {
      id: "standing-reservation",
      text: "Fluorescent lighting, burnt coffee, Friday's reheated leftovers, and the staff kept asking about my weekend. Somehow I have a standing reservation.",
      rubric: {
        restaurantAuthenticity: 10,
        mondaySpecificity: 10,
        screenshotPunch: 10,
        retypeEase: 9,
      },
      rationale:
        "Every complaint reads literally as a one-star diner review while mapping cleanly onto Monday morning office dread and involuntary weekly return.",
    },
    {
      id: "before-coffee",
      text: "Opened too early, served Friday's cold leftovers, and the waiter asked about my weekend before bringing coffee. Sadly, I have a weekly reservation.",
      rubric: {
        restaurantAuthenticity: 9,
        mondaySpecificity: 9,
        screenshotPunch: 9,
        retypeEase: 8,
      },
      rationale:
        "Strong hospitality cadence and weekend small-talk timing, slightly longer and softer in the closing beat.",
    },
    {
      id: "corporate-table",
      text: "Harsh lighting, bitter coffee, and Friday's reheated specials dumped on my table at nine sharp. Zero stars; corporate keeps renewing my reservation.",
      rubric: {
        restaurantAuthenticity: 8,
        mondaySpecificity: 8,
        screenshotPunch: 8,
        retypeEase: 8,
      },
      rationale:
        "Direct office reference explains the punchline slightly instead of letting the diner persona carry the joke.",
    },
    {
      id: "host-small-talk",
      text: "Dragged in at nine for lukewarm coffee, stale Friday leftovers, and forced weekend chatter from the host. Cannot cancel my recurring booking.",
      rubric: {
        restaurantAuthenticity: 8,
        mondaySpecificity: 9,
        screenshotPunch: 8,
        retypeEase: 8,
      },
      rationale:
        "Hits the Monday beats reliably, though less visually crisp than the winning review.",
    },
  ].map(freezeCandidate),
);

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function validateRubricScore(field: string, value: number, id: string): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_RUBRIC_SCORE) {
    throw new RangeError(
      `Candidate "${id}" has invalid ${field} score: ${String(value)} (expected 0..${MAX_RUBRIC_SCORE}).`,
    );
  }
  return value;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countStrictTokens(text: string): number {
  const matches = text.match(/[A-Za-z0-9]+/g);
  return matches ? matches.length : 0;
}

export function isSingleLinePlainText(text: string): boolean {
  if (!text || text.trim() !== text) return false;
  return /^[\x20-\x7E]+$/.test(text);
}

export function evaluateCandidates(
  candidates: readonly ReviewCandidate[],
): EvaluatedCandidate[] {
  const seenIds = new Set<string>();

  const scored = candidates.map((candidate) => {
    const id = candidate.id.trim();
    if (!id) {
      throw new Error("Review candidate id must be a non-empty string.");
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate review candidate id: "${id}".`);
    }
    seenIds.add(id);

    const rubric: RubricScores = {
      restaurantAuthenticity: validateRubricScore(
        "restaurantAuthenticity",
        candidate.rubric.restaurantAuthenticity,
        id,
      ),
      mondaySpecificity: validateRubricScore(
        "mondaySpecificity",
        candidate.rubric.mondaySpecificity,
        id,
      ),
      screenshotPunch: validateRubricScore(
        "screenshotPunch",
        candidate.rubric.screenshotPunch,
        id,
      ),
      retypeEase: validateRubricScore(
        "retypeEase",
        candidate.rubric.retypeEase,
        id,
      ),
    };

    const wordCount = countWords(candidate.text);
    const strictTokenCount = countStrictTokens(candidate.text);
    const charCount = candidate.text.length;
    const singleLine = isSingleLinePlainText(candidate.text);
    const withinLimit = wordCount > 0 && wordCount <= MAX_WORDS && singleLine;
    const totalScore =
      rubric.restaurantAuthenticity +
      rubric.mondaySpecificity +
      rubric.screenshotPunch +
      rubric.retypeEase;

    return {
      rank: 0,
      id,
      text: candidate.text,
      wordCount,
      strictTokenCount,
      charCount,
      singleLine,
      withinLimit,
      rubric,
      totalScore,
      rationale: candidate.rationale,
    };
  });

  scored.sort((a, b) => {
    if (a.withinLimit !== b.withinLimit) return a.withinLimit ? -1 : 1;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (a.wordCount !== b.wordCount) return a.wordCount - b.wordCount;
    if (a.charCount !== b.charCount) return a.charCount - b.charCount;
    return compareStrings(a.id, b.id);
  });

  return scored.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

export function buildBoard(
  candidates: readonly ReviewCandidate[] = CANDIDATES,
): BoardArtifact {
  const entries = evaluateCandidates(candidates);
  const winner = entries[0];
  if (!winner || !winner.withinLimit) {
    throw new Error("No valid review candidate satisfies the bounty constraints.");
  }

  return {
    bounty: BOUNTY_ID,
    maxWords: MAX_WORDS,
    winnerId: winner.id,
    winnerText: winner.text,
    winnerWordCount: winner.wordCount,
    winnerCharCount: winner.charCount,
    entries,
  };
}

export const BOARD: BoardArtifact = buildBoard(CANDIDATES);
export const REVIEW: string = BOARD.winnerText;

function getWinnerEntry(board: BoardArtifact): EvaluatedCandidate {
  const winner =
    board.entries.find((entry) => entry.id === board.winnerId) ?? board.entries[0];
  if (!winner) {
    throw new Error("Board artifact must contain at least one evaluated entry.");
  }
  return winner;
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
}

export function buildDossier(board: BoardArtifact): string {
  const winner = getWinnerEntry(board);
  const lines: string[] = [
    "# One Star for Monday — Entry Dossier",
    "",
    `- Bounty: \`${board.bounty}\``,
    `- Selected ID: \`${board.winnerId}\``,
    `- Word Count: ${winner.wordCount} / ${board.maxWords} (strict alphanumeric tokens: ${winner.strictTokenCount})`,
    `- Character Count: ${winner.charCount}`,
    `- Single-Line Plain ASCII: ${winner.singleLine ? "PASS" : "FAIL"}`,
    "",
    "## Final Review",
    "",
    board.winnerText,
    "",
    "## Candidate Leaderboard",
    "",
    "| Rank | ID | Words | Chars | Score | Review |",
    "| --- | --- | ---: | ---: | ---: | --- |",
  ];

  for (const entry of board.entries) {
    lines.push(
      `| ${entry.rank} | \`${escapeMarkdownCell(entry.id)}\` | ${entry.wordCount} | ${entry.charCount} | ${entry.totalScore}/${MAX_TOTAL_SCORE} | ${escapeMarkdownCell(entry.text)} |`,
    );
  }

  lines.push("", "## Selection Rationale", "", winner.rationale, "");
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDashboard(board: BoardArtifact): string {
  const winner = getWinnerEntry(board);
  const rows = board.entries
    .map(
      (entry) =>
        `<tr><td>#${entry.rank}</td><td><code>${escapeHtml(entry.id)}</code></td><td>${entry.wordCount}</td><td>${entry.totalScore}/${MAX_TOTAL_SCORE}</td><td>${escapeHtml(entry.text)}</td></tr>`,
    )
    .join("\n        ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>One Star for Monday</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 32px 20px; background: #f5f5f3; color: #1a1a18; }
    main { max-width: 760px; margin: 0 auto; }
    .card { background: #ffffff; border: 1px solid #deded8; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .stars { color: #d9381e; font-size: 20px; letter-spacing: 2px; margin-bottom: 8px; }
    .review { font-size: 20px; line-height: 1.5; margin: 12px 0 16px; font-weight: 500; }
    .meta { color: #5b5b55; font-size: 13px; display: flex; gap: 16px; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #ecece6; vertical-align: top; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #5b5b55; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <div class="stars" aria-label="1 out of 5 stars">&#9733;&#9734;&#9734;&#9734;&#9734;</div>
      <div class="review">${escapeHtml(board.winnerText)}</div>
      <div class="meta">
        <span><strong>Venue:</strong> Monday</span>
        <span><strong>Words:</strong> ${winner.wordCount}/${board.maxWords}</span>
        <span><strong>Characters:</strong> ${winner.charCount}</span>
        <span><strong>Score:</strong> ${winner.totalScore}/${MAX_TOTAL_SCORE}</span>
      </div>
    </section>
    <section class="card">
      <table>
        <thead>
          <tr><th>Rank</th><th>Candidate</th><th>Words</th><th>Score</th><th>Line</th></tr>
        </thead>
        <tbody>
        ${rows}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>
`;
}

function normalizeOutputDir(rawDir: string): string {
  const trimmed = rawDir.trim();
  if (!trimmed) {
    throw new Error("Output directory must be a non-empty path.");
  }
  if (trimmed.includes("\0")) {
    throw new Error("Output directory path must not contain NUL bytes.");
  }
  return path.resolve(trimmed);
}

function ensureWritableDirectory(dirPath: string): void {
  try {
    const existing = statSync(dirPath);
    if (!existing.isDirectory()) {
      throw new Error(`Output path exists and is not a directory: ${dirPath}`);
    }
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
  mkdirSync(dirPath, { recursive: true });
}

export function resolveOutputDir(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = env.MAKEFUN_OUTPUT_DIR?.trim();
  if (configured) return normalizeOutputDir(configured);
  return path.resolve(process.cwd(), "out");
}

export function run(outputDir: string = resolveOutputDir()): EmittedFiles {
  const targetDir = normalizeOutputDir(outputDir);
  const board = buildBoard(CANDIDATES);
  const review = board.winnerText;
  const dossier = buildDossier(board);
  const dashboard = buildDashboard(board);

  ensureWritableDirectory(targetDir);

  const reviewPath = path.join(targetDir, "review.txt");
  const boardPath = path.join(targetDir, "board.json");
  const dossierPath = path.join(targetDir, "dossier.md");
  const dashboardPath = path.join(targetDir, "dashboard.html");

  writeFileSync(reviewPath, `${review}\n`, "utf8");
  writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8");
  writeFileSync(dossierPath, dossier, "utf8");
  writeFileSync(dashboardPath, dashboard, "utf8");

  return {
    outputDir: targetDir,
    reviewPath,
    boardPath,
    dossierPath,
    dashboardPath,
    review,
  };
}

export function main(): void {
  const emitted = run();
  process.stdout.write(`${emitted.review}\n`);
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const modulePath = fileURLToPath(import.meta.url);
  try {
    return realpathSync(entry) === realpathSync(modulePath);
  } catch {
    return path.resolve(entry) === path.resolve(modulePath);
  }
}

if (isDirectExecution()) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}