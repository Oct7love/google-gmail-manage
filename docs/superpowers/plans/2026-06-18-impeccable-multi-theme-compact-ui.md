# Impeccable Multi-theme Compact UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved compact multi-theme desktop UI direction for the Gmail viewer.

**Architecture:** Keep the existing Electron + React three-column app shell and Zustand data flow. Expand theme IDs and CSS tokens to four themes, then tighten renderer component density and unify modal/drawer visual vocabulary without changing IMAP, storage, Keychain, translation, or Gmail webview behavior.

**Tech Stack:** Electron, React, TypeScript, Tailwind CSS, CSS variables, Zustand, lucide-react.

---

## File structure

- Modify: `PRODUCT.md` — root product context required by impeccable.
- Modify: `src/shared/types.ts` — expand `ThemeId` to four approved theme IDs.
- Modify: `src/renderer/src/store.ts` — validate stored theme IDs and default to fog blue.
- Modify: `src/renderer/src/index.css` — replace old cream/slate/onyx tokens with fog/warm/graphite/indigo tokens.
- Modify: `src/renderer/src/components/layout/ThemePicker.tsx` — show four compact theme cards and updated preview colors.
- Modify: `src/renderer/src/components/layout/Toolbar.tsx` — tighten toolbar button color/active states.
- Modify: `src/renderer/src/components/accounts/LeftColumn.tsx` — tighten sidebar empty state and primary CTA.
- Modify: `src/renderer/src/components/accounts/AccountItem.tsx` — tighten account rows and selected/unread affordances.
- Modify: `src/renderer/src/components/messages/MiddleColumn.tsx` — compact header, empty states, and action buttons.
- Modify: `src/renderer/src/components/messages/MessageRow.tsx` — compact message rows while preserving scan hierarchy.
- Modify: `src/renderer/src/components/detail/RightColumn.tsx` — align detail header, image/translation actions, and empty state.
- Modify: `src/renderer/src/components/detail/TranslationPanel.tsx` — keep low-footprint idle state and align non-idle states to compact theme.
- Modify: `src/renderer/src/components/detail/MessageBody.tsx` — align iframe padding and accent color with new default.
- Modify: `src/renderer/src/components/layout/TotpCalculator.tsx` — align modal density and token use.
- Modify: `src/renderer/src/components/accounts/CredentialsDrawer.tsx` — remove hardcoded whites/amber where present and strengthen critical empty state.
- Modify: `src/renderer/src/components/accounts/AddAccountDialog.tsx` — remove hardcoded success/error/warning colors and align buttons/spacing.

