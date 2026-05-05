# OLPDF Plan Compliance Matrix

Date: 2026-05-05

## Part XI.7 Component Library (`packages/ui`)

| Component | Status | File |
|---|---|---|
| Button | Implemented | `packages/ui/components/Button.tsx` |
| Input / Textarea | Implemented | `packages/ui/components/Input.tsx` |
| Select | Implemented | `packages/ui/components/Select.tsx` |
| Card | Implemented | `packages/ui/components/Card.tsx` |
| Badge | Implemented | `packages/ui/components/Badge.tsx` |
| Toast | Implemented | `packages/ui/components/Toast.tsx` |
| Modal | Implemented | `packages/ui/components/Modal.tsx` |
| Drawer | Implemented | `packages/ui/components/Drawer.tsx` |
| Progress | Implemented | `packages/ui/components/Progress.tsx` |
| Tooltip | Implemented | `packages/ui/components/Tooltip.tsx` |
| ContextMenu | Implemented | `packages/ui/components/ContextMenu.tsx` |
| CommandPalette | Implemented | `packages/ui/components/CommandPalette.tsx` |
| DiffView | Implemented | `packages/ui/components/DiffView.tsx` |
| ConfidenceMeter | Implemented | `packages/ui/components/ConfidenceMeter.tsx` |
| PresenceChip | Implemented | `packages/ui/components/PresenceChip.tsx` |
| OfflineBadge | Implemented | `packages/ui/components/OfflineBadge.tsx` |
| PreflightPanel | Implemented | `packages/ui/components/PreflightPanel.tsx` |

## Part XI.3 Pages

| Page | Status | Files |
|---|---|---|
| Landing | Implemented (product landing/dashboard hybrid) | `apps/web/app/page.tsx` |
| Dashboard (`/dashboard`) | Missing (not a standalone route) | n/a |
| Document Editor (`/editor/[id]`) | Implemented | `apps/web/app/editor/[id]/page.tsx`, `apps/web/components/editor/DocumentWorkspace.tsx` |
| Book Maker (`/books/[id]`) | Implemented | `apps/web/app/books/[id]/page.tsx`, `apps/web/components/editor/BookWorkspace.tsx` |
| Templates (`/templates`) | Implemented | `apps/web/app/templates/page.tsx` |
| Toolkit (`/toolkit`) | Implemented | `apps/web/app/toolkit/page.tsx` |

## Dev Mock Layer

- Dev-only mock utility exists in `apps/web/lib/dev/mockBff.ts`.
- Mock routing is guarded in `apps/web/app/api/bff/_shared.ts` by:
  - `NODE_ENV !== "production"`
  - `OLPDF_DEV_MODE=true|1`
- Dynamic import is used to avoid production runtime activation.
