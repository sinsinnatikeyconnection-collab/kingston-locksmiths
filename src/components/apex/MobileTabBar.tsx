import React from "react";
import { Home, Wrench, LayoutDashboard, Phone } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface Tab { to: string; label: string; icon: LucideIcon }

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/services", label: "Services", icon: Wrench },
  { to: "/portal", label: "Portal", icon: LayoutDashboard },
  { to: "/contact", label: "Contact", icon: Phone },
];

export default function MobileTabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-titanium/95 backdrop-blur-md border-t border-cyan/20"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                active ? "text-cyan" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}