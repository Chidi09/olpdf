# OLPDF Screen Implementation Checklist

Version: 1.0
Owner: Product + Engineering
Purpose: Route-by-route acceptance criteria and implementation checklist.

---

## 1) Global Conventions (applies to all screens)

- [ ] Uses shared design tokens from `packages/ui/globals.css`.
- [ ] Uses shared primitives from `packages/ui/components/*` where applicable.
- [ ] Has loading, empty, error, and success states.
- [ ] Keyboard accessible and focus-visible states present.
- [ ] No hard dependency on backend in dev mock mode (`OLPDF_DEV_MODE=true`).
- [ ] Analytics event names defined for key actions.
- [ ] Mobile behavior verified (min width 360px).
- [ ] Copy explicitly avoids ambiguous AI claims.

---

## 2) `/` Landing Page

## 2.1 Product Identity and Trust
- [ ] Hero includes product name "OLPDF" and tagline: "Understand the layout. Edit the document."
- [ ] Explicit statement that OLPDF is open source.
- [ ] GitHub stars badge displayed and linked to repository.
- [ ] "View source" CTA present.

## 2.2 Core CTA and Navigation
- [ ] Primary CTA: Get Started.
- [ ] Secondary CTA: See Docs / How it works.
- [ ] Nav links include Docs, Contribute, Privacy, Terms.
- [ ] Auth entry includes Guest mode and Google sign-in.

## 2.3 Acceptance
- [ ] If GitHub API unavailable, stars widget falls back gracefully.
- [ ] Hero/CTA visible without scrolling on desktop.

---

## 3) `/onboarding`

## 3.1 Steps
- [ ] Step 1: What OLPDF is (structure-first, open source).
- [ ] Step 2: Choose mode (Guest local-only vs Google sign-in).
- [ ] Step 3: Choose use case (Documents, Books, Toolkit, Forms).
- [ ] Step 4: First action (Import, Template, Sample Doc).

## 3.2 Guest Mode Rules
- [ ] Banner shown: "Guest mode: edits remain local and may be lost if browser data is cleared."
- [ ] Cloud save disabled in guest mode.
- [ ] Collaboration disabled in guest mode.

## 3.3 Auth Rules
- [ ] Google OAuth callback route works.
- [ ] Failed auth returns actionable error and retry option.

## 3.4 Acceptance
- [ ] User can complete onboarding in <= 60 seconds.
- [ ] State persists across refresh during onboarding.

---

## 4) `/editor/[id]` Document Studio

## 4.1 Layout
- [ ] Three-panel layout: left tools, center canvas, right inspector.
- [ ] Document canvas uses paper styling (`--bg-canvas`, readable text colors).
- [ ] PDF preview section available.

## 4.2 Editing and Persistence
- [ ] Debounced save via BFF route.
- [ ] Named snapshot creation supported.
- [ ] Version list and diff comparison available.

## 4.3 AI Interaction
- [ ] AI instruction input available.
- [ ] AI result rendered as diff panel.
- [ ] Accept/Reject writes audit status.
- [ ] AI history drawer lists prior operations.

## 4.4 Import and Review
- [ ] Import progress state includes strategy hints (native/OCR/table).
- [ ] Low-confidence blocks are visually flagged.

## 4.5 Preflight and Export
- [ ] Preflight runs before export.
- [ ] Error-level issues block strict export modes.
- [ ] User can resolve or intentionally continue where allowed.

## 4.6 Acceptance
- [ ] Editor remains usable when backend unavailable in mock mode.
- [ ] No data loss when network toggles offline/online during active edit session.

---

## 5) `/books/[id]` Book Maker

## 5.1 Layout and Navigation
- [ ] Sidebar includes front matter, chapter list, back matter.
- [ ] Center editor tied to selected chapter document.
- [ ] Inspector shows chapter stats and publish actions.

## 5.2 Chapter Lifecycle
- [ ] Status transition guard enforced (`draft -> review -> final`).
- [ ] Invalid transition shows clear error.
- [ ] Transition to review triggers embedding index workflow.

## 5.3 Consistency
- [ ] Consistency panel shows analysis + provenance (`chapter_id`, `chunk_index`).
- [ ] "Go to block" action navigates to relevant chapter context.

## 5.4 Exports
- [ ] Full book PDF export works.
- [ ] EPUB3 export works.
- [ ] Single chapter export route works.

