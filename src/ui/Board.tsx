import { useEffect, useMemo, useRef } from 'react';
import { PEERS, colOf, findConflicts, rowOf } from '../core/sudoku';
import { isGiven, type GameState } from '../core/game';

interface Props { state: GameState; onCell: (cell: number) => void }

export function Board({ state, onCell }: Props) {
  const { cells, notes, selected, activeDigit, hint } = state;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const bad = useMemo(() => findConflicts(cells), [cells]);
  const peers = selected === null ? null : new Set(PEERS[selected]);
  const hinted = useMemo(() => new Set(hint?.cells ?? []), [hint]);
  const mark = activeDigit ?? (selected !== null ? cells[selected] : 0);

  useEffect(() => { // keep keyboard focus on the selected cell once the user is inside the board
    if (selected !== null && refs.current.some((b) => b && b === document.activeElement)) refs.current[selected]?.focus();
  }, [selected]);

  return (
    <div className="board" role="group" aria-label="Sudoku board">
      {cells.map((v, i) => {
        const r = rowOf(i), c = colOf(i);
        const cls = ['cell'];
        if (isGiven(state, i)) cls.push('given');
        if (c % 3 === 2 && c !== 8) cls.push('br');
        if (r % 3 === 2 && r !== 8) cls.push('bb');
        if (peers?.has(i)) cls.push('peer');
        if (mark && v === mark) cls.push('same');
        if (hinted.has(i)) cls.push('hint');
        if (hint?.target?.cell === i) cls.push('target');
        if (i === selected) cls.push('sel');
        if (bad.has(i)) cls.push('bad');
        return (
          <button
            key={i} type="button" className={cls.join(' ')} ref={(el) => { refs.current[i] = el; }}
            tabIndex={(selected ?? 0) === i ? 0 : -1} onClick={() => onCell(i)}
            aria-label={`Row ${r + 1}, column ${c + 1}, ${v ? `${isGiven(state, i) ? 'given ' : ''}${v}` : 'empty'}${bad.has(i) ? ', conflicts' : ''}`}
          >
            {v ? v : notes[i] ? (
              <span className="notes" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <span key={d}>{notes[i] & (1 << d) ? d : ''}</span>)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
