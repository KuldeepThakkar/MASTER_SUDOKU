import { countSolutions, generateSolved, mulberry32, randomSeed, shuffle, type Grid } from './sudoku';
import { logicSolve } from './logic';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
/** Hardest technique tier a level may need: 1 singles, 2 +locked candidates, 3 +pairs, 4 +X-Wing/XY-Wing. */
export const LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const FLOOR: Record<Difficulty, number> = { easy: 36, medium: 30, hard: 27, expert: 24 };
const MAX_ATTEMPTS = 400;

export interface Puzzle { puzzle: Grid; solution: Grid; seed: number; difficulty: Difficulty; clues: number; grade: number }

function carve(solution: Grid, level: number, floor: number, rng: () => number): Grid {
  const puzzle = solution.slice();
  let clues = 81;
  for (const idx of shuffle(Array.from({ length: 81 }, (_, i) => i), rng)) {
    if (clues <= floor) break;
    const v = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) === 1 && logicSolve(puzzle, level).solved) clues--; else puzzle[idx] = v;
  }
  return puzzle;
}

/**
 * Deterministic for (difficulty, seed). Every puzzle is verified before it is returned: exactly one solution AND
 * fully solvable by named logic techniques (no guessing), using nothing harder than the level allows.
 */
export function generatePuzzle(difficulty: Difficulty, seed: number = randomSeed()): Puzzle {
  if (!DIFFICULTIES.includes(difficulty)) throw new Error('Unknown difficulty');
  const level = LEVEL[difficulty];
  let best: Puzzle | null = null;
  for (let a = 0; a < MAX_ATTEMPTS; a++) {
    const rng = mulberry32((seed + Math.imul(a, 0x9e3779b1)) >>> 0);
    const solution = generateSolved(rng);
    const puzzle = carve(solution, level, FLOOR[difficulty], rng);
    const r = logicSolve(puzzle, level);
    if (!r.solved) continue; // cannot happen (carve only keeps solvable states); defensive
    const cand: Puzzle = { puzzle, solution, seed: seed >>> 0, difficulty, clues: puzzle.filter(Boolean).length, grade: r.grade };
    if (r.grade === level) return cand;
    if (!best || r.grade > best.grade) best = cand;
  }
  if (!best) throw new Error('Generation failed');
  return best;
}
