// Human-style logic solver: every step is a named technique, so each puzzle is solvable without guessing
// and every hint can explain *why*. Pure TypeScript, no DOM/network.
import { PEERS, assertGrid, boxOf, colOf, rowOf, type Grid } from './sudoku';

export type Technique = 'naked-single' | 'hidden-single' | 'locked-candidates' | 'naked-pair' | 'hidden-pair' | 'x-wing' | 'xy-wing';
export const TECHNIQUE_LEVEL: Record<Technique, 1 | 2 | 3 | 4> = {
  'naked-single': 1, 'hidden-single': 1, 'locked-candidates': 2, 'naked-pair': 3, 'hidden-pair': 3, 'x-wing': 4, 'xy-wing': 4,
};
export const TECHNIQUE_NAME: Record<Technique, string> = {
  'naked-single': 'naked single', 'hidden-single': 'hidden single', 'locked-candidates': 'locked candidates',
  'naked-pair': 'naked pair', 'hidden-pair': 'hidden pair', 'x-wing': 'X-Wing', 'xy-wing': 'XY-Wing',
};

export interface House { kind: 'row' | 'col' | 'box'; index: number }
export interface Step {
  technique: Technique;
  placements: { cell: number; digit: number }[];
  eliminations: { cell: number; digit: number }[];
  cells: number[];   // the pattern's cells
  digits: number[];  // the pattern's digits
  house?: House;
}
export interface Cand { grid: number[]; cand: number[] }

const ALL = 0x3fe;
const bit = (d: number) => 1 << d;
const pc = (m: number) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const digitsOf = (m: number) => { const o: number[] = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) o.push(d); return o; };

export const HOUSES: number[][] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
];
const HOUSE_INFO: House[] = HOUSES.map((_, h) => ({ kind: h < 9 ? 'row' : h < 18 ? 'col' : 'box', index: h % 9 }));
export const houseCells = (h: House) => HOUSES[(h.kind === 'row' ? 0 : h.kind === 'col' ? 9 : 18) + h.index];

/** Candidate grid from the digits on the board. Returns null if two equal digits share a house. */
export function initCandidates(grid: Grid): Cand | null {
  assertGrid(grid);
  for (const cells of HOUSES) {
    let seen = 0;
    for (const c of cells) if (grid[c]) { if (seen & bit(grid[c])) return null; seen |= bit(grid[c]); }
  }
  const cand = new Array<number>(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    let m = ALL;
    for (const p of PEERS[i]) if (grid[p]) m &= ~bit(grid[p]);
    cand[i] = m;
  }
  return { grid: grid.slice(), cand };
}

/** True if the board can no longer be completed: a cell with no options, or a number with no home in a house. */
export function isDeadEnd(grid: Grid): boolean {
  const s = initCandidates(grid);
  if (!s) return true;
  if (s.grid.some((v, i) => v === 0 && s.cand[i] === 0)) return true;
  for (const cells of HOUSES) {
    let placed = 0, possible = 0;
    for (const c of cells) { if (s.grid[c]) placed |= bit(s.grid[c]); else possible |= s.cand[c]; }
    if ((ALL & ~placed & ~possible) !== 0) return true;
  }
  return false;
}

function applyStep(s: Cand, st: Step): void {
  for (const { cell, digit } of st.placements) {
    s.grid[cell] = digit; s.cand[cell] = 0;
    for (const p of PEERS[cell]) s.cand[p] &= ~bit(digit);
  }
  for (const { cell, digit } of st.eliminations) s.cand[cell] &= ~bit(digit);
}

const mk = (technique: Technique, p: Partial<Step>): Step => ({ technique, placements: [], eliminations: [], cells: [], digits: [], ...p });

function nakedSingle(s: Cand): Step | null {
  for (let i = 0; i < 81; i++) {
    const m = s.cand[i];
    if (m && (m & (m - 1)) === 0) { const d = 31 - Math.clz32(m); return mk('naked-single', { placements: [{ cell: i, digit: d }], cells: [i], digits: [d] }); }
  }
  return null;
}

function hiddenSingle(s: Cand): Step | null {
  for (let h = 0; h < 27; h++) {
    for (let d = 1; d <= 9; d++) {
      let pos = -1, n = 0;
      for (const c of HOUSES[h]) if (s.cand[c] & bit(d)) { pos = c; if (++n > 1) break; }
      if (n === 1) return mk('hidden-single', { placements: [{ cell: pos, digit: d }], cells: [pos], digits: [d], house: HOUSE_INFO[h] });
    }
  }
  return null;
}

const elimOf = (s: Cand, cells: number[], d: number) => cells.filter((c) => s.cand[c] & bit(d)).map((cell) => ({ cell, digit: d }));

function lockedCandidates(s: Cand): Step | null {
  for (let b = 18; b < 27; b++) { // pointing: digit confined to one line inside a box
    for (let d = 1; d <= 9; d++) {
      const pos = HOUSES[b].filter((c) => s.cand[c] & bit(d));
      if (pos.length < 2) continue;
      const outside = (line: number[]) => line.filter((c) => boxOf(c) !== b - 18);
      let e = pos.every((c) => rowOf(c) === rowOf(pos[0])) ? elimOf(s, outside(HOUSES[rowOf(pos[0])]), d) : [];
      if (!e.length && pos.every((c) => colOf(c) === colOf(pos[0]))) e = elimOf(s, outside(HOUSES[9 + colOf(pos[0])]), d);
      if (e.length) return mk('locked-candidates', { eliminations: e, cells: pos, digits: [d], house: HOUSE_INFO[b] });
    }
  }
  for (let h = 0; h < 18; h++) { // claiming: digit in a line confined to one box
    for (let d = 1; d <= 9; d++) {
      const pos = HOUSES[h].filter((c) => s.cand[c] & bit(d));
      if (pos.length < 2 || !pos.every((c) => boxOf(c) === boxOf(pos[0]))) continue;
      const e = elimOf(s, HOUSES[18 + boxOf(pos[0])].filter((c) => !HOUSES[h].includes(c)), d);
      if (e.length) return mk('locked-candidates', { eliminations: e, cells: pos, digits: [d], house: HOUSE_INFO[h] });
    }
  }
  return null;
}

