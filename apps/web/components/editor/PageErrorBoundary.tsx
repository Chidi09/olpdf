"use client";

import { Component, type ReactNode } from "react";

export class PageErrorBoundary extends Component<
  { children: ReactNode; pageIndex: number },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[FidelityCanvas] Page ${this.props.pageIndex} crashed:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center rounded bg-red-50 text-sm text-red-500">
          Page {this.props.pageIndex + 1} failed to render.
          <button onClick={() => this.setState({ hasError: false })} className="ml-2 underline">
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
