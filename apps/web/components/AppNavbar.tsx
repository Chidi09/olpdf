"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutTemplate,
  HelpCircle,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/components/providers/TenantProvider";
import { DEFAULT_BRAND } from "@/lib/branding";
import { useNavStore } from "@/store/useNavStore";

// AppNavbar is only rendered on public pages (landing, docs, etc.)
// Logged-in app routes use AppSidebar instead — no overlap.
const navItems = [
  { href: "/templates", label: "Templates", icon: LayoutTemplate, auth: "always" },
  { href: "/help",      label: "Help",       icon: HelpCircle,     auth: "always" },
];

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export default function AppNavbar() {
  const pathname = usePathname();

  if (AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return null;
  }

  const router = useRouter();
  const { scrolled, mobileMenuOpen, setScrolled, toggleMobileMenu, setMobileMenuOpen } = useNavStore();
  const { session, user, loading, signOut } = useAuth();
  const { branding, isLoading: tenantLoading } = useTenant();

  const isAuthenticated = !!session;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [setScrolled]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const filteredItems = navItems.filter((item) => {
    if (item.auth === "always") return true;
    if (item.auth === "required") return isAuthenticated;
    if (item.auth === "public") return !isAuthenticated || pathname === "/";
    return true;
  });

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[100] border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 backdrop-blur-md transition-all duration-300 ${
          scrolled ? "py-2 shadow-sm" : "py-4"
        }`}
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-3 group">
              <div className="relative h-9 w-9 sm:h-10 sm:w-10 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <Image src={DEFAULT_BRAND.icon192} alt={`${branding.name || "OLPDF"} Logo`} fill className="object-contain" priority />
              </div>
              <span className="hidden sm:inline-flex items-baseline">
                <span className="font-sans font-black tracking-tighter text-orange-500 text-xl">O</span>
                <span className="font-serif font-light text-[var(--text-primary)] -ml-0.5 mr-0.5 text-xl">L</span>
                <span className="bg-[#e21818] text-white px-1.5 py-0.5 rounded-md inline-flex items-baseline relative">
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-md pointer-events-none" />
                  <span className="font-mono font-bold text-base opacity-90 relative z-10">P</span>
                  <span className="font-serif font-black text-base -ml-0.5 relative z-10">D</span>
                  <span className="font-sans font-thin italic text-base ml-0.5 relative z-10">F</span>
                </span>
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 text-sm font-bold">
              {filteredItems.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 transition-all ${
                      active
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "opacity-100" : "opacity-60"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {!loading && isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                  <div className="h-2 w-2 rounded-full bg-[var(--status-ok)] animate-pulse" />
                  Live Sync
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-10 w-10 p-0 hover:bg-[var(--status-error)]/10 hover:text-[var(--status-error)]"
                  onClick={handleSignOut}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </Button>
                <div
                  className="h-10 w-10 relative rounded-full overflow-hidden border-2 border-[var(--bg-base)] shadow-md cursor-pointer bg-[var(--bg-elevated)] flex items-center justify-center"
                  role="button"
                  tabIndex={0}
                  aria-label="User Profile"
                >
                  {user?.user_metadata?.avatar_url ? (
                    <Image src={user.user_metadata.avatar_url} alt="User Avatar" fill className="object-cover opacity-80" />
                  ) : (
                    <span className="font-bold text-[var(--text-primary)]">
                      {user?.email?.charAt(0).toUpperCase() || "U"}
                    </span>
                  )}
                </div>
              </div>
            ) : !loading ? (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" className="rounded-full px-6 font-bold text-sm hidden sm:flex" aria-label="Sign In">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="rounded-full px-6 bg-[var(--text-primary)] text-[var(--bg-base)] font-bold text-sm shadow-lg hover:shadow-xl transition-all" aria-label="Join Beta">
                    Join Beta
                  </Button>
                </Link>
              </div>
            ) : null}

            <button
              className="lg:hidden p-2 text-[var(--text-primary)]"
              onClick={toggleMobileMenu}
              aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[90] bg-[var(--bg-base)] lg:hidden animate-fadeIn">
          <div className="flex flex-col p-8 pt-24 gap-6">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-4 text-2xl font-bold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                >
                  <div className="h-12 w-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center">
                    <Icon className="h-6 w-6" />
                  </div>
                  {item.label}
                </Link>
              );
            })}
            <hr className="border-[var(--border-subtle)]" />
            {!isAuthenticated && !loading && (
              <Link href="/signup" className="w-full">
                <Button className="w-full h-14 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)] text-lg font-bold">
                  Get Started
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
