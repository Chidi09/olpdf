"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/components/providers/TenantProvider";
import { DEFAULT_BRAND } from "@/lib/branding";
import { useNavStore } from "@/store/useNavStore";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

// Outer shell handles the auth-route guard without calling any hooks after return.
export default function AppNavbar() {
  const pathname = usePathname();
  if (AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return null;
  }
  return <NavbarInner />;
}

function BrandWordmark({ visible }: { visible: boolean }) {
  return (
    <span
      className={`font-sans font-black tracking-tight text-xl text-[var(--text-primary)] transition-all duration-300 ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
      }`}
    >
      OL<span className="text-orange-500">PDF</span>
    </span>
  );
}

function NavbarInner() {
  const pathname = usePathname();
  const router = useRouter();
  const { scrolled, mobileMenuOpen, setScrolled, toggleMobileMenu, setMobileMenuOpen } = useNavStore();
  const { session, user, loading, signOut } = useAuth();
  const { branding } = useTenant();
  const [pastHero, setPastHero] = useState(false);
  const [nearFooter, setNearFooter] = useState(false);

  const isAuthenticated = !!session;
  const isLanding = pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      if (isLanding) {
        const heroH = window.innerHeight * 0.85;
        const docH = document.body.scrollHeight;
        setPastHero(y > heroH);
        setNearFooter(y > docH - window.innerHeight - 320);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLanding, setScrolled]);

  const showWordmark = !isLanding || (pastHero && !nearFooter);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[100] border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 backdrop-blur-md transition-all duration-300 ${
          scrolled ? "py-2 shadow-sm" : "py-4"
        }`}
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
              <div className="relative h-9 w-9 shrink-0 group-hover:scale-105 transition-transform duration-300">
                <Image
                  src={DEFAULT_BRAND.icon192}
                  alt={`${branding.name || "OLPDF"} Logo`}
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <BrandWordmark visible={showWordmark} />
            </Link>

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
                      {user?.email?.charAt(0).toUpperCase() ?? "U"}
                    </span>
                  )}
                </div>
              </div>
            ) : !loading ? (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button className="rounded-full px-6 font-bold text-sm hidden sm:flex bg-orange-500 hover:bg-orange-400 text-white transition-colors" aria-label="Sign In">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="rounded-full px-6 font-bold text-sm bg-orange-500 hover:bg-orange-400 text-white transition-colors" aria-label="Join Beta">
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
