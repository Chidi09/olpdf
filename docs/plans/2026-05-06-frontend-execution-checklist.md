# Frontend Production Execution Checklist

> **Protocol Binding:** This checklist is governed by `docs/plans/2026-05-06-frontend-design-execution-protocol.md`.

> **Scope:** `apps/web` (Next.js App Router).

> **Rule:** A task is not complete until visual fidelity matches the Dashboard benchmark and logical routing is enforced.

---

## 0) Pre-Flight Gate (Run Before Implementation)

- [ ] Review `dashboard/page.tsx` to understand the target aesthetic and layout structure.
- [ ] Confirm Lucide React (or equivalent project icon library) is available for visual enhancements.
- [ ] Verify current Navbar auth state logic (or lack thereof) to understand the baseline.

---

## 1) Navbar & Navigation Routing Logic

- [ ] Implement auth state detection in the Navbar component.
- [ ] Hide protected routes (Dashboard, Settings, Editor, Toolkit) from logged-out users.
- [ ] Hide public/auth routes (Pricing, Login, Signup) from logged-in users.
- [ ] Ensure side panel navigation links actually point to existing, implemented pages.

**Required evidence:**
- Description of auth state logic implemented.
- List of routes hidden/shown based on state.

---

## 2) Landing Page Truthfulness & Overhaul

- [ ] Remove all "lies" and exaggerated marketing claims.
- [ ] Remove the Pricing section entirely. State clearly that the platform is "Completely Free".
- [ ] Add a specific "Tech Stack & Open Source" section explaining the use of Vercel, Python, Cloudflare, and Next.js individually.
- [ ] Add a call-to-action explaining how people can contribute and expand the platform.

**Required evidence:**
- Confirmation of pricing removal.
- Screenshot or text excerpt of the new tech stack breakdown.

---

## 3) Sidebar & Missing Pages Implementation

- [ ] Audit the side panel for missing pages (e.g., links that go nowhere).
- [ ] Create missing pages.
- [ ] Ensure newly created pages match the Dashboard "vibe" (use cards, grids, appropriate spacing).
- [ ] Add relevant icons and visual flair to these pages; absolutely no "text-only" dumps.

**Required evidence:**
- List of new pages created.
- Description of visual elements used.

---

## 4) Docs Page Enhancement

- [ ] Fleshed out documentation content, specifically adding helpful info for API endpoints.
- [ ] Implement a "Sticky" side panel (ScrollSpy / Table of Contents) that highlights the active section as the user scrolls.
- [ ] Ensure code blocks and endpoint descriptions are styled beautifully.

**Required evidence:**
- Implementation details of the ScrollSpy sidebar.
- Confirmation of endpoint information addition.

---

## 5) Template Library Upgrade

- [ ] Review the existing `templates/page.tsx`.
- [ ] Add relevant icons to represent different template categories or individual templates.
- [ ] Ensure the grid/layout feels cohesive and visually appealing.

**Required evidence:**
- Icons added to the template library.

---

## 6) "Basic" Pages Elevation (Contribute, Privacy, Terms, Settings)

- [ ] Upgrade `contribute/page.tsx` from basic text to a styled, engaging page (possibly linking to the new Landing Page open-source section).
- [ ] Upgrade `privacy/page.tsx` and `terms/page.tsx` with proper typography, readable line lengths (prose), and subtle iconography.
- [ ] Upgrade `settings/page.tsx` to match the Dashboard's clean, card-based layout structure with icons for different setting categories.

**Required evidence:**
- Description of layout upgrades applied to these 4 pages.

---

## 7) Final Sign-Off Gate

- [ ] Navbar dynamically updates based on Auth state.
- [ ] No 404s in the side panel or navbar.
- [ ] Landing page is truthful, lists the tech stack, and has no pricing.
- [ ] Docs page has a working scroll-spy sidebar.
- [ ] All pages utilize icons and structural styling; no bare text walls exist.

## Appendix A: Task Report Template

Use this exact template per task:

```md
### Task: <name>

- Files changed:
  - `path/to/file1`
- Visuals Added/Upgraded:
  - <Description of icons/styling applied>
- Routing Logic:
  - <Description of auth gating or link fixes>
- Verification:
  - <How was this tested visually and functionally?>
```