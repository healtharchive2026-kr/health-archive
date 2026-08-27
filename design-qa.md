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

## Public Home And Service Story

- Source specification: `C:\Users\225170\Downloads\healtharchive-redesign-spec.md`
- Public home: 86svh photographic hero, four-cell service strip, five module cards, access CTA, and public footer.
- Service story: `/about/` with Origin, Validation, Intelligence, and a three-stage sticky development flow.
- Desktop 1280 x 900: five module cards on one row, simplified public header, no horizontal overflow.
- Tablet 1024 x 800 and 768 x 900: module cards shift to three and two columns without text clipping.
- Mobile 390 x 844: single-column cards, compact hero actions, one-column story chapters, no page-level horizontal overflow.
- Motion: hero parallax, staggered reveal, and sticky card transitions verified; reduced-motion fallback included.
- Functional check: both public start buttons open the existing account dialog; authenticated workspace markup and navigation remain unchanged.
- Result: passed.

## Mobile App Prototype Import And Information Architecture

- Source: `HealthArchive Mobile App.dc.html` from the supplied Claude Design export.
- Target: `mobile-lite.html` at 390 x 844 CSS px.
- Source comparison: `C:/Users/225170/AppData/Local/Temp/healtharchive-mobile-comparison.png`.
- Latest home capture: `C:/Users/225170/AppData/Local/Temp/healtharchive-mobile-app4-home.png`.
- Visual match: deep-green app header, paper background, serif display title, compact data cards, image-backed six-item task grid, and five-item bottom navigation.
- Adaptation: the design-canvas device frame and layout switcher were excluded; production data and authentication replace prototype demo values.
- Home: quick-search examples, claim distribution, and news feed removed; 3 updates, 6 service shortcuts, 4 products, and 3 recent minutes rendered.
- Unified search: `감태` returned 6 grouped results across recognized ingredients, food ingredients, and committee minutes; `피부 건강` returned ingredient and protocol groups.
- Search handoff: protocol result opened the filtered protocol view; minute searches prioritize the matching ingredient in each result summary.
- News: dedicated bottom tab rendered 48 recent articles with all six source filters (3 domestic, 3 international).
- Committee minutes: dedicated searchable view returned three `감태` meetings with working R2 PDF links.
- Pre-Check: `감태` returned four evidence records without login.
- Protected data hub and My Work navigation passed in local preview mode.
- Viewport: `clientWidth 375`, `scrollWidth 375`; no horizontal overflow.
- Browser console: no errors or warnings during tested flows.

final result: passed
