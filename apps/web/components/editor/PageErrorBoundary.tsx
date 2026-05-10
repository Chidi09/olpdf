"use client";

import { Component, type ReactNode } from "react";
import { reportError } from "@/lib/errorReporting";

export class PageErrorBoundary extends Component<
  { children: ReactNode; pageIndex: number },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportError(error, { source: "canvas-page-boundary", extra: { pageIndex: this.props.pageIndex } });
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
