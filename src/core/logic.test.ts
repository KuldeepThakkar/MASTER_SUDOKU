import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, LEVEL, generatePuzzle } from './generator';
import { isDeadEnd, logicSolve, type Technique } from './logic';
import { countSolutions, findConflicts, solve } from './sudoku';

const SEEDS = Array.from({ length: 25 }, (_, i) => 100 + i);

describe('generator guarantees (every game is solved before it is handed out)', () => {
  for (const d of DIFFICULTIES) {
    it(`${d}: unique, logic-solvable with no guessing, exact grade, givens match solution`, () => {
      for (const seed of SEEDS) {
        const p = generatePuzzle(d, seed);
        expect(countSolutions(p.puzzle, 2)).toBe(1);
        expect(solve(p.puzzle)).toEqual(p.solution);
        expect(findConflicts(p.solution).size).toBe(0);
        const r = logicSolve(p.puzzle, LEVEL[d]);
        expect(r.solved).toBe(true);
        expect(r.grid).toEqual(p.solution);
        expect(r.grade).toBe(LEVEL[d]);
        expect(p.grade).toBe(LEVEL[d]);
        p.puzzle.forEach((v, i) => { if (v) expect(v).toBe(p.solution[i]); });
        expect(p.puzzle.filter(Boolean).length).toBe(p.clues);
      }
    });
  }
  it('is deterministic per seed, differs across seeds, rejects unknown level', () => {
    expect(generatePuzzle('hard', 42)).toEqual(generatePuzzle('hard', 42));
    expect(generatePuzzle('hard', 42).puzzle).not.toEqual(generatePuzzle('hard', 43).puzzle);
    expect(() => generatePuzzle('nope' as never, 1)).toThrow();
  });
  it('is fast enough for the main thread', () => {
    for (const d of DIFFICULTIES) { const t = performance.now(); generatePuzzle(d, 777); expect(performance.now() - t).toBeLessThan(2500); }
  });
});

describe('solver soundness', () => {
  it('never eliminates a true digit and never places a wrong one; covers every technique', () => {
    const seen = new Set<Technique>();
    for (const d of ['medium', 'hard', 'expert'] as const) {
      for (let seed = 1; seed <= 60; seed++) {
        const p = generatePuzzle(d, seed);
        for (const st of logicSolve(p.puzzle, 4, true).steps) {
          seen.add(st.technique);
          expect(st.placements.every((x) => p.solution[x.cell] === x.digit)).toBe(true);
          expect(st.eliminations.every((x) => p.solution[x.cell] !== x.digit)).toBe(true);
        }
      }
    }
    for (const t of ['naked-single', 'hidden-single', 'locked-candidates', 'naked-pair', 'hidden-pair', 'x-wing', 'xy-wing'] as Technique[]) {
      expect(seen.has(t), `technique never exercised: ${t}`).toBe(true);
    }
  });
});

describe('dead-end detection (what the cat will use)', () => {
  it('flags cells with no options, numbers with no home, and duplicates', () => {
    const g = new Array(81).fill(0);
    for (let c = 1; c <= 8; c++) g[c] = c;   // row 1 holds 1..8
    g[9] = 9;                                 // 9 below the first cell
    expect(isDeadEnd(g)).toBe(true);          // cell (1,1) can take nothing
    const dup = new Array(81).fill(0); dup[0] = 4; dup[1] = 4;
    expect(isDeadEnd(dup)).toBe(true);
    const p = generatePuzzle('easy', 5);
    expect(isDeadEnd(p.puzzle)).toBe(false);
    expect(isDeadEnd(p.solution)).toBe(false);
  });
  it('a rule-legal wrong digit hides at first but is always caught once the rest of the board is right', () => {
    const p = generatePuzzle('medium', 11);
    let wrongLegal = 0;
    for (let i = 0; i < 81; i++) {
      if (p.puzzle[i]) continue;
      for (let d = 1; d <= 9; d++) {
        if (d === p.solution[i]) continue;
        const early = p.puzzle.slice(); early[i] = d;
        if (findConflicts(early).size !== 0) continue; // breaks a rule: visible immediately, not what we test here
        wrongLegal++;
        const late = p.solution.slice(); late[i] = d;
        expect(isDeadEnd(late)).toBe(true);
      }
    }
    expect(wrongLegal).toBeGreaterThan(0);
  });
});
