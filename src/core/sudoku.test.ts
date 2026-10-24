import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, TARGET_CLUES, assertGrid, countSolutions, findConflicts, generatePuzzle, mulberry32, solve } from './sudoku';
import { reduce, startGame } from './game';
import { load, save, clear } from './storage';

const EMPTY = new Array(81).fill(0);

describe('engine', () => {
  it('rejects malformed grids', () => {
    expect(() => assertGrid([1, 2])).toThrow();
    expect(() => assertGrid(new Array(81).fill(10))).toThrow();
    expect(() => assertGrid(new Array(81).fill(1.5))).toThrow();
    expect(() => countSolutions('x' as never)).toThrow();
  });
  it('detects contradictory givens as 0 solutions', () => {
    const g = EMPTY.slice(); g[0] = 5; g[1] = 5;
    expect(countSolutions(g)).toBe(0);
  });
  it('empty grid has many solutions (limit respected)', () => {
    expect(countSolutions(EMPTY, 2)).toBe(2);
  });
  it('same seed gives same puzzle; different seed differs', () => {
    expect(generatePuzzle('medium', 42)).toEqual(generatePuzzle('medium', 42));
    expect(generatePuzzle('medium', 42).puzzle).not.toEqual(generatePuzzle('medium', 43).puzzle);
  });
  for (const d of DIFFICULTIES) {
    it(`${d}: unique solution, valid solution, clue count in range`, () => {
      for (const seed of [1, 2, 3]) {
        const p = generatePuzzle(d, seed);
        expect(countSolutions(p.puzzle, 2)).toBe(1);
        expect(solve(p.puzzle)).toEqual(p.solution);
        expect(findConflicts(p.solution).size).toBe(0);
        expect(p.solution.every((v) => v >= 1 && v <= 9)).toBe(true);
        expect(p.puzzle.filter(Boolean).length).toBe(p.clues);
        expect(p.clues).toBeGreaterThanOrEqual(TARGET_CLUES[d]);
        expect(p.clues).toBeLessThanOrEqual(TARGET_CLUES[d] + 4);
        p.puzzle.forEach((v, i) => { if (v) expect(v).toBe(p.solution[i]); });
      }
    });
  }
  it('rejects unknown difficulty', () => {
    expect(() => generatePuzzle('nope' as never, 1)).toThrow();
  });
  it('prng is deterministic and in [0,1)', () => {
    const a = mulberry32(7), b = mulberry32(7);
    for (let i = 0; i < 100; i++) { const x = a(); expect(x).toBe(b()); expect(x >= 0 && x < 1).toBe(true); }
  });
});

describe('game reducer', () => {
  const now = 1000;
  const fresh = () => startGame('easy', now, 5);
  const emptyCell = (s: ReturnType<typeof fresh>) => s.cells.findIndex((v) => v === 0);

  it('cannot change givens or act without selection', () => {
    let s = fresh();
    const g = s.cells.findIndex((v) => v !== 0);
    s = reduce(s, { type: 'select', cell: g });
    expect(reduce(s, { type: 'digit', digit: 1 }).cells).toEqual(s.cells);
    expect(reduce(s, { type: 'erase' }).cells).toEqual(s.cells);
    expect(reduce(fresh(), { type: 'digit', digit: 1 }).cells).toEqual(fresh().cells);
  });
  it('ignores out-of-range input', () => {
    let s = fresh(); s = reduce(s, { type: 'select', cell: emptyCell(s) });
    for (const digit of [0, 10, -1, 1.5, NaN]) expect(reduce(s, { type: 'digit', digit })).toBe(s);
    expect(reduce(s, { type: 'select', cell: 81 })).toBe(s);
    expect(reduce(s, { type: 'select', cell: -1 })).toBe(s);
  });
  it('places, notes, undo, erase', () => {
    let s = fresh(); const i = emptyCell(s);
    s = reduce(s, { type: 'select', cell: i });
    s = reduce(s, { type: 'toggleNotes' });
    s = reduce(s, { type: 'digit', digit: 3 });
    expect(s.notes[i]).toBe(1 << 3);
    s = reduce(s, { type: 'digit', digit: 3 });
    expect(s.notes[i]).toBe(0);
    s = reduce(s, { type: 'toggleNotes' });
    s = reduce(s, { type: 'digit', digit: 4 });
    expect(s.cells[i]).toBe(4);
    s = reduce(s, { type: 'undo' });
    expect(s.cells[i]).toBe(0);
    s = reduce(s, { type: 'digit', digit: 4 });
    s = reduce(s, { type: 'erase' });
    expect(s.cells[i]).toBe(0);
  });
  it('placing a digit clears that pencil mark in peers', () => {
    let s = fresh(); const i = emptyCell(s);
    const j = s.cells.findIndex((v, k) => v === 0 && k !== i && (Math.floor(k / 9) === Math.floor(i / 9)));
    s = reduce(s, { type: 'select', cell: j }); s = reduce(s, { type: 'toggleNotes' }); s = reduce(s, { type: 'digit', digit: 6 });
    s = reduce(s, { type: 'toggleNotes' }); s = reduce(s, { type: 'select', cell: i }); s = reduce(s, { type: 'digit', digit: 6 });
    expect(s.notes[j] & (1 << 6)).toBe(0);
  });
  it('wins only on the correct full grid, then becomes read-only', () => {
    let s = fresh();
    const empties = s.cells.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    for (const i of empties) { s = reduce(s, { type: 'select', cell: i }, 5); s = reduce(s, { type: 'digit', digit: s.puzzle.solution[i] }, 5000); }
    expect(s.finishedAt).toBe(5000);
    const after = reduce(s, { type: 'select', cell: empties[0] });
    expect(after).toBe(s);
    expect(reduce(s, { type: 'undo' })).toBe(s);
  });
  it('a wrong full grid does not win', () => {
    let s = fresh();
    const empties = s.cells.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    for (const i of empties) { s = reduce(s, { type: 'select', cell: i }); s = reduce(s, { type: 'digit', digit: (s.puzzle.solution[i] % 9) + 1 }); }
    expect(s.finishedAt).toBeNull();
  });
});

