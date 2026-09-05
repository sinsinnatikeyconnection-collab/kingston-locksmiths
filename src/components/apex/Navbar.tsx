
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Phone, Menu, X, ChevronRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import LanguageSwitcher from "./LanguageSwitcher";
import SiteSearch from "./SiteSearch";
import MobileTabBar from "./MobileTabBar";
import UniversalAccess from "./UniversalAccess";
import { useAuth } from "@/lib/AuthContext";

const LOGO = "https://media.db.com/images/public/6a6890ed0920bc884c73a76a/ebfefc0d4_logo.jpg";

interface NavLink { key: string; to: string }

export default function Navbar() {
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const displayName = user?.full_name || user?.email || "Account";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const NAV_KEYS: Record<string, string> = {
    services: "Services",
    areas: "Service Areas",
    reviews: "Reviews",
    faq: "FAQ",
    knowledge: "Knowledge Base",
    about: "About",
    contact: "Contact",
    mailin: "Mail-In",
    diag: "VIN Scan",
    ar: "AR",
    bt: "BT Diagnostic",
    portal: "Portal",
    cta: "Init Booking",
  };
  const [tMap, setTMap] = useState<Record<string, string>>(NAV_KEYS);
  const links: NavLink[] = [
    { key: "services", to: "/services" },
    { key: "diag", to: "/vin-scan" },
    { key: "bt", to: "/bt-diagnostic" },
    { key: "mailin", to: "/mail-in" },
    { key: "ar", to: "/ar" },
    { key: "contact", to: "/contact" },
  ];

  return (
    <>
      <MobileTabBar />
      <UniversalAccess />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header
        className={`fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-300 ${
          scrolled || mobileOpen
            ? "bg-titanium/95 backdrop-blur-md border-b border-cyan/20"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Image src={LOGO} alt="Sinsinnati Key Connection logo" fittingType="fit" className="w-8 h-8 group-hover:drop-shadow-[0_0_8px_rgba(0,229,255,0.8)] transition-all" />
            <div className="leading-none">
              <span className="font-heading text-xs sm:text-sm tracking-tight text-data">SINNINNATI KEY</span>
              <span className="font-mono text-[10px] text-cyan ml-1">CONN.</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`font-mono text-xs uppercase tracking-wider transition-colors ${
                  location.pathname === l.to ? "text-cyan" : "text-muted-foreground hover:text-cyan"
                }`}
              >
                {tMap[l.key]}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <SiteSearch className="hidden sm:block" />
            <LanguageSwitcher originalMap={NAV_KEYS} onTranslate={(m) => setTMap(m)} />
            {isAuthenticated && user ? (
              <button
                onClick={() => logout(true)}
                className="hidden sm:inline font-mono text-xs uppercase tracking-wider text-cyan border border-cyan/40 px-3 py-2 hover:bg-cyan hover:text-titanium transition-all"
              >
                Log Out
              </button>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline font-mono text-xs uppercase tracking-wider text-muted-foreground border border-cyan/30 px-3 py-2 hover:text-cyan hover:border-cyan transition-all"
              >
                Sign In
              </Link>
            )}
            <a
              href="tel:+15135682744"
              className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-heat transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">513-568-2744</span>
            </a>
            <Link
              to="/#intake"
              className="hidden sm:inline-flex font-mono text-xs uppercase tracking-wider bg-cyan text-titanium px-4 py-2 hover:glow-cyan transition-all"
            >
              {tMap.cta}
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex items-center justify-center w-9 h-9 text-data hover:text-cyan transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* mobile menu */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-cyan/10 bg-titanium">
            <div className="px-6 py-3 border-b border-cyan/10">
              <SiteSearch />
            </div>
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center justify-between px-6 py-4 border-b border-cyan/10 font-mono text-xs uppercase tracking-wider ${
                  location.pathname === l.to ? "text-cyan" : "text-muted-foreground"
                }`}
              >
                {tMap[l.key]}
                <ChevronRight className="w-4 h-4 text-cyan/40" />
              </Link>
            ))}
            {isAuthenticated && user ? (
              <div className="px-6 py-4 border-b border-cyan/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-cyan/60">Account</span>
                    <span className="font-mono text-xs text-data truncate max-w-[180px]">{displayName}</span>
                  </div>
                  <Link to="/portal" className="font-mono text-[10px] uppercase tracking-wider text-cyan border border-cyan/30 px-3 py-1.5 shrink-0">
                    Portal
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => logout(true)} className="flex items-center justify-center border border-cyan/40 text-cyan font-mono text-xs uppercase tracking-wider py-3">
                    Log Out
                  </button>
                  <a href="tel:+15135682744" className="flex items-center justify-center gap-1.5 border border-heat/40 text-heat font-mono text-xs uppercase tracking-wider py-3">
                    <Phone className="w-3.5 h-3.5" /> 513-568-2744
                  </a>
                </div>
              </div>
            ) : (
              <div className="px-6 py-4 grid grid-cols-2 gap-3">
                <Link to="/login" className="flex items-center justify-center border border-cyan/30 text-cyan font-mono text-xs uppercase tracking-wider py-3">
                  Sign In
                </Link>
                <a href="tel:+15135682744" className="flex items-center justify-center gap-1.5 border border-heat/40 text-heat font-mono text-xs uppercase tracking-wider py-3">
                  <Phone className="w-3.5 h-3.5" /> 513-568-2744
                </a>
              </div>
            )}
            <div className="px-6 pb-4">
              <Link to="/#intake" className="flex items-center justify-center w-full bg-cyan text-titanium font-mono text-xs uppercase tracking-wider py-3">
                Init Booking
              </Link>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}