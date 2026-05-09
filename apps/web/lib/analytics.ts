import posthog from "posthog-js";

export function trackEdit(action: string, properties?: Record<string, unknown>) {
  try {
    posthog.capture(`editor_${action}`, {
      $set_once: { first_edit: new Date().toISOString() },
      ...(properties || {}),
    });
  } catch {
    // Analytics is best-effort.
  }
}
