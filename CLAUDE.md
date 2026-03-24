# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role in This Project

> **Full process guide:** `WORKFLOW.md` — covers all use cases with examples, explains F-numbers vs GitHub issue numbers, and documents the complete feature lifecycle.


Claude's responsibilities are **architecture, design, planning, and code review**. Implementation is handled by a separate tool (Gemini, aider, or similar).

- Use `/spec` to produce a structured implementation spec before handing off to an implementor
- Use `/review` to review implementation output against architectural principles
- `CODING.md` (project root) is the coding reference all implementors use — keep it up to date when patterns change
- `AGENT.md` (project root) contains behavioral rules for all implementation agents

When producing specs, reference `DESIGN.md` and relevant `docs/design/` files. Specs should include: files to modify, patterns to follow, Supabase query shapes, undo actions to register, household scoping requirements, a **Tests to Write** section with specific test cases and assertions, and an **Implementation Commands** section with pre-built invocation for each tool.

**Test ownership:** Claude specifies what to test (in the Tests to Write section of each spec). The implementor writes the tests and is responsible for all tests passing. Claude can verify test quality and coverage during `/review`.

## Tracking System

| File | Purpose |
|------|---------|
| `PLAN.md` | Feature registry — ID, status, spec link, GitHub issue link |
| `specs/F[N]-[slug].md` | Full implementation spec for each feature |
| `plans/F[N]-log.md` | Feature journal — Claude-written phase history (spec, reviews, ship) |
| `plans/F[N]-progress.md` | Implementor's self-tracking scratchpad — file checklist and resume state |
| `BACKLOG.md` | Small deferred items and non-blocking review findings |
| GitHub Issues | Formal record; linked to commits via `closes #N` in commit messages |

**Statuses:** `Backlog` → `Specced` → `In Progress` → `Needs Fixes` → `In Review` → `Done`
(`Needs Fixes` = review found blocking issues; `In Review` = review passed, ready to ship)

When a feature ships, update its status in `PLAN.md` to `Done` and close the GitHub Issue:
```bash
gh issue close [N] --comment "Implemented and reviewed."
```

## Project Overview

A cross-platform (iOS/Android/Web) collaborative grocery shopping list app. React Native (Expo) frontend, Supabase (PostgreSQL + Realtime) backend.

## Commands

All commands run from the `client/` directory:

```bash
cd client

# Start dev server
npm start             # interactive (choose platform)
npm run web           # web only
npm run android       # Android
npm run ios           # iOS

# Run tests
npm test              # all tests
npm test -- --testPathPattern=SmartAddItem  # single test file
```

