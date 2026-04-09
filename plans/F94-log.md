# F94 Feature Log

## 2026-04-08 — Specced
- **Spec:** `specs/F94-voice-input-normalization.md`
- **GitHub Issue:** #94
- **Review Level:** Full
- **Scope:** Pre-parse normalization function that converts voice-style input (word-numbers like "two", "at Store" keyword) into parser-ready syntax ("2", "@Store"). Covers word-to-number lookup table (cardinals 0–12, fractions, "dozen") and "at" → "@" store hint conversion with store-name prefix validation.
- **Closes on ship:** #94
