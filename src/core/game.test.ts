import { describe, expect, it } from 'vitest';
import { isSolved, reduce, startGame, type GameState } from './game';
import { generatePuzzle, DIFFICULTIES } from './generator';
import { clear, load, save } from './storage';

const fresh = () => startGame('easy', 1000, 5);
const emptyCell = (s: GameState) => s.cells.findIndex((v) => v === 0);
const sel = (s: GameState, cell: number) => reduce(s, { type: 'select', cell });
const peerEmptyWith = (s: GameState, d: number) => { // an empty cell whose row/col/box already holds d
  for (let i = 0; i < 81; i++) if (!s.cells[i] && s.puzzle.solution[i] !== d && reduce(reduce(sel(s, i), { type: 'toggleNotes' }), { type: 'digit', digit: d }).notice) return i;
  return -1;
};

describe('basic rules', () => {
  it('cannot change givens, act without selection, or use out-of-range input', () => {
    let s = fresh();
    const g = s.cells.findIndex((v) => v !== 0);
    expect(reduce(sel(s, g), { type: 'digit', digit: 1 }).cells).toEqual(s.cells);
    expect(reduce(sel(s, g), { type: 'erase' }).cells).toEqual(s.cells);
    expect(reduce(s, { type: 'digit', digit: 1 })).toBe(s);
    s = sel(s, emptyCell(s));
    for (const digit of [0, 10, -1, 1.5, NaN]) { expect(reduce(s, { type: 'digit', digit })).toBe(s); expect(reduce(s, { type: 'setDigit', digit })).toBe(s); }
    expect(reduce(s, { type: 'select', cell: 81 })).toBe(s);
    expect(reduce(s, { type: 'paint', cell: -1 })).toBe(s);
  });
  it('places, undoes, erases, and tapping the same digit clears it', () => {
    let s = sel(fresh(), emptyCell(fresh())); const i = s.selected!;
    s = reduce(s, { type: 'digit', digit: 4 }); expect(s.cells[i]).toBe(4);
    s = reduce(s, { type: 'undo' }); expect(s.cells[i]).toBe(0);
    s = reduce(reduce(s, { type: 'digit', digit: 4 }), { type: 'digit', digit: 4 }); expect(s.cells[i]).toBe(0);
    s = reduce(reduce(s, { type: 'digit', digit: 4 }), { type: 'erase' }); expect(s.cells[i]).toBe(0);
  });
  it('wins only on the correct full grid, then is read-only', () => {
    let s = fresh();
    const empties = s.cells.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    for (const i of empties) s = reduce(reduce(s, { type: 'select', cell: i }, 5), { type: 'digit', digit: s.puzzle.solution[i] }, 5000);
    expect(s.finishedAt).toBe(5000);
    expect(reduce(s, { type: 'select', cell: empties[0] })).toBe(s);
    expect(reduce(s, { type: 'undo' })).toBe(s);
    expect(reduce(s, { type: 'hint' })).toBe(s);
  });
  it('a wrong full grid does not win', () => {
    let s = fresh();
    for (const i of s.cells.map((v, k) => (v === 0 ? k : -1)).filter((k) => k >= 0)) s = reduce(reduce(s, { type: 'select', cell: i }), { type: 'digit', digit: (s.puzzle.solution[i] % 9) + 1 });
    expect(s.finishedAt).toBeNull();
  });
});

