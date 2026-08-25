# Design QA

## Food Ingredient DB Navigation

- Source visual truth: `C:/Users/kimsi/AppData/Local/Temp/codex-clipboard-6c7d2e39-f7de-4c8d-90b0-03aeedb08d3a.png`
- Desktop implementation: `C:/Users/kimsi/Documents/Codex/2026-07-01/new-chat/work/health-archive/.audit/2026-07-12-dbnav/01-desktop-ingredients.png`
- Mobile implementation: `C:/Users/kimsi/Documents/Codex/2026-07-01/new-chat/work/health-archive/.audit/2026-07-12-dbnav/02-mobile-ingredients.png`
- Desktop viewport/state: 1084 x 1135, `ingredients` section active
- Mobile viewport/state: 390 x 844 and 320 x 700, `ingredients` section active
- Verified transitions: `ingredients` -> `temp-approval` -> `foodraw` -> `gmo-ingredients` -> `blocked` -> `safety-db`.
- Result: passed.

## Daily Report HTML

- Reference: `C:\Users\225170\Downloads\보고서 디자인 재구성.pdf`
- White report canvas with navy rules, compact uppercase header, four evidence metrics, numbered sections, dense evidence tables, and a Figure/Table gallery.
- Sticky section navigation, report-list link, source PDF link, and native-resolution Figure/Table links verified.
- Desktop: header, metrics, section rules, tables, and actions render without overlap.
- Figure/Table: long source tables use a bounded internal scroll area instead of being scaled down.
- Mobile (390 x 844): no page-level horizontal overflow; section navigation and wide evidence tables scroll independently.
- Test visual dimensions: 768 x 2135, 1280 x 1038, and 1280 x 290.
- Functional outcomes: Korean(English) endpoint labels, Korean comparison direction, p-values, and Figure/Table evidence labels render in aligned columns.
- Safety: registry and automated database results remain visible at 11px; non-database safety details are grouped as `세부 확인 필요`.
- Development/regulatory action section removed; navigation and section numbering verified.
- Result: passed after visual comparison with the three-page reference PDF.
