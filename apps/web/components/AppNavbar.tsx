"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Home, 
  LayoutDashboard, 
  LayoutTemplate, 
  Wrench, 
  FileText, 
  Users, 
  Shield, 
  Settings, 
  Menu, 
  X,
  LogIn,
  LogOut,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Metadata for navigation items
const navItems = [
  { href: "/", label: "Home", icon: Home, auth: 'public' },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, auth: 'required' },
  { href: "/templates", label: "Templates", icon: LayoutTemplate, auth: 'required' },
  { href: "/toolkit", label: "Toolkit", icon: Wrench, auth: 'required' },
  { href: "/docs", label: "Docs", icon: FileText, auth: 'always' },
  { href: "/contribute", label: "Contribute", icon: Users, auth: 'always' },
  { href: "/settings", label: "Settings", icon: Settings, auth: 'required' },
];

export default function AppNavbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Mock auth state - in a real app this would come from a useAuth hook
  // For now, we simulate being "logged in" if we are on a protected route 
  // or based on a simple toggle for demonstration purposes.
  // The user requested that we shouldn't see everything if not logged in.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    
    // Check if we are on a protected path to "simulate" auth for now
    const protectedPaths = ['/dashboard', '/templates', '/toolkit', '/settings', '/editor', '/books'];
    if (protectedPaths.some(path => pathname.startsWith(path))) {
      setIsAuthenticated(true);
    }

    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  const filteredItems = navItems.filter(item => {
    if (item.auth === 'always') return true;
    if (item.auth === 'required') return isAuthenticated;
    if (item.auth === 'public') return !isAuthenticated || pathname === '/';
    return true;
  });

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-[100] border-b transition-all duration-300 ${
        scrolled 
          ? "border-[var(--border-subtle)] bg-[var(--bg-base)]/90 backdrop-blur-md py-2" 
          : "border-transparent bg-transparent py-4"
      }`}>
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative h-10 w-10 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-300">
                <Image src="/logo.png" alt="OLPDF Logo" fill className="object-contain" />
              </div>
              {pathname !== "/" && (
                <span className="text-xl font-extrabold tracking-tighter text-[var(--text-primary)]">
                  OLPDF
                </span>
              )}
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
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                  <div className="h-2 w-2 rounded-full bg-[var(--status-ok)] animate-pulse" />
                  Live Sync
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full h-10 w-10 p-0 hover:bg-[var(--status-error)]/10 hover:text-[var(--status-error)]"
                  onClick={() => setIsAuthenticated(false)}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
                <div className="h-10 w-10 relative rounded-full overflow-hidden border-2 border-[var(--bg-base)] shadow-md cursor-pointer">
                  <Image src="/logo.png" alt="User Avatar" fill className="object-cover opacity-80" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="rounded-full px-6 font-bold text-sm hidden sm:flex" onClick={() => setIsAuthenticated(true)}>
                  Sign In
                </Button>
                <Button className="rounded-full px-6 bg-[var(--text-primary)] text-[var(--bg-base)] font-bold text-sm shadow-lg hover:shadow-xl transition-all" onClick={() => setIsAuthenticated(true)}>
                  Join Beta
                </Button>
              </div>
            )}
            
            <button 
              className="lg:hidden p-2 text-[var(--text-primary)]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
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
             {!isAuthenticated && (
               <Button className="h-14 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)] text-lg font-bold">
                 Get Started
               </Button>
             )}
          </div>
        </div>
      )}
    </>
  );
}