describe('notes obey the rules', () => {
  it('blocks a note when its row, column or box already holds that number, and says why', () => {
    const s = fresh(); const d = s.cells.find((v) => v)!;
    const i = peerEmptyWith(s, d); expect(i).toBeGreaterThanOrEqual(0);
    const t = reduce(reduce(sel(s, i), { type: 'toggleNotes' }), { type: 'digit', digit: d });
    expect(t.notes[i]).toBe(0);
    expect(t.notice).toMatch(/already in this (row|column|box)/);
  });
  it('allows legal notes, toggles them off, and refuses notes on filled cells', () => {
    let s = sel(fresh(), emptyCell(fresh())); const i = s.selected!; const ok = s.puzzle.solution[i];
    s = reduce(s, { type: 'toggleNotes' });
    s = reduce(s, { type: 'digit', digit: ok }); expect(s.notes[i]).toBe(1 << ok);
    s = reduce(s, { type: 'digit', digit: ok }); expect(s.notes[i]).toBe(0);
    s = reduce(reduce(reduce(s, { type: 'toggleNotes' }), { type: 'digit', digit: ok }), { type: 'toggleNotes' });
    expect(reduce(s, { type: 'digit', digit: ok }).notice).toMatch(/Erase/);
  });
  it('placing a digit clears that pencil mark from peers', () => {
    let s = fresh(); const i = emptyCell(s);
    const j = s.cells.findIndex((v, k) => v === 0 && k !== i && Math.floor(k / 9) === Math.floor(i / 9));
    const d = s.puzzle.solution[i];
    s = reduce(reduce(reduce(sel(s, j), { type: 'toggleNotes' }), { type: 'digit', digit: d }), { type: 'toggleNotes' });
    if (s.notes[j] & (1 << d)) { s = reduce(sel(s, i), { type: 'digit', digit: d }); expect(s.notes[j] & (1 << d)).toBe(0); }
  });
});

describe('sticky digit ("brush")', () => {
  it('stays armed across cells, works for notes too, toggles off, ignores givens', () => {
    let s = fresh();
    const [a, b] = s.cells.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    s = reduce(s, { type: 'setDigit', digit: s.puzzle.solution[a] });
    const d = s.activeDigit!;
    s = reduce(s, { type: 'paint', cell: a }); expect(s.cells[a]).toBe(d); expect(s.activeDigit).toBe(d);
    s = reduce(s, { type: 'paint', cell: b }); expect(s.cells[b]).toBe(d);
    s = reduce(s, { type: 'paint', cell: b }); expect(s.cells[b]).toBe(0);              // paint again clears
    const g = s.cells.findIndex((v, i) => v !== 0 && s.puzzle.puzzle[i] !== 0);
    expect(reduce(s, { type: 'paint', cell: g }).cells).toEqual(s.cells);               // givens untouched
    s = reduce(s, { type: 'setDigit', digit: d });                                       // let go
    const d2 = s.puzzle.solution[b];
    s = reduce(reduce(s, { type: 'setDigit', digit: d2 }), { type: 'toggleNotes' });
    s = reduce(s, { type: 'paint', cell: b }); expect(s.notes[b] & (1 << d2)).not.toBe(0); // legal note placed
    expect(reduce(s, { type: 'setDigit', digit: d2 }).activeDigit).toBeNull();            // same digit lets go
  });
  it('with nothing armed, painting just selects', () => {
    const s = fresh(); const t = reduce(s, { type: 'paint', cell: 10 });
    expect(t.selected).toBe(10); expect(t.cells).toEqual(s.cells);
  });
});

describe('counters', () => {
  it('rule violations count as visible mistakes; legal-but-wrong digits count as hidden sneaky ones', () => {
    let s = fresh();
    const legalWrong = () => { for (let i = 0; i < 81; i++) if (!s.cells[i]) for (let d = 1; d <= 9; d++) { if (d === s.puzzle.solution[i]) continue; const t = reduce(reduce(sel(s, i), { type: 'toggleNotes' }), { type: 'digit', digit: d }); if (!t.notice) return { i, d }; } return null; };
    const lw = legalWrong()!;
    s = reduce(sel(s, lw.i), { type: 'digit', digit: lw.d });
    expect(s.sneaky).toBe(1); expect(s.mistakes).toBe(0);
    const g = s.cells.find((v) => v)!; const bad = peerEmptyWith(s, g);
    s = reduce(sel(s, bad), { type: 'digit', digit: g });
    expect(s.mistakes).toBe(1);
    s = reduce(s, { type: 'undo' }); expect(s.mistakes).toBe(1); // counters survive undo
  });
});

