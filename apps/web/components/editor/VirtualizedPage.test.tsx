import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VirtualizedPage } from "./VirtualizedPage";

class OffscreenIntersectionObserver {
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(_target: Element) {
    this.callback([{ isIntersecting: false } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }

  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

class ImmediateIntersectionObserver {
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }

  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

describe("VirtualizedPage", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", ImmediateIntersectionObserver);
  });

it("does not create canvas when page is offscreen", async () => {
  vi.stubGlobal("IntersectionObserver", OffscreenIntersectionObserver);
  const dim = { page_index: 0, width: 600, height: 800 };
  const onCanvasReady = vi.fn();
  const { container } = render(
    <VirtualizedPage dim={dim} scale={1} onCanvasReady={onCanvasReady} onCanvasDestroy={vi.fn()} />,
  );
  await vi.waitFor(() => expect(container.querySelector("canvas")).toBeNull());
  expect(onCanvasReady).not.toHaveBeenCalled();
});

  it("remounts the live canvas when scale changes", async () => {
    const dim = { page_index: 0, width: 600, height: 800 };
    const onCanvasReady = vi.fn();
    const onCanvasDestroy = vi.fn();
    const { container, rerender } = render(
      <VirtualizedPage dim={dim} scale={1} onCanvasReady={onCanvasReady} onCanvasDestroy={onCanvasDestroy} />,
    );

    await waitFor(() => expect(onCanvasReady).toHaveBeenCalledTimes(1));
    const firstCanvas = container.querySelector("canvas");

    rerender(<VirtualizedPage dim={dim} scale={0.5} onCanvasReady={onCanvasReady} onCanvasDestroy={onCanvasDestroy} />);

    await waitFor(() => expect(onCanvasReady).toHaveBeenCalledTimes(2));
    expect(container.querySelector("canvas")).not.toBe(firstCanvas);
  });
});
