# Design QA

- Target: Show only an all tab and a compact, scrollable year picker beside the ingredient page heading.
- Desktop: Passed. Two controls remain aligned at equal height and the year menu overlays without shifting the table.
- Mobile: Passed. Both controls fit on one row and the menu remains within the viewport.
- Interaction: Passed. The menu lists years newest-first; selecting `2022년 (45개)` closes it and renders 45 records.
- Copy: Passed. The all tab uses `전체 (N개)` and year choices use `YYYY년 (N개)`.
- P0/P1/P2 issues: None remaining.

final result: passed