describe('storage (untrusted input)', () => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; },
  };
  const KEY = 'sudoku-cat:v1';
  it('round-trips a game', () => {
    let s = startGame('easy', 0, 9);
    const i = s.cells.findIndex((v) => v === 0);
    s = reduce(s, { type: 'select', cell: i }); s = reduce(s, { type: 'digit', digit: 2 });
    save(s, 4000);
    const l = load(10000)!;
    expect(l.cells).toEqual(s.cells);
    expect(l.startedAt).toBe(6000);
  });
  it('rejects tampered / malformed data', () => {
    const base = JSON.parse(store[KEY]);
    const bad = [
      '{', 'null', '[]', '"x"', 'x'.repeat(6000),
      JSON.stringify({ ...base, seed: 1.5 }), JSON.stringify({ ...base, difficulty: '__proto__' }),
      JSON.stringify({ ...base, cells: [1, 2] }), JSON.stringify({ ...base, cells: base.cells.map(() => 11) }),
      JSON.stringify({ ...base, notes: base.notes.map(() => 5000) }), JSON.stringify({ ...base, elapsedMs: -5 }),
      JSON.stringify({ ...base, elapsedMs: 'x' }),
      JSON.stringify({ ...base, cells: base.cells.map((v: number) => (v ? (v % 9) + 1 : 0)) }), // altered givens
    ];
    for (const b of bad) { store[KEY] = b; expect(load()).toBeNull(); }
    clear(); expect(load()).toBeNull();
  });
  it('does not persist finished games', () => {
    let s = startGame('easy', 0, 9);
    const empties = s.cells.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    for (const i of empties) { s = reduce(s, { type: 'select', cell: i }); s = reduce(s, { type: 'digit', digit: s.puzzle.solution[i] }, 9); }
    save(s); expect(load()).toBeNull();
  });
});

describe('stress', () => {
  it('rejects out-of-range seeds in saved data', () => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: () => {} };
    const s = startGame('easy', 0, 9); save(s, 1);
    const base = JSON.parse(store['sudoku-cat:v1']);
    for (const seed of [-1, 2 ** 32, 1e300]) { store['sudoku-cat:v1'] = JSON.stringify({ ...base, seed }); expect(load()).toBeNull(); }
  });
  it('200 seeds per level: unique, fast, clues in range', () => {
    for (const d of DIFFICULTIES) {
      const t0 = performance.now(); let worst = 0;
      for (let seed = 1000; seed < 1200; seed++) {
        const t = performance.now(); const p = generatePuzzle(d, seed); worst = Math.max(worst, performance.now() - t);
        expect(countSolutions(p.puzzle, 2)).toBe(1);
        expect(p.clues).toBeLessThanOrEqual(TARGET_CLUES[d] + 4);
      }
      console.log(d, 'avg ms', ((performance.now() - t0) / 200).toFixed(1), 'worst ms', worst.toFixed(0));
      expect(worst).toBeLessThan(1500);
    }
  });
});
