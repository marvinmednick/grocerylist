# F91 Feature Log

## 2026-04-06 — Specced
- **Spec:** `specs/F91-alias-system-ui.md`
- **GitHub Issue:** #91
- **Review Level:** Full
- **Scope:** UI phase of alias system — Abbreviations screen (full-screen modal with toggle views, OR search, placeholder rows, edit dialog with alias chips, suggestions, conflict warnings), item edit modal sections ("Also known as" editable chips, "Active Abbreviations" read-only, "Define Abbreviations" launch button), avatar menu "Abbreviations" entry. Depends on F90 (data + parser).
- **Closes on ship:** #91

## 2026-04-06 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 458/458 passed
- **Fixes applied during review:**
  - Search changed from substring to prefix matching on individual words
  - Cross-matching (search both canonical and alias in both views) kept as intentional, spec updated
  - Alias match highlighting added in canonical view (bold blue on matched aliases)
  - `useDeleteWordAlias` extended to accept alias key — spec updated to document
  - Punctuation allowed in aliases (only whitespace rejected) — spec updated
  - `aliases?: string[]` added to `useCreateMasterItem` type
  - 4 composition scenario tests added to SmartAddItem-parser-test.tsx
  - CODING.md: new "Composition Scenario Tests" guideline for pipeline features
  - F83 backlog note: consider substring matching in fuzzy design
- **Non-blocking:** none remaining

## 2026-04-06 — Shipped
- **Commit:** `feat: add alias system UI — abbreviations screen, item alias editor (F91) refs #91`
- **Closed:** #91
