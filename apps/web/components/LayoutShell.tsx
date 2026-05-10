"use client";

import { usePathname } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];
const BARE_ROUTES = ["/embed"]; // rendered without navbar or padding

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const isBare = BARE_ROUTES.some((r) => pathname.startsWith(r));

  if (isBare) return <>{children}</>;

  return (
    <>
      <AppNavbar />
      <div className={isAuth ? undefined : "pt-14"}>{children}</div>
      <OfflineIndicator />
    </>
  );
}
