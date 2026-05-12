"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileEdit,
  BookOpen,
  LayoutTemplate,
  Wrench,
  Settings,
  TerminalSquare,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_BRAND } from "@/lib/branding";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/editor",    label: "Editor",    icon: FileEdit },
  { href: "/books",     label: "Books",     icon: BookOpen },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/toolkit",   label: "Toolkit",   icon: Wrench },
  { href: "/settings",  label: "Settings",  icon: Settings },
  { href: "/settings/developer", label: "Developer", icon: TerminalSquare },
  { href: "/help",      label: "Help",      icon: HelpCircle },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();

  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("sidebar_expanded");
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar_expanded", String(expanded));
  }, [expanded]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <aside
      className={`relative z-20 flex h-screen shrink-0 flex-col border-r border-white/[0.08] bg-black/40 backdrop-blur-2xl transition-all duration-200 ${
        expanded ? "w-56" : "w-[64px]"
      }`}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 transition-colors hover:bg-white/[0.05]"
      >
        <div className="relative h-8 w-8 shrink-0">
          <Image src={DEFAULT_BRAND.icon192} alt="OLPDF Logo" fill className="object-contain" priority />
        </div>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto p-2 pt-3">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? "border border-white/[0.05] bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                  : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {expanded && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + sign-out */}
      <div className="shrink-0 border-t border-white/[0.08] p-2">
        <button
          onClick={handleSignOut}
          title={!expanded ? "Sign Out" : undefined}
          className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--status-error)]/10 hover:text-[var(--status-error)] transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {expanded && <span className="truncate">Sign Out</span>}
        </button>
        {expanded && user?.email && (
          <p className="text-[10px] font-mono text-[var(--text-tertiary)] truncate px-3 pb-1">
            {user.email}
          </p>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.10] bg-black/60 text-[var(--text-tertiary)] shadow-sm backdrop-blur-md transition-colors hover:text-[var(--text-primary)]"
      >
        {expanded ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
    </aside>
  );
}
