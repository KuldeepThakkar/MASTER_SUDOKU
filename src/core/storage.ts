import { DIFFICULTIES, generatePuzzle, type Difficulty } from './generator';
import { newGame, type GameState } from './game';

const KEY = 'sudoku-cat:v2';
interface Saved { seed: number; difficulty: Difficulty; cells: number[]; notes: number[]; elapsedMs: number; mistakes: number; sneaky: number; hints: number }

/** Stored data is untrusted: the puzzle is regenerated from the seed, and everything else is validated. */
export function save(s: GameState, now = Date.now()): void {
  if (s.finishedAt !== null) return clear();
  const data: Saved = { seed: s.puzzle.seed, difficulty: s.puzzle.difficulty, cells: s.cells, notes: s.notes, elapsedMs: now - s.startedAt, mistakes: s.mistakes, sneaky: s.sneaky, hints: s.hints };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked: ignore */ }
}
export function clear(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

export function load(now = Date.now()): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > 5000) return null;
    const d = JSON.parse(raw) as Partial<Saved>;
    if (!d || typeof d !== 'object') return null;
    const { seed, difficulty, cells, notes, elapsedMs, mistakes, sneaky, hints } = d;
    if (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > 0xffffffff || !DIFFICULTIES.includes(difficulty as Difficulty)) return null;
    const ok = (a: unknown, max: number) => Array.isArray(a) && a.length === 81 && a.every((v) => Number.isInteger(v) && v >= 0 && v <= max);
    if (!ok(cells, 9) || !ok(notes, 0x3fe)) return null;
    if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 864e5) return null;
    const count = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 9999;
    if (!count(mistakes) || !count(sneaky) || !count(hints)) return null;
    const puzzle = generatePuzzle(difficulty as Difficulty, seed as number);
    const c = cells as number[];
    if (puzzle.puzzle.some((g, i) => g !== 0 && c[i] !== g)) return null; // tampered givens
    return { ...newGame(puzzle, now, elapsedMs), cells: c.slice(), notes: (notes as number[]).slice(), mistakes: mistakes as number, sneaky: sneaky as number, hints: hints as number };
  } catch { return null; }
}