describe('hints', () => {
  it('escalate 1 to 3, count each press, reset when the board changes', () => {
    let s = fresh();
    s = reduce(s, { type: 'hint' }); expect(s.hint!.tier).toBe(1); expect(s.hint!.target).toBeNull();
    s = reduce(s, { type: 'hint' }); expect(s.hint!.tier).toBe(2); expect(s.hint!.target).toBeNull();
    s = reduce(s, { type: 'hint' }); expect(s.hint!.tier).toBe(3);
    const { cell, digit } = s.hint!.target!; expect(s.puzzle.solution[cell]).toBe(digit);
    expect(s.hints).toBe(3);
    expect(reduce(s, { type: 'hint' })).toBe(s);
    s = reduce(sel(s, cell), { type: 'digit', digit }); expect(s.hint).toBeNull();
  });
  for (const d of DIFFICULTIES) {
    it(`${d}: a whole game can be finished by following hints alone`, () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        let s = startGame(d, 0, seed); let guard = 0;
        while (s.finishedAt === null && guard++ < 90) {
          for (let k = 0; k < 3; k++) s = reduce(s, { type: 'hint' });
          const t = s.hint!.target!;
          expect(t, 'hint must name a cell').toBeTruthy();
          expect(s.puzzle.solution[t.cell]).toBe(t.digit);
          s = reduce(sel(s, t.cell), { type: 'digit', digit: t.digit }, 1);
        }
        expect(s.finishedAt).not.toBeNull(); expect(isSolved(s.cells, s.puzzle.solution)).toBe(true);
        expect(s.mistakes).toBe(0); expect(s.sneaky).toBe(0);
      }
    });
  }
  it('a wrong-but-legal digit is caught first, narrows down, and recovery works', () => {
    let s = fresh(); let placed = -1;
    for (let i = 0; i < 81 && placed < 0; i++) if (!s.cells[i]) for (let d = 1; d <= 9; d++) {
      if (d === s.puzzle.solution[i]) continue;
      if (!reduce(reduce(sel(s, i), { type: 'toggleNotes' }), { type: 'digit', digit: d }).notice) { s = reduce(sel(s, i), { type: 'digit', digit: d }); placed = i; break; }
    }
    s = reduce(s, { type: 'hint' }); expect(s.hint!.kind).toBe('mistake'); expect(s.hint!.cells).toContain(placed);
    s = reduce(s, { type: 'hint' }); expect(s.hint!.cells).toContain(placed);
    s = reduce(s, { type: 'hint' }); expect(s.hint!.target!.cell).toBe(placed);
    s = reduce(sel(s, placed), { type: 'erase' });
    s = reduce(s, { type: 'hint' }); expect(s.hint!.kind).toBe('step');
  });
});

describe('storage (untrusted input)', () => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; },
  };
  const KEY = 'sudoku-cat:v2';
  it('round-trips a game including counters', () => {
    let s = startGame('easy', 0, 9);
    s = reduce(reduce(sel(s, emptyCell(s)), { type: 'digit', digit: 2 }), { type: 'hint' });
    save(s, 4000);
    const l = load(10000)!;
    expect(l.cells).toEqual(s.cells); expect(l.startedAt).toBe(6000); expect(l.hints).toBe(1);
  });
  it('rejects tampered / malformed data', () => {
    const base = JSON.parse(store[KEY]);
    const bad = ['{', 'null', '[]', '"x"', 'x'.repeat(6000),
      ...[1.5, -1, 2 ** 32, 1e300].map((seed) => ({ ...base, seed })), { ...base, difficulty: '__proto__' },
      { ...base, cells: [1, 2] }, { ...base, cells: base.cells.map(() => 11) }, { ...base, notes: base.notes.map(() => 5000) },
      { ...base, elapsedMs: -5 }, { ...base, elapsedMs: 'x' }, { ...base, mistakes: -1 }, { ...base, hints: 1e6 }, { ...base, sneaky: 'a' },
      { ...base, cells: base.cells.map((v: number) => (v ? (v % 9) + 1 : 0)) }]; // altered givens
    for (const b of bad) { store[KEY] = typeof b === 'string' ? b : JSON.stringify(b); expect(load()).toBeNull(); }
    clear(); expect(load()).toBeNull();
  });
  it('does not persist finished games', () => {
    let s = startGame('easy', 0, 9);
    for (const i of s.cells.map((v, k) => (v === 0 ? k : -1)).filter((k) => k >= 0)) s = reduce(reduce(s, { type: 'select', cell: i }), { type: 'digit', digit: s.puzzle.solution[i] }, 9);
    save(s); expect(load()).toBeNull();
  });
  it('regenerates the same puzzle from a saved seed', () => {
    expect(generatePuzzle('expert', 31)).toEqual(generatePuzzle('expert', 31));
  });
});
