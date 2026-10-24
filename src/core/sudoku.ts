// Pure Sudoku engine: no DOM, no network, no storage. Grid = 81 numbers, 0 = empty.
export type Grid = number[];
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// Phase 1 grades by number of givens only. Phase 2 replaces this with technique-based grading.
export const TARGET_CLUES: Record<Difficulty, number> = { easy: 40, medium: 34, hard: 29, expert: 25 };
export const DIFFICULTIES = Object.keys(TARGET_CLUES) as Difficulty[];

const ALL = 0x3fe; // bits 1..9
export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);

export function peersOf(i: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) out.push(j);
  }
  return out;
}
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => peersOf(i));

export function assertGrid(g: unknown): asserts g is Grid {
  if (!Array.isArray(g) || g.length !== 81 || !g.every((v) => Number.isInteger(v) && v >= 0 && v <= 9)) {
    throw new Error('Invalid grid');
  }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0];
}

const popcount = (m: number) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Backtracking search (fewest-candidates-first). Stops after `limit` solutions. */
export function search(grid: Grid, limit = 2, rng?: () => number): { count: number; first: Grid | null } {
  assertGrid(grid);
  const g = grid.slice();
  const rows = new Array<number>(9).fill(0), cols = new Array<number>(9).fill(0), boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const b = 1 << g[i];
    if (rows[rowOf(i)] & b || cols[colOf(i)] & b || boxes[boxOf(i)] & b) return { count: 0, first: null };
    rows[rowOf(i)] |= b; cols[colOf(i)] |= b; boxes[boxOf(i)] |= b;
  }
  let count = 0;
  let first: Grid | null = null;
  const rec = (): void => {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      const n = popcount(m);
      if (n === 0) return;
      if (n < bestN) { best = i; bestMask = m; bestN = n; if (n === 1) break; }
    }
    if (best === -1) { count++; if (!first) first = g.slice(); return; }
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (rng) shuffle(digits, rng);
    const r = rowOf(best), c = colOf(best), b = boxOf(best);
    for (const d of digits) {
      const bit = 1 << d;
      g[best] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      rec();
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  };
  rec();
  return { count, first };
}

export const countSolutions = (g: Grid, limit = 2) => search(g, limit).count;
export const solve = (g: Grid) => search(g, 1).first;

export function generateSolved(rng: () => number): Grid {
  const solved = search(new Array(81).fill(0), 1, rng).first;
  if (!solved) throw new Error('Generation failed');
  return solved;
}

export interface Puzzle { puzzle: Grid; solution: Grid; seed: number; difficulty: Difficulty; clues: number }

/** Deterministic: same seed + difficulty always gives the same puzzle. Every puzzle has exactly one solution. */
export function generatePuzzle(difficulty: Difficulty, seed: number = randomSeed()): Puzzle {
  if (!(difficulty in TARGET_CLUES)) throw new Error('Unknown difficulty');
  const rng = mulberry32(seed);
  const solution = generateSolved(rng);
  const puzzle = solution.slice();
  const target = TARGET_CLUES[difficulty];
  let clues = 81;
  for (const idx of shuffle(Array.from({ length: 81 }, (_, i) => i), rng)) {
    if (clues <= target) break;
    const v = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) === 1) clues--; else puzzle[idx] = v;
  }
  return { puzzle, solution, seed: seed >>> 0, difficulty, clues };
}

/** Cells that share a digit with a peer (rule violations only; never reveals the solution). */
export function findConflicts(grid: Grid): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (!grid[i]) continue;
    for (const j of PEERS[i]) if (grid[j] === grid[i]) { bad.add(i); bad.add(j); }
  }
  return bad;
}
