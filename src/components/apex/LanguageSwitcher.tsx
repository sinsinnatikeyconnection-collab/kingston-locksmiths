import db from "@/api/base44Client";

import React, { useState, useEffect } from "react";
import { Globe, Loader2, Check } from "lucide-react";

import { getLanguage, setLanguage, subscribe } from "@/lib/i18n";

const LANGS: string[] = ["English", "Spanish", "French", "German", "Portuguese", "Arabic", "Chinese", "Russian", "Vietnamese"];
const cacheKey = "skc_i18n_";

type StringMap = Record<string, string>;

interface LanguageSwitcherProps {
  originalMap: StringMap;
  onTranslate: (map: StringMap, language: string) => void;
}

// Silent neural localization. A globe toggle switches the active language; the
// nav/CTA string map is translated here, and the global I18nController translates
// the rest of the page (data-i18n elements) via the shared i18n store.
export default function LanguageSwitcher({ originalMap, onTranslate }: LanguageSwitcherProps) {
  const [lang, setLang] = useState<string>(getLanguage());
  const [busy, setBusy] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribe((l: string) => setLang(l));
    return () => { unsub(); };
  }, []);

  const apply = async (language: string) => {
    setOpen(false);
    setLanguage(language); // notify the global I18nController
    if (language === "English") { onTranslate(originalMap, "English"); return; }
    setBusy(true);
    try {
      const cached = sessionStorage.getItem(cacheKey + language);
      let translations: StringMap;
      if (cached) {
        translations = JSON.parse(cached) as StringMap;
      } else {
        const r = await db.functions.invoke("translateContent", { language, strings: originalMap });
        translations = (r?.data?.translations as StringMap) || {};
        sessionStorage.setItem(cacheKey + language, JSON.stringify(translations));
      }
      const merged: StringMap = { ...originalMap };
      Object.keys(merged).forEach((k) => { if (translations[k]) merged[k] = translations[k]; });
      onTranslate(merged, language);
    } catch {
      setLang("English");
    } finally {
      setBusy(false);
    }
  };

  // silent auto-translate the nav map once for a detected non-English locale
  useEffect(() => {
    if (sessionStorage.getItem("skc_i18n_done")) return;
    const d = getLanguage();
    if (d && d !== "English") {
      sessionStorage.setItem("skc_i18n_done", "1");
      apply(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-cyan transition-colors"
        aria-label="Change language"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{lang === "English" ? "EN" : lang.slice(0, 3).toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-36 bg-titanium border border-cyan/30 py-1 shadow-lg">
          {LANGS.map((l) => (
            <button
              key={l}
              onClick={() => apply(l)}
              className="w-full flex items-center justify-between px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-cyan hover:bg-cyan/5"
            >
              {l === "English" ? "English" : l}
              {lang === l && <Check className="w-3 h-3 text-cyan" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}