import React from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import SecureCheckoutBadge from "@/components/apex/SecureCheckoutBadge";

const TICKER: string[] = [
  "KEY_GEN_SUCCESSFUL: 2025 BMW M4",
  "IMMO_BYPASS_COMPLETE: 2024 FORD F150 LIGHTNING",
  "ECU_REMAP_DONE: 2023 AUDI RS5",
  "CAN_BUS_REPAIRED: 2022 HONDA CIVIC TYPE-R",
  "ENGINE_SWAP_COMPLETE: 2024 DODGE CHARGER HELLCAT",
  "SRS_MODULE_RESET: 2024 TESLA MODEL 3",
  "ADAS_CALIBRATED: 2025 TOYOTA RAV4",
  "TRANSPONDER_MATCH: 2023 CHEVY SILVERADO",
  "EEPROM_FLASH_OK: 2021 DODGE DURANGO",
  "BCM_CLONE_DONE: 2024 JEEP GRAND CHEROKEE",
  "EV_PACK_RECELL: 2025 FORD MACH-E",
  "HUD_RECALIBRATED: 2026 RAM 1500",
];

export default function Footer() {
  return (
    <footer className="relative bg-titanium border-t border-cyan/10 overflow-hidden">
      {/* map / signal pulse */}
      <div className="relative h-56 border-b border-cyan/10 circuit-grid overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <MapPin className="w-10 h-10 text-cyan relative z-10 drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-10 h-10 border border-cyan rounded-full animate-pulse-ring" />
            </span>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-10 h-10 border border-cyan rounded-full animate-pulse-ring" style={{ animationDelay: "1.2s" }} />
            </span>
          </div>
        </div>
        <div className="absolute bottom-4 left-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          CINCINNATI, OH — SINNINNATI KEY CONNECTION
        </div>
        <div className="absolute bottom-4 right-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          24/7 DISPATCH
        </div>
      </div>

      {/* ticker tape */}
      <div className="border-b border-cyan/10 bg-blueprint/40 py-3 overflow-hidden">
        <div className="flex gap-12 animate-ticker whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="text-cyan">▸</span>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* main footer */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14">
        <div className="grid md:grid-cols-3 gap-10 mb-12">
          <div>
            <div className="font-heading text-2xl uppercase text-data mb-1 leading-tight">
              Sinsinnati Key
            </div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-3">
              a.k.a Kingston&rsquo;s Locksmiths
            </div>
            <p data-i18n="footer_about" className="font-body text-sm text-muted-foreground leading-relaxed max-w-xs mb-5">
              Total vehicle domination. From lost keys and fried computers to
              blown engines and custom tuning.
            </p>
            <div className="space-y-2">
              <a href="tel:+15135682744" className="block font-mono text-xs text-data hover:text-cyan transition-colors">
                <span className="text-cyan/60">▸</span> 513-568-2744
              </a>
              <a href="tel:+18125715765" className="block font-mono text-xs text-data hover:text-cyan transition-colors">
                <span className="text-cyan/60">▸</span> 812-571-5765
              </a>
              <a href="mailto:tcincy23@gmail.com" className="block font-mono text-xs text-muted-foreground hover:text-cyan transition-colors break-all">
                <span className="text-cyan/60">▸</span> tcincy23@gmail.com
              </a>
              <a href="mailto:sinsinnatikeyconnection@gmail.com" className="block font-mono text-xs text-muted-foreground hover:text-cyan transition-colors break-all">
                <span className="text-cyan/60">▸</span> sinsinnatikeyconnection@gmail.com
              </a>
            </div>
          </div>

          <div>
            <div data-i18n="footer_services_h" className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-4">
              // Services
            </div>
            <ul className="space-y-2 font-mono text-xs text-muted-foreground">
              <li>Lost Car Keys & Key Cutting</li>
              <li>Transponder & Smart Key Programming</li>
              <li>Immobilizer Bypass & Anti-Theft Reset</li>
              <li>ECU / BCM Cloning & Virginizing</li>
              <li>EEPROM & MCU Programming</li>
              <li>Ignition Repair & Car Lockout</li>
              <li>Electrical & Module Architecture</li>
              <li>Performance Tuning & Calibration</li>
              <li>Mechanical Teardowns & Repair</li>
            </ul>
          </div>

          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-4">
              // Dispatch
            </div>
            <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-xs mb-5">
              24/7 emergency mobile service & lockout dispatch across Greater Cincinnati.
            </p>
            <Link
              to="/#intake"
              className="inline-flex items-center justify-center w-full bg-cyan text-titanium font-mono text-sm uppercase tracking-wider px-6 py-3.5 hover:glow-cyan transition-all"
            >
              <span data-i18n="footer_cta">Book a Service</span>
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <SecureCheckoutBadge />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-cyan/10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            © {new Date().getFullYear()} SINNINNATI KEY CONNECTION / KINGSTON&rsquo;S LOCKSMITHS // ALL SYSTEMS RESERVED
          </div>
          <div className="flex gap-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
            <Link to="/#top" data-i18n="footer_l_top" className="hover:text-cyan transition-colors">Top</Link>
            <Link to="/#pillars" data-i18n="footer_l_pillars" className="hover:text-cyan transition-colors">Pillars</Link>
            <Link to="/#proof" data-i18n="footer_l_proof" className="hover:text-cyan transition-colors">Proof</Link>
            <Link to="/#intake" data-i18n="footer_l_booking" className="hover:text-cyan transition-colors">Booking</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}