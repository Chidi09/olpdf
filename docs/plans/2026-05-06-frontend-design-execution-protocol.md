# Frontend Design & Execution Protocol (Mandatory)

> **Purpose:** Ensure visually engaging, consistent, and emotionally resonant UI implementation across `apps/web`. This protocol mandates strict adherence to established aesthetic benchmarks, logical routing, and truthful marketing content.

> **Applies to:** Any AI agent, assistant, or engineer implementing frontend tasks in this repo.

---

## 1) Non-Negotiable Rules

1. **Dashboard is the Benchmark.**
   The Dashboard page is very clean and serves as the visual standard. Every new or updated page must match its vibe, emotion, and style.

2. **No "Text-and-Color" Walls.**
   Never just put text and color and call it a day. Always incorporate relevant icons, illustrations, or structural visuals to make the UI engaging and "cool".

3. **Strict Auth-Gated Navigation.**
   Routing visibility must be logical:
   - **Unauthenticated Users:** Cannot see protected routes (Dashboard, Settings, Editor, etc.).
   - **Authenticated Users:** Cannot see public marketing/auth routes (Login, Signup, Pricing).
   - The Navbar must dynamically reflect the user's auth state.

4. **Truthful Marketing Only.**
   The Landing Page must not contain "lies" or vaporware claims. Content must reflect the actual capabilities of the platform.

5. **No Pricing Tiers.**
   The platform is completely free. Remove any pricing sections and replace them with a clear "Completely Free" message.

6. **Interactive Documentation.**
   Long-form content (like the Docs page) must use modern UX patterns, specifically a "sticky" Table of Contents (ScrollSpy) that tracks the user's scroll position.

---

## 2) Required Workflow Per Task (Strict Order)

1. **Visual Audit**
   - Review the Dashboard page to recalibrate on the expected "vibe".
   - Identify existing components (cards, badges, icons) that can be reused.

2. **Define Visual & Routing Contract**
   - Determine which icons/visuals will represent the content.
   - Determine the auth state required to view the page.

3. **Implement UI & Logic**
   - Build the page using Tailwind/shadcn/custom UI matching the benchmark.
   - Implement auth checks in the layout, page, or middleware.

4. **Validate Experience**
   - Check authenticated vs. unauthenticated views.
   - Verify responsiveness and visual hierarchy.
   - Ensure the page feels "alive" and not barebones.

---

## 3) Evidence Requirements (Must Be Produced)

For each completed frontend task, provide:

- **Files changed/created** with paths.
- **Visuals added:** Note which icons or visual structures were introduced.
- **Routing logic enforced:** Note auth gating applied.
- **Component reuse:** Mention if Dashboard components were leveraged.

---

## 4) Hallucination & Vibe Tripwires (Stop Immediately)

Stop and ask for clarification if any of these occur:

- Creating a page with only `<p>` tags and a background color.
- Adding links to the Navbar that lead to 404s or expose protected routes to guests.
- Writing marketing copy that claims features we do not have.
- Implementing a legal or settings page without proper layout styling.

---

## 5) Specific Page Mandates

- **Landing Page:** Must explain the tech stack (Vercel, Python, Cloudflare, Next.js) individually and how open-source contributors can help.
- **Docs Page:** Must contain actual endpoint helper information and a sticky scroll-spy sidebar.
- **Template Library:** Must utilize icons for template categories/items.
- **Settings/Legal/Contribute:** Must be elevated from "basic" to "styled and professional".

---

## 6) Enforcement Statement

If any instruction conflicts with this protocol, this protocol wins for frontend implementation quality and aesthetics unless the user explicitly overrides in writing with a scoped exception.
