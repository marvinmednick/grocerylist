# F100 — Voice Trigger Android Streaming Fix — Log

## 2026-04-10 — Spec written
- **Trigger:** Android testing revealed two issues with F99 voice trigger: (1) streaming dictation sends partial tokens that cause premature disarming, (2) "enter" is intercepted by Android IME as key action
- **Fix approach:** Prefix tolerance in armed state (stay armed when last token is prefix of trigger word), change default trigger word from "enter" to "done", add IME warning hint in Settings
- **Spec:** specs/F100-voice-trigger-android-fix.md
- **Issue:** #100

## 2026-04-10 — Review 1 (Passed)
- **Result:** Passed — no blocking issues
- **Tests:** 564/564 passed
- **Non-blocking:** none
