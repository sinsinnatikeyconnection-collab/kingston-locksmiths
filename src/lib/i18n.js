// Global language store for the neural localization engine. Persists choice,
// auto-detects the browser locale on first visit, and notifies subscribers
// (LanguageSwitcher + I18nController) when the active language changes.

const LOCALE_MAP = [
  ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["pt", "Portuguese"],
  ["ar", "Arabic"], ["zh", "Chinese"], ["ru", "Russian"], ["vi", "Vietnamese"],
];

function detect() {
  try {
    const n = (navigator.language || "en").toLowerCase();
    const f = LOCALE_MAP.find(([p]) => n.startsWith(p));
    return f ? f[1] : null;
  } catch {
    return null;
  }
}

let language = "English";
try {
  const stored = localStorage.getItem("skc_lang");
  if (stored) language = stored;
  else {
    const d = detect();
    if (d) language = d;
  }
} catch {}

const listeners = new Set();
export function getLanguage() {
  return language;
}
export function setLanguage(l) {
  if (l === language) return;
  language = l;
  try { localStorage.setItem("skc_lang", l); } catch {}
  listeners.forEach((f) => f(l));
}
export function subscribe(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}