## 5.5 Acceptance
- [ ] Adding/deleting/reordering chapters updates UI deterministically.

---

## 6) `/templates`

## 6.1 Catalog
- [ ] At least 10 templates present.
- [ ] Category tabs: All, Business, Academic, Legal, Books, Personal, Community.
- [ ] Search/filter controls work.

## 6.2 Card UX
- [ ] Each card shows title, author/source, usage count.
- [ ] Thumbnail shown or clean fallback.
- [ ] Use Template action applies template to target doc.

## 6.3 Admin/Expansion
- [ ] Template ingestion process documented.
- [ ] Validation required for template document model shape.

## 6.4 Acceptance
- [ ] Applying a template is idempotent for same target document/template pair.

---

## 7) `/toolkit` PDF Toolkit

## 7.1 Operations Grid
- [ ] 3x3 operation cards visible with icon, title, description.
- [ ] Active operation card visually distinct.

## 7.2 Operation Panels
- [ ] Merge
- [ ] Split
- [ ] Compress
- [ ] Rotate
- [ ] Watermark
- [ ] Protect
- [ ] Redact (true)
- [ ] OCR Scan kickoff
- [ ] Extract Images

## 7.3 Form Operations
- [ ] Detect form fields available.
- [ ] Fill form fields available.

## 7.4 Acceptance
- [ ] Every operation returns structured result payload (`status`, `output_url` or equivalent).
- [ ] User-visible error details for invalid input payloads.

---

## 8) `/settings`

## 8.1 Account
- [ ] Profile details editable.
- [ ] Auth provider status displayed.

## 8.2 Document Defaults
- [ ] Default page size and margins.
- [ ] Default export mode.

## 8.3 AI Preferences
- [ ] Provider selector (Gemini/OpenAI/Anthropic/local if configured).
- [ ] Model selector per provider.
- [ ] Task routing defaults configurable.

## 8.4 Privacy/Data
- [ ] Data retention preferences visible.
- [ ] Delete account/data actions with confirmation.

## 8.5 Acceptance
- [ ] Settings writes are validated and persisted idempotently.

---

## 9) `/docs`

## 9.1 Content Sections
- [ ] Quickstart
- [ ] Editor guide
- [ ] Book maker guide
- [ ] Toolkit guide
- [ ] API reference
- [ ] Self-hosting guide

## 9.2 Acceptance
- [ ] Searchable navigation and deep links to headings.

---

## 10) `/contribute`

## 10.1 Contribution Paths
- [ ] Code contribution path (issues, PR flow, standards).
- [ ] Ideas path (feature requests, voting).
- [ ] Financial support path (sponsorship links).

## 10.2 Acceptance
- [ ] All external links validated.

---

## 11) `/privacy`

## 11.1 Must Include
- [ ] Data collected by mode (guest vs authenticated).
- [ ] Storage and retention windows.
- [ ] Third-party services list.
- [ ] User rights and contact.

## 11.2 Acceptance
- [ ] Version/date and changelog link present.

---

## 12) `/terms`

## 12.1 Must Include
- [ ] Acceptable use.
- [ ] User content ownership.
- [ ] Liability and warranty disclaimers.
- [ ] Export/legal use responsibilities.

## 12.2 Acceptance
- [ ] Version/date and enforceability sections present.

---

## 13) Supporting API/BFF Contract Checklist

- [ ] BFF routes exist for every front-end critical flow.
- [ ] Error response shape is consistent.
- [ ] Idempotency implemented for retry-prone writes.
- [ ] Worker-triggered routes enforce signature verification.
- [ ] Rate limiting and payload caps are active.

---

## 14) QA Scenario Checklist (End-to-End)

## 14.1 Guest User
- [ ] Can open app, onboard, edit, export.
- [ ] Sees local-only warning.
- [ ] Cannot access cloud-only features.

## 14.2 Auth User
- [ ] Google sign-in works.
- [ ] Can save/reopen documents and books.
- [ ] Can use templates and toolkit operations.

## 14.3 AI
- [ ] AI instruction creates auditable diff.
- [ ] Accept updates document.
- [ ] Reject leaves document unchanged.

## 14.4 Reliability
- [ ] Retry on async operations does not duplicate side effects.
- [ ] Import failures surface actionable errors.

---

## 15) Release Gate

Before release:
- [ ] All route acceptance criteria met.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build` passes.
- [ ] Security/privacy/legal pages published.
- [ ] Known limitations documented.
