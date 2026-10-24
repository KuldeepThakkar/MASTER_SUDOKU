# Project Memory: Sudoku Cat

## Current state
Phase 1 done: Vite + React + TS app, seeded generator (unique solutions), reducer with notes/undo, validated localStorage save, 22 tests. Difficulty is by clue count only (phase 2 replaces with technique grading).

## Key decisions
- Stack: Vite + React + TypeScript — approved by kk
- Hosting plan: Cloudflare Pages (frontend) + Supabase free (auth + Postgres); CSP in public/_headers must add Supabase to connect-src in phase 5
- Learning "AI" = deterministic technique solver + per-technique mastery stats, no LLM
- Scoring is vs the user's own past only

## Constraints & preferences
- Keep token use lean; run code-review on own code every phase, check data leaks/vulnerabilities, test
- Ask kk before adding features beyond the stated plan
- Cat prank: erased number kept in hidden state; reveal at end; completion rule + opt-out toggle still to decide
- Any command/install that is unverified or irreversible: explain risk first

## Open questions / blockers
- Which site is the technique-pattern source (SudokuWiki?) — write our own explanations, link as credit, don't scrape
- Cat prank completion rule
- Phase 5: scores/progress must be validated server-side (client state is untrusted)

## Recent session log
- 2026-10-25: scaffolded, built phase 1, reviewed, tested