**Environment:** Requires `client/.env` with:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_HOUSEHOLD_MODE` — `single` (all users share one household) or `multi` (each user gets their own)

**Supabase local dev:** Config in `supabase/config.toml`. Full schema in `supabase/full_schema.sql`. Migrations in `supabase/migrations/`.

## Documentation

- `DESIGN.md` — Full architecture and feature reference; read before implementing any new feature or modifying core patterns
- `PLAN.md` — Completed work and planned features/roadmap
- `USER_SCENARIOS.md` — User stories and interaction scenarios
- `OPERATIONS.md` — Deployment and operational notes
- `docs/design/F2-multi-user-trips.md` — Per-user `purchased_by` tracking, user color coding, and multi-user end-trip dialog design
- `docs/design/list-interactions.md` — List header consolidation and interaction mode design

## Architecture

### Directory Layout (client/)
- `app/` — Expo Router file-based routes
  - `_layout.tsx` — Root layout: AppThemeProvider, QueryClient, UndoProvider, GestureHandler, auth guard, HouseholdProvider
  - `auth.tsx` — Sign in / sign up + profile creation
  - `(tabs)/index.tsx` — Main shopping list screen
  - `(tabs)/items.tsx` — Master items management screen
  - `(tabs)/history.tsx` — Trip history screen
- `api/` — All data fetching and mutations (React Query hooks + Supabase calls)
  - `list.ts` — Shopping list CRUD + realtime subscription + trip management
  - `items.ts` — Master item dictionary CRUD
  - `metadata.ts` — Stores and categories (cached 1 hour)
  - `profile.ts` — Profile read/update, household members, warning preferences
  - `trips.ts` — Trip history queries
  - `undoContext.tsx` — Global undo/redo stack (React Context, session-scoped)
- `components/` — UI components
  - `SmartAddItem.tsx` — The primary add-item UI: search dropdown with inline qty/store pills, one-off vs. master item add, edit modal
  - `StoreSelector.tsx` — Header active-store dropdown (color dot + name, persisted to AsyncStorage)
  - `WarningBadge.tsx` — Per-item warning indicator (badge tap → absolutely-positioned popover; F22 will replace with a `<Modal>`)
  - `WarningCallout.tsx` — Inline warning detail display
  - `MultiTripModal.tsx` — Multi-user end-trip dialog (per-user trip selection)
  - `Settings.tsx` — Full-screen settings modal (reference implementation for full-screen modal pattern)
  - `UserAvatar.tsx` — Header user identity indicator
  - `HeaderActions.tsx` — Shared header right-side actions (undo, redo, avatar)
  - `Toast.tsx` — Auto-dismissing remote-change notification
- `lib/`
  - `supabase.ts` — Supabase client (platform-aware AsyncStorage/localStorage adapter)
  - `household.tsx` — `HouseholdProvider` + `useHousehold()` hook; fetches `household_id` once per session with `staleTime: Infinity`
  - `theme.tsx` — `AppThemeProvider` + `useAppTheme()` hook; dark/light toggle persisted to AsyncStorage (infrastructure for F10)
  - `activeStore.ts` — AsyncStorage helpers for persisting the selected store across sessions

### Key Patterns

**Household Scoping:** All user data is scoped to `household_id`. The `get_my_household_id()` SQL function (SECURITY DEFINER) powers all RLS policies. Every mutation that writes to household-scoped tables throws early if `householdId` is null. UI add/end-trip controls are disabled while household is loading.

**Undo/Redo:** Every mutation (add, delete, toggle, edit, drag-to-reorder, end trip) registers an `UndoableAction` with `undo()` and `redo()` async functions via `pushAction()` from `useUndo()`. The stack is capped at 100 actions and lives in `UndoProvider` at the root.

**Realtime Toast Suppression:** `api/list.ts` maintains a module-level `localMutationCount` counter. It increments before each mutation and decrements (with a 500ms delay) after. The Supabase realtime callback only triggers the `onRemoteChange` toast when `localMutationCount === 0`, preventing self-triggered notifications.

**Flat List + Drag-and-Drop:** The shopping list is rendered as a single `DraggableFlatList` with a mixed array of `{ type: 'header' }` and `{ type: 'item' }` rows. On `onDragEnd`, the code walks upward through the data array to find the nearest header to determine the target store.

**Item Lifecycle:** `list_items` rows go through three states:
1. Active: `is_purchased = false`, `archived_at = null`
2. Purchased: `is_purchased = true`, `archived_at = null` — visible with strikethrough
3. Archived: `archived_at IS NOT NULL` — hidden; linked to a `shopping_trips` row

**Master vs. One-Off Items:** `list_items.item_id` is nullable. When `null`, the row is a "one-off" item (not saved to the master `items` dictionary). `SmartAddItem` handles both paths: quick-add and save-to-master-then-add.

**Auth Flow:** `_layout.tsx` manages session state and redirects between `/auth` and `/(tabs)`. `auth.tsx` calls `ensureProfile()` after sign-in/sign-up to create the `profiles` row and assign the household (respecting `EXPO_PUBLIC_HOUSEHOLD_MODE`).

**Active Store Pattern:** The currently-selected store is persisted to AsyncStorage via `lib/activeStore.ts` and surfaced in the shopping list header via `StoreSelector.tsx`. The selected store is passed to `SmartAddItem` as the default store for new items. Changing the active store does not filter the list — it only affects the default for new additions.

**Warning System:** When a master item is added to the list, `item_store_preferences` rows for that item are checked against the active store. Warnings (`avoided`, `unavailable`, `non_preferred`) are computed and stored in `list_items.warnings` (JSONB). `WarningBadge` renders a per-type icon on the list row; tapping opens a modal with details. User visibility per warning type is controlled by `profiles.warning_preferences`.

### Data Model Summary

Global (shared across households): `categories`, `units`, `households`
Household-scoped: `stores`, `items`, `item_store_preferences`, `list_items`, `shopping_trips`
User-scoped: `profiles` (one per `auth.users` row, holds `household_id`)

The `items` table has a unique constraint on `(name, household_id)`. Item search (`useSearchItems`) uses prefix matching (`.ilike('name', `${query}%`)`) with a minimum query length of 2.
