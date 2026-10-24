import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { DIFFICULTIES, generatePuzzle, type Difficulty } from '../core/generator';
import { reduce, startGame, type Action, type GameState } from '../core/game';
import { load, save } from '../core/storage';
import { Board } from './Board';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const ARROWS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };

export function App() {
  const [state, dispatch] = useReducer((s: GameState, a: Action) => reduce(s, a), undefined, () => load() ?? startGame('easy', Date.now()));
  const [now, setNow] = useState(Date.now());
  const [level, setLevel] = useState<Difficulty>(state.puzzle.difficulty);
  const done = state.finishedAt !== null;

  useEffect(() => { save(state); }, [state]);
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [done]);

  const newGame = useCallback((d: Difficulty) => {
    dispatch({ type: 'new', puzzle: generatePuzzle(d), now: Date.now() });
    setNow(Date.now());
  }, []);

  const tapDigit = (d: number) => {
    const arming = state.activeDigit !== d;
    dispatch({ type: 'setDigit', digit: d });
    if (arming && state.selected !== null) dispatch({ type: 'digit', digit: d }); // cell first, then number still works
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'SELECT' || t.tagName === 'INPUT')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch({ type: 'undo' }); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); dispatch({ type: 'digit', digit: Number(e.key) }); }
      else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); dispatch({ type: 'erase' }); }
      else if (e.key === 'Escape' && state.activeDigit !== null) dispatch({ type: 'setDigit', digit: state.activeDigit });
      else if (e.key.toLowerCase() === 'n') dispatch({ type: 'toggleNotes' });
      else if (e.key.toLowerCase() === 'h') dispatch({ type: 'hint' });
      else if (e.key in ARROWS) {
        e.preventDefault();
        const cur = state.selected ?? 40, d = ARROWS[e.key], col = cur % 9;
        if ((d === -1 && col === 0) || (d === 1 && col === 8)) return;
        const next = cur + d;
        if (next >= 0 && next < 81) dispatch({ type: 'select', cell: next });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.selected, state.activeDigit]);

  const left = useMemo(() => {
    const c = new Array(10).fill(9);
    for (const v of state.cells) if (v) c[v]--;
    return c;
  }, [state.cells]);
  const elapsed = (state.finishedAt ?? now) - state.startedAt;
  const h = state.hint;

  return (
    <main className="app">
      <header className="top">
        <h1>Sudoku</h1>
        <span className="timer" role="timer" aria-label="Elapsed time">{fmt(elapsed)}</span>
        <label className="level">
          <span className="sr">Difficulty for the next game</span>
          <select value={level} onChange={(e) => setLevel(e.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{cap(d)}</option>)}
          </select>
        </label>
        <button type="button" className="primary" onClick={() => newGame(level)}>New game</button>
      </header>

      <div className="stats">
        <span className="lvl">{cap(state.puzzle.difficulty)} puzzle</span>
        <span>Mistakes <b>{state.mistakes}</b></span>
        <span>Hints <b>{state.hints}</b></span>
      </div>

      {done && (
        <p className="won" role="status">
          Solved in {fmt(elapsed)} with {state.mistakes} {state.mistakes === 1 ? 'mistake' : 'mistakes'} and {state.hints} {state.hints === 1 ? 'hint' : 'hints'}.{' '}
          <button type="button" onClick={() => newGame(level)}>Play another</button>
        </p>
      )}

      <Board state={state} onCell={(cell) => dispatch({ type: 'paint', cell })} />

      <p className="notice" role="status" aria-live="polite">{state.notice}</p>
      {h && <p className="hinttext" role="status"><b>Hint {h.tier} of 3.</b> {h.text}</p>}

      <div className="tools">
        <button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={!state.history.length || done}>Undo</button>
        <button type="button" onClick={() => dispatch({ type: 'erase' })} disabled={done}>Erase</button>
        <button type="button" aria-pressed={state.notesMode} className={state.notesMode ? 'on' : ''} onClick={() => dispatch({ type: 'toggleNotes' })} disabled={done}>Notes</button>
        <button type="button" onClick={() => dispatch({ type: 'hint' })} disabled={done || h?.tier === 3}>{h ? 'More help' : 'Hint'}</button>
      </div>
      <div className="pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" className={state.activeDigit === d ? 'armed' : ''} aria-pressed={state.activeDigit === d}
            disabled={done || left[d] === 0} onClick={() => tapDigit(d)} aria-label={`Number ${d}, ${left[d]} left`}>
            {d}<small>{left[d]}</small>
          </button>
        ))}
      </div>
      <p className="tip">{state.activeDigit ? `${state.activeDigit} is selected: tap cells to ${state.notesMode ? 'toggle it as a note' : 'place it'}. Tap it again or press Esc to let go.` : 'Pick a number, then tap as many cells as you like.'}</p>
    </main>
  );
}
