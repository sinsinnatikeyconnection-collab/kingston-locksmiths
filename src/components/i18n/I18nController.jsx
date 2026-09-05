import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getLanguage, subscribe } from "@/lib/i18n";

// DOM-driven full-page translation. Any element tagged data-i18n="<id>" gets its
// original English textContent captured once, sent to translateContent in one
// batch per language, and swapped to the translation. Restores original when
// switching back to English. Re-runs on every route change so newly mounted
// content is also translated.
const cacheKey = "skc_i18n_dom_";

export default function I18nController() {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const restoreAll = () => {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        if (el.dataset.i18nOriginal != null) el.textContent = el.dataset.i18nOriginal;
      });
    };

    const run = async (language) => {
      if (language === "English") { restoreAll(); return; }
      restoreAll();
      const els = Array.from(document.querySelectorAll("[data-i18n]"));
      if (els.length === 0) return;
      const strings = {};
      els.forEach((el) => {
        if (el.dataset.i18nOriginal == null) el.dataset.i18nOriginal = el.textContent.trim();
        if (!strings[el.dataset.i18n]) strings[el.dataset.i18n] = el.dataset.i18nOriginal;
      });
      let translations = null;
      const cached = sessionStorage.getItem(cacheKey + language);
      if (cached) {
        try { translations = JSON.parse(cached); } catch { translations = null; }
      }
      if (!translations) {
        try {
          const r = await base44.functions.invoke("translateContent", { language, strings });
          translations = r.data?.translations || {};
          sessionStorage.setItem(cacheKey + language, JSON.stringify(translations));
        } catch (e) {
          return;
        }
      }
      if (cancelled) return;
      els.forEach((el) => { if (translations[el.dataset.i18n]) el.textContent = translations[el.dataset.i18n]; });
    };

    run(getLanguage());
    const unsub = subscribe((l) => run(l));
    return () => { cancelled = true; unsub(); };
  }, [location.pathname]);

  return null;
}