## Task 1: Theme IDs and token palette

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/src/store.ts`
- Modify: `src/renderer/src/index.css`

- [ ] **Step 1: Confirm current theme references**

Run: `rg -n "cream|slate|onyx|ThemeId|themeId" src/renderer/src src/shared src/main`

Expected: only theme type, store validation, CSS theme blocks, and ThemePicker metadata need changing.

- [ ] **Step 2: Expand theme IDs**

Change `ThemeId` to `'fog' | 'warm' | 'graphite' | 'indigo'`. Update comments to say default is `fog`.

- [ ] **Step 3: Update store validation**

Replace the old stored-theme guard with a helper that accepts exactly `fog`, `warm`, `graphite`, and `indigo`; default any old value such as `cream`, `slate`, or `onyx` to `fog`.

- [ ] **Step 4: Replace CSS theme tokens**

In `index.css`, define:

- `fog`: blue-gray default, system blue accent.
- `warm`: warm-gray terracotta, not cream-heavy.
- `graphite`: neutral gray, near-black accent.
- `indigo`: cool light violet-gray, restrained indigo accent.

Keep token names unchanged so existing Tailwind classes continue working.

- [ ] **Step 5: Run TypeScript check**

Run: `pnpm typecheck`

Expected: any failures should identify remaining old theme IDs or unrelated existing worktree type issues.

## Task 2: Compact theme picker

**Files:**
- Modify: `src/renderer/src/components/layout/ThemePicker.tsx`

- [ ] **Step 1: Replace theme metadata**

Update `THEMES` to four entries matching `fog`, `warm`, `graphite`, and `indigo`.

- [ ] **Step 2: Tighten modal layout**

Change the picker from a wide three-column card grid to a compact `max-w-lg` modal with one-column theme rows. Each row keeps a mini preview, title, caption, swatches, and selected check.

- [ ] **Step 3: Remove slop patterns**

Remove hover vertical translation, replace `border-black/10` swatch borders with `border-border-strong`, and use `bg-accent-soft` for selected cards.

- [ ] **Step 4: Run TypeScript check**

Run: `pnpm typecheck`

Expected: no ThemeId mismatch in ThemePicker.

## Task 3: Compact app shell and lists

**Files:**
- Modify: `src/renderer/src/components/layout/Toolbar.tsx`
- Modify: `src/renderer/src/components/accounts/LeftColumn.tsx`
- Modify: `src/renderer/src/components/accounts/AccountItem.tsx`
- Modify: `src/renderer/src/components/messages/MiddleColumn.tsx`
- Modify: `src/renderer/src/components/messages/MessageRow.tsx`

- [ ] **Step 1: Toolbar**

Use `text-text-2` for tool buttons, preserve 28px hit areas, add selected state for the palette button, and keep sync status compact.

- [ ] **Step 2: Sidebar**

Keep `w-64`, reduce decorative empty-state icon size, remove gradient from Add Account CTA, and keep the CTA as the only solid accent in the sidebar.

- [ ] **Step 3: Account rows**

Tighten row padding and avatar size enough to show more accounts, while preserving selected background, status dot, mark pills, and unread count.

- [ ] **Step 4: Middle column**

Keep the 360px column, tighten header and empty states, and make action buttons consistent with toolbar buttons.

- [ ] **Step 5: Message rows**

Reduce row vertical padding and avatar size, keep sender/subject/snippet hierarchy readable, and avoid giant selected stripes.

- [ ] **Step 6: Run TypeScript check**

Run: `pnpm typecheck`

Expected: renderer components compile.

## Task 4: Detail view and iframe alignment

**Files:**
- Modify: `src/renderer/src/components/detail/RightColumn.tsx`
- Modify: `src/renderer/src/components/detail/TranslationPanel.tsx`
- Modify: `src/renderer/src/components/detail/MessageBody.tsx`

- [ ] **Step 1: Detail header**

Make subject, sender, sender email, time, and “发给” line more compact and clearer. Raise “发给” to `text-text-2`.

- [ ] **Step 2: Action row**

Keep external image and translation controls near each other, low height, and visually secondary unless active.

- [ ] **Step 3: Translation states**

Keep idle as a ghost button. Non-idle states use semantic tokens and compact padding.

- [ ] **Step 4: Iframe body**

Change iframe body padding to `20px 24px`, color to the product text color, and link color to the new default accent.

- [ ] **Step 5: Run TypeScript check**

Run: `pnpm typecheck`

Expected: detail components compile.

## Task 5: Modal and drawer polish

**Files:**
- Modify: `src/renderer/src/components/layout/TotpCalculator.tsx`
- Modify: `src/renderer/src/components/accounts/CredentialsDrawer.tsx`
- Modify: `src/renderer/src/components/accounts/AddAccountDialog.tsx`

- [ ] **Step 1: Find hardcoded color remnants**

Run: `rg -n "#[0-9a-fA-F]{3,8}|bg-white|border-black|emerald|amber" src/renderer/src/components`

Expected: only intentional SVG/logo/preview colors should remain; component UI states should use tokens.

- [ ] **Step 2: TOTP modal**

Tighten modal padding, keep local-only reassurance, and ensure buttons/input use theme tokens.

- [ ] **Step 3: Credentials drawer**

Replace raw white/amber backgrounds with `bg-surface`, `bg-surface-2`, and semantic tokens. Make missing IMAP app password danger-colored.

- [ ] **Step 4: Add account dialog**

Replace hardcoded success/error/warning backgrounds, make paste helper secondary, and keep verify/add as the only strong submit CTA.

- [ ] **Step 5: Run hardcoded color scan again**

Run: `rg -n "#[0-9a-fA-F]{3,8}|bg-white|border-black|emerald|amber" src/renderer/src/components`

Expected: no non-preview component UI hardcoded colors except Logo SVG and intentional inline theme swatches.

## Task 6: Final verification

**Files:**
- All modified files.

- [ ] **Step 1: Check worktree scope**

Run: `git status --short`

Expected: modified files match this plan plus pre-existing user changes.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`

Expected: exit 0, or report exact pre-existing blocker if unrelated.

- [ ] **Step 3: Build**

Run: `pnpm build`

Expected: exit 0.

- [ ] **Step 4: Visual artifact review**

Compare implementation against `docs/impeccable-preview-theme-board-compact.png`: four themes, compact density, no oversized controls, no single-theme lock-in.
