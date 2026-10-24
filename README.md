# Sudoku Cat

Adaptive Sudoku coach (web). Phase 1: playable board technique-graded puzzles (easy: singles; medium: +locked candidates; hard: +pairs; expert: +X-Wing/XY-Wing).

    npm install
    npm run dev        # local dev server
    npm test           # engine, reducer, storage, UI smoke tests
    npm run build      # typecheck + production build into dist/

Deploy target: Cloudflare Pages (build `npm run build`, output `dist`). `public/_headers` carries the security headers.

Layout: `src/core` = pure engine (no DOM/network), `src/ui` = React.
