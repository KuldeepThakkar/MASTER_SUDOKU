// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { App } from './App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('App smoke', () => {
  it('renders 81 cells, selects, types, undoes, starts a new game, never injects HTML', async () => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<App />); });
    const cells = () => Array.from(host.querySelectorAll<HTMLButtonElement>('.cell'));
    expect(cells()).toHaveLength(81);
    const empty = cells().findIndex((c) => !c.textContent);
    await act(async () => { cells()[empty].click(); });
    expect(cells()[empty].classList.contains('sel')).toBe(true);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true })); });
    expect(cells()[empty].textContent).toBe('5');
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); });
    expect(cells()[empty].textContent).toBe('');
    await act(async () => { host.querySelector<HTMLButtonElement>('button.primary')!.click(); });
    expect(cells()).toHaveLength(81);
    expect(host.querySelectorAll('script, iframe, img').length).toBe(0);
    await act(async () => { root.unmount(); });
  });
});
