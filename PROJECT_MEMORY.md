# Project Memory: Sudoku Cat

## Current state
Phase 1-2 done. Engine: seeded generator -> logic solver (7 techniques, levels 1-4) -> every puzzle verified unique AND guess-free, graded by hardest technique needed. Game: rule-aware notes, sticky digit (brush), visible mistake + hint counters, hidden `sneaky` counter (rule-legal but wrong digits, for the cat), 3-tier hint ladder, isDeadEnd() for stuck detection. 33 tests incl. finishing every level by hints alone.

## Key decisions
- Stack: Vite + React + TypeScript — approved by kk
- Hosting plan: Cloudflare Pages (frontend) + Supabase free (auth + Postgres); CSP in public/_headers must add Supabase to connect-src in phase 5
- Learning "AI" = deterministic technique solver + per-technique mastery stats, no LLM
- Scoring is vs the user's own past only
- Notes are blocked when the row/column/box already holds the digit; normal placement may break rules but counts as a visible mistake
- Cat design (phase 4): let the user make a rule-legal wrong move, wait until they are stuck (isDeadEnd / many sneaky), then tease and question that move so they realise it themselves
- Every game must be solved by the generator before it is handed out; never ship unsolvable or guess-only puzzles

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
- 2026-10-25: phase 2 (logic solver, technique grading, hints, notes rules, brush, counters)
