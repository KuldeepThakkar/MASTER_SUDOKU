import { HOUSES, TECHNIQUE_NAME, houseCells, logicSolve, type House, type Step } from './logic';
import { boxOf, colOf, rowOf, type Grid } from './sudoku';

export interface HintView {
  tier: 1 | 2 | 3;
  kind: 'mistake' | 'step' | 'stuck';
  text: string;
  cells: number[];
  target: { cell: number; digit: number } | null;
}

const rc = (i: number) => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;
const houseName = (h: House) => `${h.kind === 'col' ? 'column' : h.kind} ${h.index + 1}`;
const boxCells = (i: number) => HOUSES[18 + boxOf(i)];

const WHAT: Record<Step['technique'], (h: string) => string> = {
  'naked-single': () => 'One cell has only a single number that still fits.',
  'hidden-single': (h) => `In ${h}, one number has just one cell left where it can go.`,
  'locked-candidates': () => 'A number is trapped in one line of this block, so it can be cleared from the rest of that line (or the other way round).',
  'naked-pair': (h) => `Two cells in ${h} share the same two options, so those options can't go anywhere else there.`,
  'hidden-pair': (h) => `Two numbers in ${h} fit only the same two cells, so those cells can't hold anything else.`,
  'x-wing': () => 'A number sits in the same two columns of two different rows (or the reverse), forming a rectangle that clears it elsewhere.',
  'xy-wing': () => 'Three cells with two options each link up and rule one number out for any cell that sees two of them.',
};

/**
 * One hint for the current board, shown at three depths: where to look, what pattern to look for, the answer.
 * A wrong digit on the board always comes first (the board can't be finished with it).
 */
export function getHint(cells: Grid, solution: Grid, tier: 1 | 2 | 3): HintView {
  const w = cells.findIndex((v, i) => v !== 0 && v !== solution[i]);
  if (w >= 0) {
    if (tier === 1) return { tier, kind: 'mistake', cells: boxCells(w), target: null, text: `One of your numbers is off. Start by checking box ${boxOf(w) + 1}.` };
    if (tier === 2) return { tier, kind: 'mistake', cells: [...HOUSES[rowOf(w)], ...HOUSES[9 + colOf(w)]], target: null, text: 'Narrow it down: the wrong number sits where this row and column cross.' };
    return { tier, kind: 'mistake', cells: [w], target: { cell: w, digit: cells[w] }, text: `The ${cells[w]} in ${rc(w)} doesn't belong. Erase it, then re-check what that area really allows.` };
  }

  const r = logicSolve(cells, 4, true);
  const idx = r.steps.findIndex((s) => s.placements.length > 0);
  if (idx < 0) { // only possible if the puzzle needs something we don't teach yet
    const e = cells.findIndex((v) => v === 0);
    if (e < 0) return { tier, kind: 'stuck', cells: [], target: null, text: 'The board is full.' };
    if (tier < 3) return { tier, kind: 'stuck', cells: boxCells(e), target: null, text: `This one needs a pattern I haven't taught yet. Try box ${boxOf(e) + 1}.` };
    return { tier, kind: 'stuck', cells: [e], target: { cell: e, digit: solution[e] }, text: `Put ${solution[e]} in ${rc(e)}.` };
  }

  const chain = r.steps.slice(0, idx + 1), focus = chain[0], fin = chain[idx];
  const names = [...new Set(chain.map((s) => TECHNIQUE_NAME[s.technique]))];
  const focusHouse = focus.house ?? undefined;
  const hn = focusHouse ? houseName(focusHouse) : `the area around ${rc(focus.cells[0])}`;
  if (tier === 1) {
    return { tier, kind: 'step', cells: focusHouse ? houseCells(focusHouse) : boxCells(focus.cells[0]), target: null,
      text: `Look at ${focusHouse ? hn : `box ${boxOf(focus.cells[0]) + 1}`}.` };
  }
  if (tier === 2) {
    return { tier, kind: 'step', cells: [...new Set(chain.flatMap((s) => s.cells))], target: null,
      text: `Look for a ${names.join(', then a ')}. ${WHAT[focus.technique](hn)}` };
  }
  const t = fin.placements[0];
  const why = fin.technique === 'naked-single'
    ? 'Every other number is already ruled out by its row, column and box.'
    : `${t.digit} has nowhere else to go in ${houseName(fin.house!)}.`;
  const prep = [...new Set(chain.slice(0, -1).map((x) => TECHNIQUE_NAME[x.technique]))];
  const lead = prep.length ? `After a ${prep.join(' and a ')} clears some options: ` : '';
  return { tier, kind: 'step', cells: [t.cell], target: t, text: `${lead}put ${t.digit} in ${rc(t.cell)}. ${why}`.replace(/^./, (c) => c.toUpperCase()) };
}