function nakedPair(s: Cand): Step | null {
  for (let h = 0; h < 27; h++) {
    const two = HOUSES[h].filter((c) => pc(s.cand[c]) === 2);
    for (let a = 0; a < two.length; a++) for (let b = a + 1; b < two.length; b++) {
      const m = s.cand[two[a]];
      if (m !== s.cand[two[b]]) continue;
      const e = digitsOf(m).flatMap((d) => elimOf(s, HOUSES[h].filter((c) => c !== two[a] && c !== two[b]), d));
      if (e.length) return mk('naked-pair', { eliminations: e, cells: [two[a], two[b]], digits: digitsOf(m), house: HOUSE_INFO[h] });
    }
  }
  return null;
}

function hiddenPair(s: Cand): Step | null {
  for (let h = 0; h < 27; h++) {
    const where = new Array<number>(10).fill(0);
    HOUSES[h].forEach((c, k) => { for (let d = 1; d <= 9; d++) if (s.cand[c] & bit(d)) where[d] |= 1 << k; });
    for (let a = 1; a <= 9; a++) for (let b = a + 1; b <= 9; b++) {
      if (where[a] !== where[b] || pc(where[a]) !== 2) continue;
      const cells = HOUSES[h].filter((_, k) => where[a] & (1 << k));
      const e = cells.flatMap((cell) => digitsOf(s.cand[cell] & ~(bit(a) | bit(b))).map((digit) => ({ cell, digit })));
      if (e.length) return mk('hidden-pair', { eliminations: e, cells, digits: [a, b], house: HOUSE_INFO[h] });
    }
  }
  return null;
}

function xWing(s: Cand): Step | null {
  for (let d = 1; d <= 9; d++) for (const byRow of [true, false]) {
    const at = (line: number, k: number) => (byRow ? line * 9 + k : k * 9 + line);
    const lines: { line: number; mask: number }[] = [];
    for (let line = 0; line < 9; line++) {
      let mask = 0;
      for (let k = 0; k < 9; k++) if (s.cand[at(line, k)] & bit(d)) mask |= 1 << k;
      if (pc(mask) === 2) lines.push({ line, mask });
    }
    for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
      if (lines[a].mask !== lines[b].mask) continue;
      const ks = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((k) => lines[a].mask & (1 << k));
      const e: { cell: number; digit: number }[] = [];
      for (const k of ks) for (let line = 0; line < 9; line++) {
        if (line === lines[a].line || line === lines[b].line) continue;
        if (s.cand[at(line, k)] & bit(d)) e.push({ cell: at(line, k), digit: d });
      }
      if (e.length) return mk('x-wing', { eliminations: e, cells: ks.flatMap((k) => [at(lines[a].line, k), at(lines[b].line, k)]), digits: [d] });
    }
  }
  return null;
}

function xyWing(s: Cand): Step | null {
  for (let p = 0; p < 81; p++) {
    if (pc(s.cand[p]) !== 2) continue;
    const [a, b] = digitsOf(s.cand[p]);
    const bi = PEERS[p].filter((c) => pc(s.cand[c]) === 2);
    for (const p1 of bi) {
      const m1 = s.cand[p1];
      if (!(m1 & bit(a)) || (m1 & bit(b))) continue;
      const c = digitsOf(m1 & ~bit(a))[0];
      for (const p2 of bi) {
        if (p2 === p1 || s.cand[p2] !== (bit(b) | bit(c))) continue;
        const e = elimOf(s, PEERS[p1].filter((x) => x !== p && PEERS[p2].includes(x)), c);
        if (e.length) return mk('xy-wing', { eliminations: e, cells: [p, p1, p2], digits: [a, b, c] });
      }
    }
  }
  return null;
}

const FINDERS: [(s: Cand) => Step | null, number][] = [
  [nakedSingle, 1], [hiddenSingle, 1], [lockedCandidates, 2], [nakedPair, 3], [hiddenPair, 3], [xWing, 4], [xyWing, 4],
];
export function nextStep(s: Cand, maxLevel = 4): Step | null {
  for (const [find, level] of FINDERS) {
    if (level > maxLevel) break;
    const st = find(s);
    if (st) return st;
  }
  return null;
}

export interface SolveResult { solved: boolean; grade: number; steps: Step[]; grid: Grid }
/** Solve using techniques up to `maxLevel` only. `grade` = hardest level actually used (0 if nothing to do). */
export function logicSolve(grid: Grid, maxLevel = 4, record = false): SolveResult {
  const s = initCandidates(grid);
  const fail = (): SolveResult => ({ solved: false, grade: 0, steps: [], grid: grid.slice() });
  if (!s || s.grid.some((v, i) => v === 0 && s.cand[i] === 0)) return fail();
  let empties = s.grid.filter((v) => v === 0).length, grade = 0;
  const steps: Step[] = [];
  while (empties > 0) {
    const st = nextStep(s, maxLevel);
    if (!st) break;
    applyStep(s, st);
    if (s.grid.some((v, i) => v === 0 && s.cand[i] === 0)) return fail();
    grade = Math.max(grade, TECHNIQUE_LEVEL[st.technique]);
    if (record) steps.push(st);
    empties -= st.placements.length;
  }
  return { solved: empties === 0, grade, steps, grid: s.grid };
}
