import { PEERS, colOf, findConflicts, rowOf, type Grid } from './sudoku';
import { generatePuzzle, type Difficulty, type Puzzle } from './generator';
import { getHint, type HintView } from './hints';

export interface Snapshot { cells: Grid; notes: number[] }
export interface GameState {
  puzzle: Puzzle;
  cells: Grid;               // givens + player digits
  notes: number[];           // per-cell bitmask, bit d = pencil mark d
  selected: number | null;
  notesMode: boolean;
  activeDigit: number | null; // "brush": stays armed so each cell tap applies it
  history: Snapshot[];
  startedAt: number;         // ms epoch (adjusted on resume)
  finishedAt: number | null;
  mistakes: number;          // visible: digits placed that break a row/column/box rule
  sneaky: number;            // hidden: rule-legal digits that still aren't the solution (for the cat, phase 4)
  hints: number;
  hint: HintView | null;
  notice: string | null;
}
export type Action =
  | { type: 'select'; cell: number | null }
  | { type: 'digit'; digit: number }
  | { type: 'setDigit'; digit: number | null }
  | { type: 'paint'; cell: number }
  | { type: 'erase' }
  | { type: 'toggleNotes' }
  | { type: 'undo' }
  | { type: 'hint' }
  | { type: 'new'; puzzle: Puzzle; now: number };

const HISTORY_CAP = 500;
const validCell = (c: unknown): c is number => Number.isInteger(c) && (c as number) >= 0 && (c as number) < 81;
const validDigit = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 9;

export function newGame(puzzle: Puzzle, now: number, elapsedMs = 0): GameState {
  return {
    puzzle, cells: puzzle.puzzle.slice(), notes: new Array(81).fill(0), selected: null, notesMode: false, activeDigit: null,
    history: [], startedAt: now - elapsedMs, finishedAt: null, mistakes: 0, sneaky: 0, hints: 0, hint: null, notice: null,
  };
}
export const startGame = (d: Difficulty, now: number, seed?: number) => newGame(generatePuzzle(d, seed), now);
export const isGiven = (s: GameState, i: number) => s.puzzle.puzzle[i] !== 0;
export const isSolved = (cells: Grid, solution: Grid) => cells.every((v, i) => v === solution[i]);

function push(s: GameState): Snapshot[] {
  const h = [...s.history, { cells: s.cells.slice(), notes: s.notes.slice() }];
  return h.length > HISTORY_CAP ? h.slice(h.length - HISTORY_CAP) : h;
}

function blocker(cells: Grid, i: number, d: number): 'row' | 'column' | 'box' | null {
  const hit = PEERS[i].filter((p) => cells[p] === d);
  if (!hit.length) return null;
  if (hit.some((p) => rowOf(p) === rowOf(i))) return 'row';
  if (hit.some((p) => colOf(p) === colOf(i))) return 'column';
  return 'box';
}

/** Apply digit d to the selected cell (a pencil mark in notes mode). Returns the same object if nothing happens. */
function enter(s: GameState, d: number, now: number): GameState {
  const i = s.selected;
  if (i === null || isGiven(s, i)) return s;
  const cells = s.cells.slice(), notes = s.notes.slice();
  if (s.notesMode) {
    if (cells[i] !== 0) return { ...s, notice: 'Erase the number first to add notes.' };
    if (!(notes[i] & (1 << d))) {
      const why = blocker(cells, i, d);
      if (why) return { ...s, notice: `${d} is already in this ${why}, so it can't be a note here.` };
    }
    notes[i] ^= 1 << d;
    return { ...s, history: push(s), notes, hint: null, notice: null };
  }
  if (cells[i] === d) { // tapping the same digit again clears it
    cells[i] = 0;
    return { ...s, history: push(s), cells, hint: null, notice: null };
  }
  const conflict = blocker(cells, i, d) !== null;
  cells[i] = d; notes[i] = 0;
  for (const p of PEERS[i]) notes[p] &= ~(1 << d); // auto-clear stale pencil marks
  const solved = findConflicts(cells).size === 0 && isSolved(cells, s.puzzle.solution);
  return {
    ...s, history: push(s), cells, notes, hint: null, notice: null, finishedAt: solved ? now : null,
    mistakes: s.mistakes + (conflict ? 1 : 0), sneaky: s.sneaky + (!conflict && d !== s.puzzle.solution[i] ? 1 : 0),
  };
}

export function reduce(s: GameState, a: Action, now = Date.now()): GameState {
  if (a.type === 'new') return newGame(a.puzzle, a.now);
  if (s.finishedAt !== null) return s; // finished games are read-only
  switch (a.type) {
    case 'select':
      return a.cell === null || validCell(a.cell) ? { ...s, selected: a.cell, notice: null } : s;
    case 'toggleNotes':
      return { ...s, notesMode: !s.notesMode, notice: null };
    case 'setDigit':
      if (a.digit !== null && !validDigit(a.digit)) return s;
      return { ...s, activeDigit: a.digit === s.activeDigit ? null : a.digit, notice: null };
    case 'paint': {
      if (!validCell(a.cell)) return s;
      const t = { ...s, selected: a.cell, notice: null };
      return s.activeDigit === null ? t : enter(t, s.activeDigit, now);
    }
    case 'digit':
      return validDigit(a.digit) ? enter(s, a.digit, now) : s;
    case 'undo': {
      const prev = s.history[s.history.length - 1];
      return prev ? { ...s, cells: prev.cells, notes: prev.notes, history: s.history.slice(0, -1), hint: null, notice: null } : s;
    }
    case 'erase': {
      const i = s.selected;
      if (i === null || isGiven(s, i) || (s.cells[i] === 0 && s.notes[i] === 0)) return s;
      const cells = s.cells.slice(), notes = s.notes.slice();
      cells[i] = 0; notes[i] = 0;
      return { ...s, history: push(s), cells, notes, hint: null, notice: null };
    }
    case 'hint': {
      if (s.hint?.tier === 3) return s;
      const tier = s.hint ? ((s.hint.tier + 1) as 2 | 3) : 1;
      return { ...s, hint: getHint(s.cells, s.puzzle.solution, tier), hints: s.hints + 1, notice: null };
    }
  }
}
