"use client";

import { usePathname } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  return (
    <>
      <AppNavbar />
      <div className={isAuth ? undefined : "pt-14"}>{children}</div>
      <OfflineIndicator />
    </>
  );
}
