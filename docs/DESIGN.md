# Design System: OLPDF
**Project ID:** 3306328096669837246

## 1. Visual Theme & Atmosphere
OLPDF's visual identity is **refined dark glass** — the aesthetic of a high-end creative tool, not a generic SaaS dashboard. Think Figma meets a premium text editor. The interface recedes so the document is the star.
- Deep near-black backgrounds with translucent glass panels (`backdrop-filter: blur`)
- Warm amber/gold accent as the single action colour — signals intelligence, craft, warmth
- Generous negative space — the editor feels like a focused workspace, not a toolbar nightmare
- Typography that earns its place: a refined serif for document content, a technical mono for system UI

## 2. Color Palette & Roles
*   **Base Background (Deep Space):** `#0c0c0f` — The absolute foundation page background.
*   **Surface Background (Dark Charcoal):** `#141418` — Used for solid panels and card surfaces.
*   **Elevated Background (Obsidian):** `#1c1c22` — Used for floating panels and modals.
*   **Glass Panel (Translucent Obsidian):** `rgba(28, 28, 34, 0.72)` — Frosted glass panels for a layered depth effect.
*   **Primary Text (Warm Near-White):** `#f0ede8` — Used for primary readable text to reduce eye strain.
*   **Secondary Text (Muted Slate):** `#8a8790` — Used for secondary labels and less important text.
*   **Primary Accent (Warm Gold):** `#e8a84a` — The single primary action colour.
*   **Review Status (Amber):** `#e8834a` — Used to indicate blocks that need human review.
*   **Confirmed Status (Teal):** `#4aae8a` — Used to indicate correct operations or success states.
*   **Error Status (Red):** `#e85a4a` — Used to indicate failure or destructive actions.

## 3. Typography Rules
*   **Display Font:** `'Playfair Display', Georgia, serif` — Used for headings, brand identity, and book titles. High contrast, elegant. (Weight: 700)
*   **Body Font:** `'Lora', Georgia, serif` — Used for the actual document content inside the editor. Highly readable.
*   **UI Font:** `'DM Sans', system-ui, sans-serif` — Used for all technical UI, nav menus, labels, and buttons. Clean, utilitarian.
*   **Mono Font:** `'JetBrains Mono', monospace` — Used for code blocks, metadata, and confidence scores.

## 4. Component Stylings
*   **Cards/Panels:** Subtly rounded corners (`10px` to `16px` radius). Often feature a frosted glass effect with a subtle top inner-border (`rgba(255, 255, 255, 0.06)`) to catch the light. Shadows are deep and diffused to create elevation over the `#0c0c0f` background.
*   **Buttons:** Primary buttons use the Warm Gold accent. Hover states slightly lift the button (`translateY(-1px)`) and increase brightness. Click states scale down slightly (`0.97`).
*   **Interactive Elements:** Hovering over a block in the editor reveals a drag handle on the left and a block type badge on the top right. Selecting a block adds a 3px solid Warm Gold left border.

## 5. Layout Principles
*   **Structure:** Workspaces use a multi-panel layout (e.g., Left Sidebar, Main Canvas, Right Inspector).
*   **Canvas:** The document canvas sits in the center, styled like a physical sheet of paper (`#fefefe`) with a soft drop shadow, contrasting against the dark UI.
*   **Animation:** Micro-interactions use smooth spring curves. Tool panels slide in smoothly, and AI diff views slide up from the bottom. Staggered reveals (`40ms` increments) are used for list items.
