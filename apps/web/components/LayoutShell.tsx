"use client";

import { usePathname } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import AppSidebar from "@/components/AppSidebar";
import { OfflineIndicator } from "@/components/OfflineIndicator";

// Pages that render with absolutely no chrome
const BARE_ROUTES = ["/embed"];

// Pages that render with no navbar and no sidebar (auth flow)
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

// Logged-in app shell — gets sidebar, no top navbar
const APP_ROUTES = [
  "/dashboard",
  "/favorites",
  "/analytics",
  "/editor",
  "/books",
  "/templates",
  "/toolkit",
  "/settings",
  "/help",
  "/profile",
];

function matchesPrefix(pathname: string, routes: string[]) {
  return routes.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (matchesPrefix(pathname, BARE_ROUTES)) {
    return <>{children}</>;
  }

  if (matchesPrefix(pathname, AUTH_ROUTES)) {
    return <>{children}</>;
  }

  if (matchesPrefix(pathname, APP_ROUTES)) {
    return (
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
        <OfflineIndicator />
      </div>
    );
  }

  // Public pages — landing, docs, etc.
  return (
    <>
      <AppNavbar />
      <div>{children}</div>
      <OfflineIndicator />
    </>
  );
}
