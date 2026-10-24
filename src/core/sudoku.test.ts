import { describe, expect, it } from 'vitest';
import { assertGrid, countSolutions, findConflicts, mulberry32, solve } from './sudoku';

const EMPTY = new Array(81).fill(0);
describe('engine basics', () => {
  it('rejects malformed grids', () => {
    expect(() => assertGrid([1, 2])).toThrow();
    expect(() => assertGrid(new Array(81).fill(10))).toThrow();
    expect(() => assertGrid(new Array(81).fill(1.5))).toThrow();
    expect(() => countSolutions('x' as never)).toThrow();
  });
  it('contradictory givens have 0 solutions; empty grid hits the limit', () => {
    const g = EMPTY.slice(); g[0] = 5; g[1] = 5;
    expect(countSolutions(g)).toBe(0);
    expect(countSolutions(EMPTY, 2)).toBe(2);
    expect(findConflicts(g).size).toBe(2);
    expect(solve(EMPTY)!.every((v) => v >= 1 && v <= 9)).toBe(true);
  });
  it('prng is deterministic and in [0,1)', () => {
    const a = mulberry32(7), b = mulberry32(7);
    for (let i = 0; i < 100; i++) { const x = a(); expect(x).toBe(b()); expect(x >= 0 && x < 1).toBe(true); }
  });
});
