import { PEERS, findConflicts, generatePuzzle, type Difficulty, type Grid, type Puzzle } from './sudoku';

export interface Snapshot { cells: Grid; notes: number[] }
export interface GameState {
  puzzle: Puzzle;
  cells: Grid;          // givens + player digits
  notes: number[];      // per-cell bitmask, bit d = pencil mark d
  selected: number | null;
  notesMode: boolean;
  history: Snapshot[];
  startedAt: number;    // ms epoch (adjusted on resume)
  finishedAt: number | null;
}
export type Action =
  | { type: 'select'; cell: number | null }
  | { type: 'digit'; digit: number }
  | { type: 'erase' }
  | { type: 'toggleNotes' }
  | { type: 'undo' }
  | { type: 'new'; puzzle: Puzzle; now: number };

const HISTORY_CAP = 500;

export function newGame(puzzle: Puzzle, now: number, elapsedMs = 0): GameState {
  return {
    puzzle, cells: puzzle.puzzle.slice(), notes: new Array(81).fill(0),
    selected: null, notesMode: false, history: [], startedAt: now - elapsedMs, finishedAt: null,
  };
}
export const startGame = (d: Difficulty, now: number, seed?: number) => newGame(generatePuzzle(d, seed), now);
export const isGiven = (s: GameState, i: number) => s.puzzle.puzzle[i] !== 0;
export const isSolved = (cells: Grid, solution: Grid) => cells.every((v, i) => v === solution[i]);

function push(s: GameState): Snapshot[] {
  const h = [...s.history, { cells: s.cells.slice(), notes: s.notes.slice() }];
  return h.length > HISTORY_CAP ? h.slice(h.length - HISTORY_CAP) : h;
}

export function reduce(s: GameState, a: Action, now = Date.now()): GameState {
  if (a.type === 'new') return newGame(a.puzzle, a.now);
  if (s.finishedAt !== null) return s; // finished games are read-only
  switch (a.type) {
    case 'select':
      return a.cell === null || (Number.isInteger(a.cell) && a.cell >= 0 && a.cell < 81) ? { ...s, selected: a.cell } : s;
    case 'toggleNotes':
      return { ...s, notesMode: !s.notesMode };
    case 'undo': {
      const prev = s.history[s.history.length - 1];
      return prev ? { ...s, cells: prev.cells, notes: prev.notes, history: s.history.slice(0, -1) } : s;
    }
    case 'erase': {
      const i = s.selected;
      if (i === null || isGiven(s, i) || (s.cells[i] === 0 && s.notes[i] === 0)) return s;
      const cells = s.cells.slice(), notes = s.notes.slice();
      cells[i] = 0; notes[i] = 0;
      return { ...s, history: push(s), cells, notes };
    }
    case 'digit': {
      const i = s.selected, d = a.digit;
      if (i === null || isGiven(s, i) || !Number.isInteger(d) || d < 1 || d > 9) return s;
      const cells = s.cells.slice(), notes = s.notes.slice();
      if (s.notesMode) {
        if (cells[i] !== 0) return s; // notes only on empty cells
        notes[i] ^= 1 << d;
        return { ...s, history: push(s), notes };
      }
      if (cells[i] === d) return s;
      cells[i] = d; notes[i] = 0;
      for (const p of PEERS[i]) notes[p] &= ~(1 << d); // auto-clear stale pencil marks
      const solved = findConflicts(cells).size === 0 && isSolved(cells, s.puzzle.solution);
      return { ...s, history: push(s), cells, notes, finishedAt: solved ? now : null };
    }
  }
}
