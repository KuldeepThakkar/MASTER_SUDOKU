// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { App } from './App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const key = (k: string, o: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...o }));

describe('App smoke', () => {
  it('plays: select, type, undo, sticky digit, hint panel, counters, new game; injects no HTML', async () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<App />); });
    const cells = () => Array.from(host.querySelectorAll<HTMLButtonElement>('.cell'));
    const empties = () => cells().map((c, i) => (c.textContent ? -1 : i)).filter((i) => i >= 0);
    expect(cells()).toHaveLength(81);

    const [e1, e2] = empties();
    await act(async () => { cells()[e1].click(); });
    expect(cells()[e1].classList.contains('sel')).toBe(true);
    await act(async () => { key('5'); });
    expect(cells()[e1].textContent).toBe('5');
    await act(async () => { key('z', { ctrlKey: true }); });
    expect(cells()[e1].textContent).toBe('');

    const pad5 = host.querySelectorAll<HTMLButtonElement>('.pad button')[4];
    await act(async () => { cells()[e2].click(); }); // selecting a cell, then arming 5, applies it there
    await act(async () => { pad5.click(); });
    expect(cells()[e2].textContent).toBe('5');
    expect(pad5.getAttribute('aria-pressed')).toBe('true');
    const e3 = empties()[0];
    await act(async () => { cells()[e3].click(); });
    expect(cells()[e3].textContent).toBe('5');               // still armed, no extra tap
    await act(async () => { key('Escape'); });
    expect(pad5.getAttribute('aria-pressed')).toBe('false');

    const hintBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Hint')!;
    await act(async () => { hintBtn.click(); });
    expect(host.querySelector('.hinttext')!.textContent).toMatch(/Hint 1 of 3/);
    expect(host.querySelector('.stats')!.textContent).toMatch(/Hints\s*1/);

    await act(async () => { host.querySelector<HTMLButtonElement>('button.primary')!.click(); });
    expect(cells()).toHaveLength(81);
    expect(host.querySelector('.hinttext')).toBeNull();
    expect(host.querySelectorAll('script, iframe, img').length).toBe(0);
    await act(async () => { root.unmount(); });
  });
});
